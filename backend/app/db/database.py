from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import event
from app.core.config import settings
from app.core.logging import get_logger
from app.models.models import Base

logger = get_logger(__name__)


def _get_engine():
    db_url = settings.DATABASE_URL
    connect_args = {}
    if "sqlite" in db_url:
        connect_args = {"check_same_thread": False, "timeout": 60.0}
    engine = create_async_engine(
        db_url,
        connect_args=connect_args,
        echo=False,
    )
    return engine


engine = _get_engine()

# Enable WAL mode and busy timeout for concurrent SQLite reads/writes
@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    try:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=60000")
        cursor.close()
    except Exception as e:
        logger.warning(f"Could not set SQLite pragmas: {e}")

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Create all tables. Run on startup."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Database tables initialized")


async def get_db() -> AsyncSession:
    """Dependency — yields an async db session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
