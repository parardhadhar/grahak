"""
Grahak — Nexus AI
Main FastAPI Application
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger
from app.db.database import init_db
from app.api.routes import auth, business, contacts, webhook, dashboard, reminders, search, dev_simulator

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("🚀 Grahak starting up...")
    logger.info(f"   Environment: {settings.APP_ENV}")
    logger.info(f"   Dev mode: {settings.DEV_MODE}")
    logger.info(f"   Database: {'SQLite (dev)' if 'sqlite' in settings.DATABASE_URL else 'PostgreSQL'}")

    await init_db()

    if settings.APP_ENV == "development":
        logger.info("⚠️  DEVELOPMENT MODE — /dev/* endpoints are active")

    yield
    logger.info("🛑 Grahak shutting down...")


app = FastAPI(
    title="Grahak API",
    description="AI-powered WhatsApp CRM for Indian micro-businesses | Nexus AI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.APP_ENV == "development" else None,
    redoc_url="/redoc" if settings.APP_ENV == "development" else None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL] + (["http://localhost:3000", "http://localhost:3001"] if settings.DEV_MODE else []),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── ROUTES ────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api/v1")
app.include_router(business.router, prefix="/api/v1")
app.include_router(contacts.router, prefix="/api/v1")
app.include_router(webhook.router, prefix="/api/v1")
app.include_router(webhook.router)  # Also allow /webhook directly without /api/v1 prefix
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(reminders.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")

if settings.DEV_MODE:
    app.include_router(dev_simulator.router, prefix="/api/v1")


# ── HEALTH ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "app": "Grahak",
        "company": "Nexus AI",
        "version": "1.0.0",
        "environment": settings.APP_ENV,
        "dev_mode": settings.DEV_MODE,
    }


@app.get("/")
async def root():
    return {
        "product": "Grahak",
        "company": "Nexus AI",
        "tagline": "Your WhatsApp already has your customers. Now make it work for you.",
        "docs": "/docs" if settings.APP_ENV == "development" else "disabled in production",
    }


# ── GLOBAL ERROR HANDLER ──────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal server error"},
    )
