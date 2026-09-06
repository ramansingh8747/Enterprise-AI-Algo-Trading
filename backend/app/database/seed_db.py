"""
Database seeder for Cloud UAT deployment.
Automatically seeds users, brokers, strategies, instances, and portfolios
from seed_data.json if the database is newly provisioned.
"""
import os
import json
from pathlib import Path
from sqlalchemy import text
from app.database.session import SessionLocal
from app.database.models.user import User
from app.database.models.broker import Broker
from app.database.models.strategy import StrategyDefinition, StrategyInstance
from app.database.models.paper_portfolio import PaperPortfolio
from app.core.logging.logger import logger


def seed_database():
    seed_path = Path(__file__).parent / "seed_data.json"
    if not seed_path.exists():
        logger.info("[Seeder] No seed_data.json found. Skipping seed.")
        return

    db = SessionLocal()
    try:
        user_count = db.execute(text("SELECT count(*) FROM users")).scalar()
        if user_count and user_count > 0:
            logger.info(f"[Seeder] Database already contains {user_count} users. Skipping seeder.")
            return

        logger.info("[Seeder] Initializing fresh database with UAT seed data...")
        with open(seed_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        mapping = [
            ("users", User),
            ("brokers", Broker),
            ("strategy_definitions", StrategyDefinition),
            ("strategy_instances", StrategyInstance),
            ("paper_portfolios", PaperPortfolio),
        ]

        for table_key, model_cls in mapping:
            rows = data.get(table_key, [])
            if rows:
                db.execute(model_cls.__table__.insert(), rows)
                logger.info(f"[Seeder] Seeded {len(rows)} rows into {table_key}.")

        db.commit()
        logger.info("[Seeder] Successfully completed seeding fresh database!")
    except Exception as e:
        logger.error(f"[Seeder] Error during database seeding: {e}")
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
