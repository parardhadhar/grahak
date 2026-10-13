"""
Authentication routes: signup, login, logout, password reset, current user.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import User, Business, OnboardingStep
from app.schemas.schemas import (
    SignupRequest, LoginRequest, TokenResponse, SuccessResponse
)
from app.core.security import hash_password, verify_password, create_access_token
from app.api.deps import get_current_user
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Register a new business and owner account."""

    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == request.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    # Create business
    business = Business(
        name=request.business_name,
        onboarding_step=OnboardingStep.business_category,  # name done at signup
    )
    db.add(business)
    await db.flush()

    # Create user
    user = User(
        business_id=business.id,
        email=request.email,
        hashed_password=hash_password(request.password),
        full_name=request.full_name,
        is_owner=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    await db.refresh(business)

    token = create_access_token({"sub": user.id, "business_id": business.id})
    logger.info(f"New signup: {user.email} | business: {business.id}")

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        business_id=business.id,
        full_name=user.full_name,
        onboarding_completed=business.onboarding_completed,
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated.",
        )

    # Get business
    business = await db.get(Business, user.business_id)

    token = create_access_token({"sub": user.id, "business_id": user.business_id})
    logger.info(f"Login: {user.email}")

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        business_id=user.business_id,
        full_name=user.full_name,
        onboarding_completed=business.onboarding_completed if business else False,
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Get current authenticated user info."""
    business = await db.get(Business, current_user.business_id)
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "business_id": current_user.business_id,
        "business_name": business.name if business else None,
        "onboarding_completed": business.onboarding_completed if business else False,
    }


@router.post("/logout", response_model=SuccessResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Logout (client should discard token)."""
    return SuccessResponse(message="Logged out successfully.")
