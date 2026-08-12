import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OrderSide } from './OrderForm';
import { ROUTES } from '@/constants/routes';

interface QuickActionsProps {
  onNavigateTab?: (tab: string) => void;
  onOpenOrderForm?: (side: OrderSide) => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onNavigateTab, onOpenOrderForm }) => {
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleAction = (action: string) => {
    if (action === 'buy') {
      if (onOpenOrderForm) {
        onOpenOrderForm('BUY');
      } else {
        setModalMessage('[BUY] Order placement coming soon. Paper trading mode active.');
      }
    } else if (action === 'sell') {
      if (onOpenOrderForm) {
        onOpenOrderForm('SELL');
      } else {
        setModalMessage('[SELL] Order placement coming soon. Paper trading mode active.');
      }
    } else if (action === 'orders') {
      if (onNavigateTab) onNavigateTab('orders');
      navigate(ROUTES.ORDERS);
    } else if (action === 'portfolio') {
      if (onNavigateTab) onNavigateTab('portfolio');
      navigate(ROUTES.PORTFOLIO);
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#38bdf8' }}>Quick Actions</h3>

      {modalMessage && (
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(56, 189, 248, 0.15)',
          border: '1px solid #38bdf8',
          borderRadius: '0.5rem',
          color: '#38bdf8',
          fontSize: '0.875rem',
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{modalMessage}</span>
          <button
            onClick={() => setModalMessage(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#38bdf8',
              cursor: 'pointer',
              fontWeight: 700,
              marginLeft: '1rem',
            }}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        <button
          onClick={() => handleAction('buy')}
          style={{
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          + Buy Symbol
        </button>

        <button
          onClick={() => handleAction('sell')}
          style={{
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          - Sell Symbol
        </button>

        <button
          onClick={() => handleAction('orders')}
          style={{
            padding: '0.75rem 1rem',
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          View Orders
        </button>

        <button
          onClick={() => handleAction('portfolio')}
          style={{
            padding: '0.75rem 1rem',
            background: '#4f46e5',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          View Portfolio
        </button>
      </div>
    </div>
  );
};
