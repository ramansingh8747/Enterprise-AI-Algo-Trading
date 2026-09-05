from pathlib import Path

from app.services.strategy_import.parser import StrategyFileParser


def test_extracts_explicit_rules_from_text(tmp_path: Path):
    source = tmp_path / "strategy.txt"
    source.write_text(
        "Symbol: NIFTY\nTimeframe: 5m\nEntry: EMA 9 crosses above EMA 21\nExit: EMA 9 crosses below EMA 21\nStop Loss: 1%\n",
        encoding="utf-8",
    )
    text, config, warnings = StrategyFileParser().parse(source, ".txt")

    assert "NIFTY" in text
    assert config["symbol"] == "NIFTY"
    assert config["timeframe"] == "5m"
    assert config["entry"] == "EMA 9 crosses above EMA 21"
    assert config["exit"] == "EMA 9 crosses below EMA 21"
    assert config["stop_loss"] == "1%"
    assert warnings == []


def test_unknown_rules_are_not_invented(tmp_path: Path):
    source = tmp_path / "strategy.txt"
    source.write_text("This document describes a strategy without explicit key/value rules.", encoding="utf-8")
    _, config, warnings = StrategyFileParser().parse(source, ".txt")

    assert config == {}
    assert warnings
