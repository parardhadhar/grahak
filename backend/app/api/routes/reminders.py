"""
Reminders management routes.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models.models import User, Reminder, Contact, ReminderStatus
from app.schemas.schemas import ReminderCreate, ReminderUpdate, ReminderResponse, SuccessResponse
from app.api.deps import get_current_user
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/reminders", tags=["Reminders"])


@router.get("", response_model=list[ReminderResponse])
async def list_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: str = None,
    today_only: bool = False,
):
    """List all reminders for the business."""
    stmt = (
        select(Reminder, Contact)
        .join(Contact, Reminder.contact_id == Contact.id)
        .where(Reminder.business_id == current_user.business_id)
    )
    if status:
        try:
            stmt = stmt.where(Reminder.status == ReminderStatus(status))
        except ValueError:
            pass
    if today_only:
        now = datetime.now(timezone.utc)
        today_end = now.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(Reminder.due_at <= today_end)

    stmt = stmt.order_by(Reminder.due_at)
    result = await db.execute(stmt)
    rows = result.all()

    return [
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
        for r, c in rows
    ]


@router.post("", response_model=ReminderResponse, status_code=201)
async def create_reminder(
    request: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify contact belongs to this business
    contact = await db.get(Contact, request.contact_id)
    if not contact or contact.business_id != current_user.business_id:
        raise HTTPException(status_code=404, detail="Contact not found.")

    reminder = Reminder(
        business_id=current_user.business_id,
        contact_id=request.contact_id,
        due_at=request.due_at,
        note=request.note,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)

    return ReminderResponse(
        id=reminder.id,
        business_id=reminder.business_id,
        contact_id=reminder.contact_id,
        due_at=reminder.due_at,
        status=reminder.status,
        note=reminder.note,
        created_at=reminder.created_at,
        contact_name=contact.display_name,
        contact_whatsapp=contact.whatsapp_number,
        contact_service=contact.extracted_service,
    )


@router.patch("/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(
    reminder_id: str,
    request: ReminderUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reminder = await db.get(Reminder, reminder_id)
    if not reminder or reminder.business_id != current_user.business_id:
        raise HTTPException(status_code=404, detail="Reminder not found.")

    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(reminder, key, value)
    await db.commit()
    await db.refresh(reminder)

    contact = await db.get(Contact, reminder.contact_id)
    return ReminderResponse(
        id=reminder.id,
        business_id=reminder.business_id,
        contact_id=reminder.contact_id,
        due_at=reminder.due_at,
        status=reminder.status,
        note=reminder.note,
        created_at=reminder.created_at,
        contact_name=contact.display_name if contact else None,
        contact_whatsapp=contact.whatsapp_number if contact else None,
        contact_service=contact.extracted_service if contact else None,
    )


@router.post("/{reminder_id}/complete", response_model=SuccessResponse)
async def complete_reminder(
    reminder_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reminder = await db.get(Reminder, reminder_id)
    if not reminder or reminder.business_id != current_user.business_id:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    reminder.status = ReminderStatus.done
    await db.commit()
    return SuccessResponse(message="Reminder marked as complete.")


@router.post("/{reminder_id}/snooze", response_model=ReminderResponse)
async def snooze_reminder(
    reminder_id: str,
    hours: int = 24,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    reminder = await db.get(Reminder, reminder_id)
    if not reminder or reminder.business_id != current_user.business_id:
        raise HTTPException(status_code=404, detail="Reminder not found.")
    reminder.due_at = datetime.now(timezone.utc) + timedelta(hours=hours)
    await db.commit()
    await db.refresh(reminder)
    contact = await db.get(Contact, reminder.contact_id)
    return ReminderResponse(
        id=reminder.id,
        business_id=reminder.business_id,
        contact_id=reminder.contact_id,
        due_at=reminder.due_at,
        status=reminder.status,
        note=reminder.note,
        created_at=reminder.created_at,
        contact_name=contact.display_name if contact else None,
        contact_whatsapp=contact.whatsapp_number if contact else None,
        contact_service=contact.extracted_service if contact else None,
    )
