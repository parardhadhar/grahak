"""
Contact management routes.
Full CRUD + search + filtering with strict tenant isolation.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc
from typing import Optional

from app.db.database import get_db
from app.models.models import User, Contact, Message, Note, Reminder, AIInsight, ContactStatus, MessageDirection
from app.schemas.schemas import (
    ContactCreate, ContactUpdate, ContactResponse, ContactListResponse,
    MessageResponse, NoteCreate, NoteUpdate, NoteResponse,
    ReminderCreate, ReminderResponse, AIInsightResponse, SuccessResponse
)
from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.services.whatsapp.whatsapp_client import whatsapp_client
from app.services.whatsapp.message_processor import process_incoming_message
from datetime import datetime, timezone

logger = get_logger(__name__)
router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get("", response_model=ContactListResponse)
async def list_contacts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("last_contacted_at"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all contacts for the current business with filtering and search."""
    stmt = select(Contact).where(Contact.business_id == current_user.business_id)

    if status:
        try:
            stmt = stmt.where(Contact.status == ContactStatus(status))
        except ValueError:
            pass

    if search:
        search_term = f"%{search}%"
        stmt = stmt.where(
            or_(
                Contact.display_name.ilike(search_term),
                Contact.whatsapp_number.ilike(search_term),
                Contact.extracted_service.ilike(search_term),
                Contact.notes.ilike(search_term),
                Contact.ai_summary.ilike(search_term),
            )
        )

    # Sorting
    sort_col = getattr(Contact, sort_by, Contact.last_contacted_at)
    stmt = stmt.order_by(desc(sort_col))

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()

    # Paginate
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    contacts = result.scalars().all()

    return ContactListResponse(
        contacts=contacts,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_contact_or_404(db, contact_id, current_user.business_id)
    return contact


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    request: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicates
    existing = await db.execute(
        select(Contact).where(
            Contact.business_id == current_user.business_id,
            Contact.whatsapp_number == request.whatsapp_number,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Contact with this WhatsApp number already exists.",
        )

    contact = Contact(
        business_id=current_user.business_id,
        **request.model_dump(),
    )
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    request: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_contact_or_404(db, contact_id, current_user.business_id)
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contact, key, value)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{contact_id}", response_model=SuccessResponse)
async def delete_contact(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_contact_or_404(db, contact_id, current_user.business_id)
    await db.delete(contact)
    await db.commit()
    return SuccessResponse(message="Contact deleted.")


# ──────────────────────────── MESSAGES ─────────────────────────────

@router.get("/{contact_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_contact_or_404(db, contact_id, current_user.business_id)
    result = await db.execute(
        select(Message)
        .where(Message.contact_id == contact_id)
        .order_by(Message.created_at)
    )
    return result.scalars().all()


@router.post("/{contact_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    contact_id: str,
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contact = await _get_contact_or_404(db, contact_id, current_user.business_id)
    text = payload.get("message") or payload.get("body")
    if not isinstance(text, str) or not text.strip():
        raise HTTPException(status_code=400, detail="Message text is required")
    text = text.strip()

    # Send via WhatsApp client (checks Baileys companion bridge first)
    try:
        send_res = await whatsapp_client.send_text_message(contact.whatsapp_number, text, current_user.business_id)
    except Exception:
        raise HTTPException(status_code=503, detail="WhatsApp could not send this message. Check your connection and try again.")
    msg_id = send_res.get("messageId") or send_res.get("messages", [{}])[0].get("id")

    result = await process_incoming_message(db, current_user.business_id, contact.whatsapp_number, text, whatsapp_message_id=msg_id, direction="outbound")
    msg = await db.get(Message, result["message_id"])
    return msg



# ──────────────────────────── NOTES ─────────────────────────────

@router.get("/{contact_id}/notes", response_model=list[NoteResponse])
async def get_notes(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_contact_or_404(db, contact_id, current_user.business_id)
    result = await db.execute(
        select(Note)
        .where(Note.contact_id == contact_id)
        .order_by(Note.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{contact_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    contact_id: str,
    request: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_contact_or_404(db, contact_id, current_user.business_id)
    note = Note(
        contact_id=contact_id,
        business_id=current_user.business_id,
        body=request.body,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.patch("/{contact_id}/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    contact_id: str,
    note_id: str,
    request: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_contact_or_404(db, contact_id, current_user.business_id)
    note = await db.get(Note, note_id)
    if not note or note.contact_id != contact_id:
        raise HTTPException(status_code=404, detail="Note not found.")
    note.body = request.body
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{contact_id}/notes/{note_id}", response_model=SuccessResponse)
async def delete_note(
    contact_id: str,
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_contact_or_404(db, contact_id, current_user.business_id)
    note = await db.get(Note, note_id)
    if not note or note.contact_id != contact_id:
        raise HTTPException(status_code=404, detail="Note not found.")
    await db.delete(note)
    await db.commit()
    return SuccessResponse(message="Note deleted.")


# ──────────────────────────── REMINDERS ─────────────────────────────

@router.post("/{contact_id}/reminders", response_model=ReminderResponse, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    contact_id: str,
    request: ReminderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_contact_or_404(db, contact_id, current_user.business_id)
    reminder = Reminder(
        business_id=current_user.business_id,
        contact_id=contact_id,
        due_at=request.due_at,
        note=request.note,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return _enrich_reminder(reminder, None, None, None)


# ──────────────────────────── AI INSIGHTS ─────────────────────────────

@router.get("/{contact_id}/ai-insights", response_model=list[AIInsightResponse])
async def get_ai_insights(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_contact_or_404(db, contact_id, current_user.business_id)
    result = await db.execute(
        select(AIInsight)
        .where(AIInsight.contact_id == contact_id)
        .order_by(AIInsight.created_at.desc())
        .limit(10)
    )
    return result.scalars().all()


# ──────────────────────────── HELPERS ─────────────────────────────

async def _get_contact_or_404(db: AsyncSession, contact_id: str, business_id: str) -> Contact:
    """Get contact with tenant isolation check."""
    contact = await db.get(Contact, contact_id)
    if not contact or contact.business_id != business_id:
        raise HTTPException(status_code=404, detail="Contact not found.")
    return contact


def _enrich_reminder(reminder, name, whatsapp, service) -> ReminderResponse:
    return ReminderResponse(
        id=reminder.id,
        business_id=reminder.business_id,
        contact_id=reminder.contact_id,
        due_at=reminder.due_at,
        status=reminder.status,
        note=reminder.note,
        created_at=reminder.created_at,
        contact_name=name,
        contact_whatsapp=whatsapp,
        contact_service=service,
    )
