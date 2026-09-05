from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.core.config.settings import settings


# Use psycopg2 consistently with the project's local DATABASE_URL
# (postgresql+psycopg2://...). This avoids the broken/mixed psycopg3/libpq
# installation that can prevent FastAPI from starting on Windows.
database_url = settings.DATABASE_URL
if database_url.startswith("postgresql+psycopg2://"):
    try:
        import psycopg2
    except ImportError:
        try:
            import psycopg
            database_url = database_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
        except ImportError:
            pass

engine_kwargs = {
    "future": True,
    "pool_pre_ping": True,
    "pool_recycle": getattr(settings, "DB_POOL_RECYCLE", 1800),
}
if not database_url.startswith("sqlite"):
    engine_kwargs.update({
        "pool_size": getattr(settings, "DB_POOL_SIZE", 30),
        "max_overflow": getattr(settings, "DB_MAX_OVERFLOW", 50),
        "pool_timeout": getattr(settings, "DB_POOL_TIMEOUT", 60.0),
    })

engine = create_engine(
    database_url,
    **engine_kwargs,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
    future=True,
    class_=Session,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()