import sys
from loguru import logger
from app.core.config.settings import settings

# Configure loguru to use console logging
logger.remove()
logger.add(
    sys.stderr,
    level=settings.LOG_LEVEL,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    enqueue=True,
    serialize=False,
)

# Export the configured logger
logger = logger.bind(name="enterprise-app")
