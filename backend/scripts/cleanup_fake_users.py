import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.session import SessionLocal
from app.database.models import User
from sqlalchemy import text

def cleanup():
    db = SessionLocal()
    try:
        real_emails = ['raman0001@gmail.com', 'rohan@gmail.com', 'raman@gmail.com']
        real_users = db.query(User).filter(User.email.in_(real_emails)).all()
        real_ids = [str(u.id) for u in real_users]

        fake_users = db.query(User).filter(~User.email.in_(real_emails)).order_by(User.created_at.desc()).all()

        # Keep 12 demo users + 3 real = 15 total users (Page 1 has 10, Page 2 has 5)
        keep_fake = fake_users[:12]
        keep_ids = set(real_ids + [str(u.id) for u in keep_fake])

        delete_users = [u for u in fake_users if str(u.id) not in keep_ids]
        delete_ids = [str(u.id) for u in delete_users]

        print(f"Total existing users: {len(real_users) + len(fake_users)}")
        print(f"Preserving {len(keep_ids)} users ({len(real_users)} real + {len(keep_fake)} demo).")
        print(f"Deleting {len(delete_ids)} fake users...")

        if delete_ids:
            id_list = ", ".join([f"'{i}'" for i in delete_ids])

            # Delete related data
            queries = [
                f"DELETE FROM watchlist_items WHERE watchlist_id IN (SELECT id FROM watchlists WHERE user_id IN ({id_list}))",
                f"DELETE FROM watchlists WHERE user_id IN ({id_list})",
                f"DELETE FROM alerts WHERE user_id IN ({id_list})",
                f"DELETE FROM refresh_tokens WHERE user_id IN ({id_list})",
                f"DELETE FROM trading_journal_entries WHERE user_id IN ({id_list})",
                f"DELETE FROM paper_trades WHERE user_id IN ({id_list})",
                f"DELETE FROM paper_orders WHERE user_id IN ({id_list})",
                f"DELETE FROM paper_portfolios WHERE user_id IN ({id_list})",
                f"DELETE FROM strategy_signals WHERE instance_id IN (SELECT id FROM strategy_instances WHERE user_id IN ({id_list}))",
                f"DELETE FROM strategy_instances WHERE user_id IN ({id_list})",
                f"DELETE FROM broker_sessions WHERE user_id IN ({id_list})",
                f"DELETE FROM admin_audit_logs WHERE actor_user_id IN ({id_list}) OR target_user_id IN ({id_list})",
                f"DELETE FROM users WHERE id IN ({id_list})"
            ]

            for q in queries:
                try:
                    db.execute(text(q))
                except Exception as ex:
                    print(f"Notice executing query: {ex}")

            db.commit()
            print("Cleanup committed successfully.")

        remaining = db.query(User).all()
        print(f"Total remaining users in DB: {len(remaining)}")
        for u in remaining:
            print(f" - {u.username} ({u.email}) [{u.role}]")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    cleanup()
