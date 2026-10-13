"""
Dashboard route — the main overview for the business owner.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models.models import (
    User, Contact, Reminder, ContactStatus, ReminderStatus
)
from app.schemas.schemas import (
    DashboardResponse, DashboardStats, ReminderResponse, ContactResponse
)
from app.api.deps import get_current_user
from app.core.integrations import get_whatsapp_status, get_ai_status
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bid = current_user.business_id
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Stats — single aggregated query
    counts_result = await db.execute(
        select(Contact.status, func.count()).where(Contact.business_id == bid).group_by(Contact.status)
    )
    counts = {row[0]: row[1] for row in counts_result.all()}
    new_leads = counts.get(ContactStatus.new_lead, 0)
    active = counts.get(ContactStatus.active_customer, 0)
    complaints = counts.get(ContactStatus.complaint, 0)
    total_contacts = sum(counts.values())

    pending_followups_result = await db.execute(
        select(func.count()).where(
            Reminder.business_id == bid,
            Reminder.status == ReminderStatus.pending,
        )
    )
    pending_followups = pending_followups_result.scalar() or 0

    # Today's follow-ups
    todays_reminders_result = await db.execute(
        select(Reminder, Contact)
        .join(Contact, Reminder.contact_id == Contact.id)
        .where(
            Reminder.business_id == bid,
            Reminder.status == ReminderStatus.pending,
            Reminder.due_at >= today_start,
            Reminder.due_at < today_end,
        )
        .order_by(Reminder.due_at)
        .limit(10)
    )
    todays_rows = todays_reminders_result.all()
    todays_followups = [
        ReminderResponse(
            id=r.id,
            business_id=r.business_id,
            contact_id=r.contact_id,
            due_at=r.due_at,
            status=r.status,
            note=r.note,
            created_at=r.created_at,
            contact_name=c.display_name,
            contact_whatsapp=c.whatsapp_number,
            contact_service=c.extracted_service,
        )
        for r, c in todays_rows
    ]

    # Recent conversations (most recently contacted)
    recent_result = await db.execute(
        select(Contact)
        .where(Contact.business_id == bid)
        .order_by(Contact.last_contacted_at.desc())
        .limit(5)
    )
    recent_contacts = recent_result.scalars().all()

    return DashboardResponse(
        stats=DashboardStats(
            new_leads=new_leads,
            active_conversations=active,
            pending_followups=pending_followups,
            complaints=complaints,
            total_contacts=total_contacts,
        ),
        todays_followups=todays_followups,
        recent_conversations=recent_contacts,
        ai_insights_summary=_generate_insight_text(new_leads, pending_followups, complaints),
        whatsapp_status=await get_whatsapp_status(bid),
        ai_status=get_ai_status(),
    )


async def _count(db, model, business_id, *conditions):
    stmt = select(func.count()).where(model.business_id == business_id, *conditions)
    result = await db.execute(stmt)
    return result.scalar() or 0


def _generate_insight_text(new_leads: int, followups: int, complaints: int) -> str:
    parts = []
    if new_leads > 0:
        parts.append(f"You have {new_leads} new lead{'s' if new_leads > 1 else ''} waiting.")
    if followups > 0:
        parts.append(f"{followups} follow-up{'s' if followups > 1 else ''} due today.")
    if complaints > 0:
        parts.append(f"⚠️ {complaints} complaint{'s' if complaints > 1 else ''} need attention.")
    if not parts:
        return "Everything looks good! No urgent actions needed."
    return " ".join(parts)
