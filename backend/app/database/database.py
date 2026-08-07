from app.database.base import Base
from app.database.session import engine
from app.core.config.settings import settings
from app.core.logging.logger import logger

def init_db() -> None:
    """
    Initialize database tables.
    NOTE: This is for development purposes only. 
    In production, use Alembic migrations.
    """
    if settings.DEBUG:
        logger.info("Initializing database tables (Development Mode)")
        Base.metadata.create_all(bind=engine)
    else:
        logger.warning("Database initialization skipped. Use Alembic for production.")
