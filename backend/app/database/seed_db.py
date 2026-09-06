"""
Database seeder for Cloud UAT deployment.
Automatically seeds users, brokers, strategies, instances, and portfolios
from seed_data.json if the database is newly provisioned.
"""
import os
import json
from pathlib import Path
from uuid import UUID
from datetime import datetime
from sqlalchemy import text
from app.database.session import SessionLocal
from app.database.models.user import User, UserRole
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

        # 1. Users
        for u in data.get("users", []):
            user_obj = User(
                id=UUID(u["id"]),
                email=u["email"],
                username=u["username"],
                full_name=u["full_name"],
                password_hash=u["password_hash"],
                phone_number=u["phone_number"],
                role=UserRole(u["role"]),
                is_active=u["is_active"],
                is_verified=u["is_verified"],
                created_at=datetime.fromisoformat(u["created_at"]) if u.get("created_at") else None,
                updated_at=datetime.fromisoformat(u["updated_at"]) if u.get("updated_at") else None,
            )
            db.add(user_obj)
        db.flush()
        logger.info(f"[Seeder] Seeded {len(data.get('users', []))} users.")

        # 2. Brokers
        for b in data.get("brokers", []):
            b_obj = Broker(
                id=UUID(b["id"]),
                broker_name=b["broker_name"],
                broker_type=b["roker_type"],
                is_active=b["is_active"],
                api_key=b.get("api_key"),
                api_secret=b.get("api_secret"),
                client_id=b.get("client_id"),
            )
            db.add(b_obj)
        db.flush()
        logger.info(f"[Seeder] Seeded {len(data.get('brokers', []))} brokers.")

        # 3. Strategy definitions
        for sd in data.get("strategy_definitions", []):
            sd_obj = StrategyDefinition(
                id=UUID(sd["id"]),
                user_id=UUID(sd["user_id"]),
                name=sd["name"],
                strategy_type=sd["strategy_type"],
                config_json=sd["config_json"],
                is_active=sd["is_active"],
            )
            db.add(sd_obj)
        db.flush()
        logger.info(f"[Seeder] Seeded {len(data.get('strategy_definitions', []))} strategy definitions.")

        # 4. Strategy instances
        for si in data.get("strategy_instances", []):
            si_obj = StrategyInstance(
                id=UUID(si["id"]),
                strategy_definition_id=UUID(si["strategy_definition_id"]),
                user_id=UUID(si["user_id"]),
                broker_id=UUID(si["broker_id"]) if si.get("broker_id") else None,
                execution_mode=si["execution_mode"],
                status=si["status"],
            )
            db.add(si_obj)
        db.flush()
        logger.info(f"[Seeder] Seeded {len(data.get('strategy_instances', []))} strategy instances.")

        # 5. Paper portfolios
        for pp in data.get("paper_portfolios", []):
            pp_obj = PaperPortfolio(
                id=UUID(pp["id"]),
                user_id=UUID(pp["user_id"]),
                strategy_instance_id=UUID(pp["strategy_instance_id"]) if pp.get("strategy_instance_id") else None,
                name=pp.get("name", "Portfolio"),
                execution_mode=pp.get("execution_mode", "PAPER"),
                currency=pp.get("currency", "INR"),
                initial_balance=pp.get("initial_balance", 1000000.0),
                cash_balance=pp.get("cash_balance", 1000000.0),
                realized_pnl=pp.get("realized_pnl", 0.0),
            )
            db.add(pp_obj)
        db.flush()
        logger.info(f"[Seeder] Seeded {len(data.get('paper_portfolios', []))} paper portfolios.")

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
