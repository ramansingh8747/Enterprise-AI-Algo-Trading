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
