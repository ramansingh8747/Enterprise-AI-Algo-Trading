from typing import Optional, Any
from kiteconnect.exceptions import TokenException, OrderException, NetworkException, KiteException

class MockKiteConnectClient:
    """Standalone fake KiteConnect client for deterministic testing."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.access_token = None
        self.exception_to_raise: Optional[Exception] = None

    def set_access_token(self, access_token: str):
        self.access_token = access_token

    def set_side_effect(self, exception: Optional[Exception]):
        self.exception_to_raise = exception

    def place_order(
        self,
        variety: str,
        exchange: str,
        tradingsymbol: str,
        transaction_type: str,
        quantity: int,
        product: str,
        order_type: str,
        price: Optional[float] = None,
        validity: Optional[str] = None,
        validity_ttl: Optional[int] = None,
        disclosed_quantity: Optional[int] = None,
        trigger_price: Optional[float] = None,
        iceberg_legs: Optional[int] = None,
        iceberg_quantity: Optional[int] = None,
        auction_number: Optional[int] = None,
        tag: Optional[str] = None
    ) -> str:

        # 1. Simulate Exception Injection
        if self.exception_to_raise:
            raise self.exception_to_raise

        # 2. Basic Contract Validation (Ensuring mapping calls are correct)
        if not variety or not exchange or not tradingsymbol or not transaction_type or not quantity or not product or not order_type:
            raise ValueError("Missing required parameters for place_order")

        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero")

        # 3. Success Behavior
        return "MOCK-ORDER-000001"

    def cancel_order(
        self,
        variety: str,
        order_id: str,
        parent_order_id: Optional[str] = None
    ) -> str:
        # 1. Simulate Exception Injection
        if self.exception_to_raise:
            raise self.exception_to_raise

        # 2. Basic Contract Validation
        if not variety or not order_id:
            raise ValueError("Missing required parameters for cancel_order")

        # 3. Success Behavior
        return order_id

    def modify_order(
        self,
        variety: str,
        order_id: str,
        parent_order_id: Optional[str] = None,
        quantity: Optional[int] = None,
        price: Optional[float] = None,
        order_type: Optional[str] = None,
        trigger_price: Optional[float] = None,
        validity: Optional[str] = None,
        disclosed_quantity: Optional[int] = None
    ) -> str:
        # 1. Simulate Exception Injection
        if self.exception_to_raise:
            raise self.exception_to_raise

        # 2. Basic Contract Validation
        if not variety or not order_id:
            raise ValueError("Missing required parameters for modify_order")

        # 3. Success Behavior
        return order_id
