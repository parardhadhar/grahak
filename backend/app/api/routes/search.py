"""
Search route — global search across contacts, messages, notes.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.db.database import get_db
from app.models.models import User, Contact
from app.schemas.schemas import SearchResponse
from app.api.deps import get_current_user

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Global search across contacts."""
    search_term = f"%{q}%"
    stmt = (
        select(Contact)
        .where(
            Contact.business_id == current_user.business_id,
            or_(
                Contact.display_name.ilike(search_term),
                Contact.whatsapp_number.ilike(search_term),
                Contact.extracted_service.ilike(search_term),
                Contact.notes.ilike(search_term),
                Contact.ai_summary.ilike(search_term),
                Contact.extracted_location.ilike(search_term),
            ),
        )
        .order_by(Contact.last_contacted_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    contacts = result.scalars().all()
    return SearchResponse(contacts=contacts, total=len(contacts))
