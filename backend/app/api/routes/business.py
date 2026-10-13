"""
Business onboarding routes.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.models import User, Business, OnboardingStep
from app.schemas.schemas import (
    BusinessProfileResponse, OnboardingUpdateRequest, SuccessResponse
)
from app.api.deps import get_current_user
from app.core.integrations import get_whatsapp_status, get_ai_status
from app.core.logging import get_logger
from app.core.config import settings
import httpx

logger = get_logger(__name__)
router = APIRouter(prefix="/business", tags=["Business"])


@router.api_route("/whatsapp/{action}", methods=["GET", "POST"])
async def bridge_action(action: str, request: Request, current_user: User = Depends(get_current_user)):
    allowed = {"status": "GET", "qr": "GET", "reset": "POST", "disconnect": "POST"}
    if action not in allowed or request.method != allowed[action]:
        raise HTTPException(status_code=405, detail="Unsupported WhatsApp action.")
    if settings.WHATSAPP_BRIDGE_BUSINESS_ID != current_user.business_id:
        if action in {"status", "qr"}:
            return {"connected": False, "phone": None, "name": None, "qr": None, "qr_image": None, "available": False}
        raise HTTPException(status_code=403, detail="WhatsApp bridge is not assigned to your business.")
    headers = {"Authorization": f"Bearer {settings.WHATSAPP_BRIDGE_TOKEN}"} if settings.WHATSAPP_BRIDGE_TOKEN else {}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.request(request.method, f"{settings.WHATSAPP_BRIDGE_URL}/{action}", headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="WhatsApp connection service is unavailable. Please try again.")


@router.get("/profile", response_model=BusinessProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    business = await db.get(Business, current_user.business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found.")
    return business


@router.post("/onboarding", response_model=BusinessProfileResponse)
async def update_onboarding(
    request: OnboardingUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update onboarding step by step."""
    business = await db.get(Business, current_user.business_id)
    if not business:
        raise HTTPException(status_code=404, detail="Business not found.")

    step = request.step

    if step == OnboardingStep.business_name and request.business_name:
        business.name = request.business_name
        business.onboarding_step = OnboardingStep.business_category

    elif step == OnboardingStep.business_category and request.business_category:
        business.category = request.business_category
        business.onboarding_step = OnboardingStep.owner_name

    elif step == OnboardingStep.owner_name and request.owner_name:
        business.owner_name = request.owner_name
        current_user.full_name = request.owner_name
        business.onboarding_step = OnboardingStep.whatsapp_number

    elif step == OnboardingStep.whatsapp_number and request.whatsapp_number:
        business.whatsapp_number = request.whatsapp_number
        business.onboarding_step = OnboardingStep.connect_whatsapp

    elif step == OnboardingStep.connect_whatsapp:
        # In dev mode, mark as "connected" in demo mode
        business.onboarding_step = OnboardingStep.completed
        business.onboarding_completed = True

    await db.commit()
    await db.refresh(business)
    logger.info(f"Onboarding step '{step}' completed for business {business.id}")
    return business


@router.get("/status")
async def get_status(
    current_user: User = Depends(get_current_user),
):
    """Get integration status (WhatsApp, AI)."""
    return {
        "whatsapp": await get_whatsapp_status(current_user.business_id),
        "ai": get_ai_status(),
        "dev_mode": settings.DEV_MODE,
    }
