"""
Message Processor — Core pipeline for incoming WhatsApp messages.
Architecture:
  1. Save message to DB first (NEVER lose a message due to AI failure)
  2. Create/update contact
  3. Process with AI asynchronously
  4. Update contact with AI insights
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.exc import IntegrityError
from typing import Optional
from datetime import datetime, timezone

from app.models.models import (
    Contact, Message, AIInsight, AIUsageLog,
    ContactStatus, MessageDirection, IntentType, PriorityLevel
)
from app.services.ai.ai_service import ai_service, AIAnalysisResult
from app.core.logging import get_logger

logger = get_logger(__name__)


async def process_incoming_message(
    db: AsyncSession,
    business_id: str,
    whatsapp_number: str,
    message_body: str,
    customer_name: Optional[str] = None,
    whatsapp_message_id: Optional[str] = None,
    is_simulator: bool = False,
    business_category: Optional[str] = None,
    direction: str = "inbound",
    message_timestamp: Optional[datetime] = None,
    skip_ai: bool = False,
) -> dict:
    """
    Core message processing pipeline.
    ALWAYS saves message first, THEN processes with AI (for inbound).
    Returns result dict with message_id, contact_id, and AI result.
    """
    if whatsapp_message_id:
        existing = await db.scalar(select(Message).where(Message.business_id == business_id, Message.whatsapp_message_id == whatsapp_message_id))
        if existing:
            return {"message_id": existing.id, "contact_id": existing.contact_id, "duplicate": True}
    clean_phone = "".join(c for c in str(whatsapp_number) if c.isdigit())
    if len(clean_phone) == 10:
        clean_phone = f"91{clean_phone}"

    # ── STEP 1: Create or update contact ──────────────────────────
    contact = await _get_or_create_contact(
        db=db,
        business_id=business_id,
        whatsapp_number=clean_phone,
        display_name=customer_name,
    )

    is_out = direction == "outbound"

    # ── STEP 2: Save message FIRST (before AI) ────────────────────
    message = Message(
        contact_id=contact.id,
        business_id=business_id,
        whatsapp_message_id=whatsapp_message_id,
        direction=MessageDirection.outbound if is_out else MessageDirection.inbound,
        body=message_body,
        ai_processed=is_out,
        is_simulator=is_simulator,
        created_at=message_timestamp or datetime.now(timezone.utc),
    )
    db.add(message)

    # Update contact stats
    contact.message_count = (contact.message_count or 0) + 1
    sent_at = message_timestamp or datetime.now(timezone.utc)
    previous = contact.last_contacted_at
    if previous is None or sent_at > previous.replace(tzinfo=timezone.utc):
        contact.last_contacted_at = sent_at
    if customer_name and not contact.display_name:
        contact.display_name = customer_name

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        existing = await db.scalar(select(Message).where(Message.business_id == business_id, Message.whatsapp_message_id == whatsapp_message_id)) if whatsapp_message_id else None
        if existing:
            return {"message_id": existing.id, "contact_id": existing.contact_id, "duplicate": True}
        raise
    await db.refresh(message)
    await db.refresh(contact)

    logger.info(f"Message saved: {message.id} ({direction}) for contact {contact.id}")

    if is_out or skip_ai:
        return {
            "message_id": message.id,
            "contact_id": contact.id,
            "ai_processed": False,
            "ai_result": None,
        }

    # ── STEP 3: AI processing (async, won't crash if it fails) ────
    ai_result = None
    try:
        # Get recent conversation history for context
        history = await _get_recent_history(db, contact.id, limit=5)

        ai_result = await ai_service.analyze_message(
            message=message_body,
            conversation_history=history,
            business_category=business_category,
        )

        if ai_result:
            # Store AI insight
            insight = AIInsight(
                contact_id=contact.id,
                business_id=business_id,
                message_id=message.id,
                intent=_safe_enum(IntentType, ai_result.intent),
                priority=_safe_enum(PriorityLevel, ai_result.priority),
                summary=ai_result.summary,
                customer_name=ai_result.customer_name,
                service=ai_result.service,
                budget=ai_result.budget,
                date=ai_result.date,
                location=ai_result.location,
                suggested_action=ai_result.suggested_action,
                needs_followup=ai_result.needs_followup,
                followup_hours=ai_result.followup_hours,
                raw_response=ai_result.to_dict(),
            )
            db.add(insight)

            # Update contact with AI extractions
            if ai_result.customer_name and not contact.display_name:
                contact.display_name = ai_result.customer_name
            if ai_result.service:
                contact.extracted_service = ai_result.service
            if ai_result.budget:
                contact.extracted_budget = ai_result.budget
            if ai_result.date:
                contact.extracted_date = ai_result.date
            if ai_result.location:
                contact.extracted_location = ai_result.location

            # Update status based on intent
            if ai_result.intent in ("complaint",):
                contact.status = ContactStatus.complaint
            elif ai_result.intent in ("returning_customer",):
                contact.status = ContactStatus.returning_customer
            elif ai_result.intent == "spam":
                contact.status = ContactStatus.spam
            elif contact.status == ContactStatus.new_lead:
                pass  # Keep as new lead until owner updates

            # Update AI summary
            if ai_result.summary:
                contact.ai_summary = ai_result.summary

            # Mark message as processed
            message.intent = _safe_enum(IntentType, ai_result.intent)
            message.ai_processed = True

            await db.commit()
            logger.info(f"AI processing complete for message {message.id}")

    except Exception as e:
        logger.error(f"AI processing failed for message {message.id}: {e}")
        # Message is already saved — don't raise, just log

    return {
        "message_id": message.id,
        "contact_id": contact.id,
        "ai_processed": ai_result is not None,
        "ai_result": ai_result.to_dict() if ai_result else None,
    }


async def _get_or_create_contact(
    db: AsyncSession,
    business_id: str,
    whatsapp_number: str,
    display_name: Optional[str] = None,
) -> Contact:
    """Find existing contact or create new one. Ensures no duplicates per business."""
    clean = "".join(c for c in str(whatsapp_number) if c.isdigit())
    last10 = clean[-10:] if len(clean) >= 10 else clean
    canonical = f"91{clean}" if len(clean) == 10 else clean
    aliases = [canonical, clean]
    if len(canonical) == 12 and canonical.startswith("91"):
        aliases.extend([last10, f"+91{last10}"])

    stmt = select(Contact).where(
        Contact.business_id == business_id,
        Contact.whatsapp_number.in_(aliases),
    )
    result = await db.execute(stmt)
    contact = result.scalars().first()

    if not contact:
        contact = Contact(
            business_id=business_id,
            whatsapp_number=canonical,
            display_name=display_name,
            status=ContactStatus.new_lead,
        )
        db.add(contact)
        await db.flush()  # Get the ID without committing
        logger.info(f"New contact created: {contact.id} for {canonical}")
    elif display_name and not contact.display_name:
        contact.display_name = display_name
    
    return contact


async def _get_recent_history(db: AsyncSession, contact_id: str, limit: int = 5) -> list:
    """Get recent message history for AI context."""
    from sqlalchemy import desc
    stmt = (
        select(Message)
        .where(Message.contact_id == contact_id)
        .order_by(desc(Message.created_at))
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return [{"direction": m.direction.value, "body": m.body} for m in reversed(messages)]


def _safe_enum(enum_class, value):
    """Safely convert string to enum, returning None if invalid."""
    try:
        return enum_class(value)
    except (ValueError, KeyError):
        return None
