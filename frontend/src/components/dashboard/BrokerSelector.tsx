import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BrokerType, BrokerConnection } from '@/types/brokerConnection';
import { ROUTES } from '@/constants/routes';

interface BrokerSelectorProps {
  connections: Record<BrokerType, BrokerConnection>;
  selectedBrokerType: BrokerType;
  onSelectBroker: (type: BrokerType) => void;
}

export const BrokerSelector: React.FC<BrokerSelectorProps> = ({
  connections,
  selectedBrokerType,
  onSelectBroker,
}) => {
  const navigate = useNavigate();

  const zerodhaConn = connections.zerodha;
  const angeloneConn = connections.angelone;

  const hasAnyConnection =
    (zerodhaConn && zerodhaConn.status === 'connected') ||
    (angeloneConn && angeloneConn.status === 'connected');

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '1rem',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Active Broker Account:
        </span>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {/* Zerodha Selector Button */}
          <button
            type="button"
            onClick={() => onSelectBroker('zerodha')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              background: selectedBrokerType === 'zerodha'
                ? 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'
                : '#0f172a',
              color: selectedBrokerType === 'zerodha' ? '#ffffff' : '#cbd5e1',
              border: selectedBrokerType === 'zerodha' ? '1px solid #38bdf8' : '1px solid #334155',
            }}
          >
            <span>Zerodha (Kite)</span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: zerodhaConn?.status === 'connected' ? '#4ade80' : '#94a3b8',
            }} />
          </button>

          {/* Angel One Selector Button */}
          <button
            type="button"
            onClick={() => onSelectBroker('angelone')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              background: selectedBrokerType === 'angelone'
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : '#0f172a',
              color: selectedBrokerType === 'angelone' ? '#ffffff' : '#cbd5e1',
              border: selectedBrokerType === 'angelone' ? '1px solid #f59e0b' : '1px solid #334155',
            }}
          >
            <span>Angel One (SmartAPI)</span>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: angeloneConn?.status === 'connected' ? '#4ade80' : '#94a3b8',
            }} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {!hasAnyConnection && (
          <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
            No broker connected
          </span>
        )}

        <button
          type="button"
          onClick={() => navigate(ROUTES.BROKERS)}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: '0.375rem',
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Manage Broker Connections →
        </button>
      </div>
    </div>
  );
};

export default BrokerSelector;
