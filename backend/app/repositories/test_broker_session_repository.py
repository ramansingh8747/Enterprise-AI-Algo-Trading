import unittest
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.base import Base
from app.database.models.broker_session import BrokerSession
from app.repositories.implementations.broker_session_repository_impl import BrokerSessionRepositoryImpl

class TestBrokerSessionRepository(unittest.TestCase):
    def setUp(self):
        # Create an in-memory SQLite database
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.session = Session()
        self.repo = BrokerSessionRepositoryImpl(self.session)

    def tearDown(self):
        self.session.close()
        Base.metadata.drop_all(self.engine)

    def create_sample_session(self, user_id=None, broker_id=None, expires_at=None):
        session = BrokerSession(
            id=uuid4(),
            user_id=user_id or uuid4(),
            broker_id=broker_id or uuid4(),
            access_token="encrypted_token",
            expires_at=expires_at or datetime.now(timezone.utc) + timedelta(hours=1),
        )
        self.repo.create_session(session)
        return session

    def test_create_session(self):
        session = BrokerSession(
            id=uuid4(),
            user_id=uuid4(),
            broker_id=uuid4(),
            access_token="token",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        created = self.repo.create_session(session)
        self.assertIsNotNone(created.id)

    def test_get_active_session_success(self):
        user_id = uuid4()
        broker_id = uuid4()
        self.create_sample_session(user_id=user_id, broker_id=broker_id)
        
        session = self.repo.get_active_session(user_id, broker_id)
        self.assertIsNotNone(session)
        self.assertEqual(session.user_id, user_id)

    def test_get_active_session_expired(self):
        user_id = uuid4()
        broker_id = uuid4()
        self.create_sample_session(
            user_id=user_id, 
            broker_id=broker_id, 
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1)
        )
        
        session = self.repo.get_active_session(user_id, broker_id)
        self.assertIsNone(session)

    def test_get_active_session_wrong_user(self):
        user_id = uuid4()
        broker_id = uuid4()
        self.create_sample_session(user_id=user_id, broker_id=broker_id)
        
        session = self.repo.get_active_session(uuid4(), broker_id)
        self.assertIsNone(session)

    def test_get_active_session_wrong_broker(self):
        user_id = uuid4()
        broker_id = uuid4()
        self.create_sample_session(user_id=user_id, broker_id=broker_id)
        
        session = self.repo.get_active_session(user_id, uuid4())
        self.assertIsNone(session)

    def test_update_session(self):
        session = self.create_sample_session()
        session.access_token = "new_token"
        
        updated = self.repo.update_session(session)
        self.assertEqual(updated.access_token, "new_token")

    def test_delete_session(self):
        session = self.create_sample_session()
        self.repo.delete_session(session.id)
        
        deleted = self.repo.get_by_id(BrokerSession, session.id)
        self.assertIsNone(deleted)

    def test_delete_session_non_existing(self):
        # Existing convention: should just do nothing if not found, 
        # as per implementation "if session: super().delete(session)"
        try:
            self.repo.delete_session(uuid4())
        except Exception as e:
            self.fail(f"delete_session raised {type(e).__name__} unexpectedly!")

if __name__ == '__main__':
    unittest.main()
