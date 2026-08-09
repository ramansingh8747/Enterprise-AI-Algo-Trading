# Broker Security & Session Architecture

## Encryption Utility
- File: backend/app/core/security/encryption.py
- Class: EncryptionUtility
- Methods:
  - encrypt(plain_text: str) -> str
  - decrypt(encrypted_text: str) -> str

## Encryption Technology
- Uses cryptography.fernet.Fernet
- Symmetric encryption
- Encryption key comes from BROKER_SECRET_KEY
- Configuration is loaded through backend/app/core/config/settings.py

## Zerodha Access Token
- Zerodha access_token must be encrypted before database persistence.
- EncryptionUtility must be reused.
- request_token must NOT be persisted because it is short-lived and single-use.

## Current Broker Credential Security
- Broker.api_key and Broker.api_secret currently exist in:
  backend/app/database/models/broker.py
- They are currently stored as plain strings.
- Do NOT modify them as part of Module 13 session implementation.

## Future Security Refactoring
- Existing Broker.api_key and Broker.api_secret should eventually use EncryptionUtility.
- This should be handled as a separate security-refactoring task.

## Architectural Decision
Broker session persistence should use:
- BrokerSession model
- encrypted access_token
- user_id
- broker_id
- expires_at
- created_at
- updated_at

Do not include:
- request_token
- JWT access token
- JWT refresh token

## Important Separation
Application JWT authentication and broker authentication are separate security domains.

Application JWT:
User authentication and application authorization.

Broker access_token:
Broker API authorization for trading and market-data operations.

Do not mix the two token systems.
