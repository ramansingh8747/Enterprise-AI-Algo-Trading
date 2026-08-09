from pydantic import BaseModel, ConfigDict
from decimal import Decimal

class BrokerQuoteResponse(BaseModel):
    symbol: str
    bid: Decimal
    ask: Decimal
    last_price: Decimal
    model_config = ConfigDict(from_attributes=True)
