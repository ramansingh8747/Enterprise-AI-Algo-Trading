import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.session import SessionLocal
from app.database.models import User
from app.core.security.password_service import PasswordService


def reset_password(email: str, new_password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"Error: User with email '{email}' not found.")
            return False

        user.password_hash = PasswordService.hash_password(new_password)
        db.commit()
        print(f"Success: Password for '{email}' has been reset successfully.")
        return True
    except Exception as e:
        db.rollback()
        print(f"Database error: {e}")
        return False
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Reset user password in Algo Trading Platform")
    parser.add_argument("--email", type=str, required=True, help="User email address")
    parser.add_argument("--password", type=str, required=True, help="New password")
    args = parser.parse_args()

    reset_password(args.email, args.password)
