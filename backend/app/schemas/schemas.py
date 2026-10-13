"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Any
from datetime import datetime
from app.models.models import (
    PlanType, ContactStatus, MessageDirection, IntentType,
    PriorityLevel, ReminderStatus, OnboardingStep
)


# ──────────────────────────── AUTH ─────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=255)
    business_name: str = Field(min_length=1, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    business_id: str
    full_name: str
    onboarding_completed: bool


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


# ──────────────────────────── BUSINESS ─────────────────────────────

class BusinessProfileResponse(BaseModel):
    id: str
    name: str
    category: Optional[str]
    owner_name: Optional[str]
    whatsapp_number: Optional[str]
    whatsapp_connected: bool
    plan: PlanType
    onboarding_step: OnboardingStep
    onboarding_completed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OnboardingUpdateRequest(BaseModel):
    step: OnboardingStep
    business_name: Optional[str] = None
    business_category: Optional[str] = None
    owner_name: Optional[str] = None
    whatsapp_number: Optional[str] = None


# ──────────────────────────── CONTACTS ─────────────────────────────

class ContactCreate(BaseModel):
    whatsapp_number: str
    display_name: Optional[str] = None
    status: Optional[ContactStatus] = ContactStatus.new_lead
    notes: Optional[str] = None


class ContactUpdate(BaseModel):
    display_name: Optional[str] = None
    status: Optional[ContactStatus] = None
    priority: Optional[PriorityLevel] = None
    notes: Optional[str] = None
    extracted_service: Optional[str] = None
    extracted_budget: Optional[float] = None
    extracted_date: Optional[str] = None
    extracted_location: Optional[str] = None


class ContactResponse(BaseModel):
    id: str
    business_id: str
    whatsapp_number: str
    display_name: Optional[str]
    first_contacted_at: datetime
    last_contacted_at: datetime
    message_count: int
    status: ContactStatus
    priority: PriorityLevel
    ai_summary: Optional[str]
    extracted_service: Optional[str]
    extracted_budget: Optional[float]
    extracted_date: Optional[str]
    extracted_location: Optional[str]
    notes: Optional[str]
    tags: Optional[List[str]] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContactListResponse(BaseModel):
    contacts: List[ContactResponse]
    total: int
    page: int
    page_size: int


# ──────────────────────────── MESSAGES ─────────────────────────────

class MessageResponse(BaseModel):
    id: str
    contact_id: str
    direction: MessageDirection
    body: str
    intent: Optional[IntentType]
    ai_processed: bool
    is_simulator: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────── REMINDERS ─────────────────────────────

class ReminderCreate(BaseModel):
    contact_id: str
    due_at: datetime
    note: Optional[str] = None


class ReminderUpdate(BaseModel):
    status: Optional[ReminderStatus] = None
    due_at: Optional[datetime] = None
    note: Optional[str] = None


class ReminderResponse(BaseModel):
    id: str
    business_id: str
    contact_id: str
    due_at: datetime
    status: ReminderStatus
    note: Optional[str]
    created_at: datetime
    # Nested contact info
    contact_name: Optional[str] = None
    contact_whatsapp: Optional[str] = None
    contact_service: Optional[str] = None

    class Config:
        from_attributes = True


# ──────────────────────────── NOTES ─────────────────────────────

class NoteCreate(BaseModel):
    body: str = Field(min_length=1)


class NoteUpdate(BaseModel):
    body: str = Field(min_length=1)


class NoteResponse(BaseModel):
    id: str
    contact_id: str
    business_id: str
    body: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────── AI INSIGHTS ─────────────────────────────

class AIInsightResponse(BaseModel):
    id: str
    contact_id: str
    intent: Optional[IntentType]
    priority: Optional[PriorityLevel]
    summary: Optional[str]
    customer_name: Optional[str]
    service: Optional[str]
    budget: Optional[float]
    date: Optional[str]
    location: Optional[str]
    suggested_action: Optional[str]
    needs_followup: bool
    followup_hours: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ──────────────────────────── DASHBOARD ─────────────────────────────

class DashboardStats(BaseModel):
    new_leads: int
    active_conversations: int
    pending_followups: int
    complaints: int
    total_contacts: int


class DashboardResponse(BaseModel):
    stats: DashboardStats
    todays_followups: List[ReminderResponse]
    recent_conversations: List[ContactResponse]
    ai_insights_summary: Optional[str]
    whatsapp_status: dict
    ai_status: dict


# ──────────────────────────── SIMULATOR (DEV) ─────────────────────────────

class SimulateMessageRequest(BaseModel):
    customer_name: str
    phone: str
    message: str


class SimulateMessageResponse(BaseModel):
    success: bool
    message_id: str
    contact_id: str
    ai_processed: bool
    ai_result: Optional[dict]
    message: str


# ──────────────────────────── SEARCH ─────────────────────────────

class SearchResponse(BaseModel):
    contacts: List[ContactResponse]
    total: int


# ──────────────────────────── GENERIC ─────────────────────────────

class SuccessResponse(BaseModel):
    success: bool = True
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[Any] = None
