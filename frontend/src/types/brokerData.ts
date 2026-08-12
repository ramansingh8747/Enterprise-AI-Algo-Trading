export interface BrokerProfile {
  account_id: string;
  account_type: string;
  currency?: string | null;
}

export interface BrokerHolding {
  symbol: string;
  quantity: string;
  average_price: string;
}

export interface BrokerPosition {
  symbol: string;
  quantity: string;
  side: 'buy' | 'sell';
  avg_price: string;
}

export interface BrokerOrder {
  order_id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  status: string;
}

export interface BrokerQuote {
  symbol: string;
  bid: string;
  ask: string;
  last_price: string;
}
