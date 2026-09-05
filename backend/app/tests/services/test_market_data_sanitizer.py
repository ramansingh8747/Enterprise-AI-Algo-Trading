import pytest
from app.services.market_data_sanitizer import MarketDataSanitizer


def test_normal_tick_passes_validation():
    """Normal tick within intraday range (₹1,812 vs previous close ₹1,800) passes validation."""
    quote = {
        "symbol": "KOTAKBANK",
        "price": "1812.40",
        "last_price": "1812.40",
        "previous_close": "1800.00",
    }
    is_valid, sanitized, msg = MarketDataSanitizer.validate_and_sanitize_quote(quote, max_deviation_pct=20.0)
    assert is_valid is True
    assert sanitized["price"] == "1812.40"
    assert "normal" in msg.lower()


def test_outlier_tick_detected_and_sanitized():
    """Glitch tick (Kotak Bank @ ₹390.25 vs previous close ₹1,810) is flagged and sanitized."""
    glitch_quote = {
        "symbol": "KOTAKBANK",
        "price": "390.25",
        "last_price": "390.25",
        "previous_close": "1810.00",
    }
    is_valid, sanitized, msg = MarketDataSanitizer.validate_and_sanitize_quote(glitch_quote, max_deviation_pct=20.0)
    assert is_valid is False
    assert sanitized["outlier_detected"] is True
    assert sanitized["raw_outlier_price"] == 390.25
    # Price is sanitized back to verified previous close ₹1810.00
    assert sanitized["price"] == "1810.0" or sanitized["price"] == "1810.00"
    assert "outlier" in msg.lower()


def test_outlier_tick_reverts_to_fallback_cache_price():
    """Glitch tick reverts to cached fallback price when provided."""
    glitch_quote = {
        "symbol": "TCS",
        "price": "500.00", # Severe glitch on ₹3,500 stock
        "last_price": "500.00",
        "previous_close": "3500.00",
    }
    is_valid, sanitized, msg = MarketDataSanitizer.validate_and_sanitize_quote(
        glitch_quote,
        max_deviation_pct=20.0,
        fallback_price=3520.0,
    )
    assert is_valid is False
    assert sanitized["price"] == "3520.0" or sanitized["price"] == "3520.00"


def test_non_positive_price_sanitized():
    """Negative or zero price is sanitized."""
    bad_quote = {
        "symbol": "INFY",
        "price": "-10.00",
        "previous_close": "1500.00",
    }
    is_valid, sanitized, msg = MarketDataSanitizer.validate_and_sanitize_quote(
        bad_quote,
        fallback_price=1500.0,
    )
    assert is_valid is False
    assert sanitized["price"] == "1500.0" or sanitized["price"] == "1500.00"
