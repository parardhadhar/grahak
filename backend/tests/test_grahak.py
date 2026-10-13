"""
Grahak Test Suite
Tests authentication, tenant isolation, contacts, messages, AI, reminders, webhooks.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.main import app
from app.db.database import get_db
from app.models.models import Base, Business, User, Contact, Message
from app.core.security import hash_password


# ── TEST DATABASE SETUP ────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///./test_grahak.db"

test_engine = create_async_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestSessionLocal = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="function", autouse=True)
async def setup_db(monkeypatch):
    # Integration tests never send customer text or credentials to external AI.
    from app.services.ai.ai_service import ai_service
    async def offline_analysis(**kwargs):
        return None
    monkeypatch.setattr(ai_service, "analyze_message", offline_analysis)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


# ── HELPERS ────────────────────────────────────────────────────────

async def create_test_user(client, email="test@example.com", password="testpass123", business_name="Test Studio"):
    resp = await client.post("/api/v1/auth/signup", json={
        "email": email,
        "password": password,
        "full_name": "Test Owner",
        "business_name": business_name,
    })
    return resp.json()


async def get_auth_headers(client, email="test@example.com", password="testpass123"):
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ── AUTH TESTS ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_signup_creates_user_and_business(client):
    resp = await client.post("/api/v1/auth/signup", json={
        "email": "owner@photo.com",
        "password": "securepass123",
        "full_name": "Parardha",
        "business_name": "Nexus Photography",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["full_name"] == "Parardha"
    assert "business_id" in data


@pytest.mark.asyncio
async def test_duplicate_email_rejected(client):
    await create_test_user(client)
    resp = await client.post("/api/v1/auth/signup", json={
        "email": "test@example.com",
        "password": "anotherpass123",
        "full_name": "Someone Else",
        "business_name": "Another Business",
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_login_success(client):
    await create_test_user(client)
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    await create_test_user(client)
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_requires_auth(client):
    resp = await client.get("/api/v1/contacts")
    assert resp.status_code == 403  # No auth header


@pytest.mark.asyncio
async def test_get_me(client):
    await create_test_user(client)
    headers = await get_auth_headers(client)
    resp = await client.get("/api/v1/auth/me", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"


# ── TENANT ISOLATION TESTS ─────────────────────────────────────────

@pytest.mark.asyncio
async def test_tenant_isolation_contacts(client):
    """Business A cannot see Business B's contacts."""
    # Create business A
    await create_test_user(client, "business_a@test.com", "pass123456", "Business A")
    headers_a = await get_auth_headers(client, "business_a@test.com", "pass123456")

    # Create business B
    await create_test_user(client, "business_b@test.com", "pass123456", "Business B")
    headers_b = await get_auth_headers(client, "business_b@test.com", "pass123456")

    # Business A creates a contact
    resp = await client.post("/api/v1/contacts", json={
        "whatsapp_number": "9999999999",
        "display_name": "Rahul",
    }, headers=headers_a)
    assert resp.status_code == 201
    contact_id = resp.json()["id"]

    # Business B should NOT be able to access this contact
    resp = await client.get(f"/api/v1/contacts/{contact_id}", headers=headers_b)
    assert resp.status_code == 404


