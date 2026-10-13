"""
WhatsApp Webhook routes.
GET  /webhook — Meta verification handshake
POST /webhook — Incoming WhatsApp messages
"""

from fastapi import APIRouter, Request, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.db.database import get_db
from app.core.config import settings
from app.core.logging import get_logger
from app.services.whatsapp.whatsapp_client import whatsapp_client
from app.services.whatsapp.message_processor import process_incoming_message
from sqlalchemy import select, or_
from app.models.models import Business
import hmac
from datetime import datetime, timezone

logger = get_logger(__name__)
router = APIRouter(prefix="/webhook", tags=["WhatsApp Webhook"])


def verify_bridge(request: Request):
    token = settings.WHATSAPP_BRIDGE_TOKEN
    if not token or not hmac.compare_digest(request.headers.get("Authorization", ""), f"Bearer {token}"):
        raise HTTPException(status_code=403, detail="Invalid bridge credentials.")


@router.get("")
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=None),
    hub_challenge: str = Query(alias="hub.challenge", default=None),
    hub_verify_token: str = Query(alias="hub.verify_token", default=None),
):
    """
    Meta webhook verification handshake.
    Meta sends a GET request with a challenge — we must echo it back.
    """
    if hub_mode == "subscribe" and hub_verify_token == settings.WHATSAPP_VERIFY_TOKEN:
        logger.info("✅ WhatsApp webhook verified successfully")
        return Response(content=hub_challenge, media_type="text/plain")

    logger.warning(f"Webhook verification failed. Token mismatch.")
    raise HTTPException(status_code=403, detail="Verification failed.")


@router.post("")
async def receive_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receive incoming WhatsApp messages from Meta.
    Verifies webhook signature and processes messages.
    """
    raw_body = await request.body()

    # Verify signature (if app secret is configured)
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not whatsapp_client.verify_webhook_signature(raw_body, signature):
        logger.warning("Invalid webhook signature")
        raise HTTPException(status_code=403, detail="Invalid signature.")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    # Process each entry/message
    try:
        await _process_webhook_payload(db, data)
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
        raise HTTPException(status_code=503, detail="Message processing temporarily unavailable.")
    
    return {"status": "ok"}


@router.post("/bridge")
async def receive_bridge_message(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Receive incoming message from Baileys WhatsApp Web Companion bridge.
    """
    verify_bridge(request)
    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload.")

    whatsapp_number = data.get("whatsapp_number")
    customer_name = data.get("customer_name")
    message_body = data.get("message_body")
    whatsapp_message_id = data.get("whatsapp_message_id")
    direction = data.get("direction", "inbound")
    business_id = data.get("business_id")

    if not whatsapp_number or not message_body:
        raise HTTPException(status_code=400, detail="whatsapp_number and message_body required")

    if direction not in {"inbound", "outbound"}:
        raise HTTPException(status_code=400, detail="Invalid message direction.")
    if not business_id or business_id != settings.WHATSAPP_BRIDGE_BUSINESS_ID:
        raise HTTPException(status_code=403, detail="Bridge business mismatch.")
    business = await db.get(Business, business_id)
    if not business:
        raise HTTPException(status_code=404, detail="No business registered")

    try:
        sent_at = datetime.fromtimestamp(float(data['timestamp']), timezone.utc) if data.get('timestamp') else None
    except (ValueError, TypeError, OverflowError):
        raise HTTPException(status_code=400, detail="Invalid message timestamp.")

    res = await process_incoming_message(
        db=db,
        business_id=business.id,
        whatsapp_number=whatsapp_number,
        message_body=message_body,
        customer_name=customer_name,
        whatsapp_message_id=whatsapp_message_id,
        is_simulator=False,
        business_category=business.category,
        direction=direction,
        message_timestamp=sent_at,
        skip_ai=bool(data.get('is_history', False)),
    )
    return {"status": "ok", "result": res}


@router.get("/bridge/status")
@router.post("/bridge/status")
async def update_bridge_status(request: Request, db: AsyncSession = Depends(get_db)):
    """Update or retrieve business WhatsApp pairing status."""
    verify_bridge(request)
    business = await db.get(Business, settings.WHATSAPP_BRIDGE_BUSINESS_ID) if settings.WHATSAPP_BRIDGE_BUSINESS_ID else None
    if request.method == "GET":
        return {
            "status": "ok",
            "connected": bool(business.whatsapp_connected) if business else False,
            "phone": business.whatsapp_number if business else None,
        }

    try:
        data = await request.json()
        connected = bool(data.get("connected", False))
        phone = data.get("phone")

        if business:
            business.whatsapp_connected = 1 if connected else 0
            if phone:
                business.whatsapp_number = phone
            await db.commit()
            logger.info(f"WhatsApp companion bridge status updated: connected={connected} phone={phone} business={business.name}")
    except Exception as e:
        logger.error(f"Error updating bridge status: {e}")

    return {"status": "ok"}



async def _process_webhook_payload(db: AsyncSession, data: dict):
    """Parse Meta webhook payload and process messages."""
    entry_list = data.get("entry", [])
    
    for entry in entry_list:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            contacts_info = {
                c.get("wa_id"): c.get("profile", {}).get("name")
                for c in value.get("contacts", [])
            }
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            
            # Find which business this webhook belongs to
            business_id = await _get_business_by_phone_number_id(db, phone_number_id)
            if not business_id:
                logger.warning(f"No business found for phone_number_id: {phone_number_id}")
                continue

            for msg in messages:
                if msg.get("type") != "text":
                    logger.info(f"Non-text message received (type={msg.get('type')}), skipping AI")
                    continue

                sender = msg.get("from")
                text = msg.get("text", {}).get("body", "")
                msg_id = msg.get("id")
                customer_name = contacts_info.get(sender)

                await process_incoming_message(
                    db=db,
                    business_id=business_id,
                    whatsapp_number=sender,
                    message_body=text,
                    customer_name=customer_name,
                    whatsapp_message_id=msg_id,
                    is_simulator=False,
                )


async def _get_business_by_phone_number_id(db: AsyncSession, phone_number_id: str) -> str:
    """
    Find business by their WhatsApp phone number ID.
    In MVP, falls back to the registered business so incoming messages are never lost.
    """
    if not phone_number_id or phone_number_id != settings.WHATSAPP_PHONE_NUMBER_ID:
        return None
    business = await db.get(Business, settings.WHATSAPP_BRIDGE_BUSINESS_ID) if settings.WHATSAPP_BRIDGE_BUSINESS_ID else None
    return business.id if business else None
