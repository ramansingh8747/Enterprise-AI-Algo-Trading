import React, { useEffect } from 'react';
import { PaperOrder } from './OrderForm';
import { OrderLifecycleTimeline } from './OrderLifecycleTimeline';

interface OrderDetailPanelProps {
  order: PaperOrder | null;
  onClose: () => void;
  onCancelOrder?: (orderId: string) => void;
  onTrade?: (symbol: string, side: 'BUY' | 'SELL', price: number) => void;
  onNavigate?: (route: string) => void;
}

export const OrderDetailPanel: React.FC<OrderDetailPanelProps> = ({
  order,
  onClose,
  onCancelOrder,
  onTrade,
  onNavigate,
}) => {
  // Keydown Escape listener
  useEffect(() => {
    if (!order) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [order, onClose]);

  if (!order) return null;

  const isBuy = order.side === 'BUY';
  const orderValue = order.quantity * order.price;
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-detail-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '540px',
          background: '#0f172a',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '0.85rem',
          padding: '1.5rem',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.75)',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 id="order-detail-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>
                {order.symbol}
              </h2>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: isBuy ? '#4ade80' : '#f87171',
                background: isBuy ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                padding: '0.1rem 0.4rem',
                borderRadius: '0.2rem',
              }}>
                PAPER {order.side}
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              ID: {order.id}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Close order detail panel"
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.3rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Status Banner */}
        <div style={{
          background: isCancelled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)',
          border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.25)' : 'rgba(56, 189, 248, 0.25)'}`,
          borderRadius: '0.5rem',
          padding: '0.85rem 1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>Execution Status</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: isCancelled ? '#f87171' : '#38bdf8' }}>
              {order.status}
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            {new Date(order.timestamp).toLocaleString()}
          </span>
        </div>

        {/* Order Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', fontSize: '0.85rem' }}>
          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Quantity</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{order.quantity} shares</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Order Price</span>
            <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>₹{order.price.toFixed(2)}</strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Total Order Value</span>
            <strong style={{ color: '#38bdf8', fontSize: '1rem' }}>
              ₹{orderValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </strong>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 0.9rem', borderRadius: '0.5rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block' }}>Order Mode</span>
            <strong style={{ color: '#fbbf24', fontSize: '1rem' }}>PAPER SANDBOX</strong>
          </div>
        </div>

        {/* Trade Lifecycle Stepper */}
        <OrderLifecycleTimeline order={order} />

        {/* Navigation & Action Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            onClick={() => { onClose(); onNavigate?.('/portfolio'); }}
            style={{ padding: '0.6rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Portfolio
          </button>

          <button
            onClick={() => { onClose(); onNavigate?.('/journal'); }}
            style={{ padding: '0.6rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Journal
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {order.status === 'PENDING' && onCancelOrder && (
            <button
              onClick={() => { onClose(); onCancelOrder(order.id); }}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: '#dc2626',
                border: 'none',
                color: '#ffffff',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Cancel Order
            </button>
          )}

          <button
            onClick={() => { onClose(); onTrade?.(order.symbol, 'BUY', order.price); }}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '0.5rem',
              background: '#059669',
              border: 'none',
              color: '#ffffff',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            New Paper BUY
          </button>
        </div>
      </div>
    </div>
  );
};
