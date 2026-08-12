
export type OrderFilterSide = 'ALL' | 'BUY' | 'SELL';
export type OrderFilterStatus = 'ALL' | 'EXECUTED' | 'PENDING' | 'CANCELLED' | 'PAPER_EXECUTED';
export type OrderSort = 'TIMESTAMP' | 'VALUE' | 'QUANTITY' | 'SYMBOL';

export interface OrderAnalyticsSummary {
  totalOrders: number;
  buyOrdersCount: number;
  sellOrdersCount: number;
  executedOrdersCount: number;
  pendingOrdersCount: number;
  cancelledOrdersCount: number;
  averageTradeValue: number;
}
