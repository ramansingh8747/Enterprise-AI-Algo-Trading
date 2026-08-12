import React from "react";
import { BrokerConnection } from "@/types/brokerConnection";

interface BrokerAccountSummaryProps {
  connection: BrokerConnection;
  onDisconnect?: () => void;
}

export const BrokerAccountSummary: React.FC<BrokerAccountSummaryProps> = ({
  connection,
  onDisconnect,
}) => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.5rem',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#38bdf8', fontWeight: 700 }}>
            {connection.brokerName} Account Summary
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Connected Broker Session
          </span>
        </div>

        <span style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#4ade80',
          background: 'rgba(74, 222, 128, 0.15)',
          border: '1px solid rgba(74, 222, 128, 0.3)',
          padding: '0.25rem 0.65rem',
          borderRadius: '1rem',
        }}>
          ● Connected
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Account ID</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
            {connection.accountId || 'DEMO-ACCOUNT'}
          </span>
        </div>

        <div style={{ background: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Client Name</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
            {connection.clientName || 'Demo Client'}
          </span>
        </div>

        <div style={{ background: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Account Type</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>Equity & F&O</span>
        </div>

        <div style={{ background: '#0f172a', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Connected At</span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            {connection.connectedAt ? new Date(connection.connectedAt).toLocaleString() : 'Just now'}
          </span>
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 1rem',
        background: 'rgba(250, 204, 21, 0.08)',
        border: '1px solid rgba(250, 204, 21, 0.2)',
        borderRadius: '0.5rem',
      }}>
        <span style={{ fontSize: '0.8rem', color: '#facc15', fontWeight: 600 }}>
          ⚡ Live Order Execution: Disabled (Simulated Sandbox)
        </span>

        {onDisconnect && (
          <button
            onClick={onDisconnect}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
};

export default BrokerAccountSummary;
