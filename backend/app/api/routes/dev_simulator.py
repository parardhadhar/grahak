"""
Development Message Simulator — DEVELOPMENT ONLY
Simulates incoming WhatsApp messages without needing Meta credentials.
Runs through the EXACT same processing pipeline as real messages.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.db.database import get_db
from app.models.models import User, Business, Contact, Message, Reminder, Note, AIInsight, AIUsageLog, ContactStatus, MessageDirection, ReminderStatus, IntentType, PriorityLevel
from app.schemas.schemas import SimulateMessageRequest, SimulateMessageResponse, SuccessResponse
from app.api.deps import get_current_user
from app.services.whatsapp.message_processor import process_incoming_message
from app.core.config import settings
from app.core.logging import get_logger
from datetime import datetime, timezone, timedelta
import random

logger = get_logger(__name__)
router = APIRouter(prefix="/dev", tags=["Development Simulator"])


def _require_dev_mode():
    if not settings.DEV_MODE:
        raise HTTPException(status_code=403, detail="Dev mode is disabled.")


# ──────────────────────────── MESSAGE SIMULATOR ─────────────────────────────

@router.post("/simulate-message", response_model=SimulateMessageResponse)
async def simulate_message(
    request: SimulateMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    ⚠️ DEVELOPMENT ONLY
    Simulate an incoming WhatsApp message.
    Runs through the EXACT same pipeline as real WhatsApp messages.
    Creates real database records — not fake data.
    """
    _require_dev_mode()

    # Get business category for better AI context
    business = await db.get(Business, current_user.business_id)
    business_category = business.category if business else None

    result = await process_incoming_message(
        db=db,
        business_id=current_user.business_id,
        whatsapp_number=request.phone,
        message_body=request.message,
        customer_name=request.customer_name,
        whatsapp_message_id=None,
        is_simulator=True,
        business_category=business_category,
    )

    logger.info(f"[DEV] Simulated message from {request.customer_name} ({request.phone})")

    return SimulateMessageResponse(
        success=True,
        message_id=result["message_id"],
        contact_id=result["contact_id"],
        ai_processed=result["ai_processed"],
        ai_result=result["ai_result"],
        message=f"Message simulated and processed. Contact: {result['contact_id']}",
    )


# ──────────────────────────── SEED DATA ─────────────────────────────

SAMPLE_CUSTOMERS = [
    {
        "name": "Rahul Sharma",
        "phone": "919999111101",
        "messages": [
            "Bhai wedding photography ka package kitne ka hai?",
            "December 15 available hai?",
            "Budget around 30k hai mera",
            "Send packages please",
        ],
    },
    {
        "name": "Priya Singh",
        "phone": "919999111102",
        "messages": [
            "Hi, birthday photography ke liye available ho?",
            "25 November Sunday ko chahiye",
            "2 ghante ki shoot ke liye kitna loge?",
        ],
    },
    {
        "name": "Aman Verma",
        "phone": "919999111103",
        "messages": [
            "Are you available this Saturday for a corporate event?",
            "It's in Bhopal, 5 hours event",
            "What's your rate for corporate shoots?",
        ],
    },
    {
        "name": "Neha Gupta",
        "phone": "919999111104",
        "messages": [
            "I have a complaint. You missed my pre-wedding shoot last week.",
            "I am very upset. You didn't even call to inform.",
        ],
    },
    {
        "name": "Rohan Patel",
        "phone": "919999111105",
        "messages": [
            "Hi",
            "ok",
            "yes",
        ],
    },
]


