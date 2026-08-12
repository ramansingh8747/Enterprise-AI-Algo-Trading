import React from 'react';
import { BrokerQuote } from '@/types/brokerData';

interface QuotesWidgetProps {
  quotes: BrokerQuote[];
  loading: boolean;
  onRefresh: () => void;
}

export const QuotesWidget: React.FC<QuotesWidgetProps> = ({ quotes, loading, onRefresh }) => {
  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#38bdf8' }}>Live Market Quotes</h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          style={{
            padding: '0.4rem 0.8rem',
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {loading ? 'Refreshing...' : 'Refresh Quotes'}
        </button>
      </div>

      {loading && quotes.length === 0 ? (
        <p style={{ color: '#94a3b8' }}>Fetching live quotes...</p>
      ) : quotes.length === 0 ? (
        <p style={{ color: '#64748b' }}>No live quotes available.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {quotes.map((q, i) => (
            <div key={i} style={{
              padding: '1rem',
              background: '#0f172a',
              borderRadius: '0.5rem',
              border: '1px solid #334155',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: '#f1f5f9' }}>{q.symbol}</span>
                <span style={{ fontWeight: 700, color: '#38bdf8' }}>₹{parseFloat(q.last_price).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                <span>Bid: <strong style={{ color: '#4ade80' }}>₹{parseFloat(q.bid).toFixed(2)}</strong></span>
                <span>Ask: <strong style={{ color: '#f87171' }}>₹{parseFloat(q.ask).toFixed(2)}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
