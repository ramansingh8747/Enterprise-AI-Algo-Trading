from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Optional, Tuple

PRECISION_TWO = Decimal("0.01")
PRECISION_FOUR = Decimal("0.0001")


class TransactionCostService:
    """
    Indian Stock Market (NSE/BSE) Regulatory & Transaction Costs Calculator.
    
    Supports:
    1. Dynamic Slippage (0.05% - 0.10% based on volatility).
    2. Delivery (CNC) vs Intraday (MIS) conditional taxes & charges:
       - STT: Delivery = 0.10% both sides; Intraday = 0.025% SELL side only.
       - Stamp Duty: Delivery = 0.015% BUY only; Intraday = 0.003% BUY only.
       - Brokerage: Delivery = Rs 0; Intraday = min(Rs 20, 0.03% of turnover).
       - Exchange Txn Fee (NSE): 0.00297%
       - SEBI Turnover Fee: Rs 10 / crore (0.0001%)
       - GST: 18% on (Brokerage + Exchange Txn Fee + SEBI Fee)
    """

    @staticmethod
    def calculate_slippage(
        price: Decimal,
        side: str,
        volatility_pct: Optional[Decimal] = None,
        base_slippage: Decimal = Decimal("0.0005"),  # 0.05%
        max_slippage: Decimal = Decimal("0.0010"),   # 0.10%
    ) -> Tuple[Decimal, Decimal, Decimal]:
        """
        Calculates realistic slippage based on volatility.
        Returns: (effective_price, slippage_amount, slippage_rate)
        """
        px = Decimal(str(price))
        normalized_side = str(side).upper().strip()

        if volatility_pct is not None and volatility_pct > Decimal("0"):
            # Scale slippage between 0.05% and 0.10% based on price swing
            vol_factor = min(Decimal("1.0"), Decimal(str(volatility_pct)) / Decimal("3.0"))
            slippage_rate = base_slippage + (vol_factor * (max_slippage - base_slippage))
        else:
            slippage_rate = base_slippage

        slippage_amount = (px * slippage_rate).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)

        if normalized_side == "BUY":
            effective_price = (px + slippage_amount).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)
        else:
            effective_price = max(Decimal("0.01"), (px - slippage_amount).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP))

        return effective_price, slippage_amount, slippage_rate

    @staticmethod
    def calculate_transaction_costs(
        traded_value: Decimal,
        side: str,
        product: str = "CNC",
        exchange: str = "NSE",
    ) -> Dict[str, Decimal]:
        """
        Calculates all regulatory taxes and brokerage charges for a trade.
        """
        val = Decimal(str(traded_value)).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)
        norm_side = str(side).upper().strip()
        norm_product = str(product).upper().strip()  # CNC (Delivery) or MIS (Intraday)

        is_delivery = norm_product in ("CNC", "DELIVERY")
        is_buy = norm_side == "BUY"
        is_sell = norm_side == "SELL"

        # 1. Brokerage (Zerodha / Discount Broker Model)
        if is_delivery:
            brokerage = Decimal("0.00")
        else:
            # Intraday: min(Rs 20, 0.03% of turnover)
            brokerage = min(Decimal("20.00"), (val * Decimal("0.0003"))).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)

        # 2. STT (Securities Transaction Tax)
        if is_delivery:
            # 0.10% on both BUY & SELL
            stt = (val * Decimal("0.0010")).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)
        else:
            # 0.025% on SELL only
            stt = (val * Decimal("0.00025")).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP) if is_sell else Decimal("0.00")

        # 3. Exchange Transaction Charges (NSE: 0.00297%, BSE: 0.00375%)
        exchange_rate = Decimal("0.0000375") if exchange.upper() == "BSE" else Decimal("0.0000297")
        exchange_charges = (val * exchange_rate).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)

        # 4. SEBI Turnover Fee (Rs 10 per crore = 0.0001%)
        sebi_charges = (val * Decimal("0.000001")).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)

        # 5. Stamp Duty (BUY only: Delivery = 0.015%, Intraday = 0.003%)
        if is_buy:
            stamp_rate = Decimal("0.00015") if is_delivery else Decimal("0.00003")
            stamp_duty = (val * stamp_rate).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)
        else:
            stamp_duty = Decimal("0.00")

        # 6. GST (18% on Brokerage + Exchange Charges + SEBI Charges)
        gst_base = brokerage + exchange_charges + sebi_charges
        gst = (gst_base * Decimal("0.18")).quantize(PRECISION_TWO, rounding=ROUND_HALF_UP)

        # 7. Total Transaction Charges
        total_charges = (brokerage + stt + exchange_charges + sebi_charges + stamp_duty + gst).quantize(
            PRECISION_TWO, rounding=ROUND_HALF_UP
        )

        return {
            "traded_value": val,
            "brokerage": brokerage,
            "stt": stt,
            "exchange_charges": exchange_charges,
            "sebi_charges": sebi_charges,
            "stamp_duty": stamp_duty,
            "gst": gst,
            "total_charges": total_charges,
            "product": "CNC" if is_delivery else "MIS",
        }
