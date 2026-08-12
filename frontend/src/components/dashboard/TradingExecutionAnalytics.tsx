import React from 'react';
import { PaperOrder } from '@/components/dashboard/OrderForm';
import { OrderAnalyticsSummary } from '@/types/orderAnalytics';

interface TradingExecutionAnalyticsProps {
  orders: PaperOrder[];
  analytics: OrderAnalyticsSummary;
}

export const TradingExecutionAnalytics: React.FC<TradingExecutionAnalyticsProps> = ({
  orders: _orders,
  analytics,
}) => {
  const total = analytics.totalOrders;
  const filledPct = total > 0 ? (analytics.executedOrdersCount / total) * 100 : 0;
  const pendingPct = total > 0 ? (analytics.pendingOrdersCount / total) * 100 : 0;
  const cancelledPct = total > 0 ? (analytics.cancelledOrdersCount / total) * 100 : 0;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
          Execution & Order Status Analytics
        </h3>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          Order execution rate, status distribution and fill metrics
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Fill Rate</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>
            {filledPct.toFixed(1)}%
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>BUY vs SELL Ratio</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc' }}>
            <span style={{ color: '#4ade80' }}>{analytics.buyOrdersCount} BUY</span> / <span style={{ color: '#f87171' }}>{analytics.sellOrdersCount} SELL</span>
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Pending Orders</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24' }}>
            {analytics.pendingOrdersCount}
          </p>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Avg Order Value</span>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
            ₹{analytics.averageTradeValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Visual Status Distribution Bar */}
      <div style={{ background: '#0f172a', borderRadius: '0.5rem', padding: '0.85rem 1rem', border: '1px solid #334155' }}>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
          ORDER STATUS DISTRIBUTION
        </span>
        <div style={{ display: 'flex', height: '0.75rem', borderRadius: '0.375rem', overflow: 'hidden', background: '#1e293b' }}>
          <div style={{ width: `${filledPct}%`, background: '#4ade80', transition: 'width 0.3s' }} title={`Filled: ${filledPct.toFixed(1)}%`} />
          <div style={{ width: `${pendingPct}%`, background: '#fbbf24', transition: 'width 0.3s' }} title={`Pending: ${pendingPct.toFixed(1)}%`} />
          <div style={{ width: `${cancelledPct}%`, background: '#f87171', transition: 'width 0.3s' }} title={`Cancelled: ${cancelledPct.toFixed(1)}%`} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.5rem' }}>
          <span style={{ color: '#4ade80' }}>● Filled ({analytics.executedOrdersCount})</span>
          <span style={{ color: '#fbbf24' }}>● Pending ({analytics.pendingOrdersCount})</span>
          <span style={{ color: '#f87171' }}>● Cancelled ({analytics.cancelledOrdersCount})</span>
        </div>
      </div>
    </div>
  );
};
