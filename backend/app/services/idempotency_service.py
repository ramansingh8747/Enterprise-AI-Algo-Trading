import hashlib
import json
from typing import Any, Callable, Dict, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel

from app.database.models.order_idempotency import OrderIdempotencyRecord
from app.database.repositories.order_idempotency_repository import OrderIdempotencyRepository
from app.exceptions.idempotency_exceptions import (
    IdempotencyConflictException,
    IdempotencyPayloadMismatchException,
)
from app.core.logging.logger import logger

T = TypeVar("T")


class IdempotencyService:
    """
    Service layer providing idempotency protection for order execution requests.
    Prevents duplicate execution of broker orders when identical requests are retried.
    """

    def __init__(self, repository: OrderIdempotencyRepository) -> None:
        self.repository = repository

    @staticmethod
    def compute_request_hash(payload_data: Dict[str, Any]) -> str:
        """
        Generates a deterministic SHA-256 hash of non-sensitive request parameters.
        Canonicalizes floats/decimals and string values.
        """
        sanitized: Dict[str, Any] = {}
        sensitive_keys = {"api_key", "api_secret", "access_token", "password", "token", "jwt"}

        for k, v in sorted(payload_data.items()):
            if k.lower() in sensitive_keys:
                continue
            if v is None:
                sanitized[k] = None
            else:
                sanitized[k] = str(v)

        canonical_json = json.dumps(sanitized, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

    def execute_idempotent_order(
        self,
        user_id: UUID,
        broker_id: UUID,
        idempotency_key: str,
        request_payload: Dict[str, Any],
        execute_fn: Callable[[], T],
        deserialize_fn: Callable[[Dict[str, Any]], T],
        serialize_fn: Callable[[T], Dict[str, Any]],
    ) -> T:
        """
        Executes order logic with idempotency protection.

        - If idempotency_key is None or empty, executes execute_fn directly (backwards-compatible).
        - If matching completed record exists with identical hash, returns stored response.
        - If matching completed record exists with different hash, raises 409 Payload Mismatch error.
        - If matching pending record exists, raises 409 Concurrent Conflict error.
        - Otherwise, records PENDING state, executes order, records COMPLETED/FAILED, and returns result.
        """
        if not idempotency_key or not idempotency_key.strip():
            return execute_fn()

        clean_key = idempotency_key.strip()
        current_hash = self.compute_request_hash(request_payload)

        record, created = self.repository.get_or_create_pending(
            user_id=user_id,
            broker_id=broker_id,
            idempotency_key=clean_key,
            request_hash=current_hash,
        )

        if not created:
            # Replaying or concurrent request
            if record.request_hash != current_hash:
                logger.warning(
                    f"Idempotency payload mismatch for key={clean_key}, user_id={user_id}, broker_id={broker_id}"
                )
                raise IdempotencyPayloadMismatchException(
                    message="Idempotency key reuse detected with different order parameters."
                )

            if record.status == "PENDING":
                logger.warning(
                    f"Idempotency concurrent conflict for key={clean_key}, user_id={user_id}, broker_id={broker_id}"
                )
                raise IdempotencyConflictException(
                    message="Order request with this idempotency key is currently in-flight."
                )

            if record.status == "COMPLETED" and record.response_payload:
                logger.info(
                    f"Returning stored idempotent order response for key={clean_key}, user_id={user_id}, broker_id={broker_id}"
                )
                payload_dict = json.loads(record.response_payload)
                return deserialize_fn(payload_dict)

            if record.status == "FAILED" and record.response_payload:
                logger.info(
                    f"Replaying stored failed idempotency record for key={clean_key}, user_id={user_id}, broker_id={broker_id}"
                )
                payload_dict = json.loads(record.response_payload)
                raise Exception(payload_dict.get("error", "Previous order request failed."))

        # First execution attempt
        try:
            result = execute_fn()
            serialized_result = serialize_fn(result)
            order_id = serialized_result.get("order_id")

            self.repository.mark_completed(
                record_id=record.id,
                order_id=str(order_id) if order_id else None,
                response_payload=json.dumps(serialized_result),
            )
            return result
        except Exception as exc:
            err_dict = {"error": str(exc)}
            self.repository.mark_failed(
                record_id=record.id,
                response_payload=json.dumps(err_dict),
            )
            raise exc
