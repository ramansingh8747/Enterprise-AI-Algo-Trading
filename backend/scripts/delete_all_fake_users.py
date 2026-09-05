import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.database.session import SessionLocal
from app.database.models import User
from sqlalchemy import text


def execute_safe(db, sql, label=""):
    try:
        db.execute(text(sql))
        db.commit()
        return True
    except Exception as ex:
        db.rollback()
        print(f"  [skip] {label}: {type(ex).__name__}")
        return False


def run():
    db = SessionLocal()
    try:
        real_emails = ['raman0001@gmail.com', 'rohan@gmail.com', 'raman@gmail.com']
        to_delete = db.query(User).filter(~User.email.in_(real_emails)).all()
        delete_ids = [str(u.id) for u in to_delete]

        print(f"Real users to keep: {len(real_emails)}")
        print(f"Fake users to delete: {len(delete_ids)}")

        if not delete_ids:
            print("Nothing to delete!")
        else:
            id_list = ", ".join([f"'{uid}'" for uid in delete_ids])

            steps = [
                ("watchlist_items",
                 f"DELETE FROM watchlist_items WHERE watchlist_id IN (SELECT id FROM watchlists WHERE user_id IN ({id_list}))"),
                ("watchlists",          f"DELETE FROM watchlists WHERE user_id IN ({id_list})"),
                ("alerts",              f"DELETE FROM alerts WHERE user_id IN ({id_list})"),
                ("refresh_tokens",      f"DELETE FROM refresh_tokens WHERE user_id IN ({id_list})"),
                ("trading_journal",     f"DELETE FROM trading_journal WHERE user_id IN ({id_list})"),
                ("trading_journal_entries", f"DELETE FROM trading_journal_entries WHERE user_id IN ({id_list})"),
                ("paper_positions",     f"DELETE FROM paper_positions WHERE user_id IN ({id_list})"),
                ("paper_portfolios",    f"DELETE FROM paper_portfolios WHERE user_id IN ({id_list})"),
                ("strategy_signals via instances",
                 f"DELETE FROM strategy_signals WHERE instance_id IN (SELECT id FROM strategy_instances WHERE user_id IN ({id_list}))"),
                ("strategy_signals direct", f"DELETE FROM strategy_signals WHERE user_id IN ({id_list})"),
                ("strategy_instances",  f"DELETE FROM strategy_instances WHERE user_id IN ({id_list})"),
                ("strategy_definitions",f"DELETE FROM strategy_definitions WHERE user_id IN ({id_list})"),
                ("trading_risk_settings", f"DELETE FROM trading_risk_settings WHERE user_id IN ({id_list})"),
                ("order_idempotency",   f"DELETE FROM order_idempotency_records WHERE user_id IN ({id_list})"),
                ("broker_sessions",     f"DELETE FROM broker_sessions WHERE user_id IN ({id_list})"),
                ("broker_order_records",f"DELETE FROM broker_order_records WHERE user_id IN ({id_list})"),
                ("trading_executions",  f"DELETE FROM trading_executions WHERE user_id IN ({id_list})"),
                ("trading_positions",   f"DELETE FROM trading_positions WHERE user_id IN ({id_list})"),
                ("admin_audit_logs actor",  f"DELETE FROM admin_audit_logs WHERE actor_user_id IN ({id_list})"),
                ("admin_audit_logs target", f"DELETE FROM admin_audit_logs WHERE target_user_id IN ({id_list})"),
            ]

            for label, sql in steps:
                execute_safe(db, sql, label)

            # Final delete
            try:
                res = db.execute(text(f"DELETE FROM users WHERE id IN ({id_list})"))
                db.commit()
                print(f"\nDeleted {res.rowcount} fake users!")
            except Exception as e:
                db.rollback()
                print(f"Error deleting users: {e}")
                return

        remaining = db.query(User).order_by(User.created_at.desc()).all()
        total_pages = (len(remaining) + 9) // 10
        print(f"\n=== FINAL STATE ===")
        print(f"Total users: {len(remaining)} | Pages: {total_pages}")
        print("-" * 70)
        for idx, u in enumerate(remaining, 1):
            print(f"  {idx:2d}. {u.username:20s} | {u.email:35s} | {str(u.role).replace('UserRole.', '')}")

    except Exception as e:
        db.rollback()
        print(f"Fatal error: {e}")
    finally:
        db.close()


if __name__ == '__main__':
    run()
