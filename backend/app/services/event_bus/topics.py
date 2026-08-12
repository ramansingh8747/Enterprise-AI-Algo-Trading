from typing import Optional
from uuid import UUID

class Topic:
    @staticmethod
    def market(symbol: str) -> str:
        return f"market:{symbol.upper()}"

    @staticmethod
    def strategy(instance_id: UUID) -> str:
        return f"strategy:{instance_id}"

    @staticmethod
    def paper_strategy(instance_id: UUID) -> str:
        return f"paper:strategy:{instance_id}"

    @staticmethod
    def live_strategy(instance_id: UUID) -> str:
        return f"live:strategy:{instance_id}"

    @staticmethod
    def validate(topic: str) -> bool:
        # Basic validation for now
        parts = topic.split(":")
        if len(parts) < 2:
            return False
        return True