@router.post("/seed", response_model=SuccessResponse)
async def seed_demo_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    ⚡ INSTANT SEED
    Seeds realistic sample leads with complete chat history and AI extractions.
    Executes in < 50ms without blocking network calls.
    """
    _require_dev_mode()
    bid = current_user.business_id
    now = datetime.now(timezone.utc)

    samples = [
        {
            "name": "Rahul Sharma",
            "phone": "919811204001",
            "status": ContactStatus.new_lead,
            "service": "Wedding Photography",
            "budget": 45000.0,
            "location": "South Delhi",
            "date": "14 Dec",
            "summary": "Looking for a photographer for a 200-person wedding.",
            "messages": [
                ("inbound", "Hi, are you available for a wedding on 14 December?"),
                ("outbound", "Namaste Rahul! Yes, 14th December is open. What kind of coverage are you looking for?"),
                ("inbound", "Need a quote for a 200 guest event in South Delhi. Budget is around ₹45,000."),
            ],
            "reminder": "Photography package discussion · Today 4:30 PM",
            "due_hours": 2,
        },
        {
            "name": "Priya Mehta",
            "phone": "919820304002",
            "status": ContactStatus.new_lead,
            "service": "Saturday Studio Booking",
            "budget": 18000.0,
            "location": "Bandra, Mumbai",
            "date": "Saturday",
            "summary": "Can we book Saturday? Can you send me your photography packages?",
            "messages": [
                ("inbound", "Can you send me your photography packages?"),
                ("outbound", "Hi Priya! Sending our studio portrait and editorial deck right over."),
                ("inbound", "Can we book Saturday afternoon at 3:30 PM?"),
            ],
            "reminder": "Saturday booking confirmation · Tomorrow",
            "due_hours": 24,
        },
        {
            "name": "Ankit Verma",
            "phone": "919830504003",
            "status": ContactStatus.new_lead,
            "service": "Wedding Photography",
            "budget": 45000.0,
            "location": "Lucknow",
            "date": "22 Nov",
            "summary": "Need a quote for a 200 guest event.",
            "messages": [
                ("inbound", "Hello, need a quote for a 200 guest event."),
                ("inbound", "Looking for candid photography and traditional video."),
            ],
            "reminder": None,
            "due_hours": None,
        },
        {
            "name": "Neha Kapoor",
            "phone": "919840604004",
            "status": ContactStatus.active_customer,
            "service": "Bridal & Portrait Session",
            "budget": 28000.0,
            "location": "Bangalore",
            "date": "Next Friday",
            "summary": "Studio bridal portrait session with 3 wardrobe changes.",
            "messages": [
                ("inbound", "Hi! Loved your recent bride portraits on Instagram."),
                ("outbound", "Thank you Neha! Would love to create something special for your big day."),
                ("inbound", "Can we schedule my bridal trial shoot next Friday at 11 AM?"),
            ],
            "reminder": "Finalize wardrobe & moodboard · In 3 days",
            "due_hours": 72,
        },
        {
            "name": "Arjun Singh",
            "phone": "919850704005",
            "status": ContactStatus.new_lead,
            "service": "Commercial Product Shoot",
            "budget": 35000.0,
            "location": "Gurgaon Cyber City",
            "date": "End of Month",
            "summary": "Catalog shoot for 25 handcrafted leather goods SKUs.",
            "messages": [
                ("inbound", "Hey! Do you cover corporate product shoots in Gurgaon?"),
                ("outbound", "Hi Arjun! Yes, we have a portable studio setup and studio in Udyog Vihar."),
                ("inbound", "Great! We have 25 SKUs that need white background and lifestyle shots."),
            ],
            "reminder": None,
            "due_hours": None,
        },
    ]

    for s in samples:
        contact = Contact(
            business_id=bid,
            whatsapp_number=s["phone"],
            display_name=s["name"],
            status=s["status"],
            extracted_service=s["service"],
            extracted_budget=s["budget"],
            extracted_location=s["location"],
            extracted_date=s.get("date"),
            ai_summary=s["summary"],
            message_count=len(s["messages"]),
            last_contacted_at=now,
        )
        db.add(contact)
        await db.flush()

        for idx, (dirn, body) in enumerate(s["messages"]):
            msg = Message(
                contact_id=contact.id,
                business_id=bid,
                direction=MessageDirection.outbound if dirn == "outbound" else MessageDirection.inbound,
                body=body,
                ai_processed=True,
                created_at=now - timedelta(minutes=(len(s["messages"]) - idx) * 12),
            )
            db.add(msg)
            await db.flush()

            if idx == len(s["messages"]) - 1:
                insight = AIInsight(
                    contact_id=contact.id,
                    business_id=bid,
                    message_id=msg.id,
                    intent=IntentType.new_lead if s["status"] == ContactStatus.new_lead else IntentType.other,
                    priority=PriorityLevel.high,
                    summary=s["summary"],
                    service=s["service"],
                    budget=s["budget"],
                    location=s["location"],
                    suggested_action=f"Follow up with {s['name']} regarding {s['service']}.",
                    needs_followup=bool(s.get("reminder")),
                    followup_hours=s.get("due_hours", 2) or 2,
                )
                db.add(insight)

        if s.get("reminder") and s.get("due_hours"):
            rem = Reminder(
                business_id=bid,
                contact_id=contact.id,
                due_at=now + timedelta(hours=s["due_hours"]),
                note=s["reminder"],
            )
            db.add(rem)

    await db.commit()
    logger.info(f"[DEV] Instant seeded {len(samples)} realistic Indian leads for business {bid}")
    return SuccessResponse(message="Realistic CRM conversations loaded.")


@router.delete("/reset", response_model=SuccessResponse)
async def reset_dev_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    ⚡ INSTANT RESET
    Delete ALL contacts, messages, reminders for this business in a single fast query.
    """
    _require_dev_mode()
    bid = current_user.business_id

    await db.execute(delete(Reminder).where(Reminder.business_id == bid))
    await db.execute(delete(Note).where(Note.business_id == bid))
    await db.execute(delete(AIInsight).where(AIInsight.business_id == bid))
    await db.execute(delete(Message).where(Message.business_id == bid))
    await db.execute(delete(Contact).where(Contact.business_id == bid))
    await db.commit()

    logger.info(f"[DEV] Instant reset all data for business {bid}")
    return SuccessResponse(message="All CRM leads & messages cleared.")


@router.get("/status")
async def dev_status():
    """Check dev mode status and available endpoints."""
    if not settings.DEV_MODE:
        raise HTTPException(status_code=403, detail="Dev mode is disabled.")
    return {
        "dev_mode": True,
        "warning": "DEVELOPMENT MODE — not for production use",
        "available_endpoints": [
            "POST /dev/simulate-message",
            "POST /dev/seed",
            "DELETE /dev/reset",
        ],
    }
