import { PaperOrder } from '@/components/dashboard/OrderForm';
import { OrderAnalyticsSummary } from '@/types/orderAnalytics';

export const calculateOrderAnalytics = (orders: PaperOrder[]): OrderAnalyticsSummary => {
  if (!orders || orders.length === 0) {
    return {
      totalOrders: 0,
      buyOrdersCount: 0,
      sellOrdersCount: 0,
      executedOrdersCount: 0,
      pendingOrdersCount: 0,
      cancelledOrdersCount: 0,
      averageTradeValue: 0,
    };
  }

  const totalOrders = orders.length;
  const buyOrdersCount = orders.filter(o => o.side === 'BUY').length;
  const sellOrdersCount = orders.filter(o => o.side === 'SELL').length;
  const executedOrdersCount = orders.filter(o => o.status === 'EXECUTED' || o.status === 'PAPER_EXECUTED').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;
  const cancelledOrdersCount = orders.filter(o => o.status === 'CANCELLED').length;

  const totalValue = orders.reduce((sum, o) => sum + (o.quantity * o.price), 0);
  const averageTradeValue = totalOrders > 0 ? totalValue / totalOrders : 0;

  return {
    totalOrders,
    buyOrdersCount,
    sellOrdersCount,
    executedOrdersCount,
    pendingOrdersCount,
    cancelledOrdersCount,
    averageTradeValue,
  };
};
