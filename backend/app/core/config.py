from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./grahak_dev.db"
    SUPABASE_URL: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None

    # AI
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    AI_MAX_TOKENS: int = 1024
    AI_TEMPERATURE: float = 0.1

    # WhatsApp
    WHATSAPP_ACCESS_TOKEN: Optional[str] = None
    WHATSAPP_PHONE_NUMBER_ID: Optional[str] = None
    WHATSAPP_BUSINESS_ACCOUNT_ID: Optional[str] = None
    WHATSAPP_VERIFY_TOKEN: str = ""
    WHATSAPP_APP_SECRET: Optional[str] = None
    WHATSAPP_TEST_NUMBER: Optional[str] = None
    WHATSAPP_BRIDGE_URL: str = "http://localhost:5001"
    WHATSAPP_BRIDGE_TOKEN: Optional[str] = None
    WHATSAPP_BRIDGE_BUSINESS_ID: Optional[str] = None

    # Gemini AI (secondary)
    GEMINI_API_KEY: Optional[str] = None

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    # Redis
    REDIS_URL: Optional[str] = None

    # Dev Mode
    DEV_MODE: bool = True

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