# ── CONTACT TESTS ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_contact(client):
    await create_test_user(client)
    headers = await get_auth_headers(client)
    resp = await client.post("/api/v1/contacts", json={
        "whatsapp_number": "9876543210",
        "display_name": "Priya",
    }, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["display_name"] == "Priya"
    assert data["whatsapp_number"] == "9876543210"
    assert data["status"] == "new_lead"


@pytest.mark.asyncio
async def test_duplicate_contact_rejected(client):
    await create_test_user(client)
    headers = await get_auth_headers(client)
    contact_data = {"whatsapp_number": "9876543210", "display_name": "Rahul"}
    await client.post("/api/v1/contacts", json=contact_data, headers=headers)
    resp = await client.post("/api/v1/contacts", json=contact_data, headers=headers)
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_list_contacts(client):
    await create_test_user(client)
    headers = await get_auth_headers(client)
    await client.post("/api/v1/contacts", json={"whatsapp_number": "111", "display_name": "A"}, headers=headers)
    await client.post("/api/v1/contacts", json={"whatsapp_number": "222", "display_name": "B"}, headers=headers)
    resp = await client.get("/api/v1/contacts", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["total"] == 2


# ── DEV SIMULATOR TESTS ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_simulate_message_creates_contact(client):
    await create_test_user(client)
    headers = await get_auth_headers(client)
    resp = await client.post("/api/v1/dev/simulate-message", json={
        "customer_name": "Rahul",
        "phone": "9999999999",
        "message": "Bhai wedding photography ka package kitne ka hai?",
    }, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["contact_id"]

    # Contact should now exist
    contact_resp = await client.get(f"/api/v1/contacts/{data['contact_id']}", headers=headers)
    assert contact_resp.status_code == 200
    assert contact_resp.json()["whatsapp_number"] == "919999999999"


@pytest.mark.asyncio
async def test_second_message_updates_same_contact(client):
    """Same phone number should update existing contact, not create a duplicate."""
    await create_test_user(client)
    headers = await get_auth_headers(client)

    resp1 = await client.post("/api/v1/dev/simulate-message", json={
        "customer_name": "Rahul",
        "phone": "9999999999",
        "message": "Hello, interested in photography",
    }, headers=headers)
    contact_id_1 = resp1.json()["contact_id"]

    resp2 = await client.post("/api/v1/dev/simulate-message", json={
        "customer_name": "Rahul",
        "phone": "9999999999",
        "message": "What is the price?",
    }, headers=headers)
    contact_id_2 = resp2.json()["contact_id"]

    assert contact_id_1 == contact_id_2  # Same contact


# ── REMINDER TESTS ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_and_complete_reminder(client):
    from datetime import datetime, timezone, timedelta
    await create_test_user(client)
    headers = await get_auth_headers(client)

    # Create contact
    contact_resp = await client.post("/api/v1/contacts", json={
        "whatsapp_number": "9876543210",
        "display_name": "Rahul",
    }, headers=headers)
    contact_id = contact_resp.json()["id"]

    # Create reminder
    due = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    reminder_resp = await client.post("/api/v1/reminders", json={
        "contact_id": contact_id,
        "due_at": due,
        "note": "Follow up about quotation",
    }, headers=headers)
    assert reminder_resp.status_code == 201
    reminder_id = reminder_resp.json()["id"]

    # Complete reminder
    complete_resp = await client.post(f"/api/v1/reminders/{reminder_id}/complete", headers=headers)
    assert complete_resp.status_code == 200

    # List reminders — should be done now
    list_resp = await client.get("/api/v1/reminders?status=done", headers=headers)
    assert any(r["id"] == reminder_id for r in list_resp.json())


# ── WEBHOOK TESTS ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_webhook_verification(client):
    from app.core.config import settings
    resp = await client.get("/api/v1/webhook", params={
        "hub.mode": "subscribe",
        "hub.verify_token": settings.WHATSAPP_VERIFY_TOKEN,
        "hub.challenge": "test123",
    })
    assert resp.status_code == 200
    assert resp.text == "test123"


@pytest.mark.asyncio
async def test_webhook_invalid_token(client):
    resp = await client.get("/api/v1/webhook", params={
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "test123",
    })
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_seed_data(client):
    await create_test_user(client)
    headers = await get_auth_headers(client)
    response = await client.post('/api/v1/dev/seed', headers=headers)
    assert response.status_code == 200
    contacts = (await client.get('/api/v1/contacts', headers=headers)).json()
    assert contacts['total'] == 5


@pytest.mark.asyncio
async def test_failed_send_does_not_create_message(client, monkeypatch):
    from app.services.whatsapp.whatsapp_client import whatsapp_client
    async def fail_send(*args):
        raise RuntimeError('Disconnected')
    monkeypatch.setattr(whatsapp_client, 'send_text_message', fail_send)
    await create_test_user(client)
    headers = await get_auth_headers(client)
    contact = (await client.post('/api/v1/contacts', json={'whatsapp_number': '919876543210'}, headers=headers)).json()
    response = await client.post(f"/api/v1/contacts/{contact['id']}/messages", json={'message': 'Test reply'}, headers=headers)
    assert response.status_code == 503
    assert (await client.get(f"/api/v1/contacts/{contact['id']}/messages", headers=headers)).json() == []


@pytest.mark.asyncio
async def test_bridge_requires_credentials_and_correct_business(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'WHATSAPP_BRIDGE_TOKEN', 'test-bridge-token')
    account = await create_test_user(client)
    monkeypatch.setattr(settings, 'WHATSAPP_BRIDGE_BUSINESS_ID', account['business_id'])
    payload = {'business_id': 'wrong-business', 'whatsapp_number': '919876543210', 'message_body': 'Hello'}
    assert (await client.post('/api/v1/webhook/bridge', json=payload)).status_code == 403
    assert (await client.post('/api/v1/webhook/bridge', json=payload, headers={'Authorization': 'Bearer test-bridge-token'})).status_code == 403


@pytest.mark.asyncio
async def test_bridge_duplicate_is_saved_once(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'WHATSAPP_BRIDGE_TOKEN', 'test-bridge-token')
    account = await create_test_user(client)
    monkeypatch.setattr(settings, 'WHATSAPP_BRIDGE_BUSINESS_ID', account['business_id'])
    payload = {'business_id': account['business_id'], 'whatsapp_number': '919876543210', 'message_body': 'Hello', 'whatsapp_message_id': 'unique-test-message'}
    headers = {'Authorization': 'Bearer test-bridge-token'}
    first = await client.post('/api/v1/webhook/bridge', json=payload, headers=headers)
    second = await client.post('/api/v1/webhook/bridge', json=payload, headers=headers)
    assert first.status_code == second.status_code == 200
    assert first.json()['result']['message_id'] == second.json()['result']['message_id']
    assert second.json()['result']['duplicate'] is True


@pytest.mark.asyncio
async def test_bridge_management_is_tenant_scoped(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'WHATSAPP_BRIDGE_BUSINESS_ID', 'other-business')
    await create_test_user(client)
    headers = await get_auth_headers(client)
    status = await client.get('/api/v1/business/whatsapp/status', headers=headers)
    assert status.json()['available'] is False
    assert (await client.post('/api/v1/business/whatsapp/disconnect', headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_bridge_preserves_timestamp_and_international_phone(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'WHATSAPP_BRIDGE_TOKEN', 'test-bridge-token')
    account = await create_test_user(client)
    monkeypatch.setattr(settings, 'WHATSAPP_BRIDGE_BUSINESS_ID', account['business_id'])
    payload = {'business_id': account['business_id'], 'whatsapp_number': '447911123456', 'message_body': 'Historical enquiry', 'whatsapp_message_id': 'historic-1', 'timestamp': 1700000000, 'is_history': True}
    response = await client.post('/api/v1/webhook/bridge', json=payload, headers={'Authorization':'Bearer test-bridge-token'})
    assert response.status_code == 200
    headers = await get_auth_headers(client)
    contact = (await client.get('/api/v1/contacts', headers=headers)).json()['contacts'][0]
    assert contact['whatsapp_number'] == '447911123456'
    messages = (await client.get(f"/api/v1/contacts/{contact['id']}/messages", headers=headers)).json()
    assert messages[0]['created_at'].startswith('2023-11-14T22:13:20')


@pytest.mark.asyncio
async def test_send_echo_does_not_duplicate_saved_reply(client, monkeypatch):
    from app.services.whatsapp.whatsapp_client import whatsapp_client
    async def sent(*args):
        return {'messageId':'reply-echo-1'}
    monkeypatch.setattr(whatsapp_client, 'send_text_message', sent)
    account = await create_test_user(client)
    headers = await get_auth_headers(client)
    contact = (await client.post('/api/v1/contacts', json={'whatsapp_number':'919876543210'}, headers=headers)).json()
    first = await client.post(f"/api/v1/contacts/{contact['id']}/messages", json={'message':'Test reply'}, headers=headers)
    assert first.status_code == 201
    from app.services.whatsapp.message_processor import process_incoming_message
    async with TestSessionLocal() as db:
        echo = await process_incoming_message(db, account['business_id'], '919876543210', 'Test reply', whatsapp_message_id='reply-echo-1', direction='outbound')
    assert echo['message_id'] == first.json()['id']
    messages = (await client.get(f"/api/v1/contacts/{contact['id']}/messages", headers=headers)).json()
    assert len(messages) == 1
