import React from "react";
import { useNavigate } from "react-router-dom";
import { BrokerConnection } from "@/types/brokerConnection";
import { ROUTES } from "@/constants/routes";

interface ActiveBrokerCardProps {
  connection?: BrokerConnection | null;
}

export const ActiveBrokerCard: React.FC<ActiveBrokerCardProps> = ({ connection }) => {
  const navigate = useNavigate();

  const isConnected = connection && connection.status === "connected";

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '0.5rem',
          background: isConnected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(148, 163, 184, 0.15)',
          border: isConnected ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.25rem',
        }}>
          {isConnected ? '🏦' : '🔌'}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              {isConnected ? connection.brokerName : 'No Broker Connected'}
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: '1rem',
              color: isConnected ? '#4ade80' : '#94a3b8',
              background: isConnected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(148, 163, 184, 0.15)',
              border: isConnected ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid #334155',
            }}>
              {isConnected ? '● Connected' : 'Disconnected'}
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', display: 'block' }}>
            {isConnected ? `Account ID: ${connection.accountId || 'DEMO-ACCOUNT'} • Demo Connection` : 'Connect Zerodha or Angel One account to view broker data.'}
          </span>
        </div>
      </div>

      <button
        onClick={() => navigate(ROUTES.BROKERS)}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          background: '#0284c7',
          color: '#ffffff',
          border: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        {isConnected ? 'Manage Brokers' : 'Connect Broker'}
      </button>
    </div>
  );
};

export default ActiveBrokerCard;
