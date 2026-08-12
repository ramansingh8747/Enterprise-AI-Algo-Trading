import React, { useState, useEffect } from 'react';
import { strategyApi } from '@/services/api/strategyApi';
import { Signal } from '@/types/strategy';
import { Spinner } from '@/components/common/Spinner';
import { JournalEntryModal, JournalEntryModalProps } from '@/components/dashboard/JournalEntryModal';



interface Props {
  strategyDefinitionId: string;
  instanceId: string;
}

export const SignalHistory: React.FC<Props> = ({ strategyDefinitionId, instanceId }) => {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journalModalData, setJournalModalData] = useState<JournalEntryModalProps['initialData'] | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const loadSignals = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await strategyApi.getSignalHistory(strategyDefinitionId, instanceId);
      setSignals(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load signal history');
    } finally {
      setLoading(false);
    }
  }, [strategyDefinitionId, instanceId]);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  if (loading) return <Spinner />;
  if (error) return <div>{error} <button onClick={loadSignals}>Retry</button></div>;

  return (
    <div>
      {notification && (
        <div style={{ padding: '0.4rem 0.75rem', background: 'rgba(74, 222, 128, 0.15)', border: '1px solid #4ade80', color: '#4ade80', borderRadius: '0.25rem', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
          ✓ {notification}
        </div>
      )}
      <h4>Signal History</h4>
      {signals.length === 0 ? (
        <p>No signals.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Symbol</th>
              <th>Side</th>
              <th>Quantity</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.created_at).toLocaleString()}</td>
                <td>{s.symbol}</td>
                <td>{s.side}</td>
                <td>{s.quantity}</td>
                <td>{s.price}</td>
                <td>{s.status}</td>
                <td>
                  <button
                    onClick={() => {
                      setJournalModalData({
                        symbol: s.symbol,
                        side: s.side,
                        quantity: Number(s.quantity),
                        entry_price: s.price ? Number(s.price) : 0,
                        strategy_instance_id: instanceId,
                        strategy_signal_id: s.id,
                        notes: `Strategy Signal #${s.id} for ${s.symbol}`,
                      });
                    }}

                    style={{
                      padding: '0.25rem 0.55rem',
                      borderRadius: '0.25rem',
                      background: 'rgba(56, 189, 248, 0.15)',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    + Journal
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {journalModalData && (
        <JournalEntryModal
          initialData={journalModalData}
          onClose={() => setJournalModalData(null)}
          onSuccess={(entry) => {
            setNotification(`Journal entry created for ${entry.symbol}!`);
            setTimeout(() => setNotification(null), 3000);
          }}
        />
      )}
    </div>
  );
};

