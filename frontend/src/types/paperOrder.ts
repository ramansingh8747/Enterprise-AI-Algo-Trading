export interface PaperOrder {
  id: string;
  order_id: string;
  execution_mode: 'PAPER';
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  status: 'FILLED';
  order_source?: string | null;
  stop_loss?: string | null;
  target?: string | null;
  executed_at: string;
  broker_id?: string | null;
  strategy_instance_id?: string | null;
  signal_id?: string | null;
  paper_portfolio_id?: string | null;
}

export interface PaperOrderCreateRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: string;
  order_type?: 'MARKET' | 'LIMIT';
  price: string;
  order_source?: string | null;
  stop_loss?: string | null;
  target?: string | null;
  signal_id?: string | null;
  broker_id?: string | null;
  strategy_instance_id?: string | null;
}
