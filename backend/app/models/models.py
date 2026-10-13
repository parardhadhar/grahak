"""
Grahak Database Models
Uses SQLAlchemy with async support.
Supports both SQLite (dev) and PostgreSQL (production via Supabase).
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float,
    DateTime, ForeignKey, Enum as SAEnum, Index, JSON
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy import String as SAString
import enum


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ──────────────────────────── ENUMS ─────────────────────────────

class PlanType(str, enum.Enum):
    trial = "trial"
    pro = "pro"
    business = "business"


class ContactStatus(str, enum.Enum):
    new_lead = "new_lead"
    active_customer = "active_customer"
    returning_customer = "returning_customer"
    follow_up_required = "follow_up_required"
    complaint = "complaint"
    closed = "closed"
    spam = "spam"


class MessageDirection(str, enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class IntentType(str, enum.Enum):
    new_lead = "new_lead"
    returning_customer = "returning_customer"
    question = "question"
    complaint = "complaint"
    spam = "spam"
    support = "support"
    purchase_intent = "purchase_intent"
    other = "other"


class PriorityLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class ReminderStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    done = "done"
    cancelled = "cancelled"


class OnboardingStep(str, enum.Enum):
    business_name = "business_name"
    business_category = "business_category"
    owner_name = "owner_name"
    whatsapp_number = "whatsapp_number"
    connect_whatsapp = "connect_whatsapp"
    completed = "completed"


# ──────────────────────────── MODELS ─────────────────────────────

class Business(Base):
    __tablename__ = "businesses"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    owner_name = Column(String(255), nullable=True)
    whatsapp_number = Column(String(20), nullable=True)
    whatsapp_connected = Column(Boolean, default=False)
    plan = Column(SAEnum(PlanType), default=PlanType.trial)
    onboarding_step = Column(SAEnum(OnboardingStep), default=OnboardingStep.business_name)
    onboarding_completed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    users = relationship("User", back_populates="business", cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="business", cascade="all, delete-orphan")
    reminders = relationship("Reminder", back_populates="business", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="business", cascade="all, delete-orphan")
    ai_usage_logs = relationship("AIUsageLog", back_populates="business", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_owner = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    business = relationship("Business", back_populates="users")

    __table_args__ = (
        Index("ix_users_business_id", "business_id"),
    )


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False, index=True)
    whatsapp_number = Column(String(20), nullable=False)
    display_name = Column(String(255), nullable=True)
    first_contacted_at = Column(DateTime(timezone=True), default=utcnow)
    last_contacted_at = Column(DateTime(timezone=True), default=utcnow)
    message_count = Column(Integer, default=0)
    status = Column(SAEnum(ContactStatus), default=ContactStatus.new_lead)
    priority = Column(SAEnum(PriorityLevel), default=PriorityLevel.medium)
    ai_summary = Column(Text, nullable=True)
    extracted_service = Column(String(255), nullable=True)
    extracted_budget = Column(Float, nullable=True)
    extracted_date = Column(String(100), nullable=True)
    extracted_location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    tags = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    business = relationship("Business", back_populates="contacts")
    messages = relationship("Message", back_populates="contact", cascade="all, delete-orphan", order_by="Message.created_at")
    reminders = relationship("Reminder", back_populates="contact", cascade="all, delete-orphan")
    notes_list = relationship("Note", back_populates="contact", cascade="all, delete-orphan")
    ai_insights = relationship("AIInsight", back_populates="contact", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_contacts_business_whatsapp", "business_id", "whatsapp_number"),
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    contact_id = Column(SAString(36), ForeignKey("contacts.id"), nullable=False, index=True)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False, index=True)
    whatsapp_message_id = Column(String(255), nullable=True, unique=True)
    direction = Column(SAEnum(MessageDirection), nullable=False)
    body = Column(Text, nullable=False)
    intent = Column(SAEnum(IntentType), nullable=True)
    ai_processed = Column(Boolean, default=False)
    is_simulator = Column(Boolean, default=False)  # True for dev simulator messages
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationships
    contact = relationship("Contact", back_populates="messages")

    __table_args__ = (
        Index("ix_messages_contact_created", "contact_id", "created_at"),
    )


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False, index=True)
    contact_id = Column(SAString(36), ForeignKey("contacts.id"), nullable=False)
    due_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(SAEnum(ReminderStatus), default=ReminderStatus.pending)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    business = relationship("Business", back_populates="reminders")
    contact = relationship("Contact", back_populates="reminders")

    __table_args__ = (
        Index("ix_reminders_business_due", "business_id", "due_at", "status"),
    )


class Note(Base):
    __tablename__ = "notes"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    contact_id = Column(SAString(36), ForeignKey("contacts.id"), nullable=False, index=True)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    contact = relationship("Contact", back_populates="notes_list")


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    contact_id = Column(SAString(36), ForeignKey("contacts.id"), nullable=False)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False)
    message_id = Column(SAString(36), ForeignKey("messages.id"), nullable=True)
    intent = Column(SAEnum(IntentType), nullable=True)
    priority = Column(SAEnum(PriorityLevel), nullable=True)
    summary = Column(Text, nullable=True)
    customer_name = Column(String(255), nullable=True)
    service = Column(String(255), nullable=True)
    budget = Column(Float, nullable=True)
    date = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)
    suggested_action = Column(String(500), nullable=True)
    needs_followup = Column(Boolean, default=False)
    followup_hours = Column(Integer, nullable=True)
    raw_response = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    contact = relationship("Contact", back_populates="ai_insights")

    __table_args__ = (
        Index("ix_ai_insights_contact", "contact_id"),
    )


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False)
    message_id = Column(SAString(36), nullable=True)
    provider = Column(String(50), nullable=False, default="groq")
    model = Column(String(100), nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True, default=0.0)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    business = relationship("Business", back_populates="ai_usage_logs")

    __table_args__ = (
        Index("ix_ai_usage_business_created", "business_id", "created_at"),
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(SAString(36), primary_key=True, default=new_uuid)
    business_id = Column(SAString(36), ForeignKey("businesses.id"), nullable=False)
    plan = Column(SAEnum(PlanType), default=PlanType.trial)
    is_active = Column(Boolean, default=True)
    starts_at = Column(DateTime(timezone=True), default=utcnow)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    business = relationship("Business", back_populates="subscriptions")
