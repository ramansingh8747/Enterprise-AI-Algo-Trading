export interface BrokerOrderCreateRequest {
  symbol: string;
  exchange: string;
  quantity: string;
  side: string;
  order_type: string;
  product: string;
  variety?: string;
  price?: string | null;
  trigger_price?: string | null;
}

export interface BrokerOrderModifyRequest {
  symbol: string;
  exchange: string;
  quantity: string;
  side: string;
  order_type: string;
  product: string;
  variety?: string;
  price?: string | null;
  trigger_price?: string | null;
}

export interface BrokerOrderCancelRequest {
  variety?: string;
  parent_order_id?: string | null;
}

export interface BrokerOrderResponse {
  order_id: string;
  symbol: string;
  side: string;
  quantity: string;
  status: string;
}

export interface BrokerOrderActionResultResponse {
  order_id: string;
  success: boolean;
}

export interface BrokerOrderLedgerResponse {
  order_id: string;
  id: string;
  broker_order_id: string;
  symbol: string;
  exchange?: string | null;
  side: string;
  quantity: string;
  filled_quantity: string;
  average_fill_price?: string | null;
  order_type?: string | null;
  product?: string | null;
  variety?: string | null;
  price?: string | null;
  trigger_price?: string | null;
  status: string;
  strategy_instance_id?: string | null;
  signal_id?: string | null;
  last_broker_sync_at: string;
  broker_created_at?: string | null;
  broker_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TradingExecutionResponse {
  id: string;
  execution_mode: 'LIVE' | 'PAPER';
  external_execution_id: string;
  broker_order_record_id?: string | null;
  strategy_instance_id?: string | null;
  signal_id?: string | null;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  executed_at: string;
}

export interface TradingPositionResponse {
  id: string;
  symbol: string;
  quantity: string;
  average_price: string;
  realized_pnl: string;
  strategy_instance_id?: string | null;
  last_execution_at?: string | null;
  updated_at: string;
}
