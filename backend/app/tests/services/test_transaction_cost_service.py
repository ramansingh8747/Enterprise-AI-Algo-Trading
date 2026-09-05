from decimal import Decimal
import pytest
from app.services.transaction_cost_service import TransactionCostService


def test_delivery_cnc_transaction_costs_buy():
    # Rs 1,00,000 Delivery BUY
    costs = TransactionCostService.calculate_transaction_costs(
        traded_value=Decimal("100000.00"),
        side="BUY",
        product="CNC",
        exchange="NSE",
    )
    # Delivery Brokerage = 0
    assert costs["brokerage"] == Decimal("0.00")
    # STT = 0.10% of 1,00,000 = 100.00
    assert costs["stt"] == Decimal("100.00")
    # Exchange Fee = 0.00297% of 1,00,000 = 2.97
    assert costs["exchange_charges"] == Decimal("2.97")
    # SEBI Fee = Rs 10/crore = 0.10
    assert costs["sebi_charges"] == Decimal("0.10")
    # Stamp Duty = 0.015% on BUY = 15.00
    assert costs["stamp_duty"] == Decimal("15.00")
    # GST = 18% of (0 + 2.97 + 0.10) = 18% of 3.07 = 0.55
    assert costs["gst"] == Decimal("0.55")
    # Total = 0 + 100 + 2.97 + 0.10 + 15 + 0.55 = 118.62
    assert costs["total_charges"] == Decimal("118.62")


def test_delivery_cnc_transaction_costs_sell():
    # Rs 1,00,000 Delivery SELL
    costs = TransactionCostService.calculate_transaction_costs(
        traded_value=Decimal("100000.00"),
        side="SELL",
        product="CNC",
        exchange="NSE",
    )
    # Delivery Brokerage = 0
    assert costs["brokerage"] == Decimal("0.00")
    # STT = 0.10% of 1,00,000 = 100.00
    assert costs["stt"] == Decimal("100.00")
    # Stamp Duty = 0 on SELL
    assert costs["stamp_duty"] == Decimal("0.00")
    # Total charges on Delivery SELL (100 + 2.97 + 0.10 + 0.55) = 103.62
    assert costs["total_charges"] == Decimal("103.62")


def test_intraday_mis_transaction_costs_buy():
    # Rs 1,00,000 Intraday BUY
    costs = TransactionCostService.calculate_transaction_costs(
        traded_value=Decimal("100000.00"),
        side="BUY",
        product="MIS",
        exchange="NSE",
    )
    # Intraday Brokerage = min(20, 0.03% of 1,00,000 = 30) = 20.00
    assert costs["brokerage"] == Decimal("20.00")
    # STT = 0 on Intraday BUY
    assert costs["stt"] == Decimal("0.00")
    # Stamp Duty = 0.003% on Intraday BUY = 3.00
    assert costs["stamp_duty"] == Decimal("3.00")
    # Exchange Fee = 2.97, SEBI = 0.10
    # GST = 18% of (20 + 2.97 + 0.10) = 18% of 23.07 = 4.15
    assert costs["gst"] == Decimal("4.15")
    # Total = 20 + 0 + 2.97 + 0.10 + 3 + 4.15 = 30.22
    assert costs["total_charges"] == Decimal("30.22")


def test_intraday_mis_transaction_costs_sell():
    # Rs 1,00,000 Intraday SELL
    costs = TransactionCostService.calculate_transaction_costs(
        traded_value=Decimal("100000.00"),
        side="SELL",
        product="MIS",
        exchange="NSE",
    )
    # Intraday Brokerage = 20.00
    assert costs["brokerage"] == Decimal("20.00")
    # STT = 0.025% on Intraday SELL = 25.00
    assert costs["stt"] == Decimal("25.00")
    # Stamp Duty = 0 on SELL
    assert costs["stamp_duty"] == Decimal("0.00")
    # Total = 20 + 25 + 2.97 + 0.10 + 0 + 4.15 = 52.22
    assert costs["total_charges"] == Decimal("52.22")


def test_dynamic_slippage_calculation():
    # Base 0.05% slippage on Rs 1000 BUY
    eff_px_buy, slip_amt_buy, rate_buy = TransactionCostService.calculate_slippage(
        price=Decimal("1000.00"),
        side="BUY",
        volatility_pct=Decimal("0.5"),
    )
    assert eff_px_buy > Decimal("1000.00")
    assert rate_buy >= Decimal("0.0005")

    # Base 0.05% slippage on Rs 1000 SELL
    eff_px_sell, slip_amt_sell, rate_sell = TransactionCostService.calculate_slippage(
        price=Decimal("1000.00"),
        side="SELL",
        volatility_pct=Decimal("0.5"),
    )
    assert eff_px_sell < Decimal("1000.00")
