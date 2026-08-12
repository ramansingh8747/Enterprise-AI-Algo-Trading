import React from 'react';
import { PaperOrder } from './OrderForm';

interface OrderLifecycleTimelineProps {
  order: PaperOrder | null;
}

export const OrderLifecycleTimeline: React.FC<OrderLifecycleTimelineProps> = ({ order }) => {
  if (!order) return null;

  const isCancelled = order.status === 'CANCELLED';
  const isExecuted = order.status === 'EXECUTED' || order.status === 'PAPER_EXECUTED';
  const isPending = order.status === 'PENDING';

  const steps = [
    { label: 'Created', done: true, current: false },
    { label: 'Validated', done: true, current: false },
    {
      label: isCancelled ? 'Cancelled' : isExecuted ? 'Paper Executed' : 'Pending',
      done: isExecuted || isCancelled,
      current: isPending,
      error: isCancelled,
    },
    { label: 'State Synced', done: isExecuted, current: false },
  ];

  return (
    <div style={{ background: '#08111f', borderRadius: '0.65rem', padding: '1rem', border: '1px solid #1e293b' }}>
      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, display: 'block', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
        ORDER LIFECYCLE TIMELINE
      </span>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {steps.map((step, idx) => {
          const color = step.error ? '#f87171' : step.done ? '#4ade80' : step.current ? '#fbbf24' : '#64748b';
          const bg = step.error ? 'rgba(239, 68, 68, 0.2)' : step.done ? 'rgba(34, 197, 94, 0.2)' : step.current ? 'rgba(251, 191, 36, 0.2)' : '#1e293b';

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
              <div style={{
                width: '1.75rem',
                height: '1.75rem',
                borderRadius: '50%',
                background: bg,
                border: `2px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
                fontWeight: 800,
                fontSize: '0.75rem',
                zIndex: 2,
              }}>
                {step.error ? '✕' : step.done ? '✓' : idx + 1}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#f8fafc', fontWeight: 700, marginTop: '0.35rem', textAlign: 'center' }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
