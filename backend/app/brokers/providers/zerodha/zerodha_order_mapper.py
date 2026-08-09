from typing import Any, Dict
from kiteconnect import KiteConnect
from app.brokers.base.broker_types import BrokerOrderRequest, BrokerCancelOrderRequest

class ZerodhaOrderMapper:
    """Mapper to convert BrokerOrderRequest/BrokerCancelOrderRequest to KiteConnect 5.0.0 parameters."""

    VARIETY_MAP = {
        "REGULAR": KiteConnect.VARIETY_REGULAR,
        "AMO": KiteConnect.VARIETY_AMO,
        "CO": KiteConnect.VARIETY_CO,
        "ICEBERG": KiteConnect.VARIETY_ICEBERG,
        "AUCTION": KiteConnect.VARIETY_AUCTION
    }

    EXCHANGE_MAP = {
        "NSE": KiteConnect.EXCHANGE_NSE,
        "BSE": KiteConnect.EXCHANGE_BSE,
        "NFO": KiteConnect.EXCHANGE_NFO,
        "BFO": KiteConnect.EXCHANGE_BFO,
        "CDS": KiteConnect.EXCHANGE_CDS,
        "BCD": KiteConnect.EXCHANGE_BCD,
        "MCX": KiteConnect.EXCHANGE_MCX
    }

    TRANSACTION_MAP = {
        "BUY": KiteConnect.TRANSACTION_TYPE_BUY,
        "SELL": KiteConnect.TRANSACTION_TYPE_SELL
    }

    PRODUCT_MAP = {
        "MIS": KiteConnect.PRODUCT_MIS,
        "CNC": KiteConnect.PRODUCT_CNC,
        "NRML": KiteConnect.PRODUCT_NRML,
        "CO": KiteConnect.PRODUCT_CO
    }

    ORDER_TYPE_MAP = {
        "LIMIT": KiteConnect.ORDER_TYPE_LIMIT,
        "MARKET": KiteConnect.ORDER_TYPE_MARKET,
        "SL": KiteConnect.ORDER_TYPE_SL,
        "SLM": KiteConnect.ORDER_TYPE_SLM
    }

    @staticmethod
    def _get_variety(variety_str: str) -> str:
        variety = ZerodhaOrderMapper.VARIETY_MAP.get(variety_str.upper())
        if not variety:
            raise ValueError(f"Invalid variety: {variety_str}")
        return variety

    @staticmethod
    def map_to_sdk_params(order_data: BrokerOrderRequest) -> Dict[str, Any]:
        """Maps BrokerOrderRequest to KiteConnect SDK place_order parameters."""

        # 1. Base Validations
        if order_data.quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")
        if not order_data.symbol:
            raise ValueError("Symbol cannot be empty.")

        variety = ZerodhaOrderMapper._get_variety(order_data.variety)
        exchange = ZerodhaOrderMapper.EXCHANGE_MAP.get(order_data.exchange.upper())
        transaction_type = ZerodhaOrderMapper.TRANSACTION_MAP.get(order_data.side.upper())
        product = ZerodhaOrderMapper.PRODUCT_MAP.get(order_data.product.upper())
        order_type = ZerodhaOrderMapper.ORDER_TYPE_MAP.get(order_data.order_type.upper())

        if not exchange: raise ValueError(f"Invalid exchange: {order_data.exchange}")
        if not transaction_type: raise ValueError(f"Invalid side: {order_data.side}")
        if not product: raise ValueError(f"Invalid product: {order_data.product}")
        if not order_type: raise ValueError(f"Invalid order type: {order_data.order_type}")

        # 2. Order-Type specific validations
        if order_type == KiteConnect.ORDER_TYPE_MARKET:
            if order_data.price is not None:
                raise ValueError("Price should not be supplied for MARKET orders.")
        elif order_type == KiteConnect.ORDER_TYPE_LIMIT:
            if order_data.price is None:
                raise ValueError("Price is required for LIMIT orders.")
        elif order_type == KiteConnect.ORDER_TYPE_SL:
            if order_data.price is None or order_data.trigger_price is None:
                raise ValueError("Price and trigger_price are required for SL orders.")
        elif order_type == KiteConnect.ORDER_TYPE_SLM:
            if order_data.trigger_price is None:
                raise ValueError("Trigger price is required for SLM orders.")

        # 3. Base Mapping
        params = {
            "variety": variety,
            "exchange": exchange,
            "tradingsymbol": order_data.symbol,
            "transaction_type": transaction_type,
            "quantity": int(order_data.quantity),
            "product": product,
            "order_type": order_type,
        }

        # 4. Optional Fields and Type Conversion
        if order_data.price is not None:
            params["price"] = float(order_data.price)

        if order_data.trigger_price is not None:
            params["trigger_price"] = float(order_data.trigger_price)

        # 5. Remove None values (to mirror observed KiteConnect behavior)
        return {k: v for k, v in params.items() if v is not None}

    @staticmethod
    def map_cancel_to_sdk_params(cancel_data: BrokerCancelOrderRequest) -> Dict[str, Any]:
        """Maps BrokerCancelOrderRequest to KiteConnect SDK cancel_order parameters."""

        # 1. Validation
        if not cancel_data.order_id:
            raise ValueError("order_id cannot be empty.")

        # 2. Mapping
        params = {
            "variety": ZerodhaOrderMapper._get_variety(cancel_data.variety),
            "order_id": cancel_data.order_id,
        }

        # 3. Optional Fields
        if cancel_data.parent_order_id:
            params["parent_order_id"] = cancel_data.parent_order_id

        return params

    @staticmethod
    def map_modify_to_sdk_params(order_id: str, order_data: BrokerOrderRequest) -> Dict[str, Any]:
        """Maps modification request to KiteConnect SDK modify_order parameters."""

        if not order_id:
            raise ValueError("order_id cannot be empty.")

        params = {
            "variety": ZerodhaOrderMapper._get_variety(order_data.variety),
            "order_id": order_id,
        }

        if order_data.quantity is not None:
            if order_data.quantity <= 0:
                raise ValueError("Quantity must be greater than zero.")
            params["quantity"] = int(order_data.quantity)

        if order_data.price is not None:
            params["price"] = float(order_data.price)

        if order_data.order_type:
            order_type = ZerodhaOrderMapper.ORDER_TYPE_MAP.get(order_data.order_type.upper())
            if not order_type:
                raise ValueError(f"Invalid order type: {order_data.order_type}")

            # Add LIMIT price validation
            if order_type == KiteConnect.ORDER_TYPE_LIMIT and order_data.price is None:
                raise ValueError("Price is required for LIMIT orders.")

            params["order_type"] = order_type

        if order_data.trigger_price is not None:
            params["trigger_price"] = float(order_data.trigger_price)

        return params
