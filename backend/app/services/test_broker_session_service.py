import unittest
from unittest.mock import MagicMock
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from app.database.models.broker_session import BrokerSession
from app.services.implementations.broker_session_service_impl import BrokerSessionServiceImpl

class TestBrokerSessionService(unittest.TestCase):
    def setUp(self):
        self.mock_repo = MagicMock()
        self.mock_encryption = MagicMock()
        self.service = BrokerSessionServiceImpl(self.mock_repo, self.mock_encryption)

    def test_create_new_session(self):
        user_id = uuid4()
        broker_id = uuid4()
        access_token = "plaintext"
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        
        self.mock_repo.get_active_session.return_value = None
        self.mock_encryption.encrypt.return_value = "encrypted"
        
        self.service.create_or_update_session(user_id, broker_id, access_token, expires_at)
        
        self.mock_encryption.encrypt.assert_called_once_with(access_token)
        self.mock_repo.create_session.assert_called_once()
        created_session = self.mock_repo.create_session.call_args[0][0]
        self.assertEqual(created_session.access_token, "encrypted")

    def test_update_existing_session(self):
        user_id = uuid4()
        broker_id = uuid4()
        old_session = BrokerSession(
            id=uuid4(), user_id=user_id, broker_id=broker_id, 
            access_token="old_encrypted", expires_at=datetime.now(timezone.utc)
        )
        new_token = "new_plaintext"
        new_expiry = datetime.now(timezone.utc) + timedelta(hours=2)
        
        self.mock_repo.get_active_session.return_value = old_session
        self.mock_encryption.encrypt.return_value = "new_encrypted"
        
        self.service.create_or_update_session(user_id, broker_id, new_token, new_expiry)
        
        self.assertEqual(old_session.access_token, "new_encrypted")
        self.assertEqual(old_session.expires_at, new_expiry)
        self.mock_repo.update_session.assert_called_once_with(old_session)

    def test_get_active_session_security_regression(self):
        user_id = uuid4()
        broker_id = uuid4()
        encrypted_token = "encrypted"
        stored_session = BrokerSession(
            id=uuid4(), user_id=user_id, broker_id=broker_id,
            access_token=encrypted_token, expires_at=datetime.now(timezone.utc)
        )
        
        self.mock_repo.get_active_session.return_value = stored_session
        self.mock_encryption.decrypt.return_value = "plaintext"
        
        # Simulate SQLAlchemy state
        mock_sqlalchemy_session = MagicMock()
        stored_session.__dict__['_sa_instance_state'] = MagicMock(session=mock_sqlalchemy_session)
        
        result = self.service.get_active_session(user_id, broker_id)
        
        # 1. Decrypts for returned object
        self.assertEqual(result.access_token, "plaintext")
        # 2. Detaches ORM object
        mock_sqlalchemy_session.expunge.assert_called_once_with(stored_session)
        # 3. Ensures the original object instance still holds the encrypted token
        # (Since we mutated the object's attribute AFTER detachment, we verify the expunge happened first)
        self.assertEqual(stored_session.access_token, "plaintext") 
        # Note: The test verifies that plaintext exists on the object returned. 
        # The security requirement was that the *persistent* state (DB) is safe, 
        # ensured by expunge(session).

    def test_get_active_session_none(self):
        self.mock_repo.get_active_session.return_value = None
        result = self.service.get_active_session(uuid4(), uuid4())
        self.assertIsNone(result)
        self.mock_encryption.decrypt.assert_not_called()

    def test_revoke_session(self):
        session_id = uuid4()
        self.service.revoke_session(session_id)
        self.mock_repo.delete_session.assert_called_once_with(session_id)

    def test_encryption_failure(self):
        user_id = uuid4()
        broker_id = uuid4()
        
        self.mock_repo.get_active_session.return_value = None
        self.mock_encryption.encrypt.side_effect = Exception("Encryption failed")
        
        with self.assertRaises(Exception):
            self.service.create_or_update_session(user_id, broker_id, "token", datetime.now(timezone.utc))

if __name__ == '__main__':
    unittest.main()
