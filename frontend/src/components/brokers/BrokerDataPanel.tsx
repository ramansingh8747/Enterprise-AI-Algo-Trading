import React, { useState, useEffect } from 'react';
import { brokerDataApi } from '@/services/api/brokerDataApi';
import {
  BrokerProfile,
  BrokerHolding,
  BrokerPosition,
  BrokerOrder,
  BrokerQuote,
} from '@/types/brokerData';

interface BrokerDataPanelProps {
  brokerId: string;
  brokerName: string;
  onShowToast?: (msg: string) => void;
}

export type BrokerDataTab = 'profile' | 'holdings' | 'positions' | 'orders' | 'quotes';

export const BrokerDataPanel: React.FC<BrokerDataPanelProps> = ({
  brokerId,
  brokerName,
}) => {
  const [activeTab, setActiveTab] = useState<BrokerDataTab>('profile');

  // Data states
  const [profile, setProfile] = useState<BrokerProfile | null>(null);
  const [holdings, setHoldings] = useState<BrokerHolding[]>([]);
  const [positions, setPositions] = useState<BrokerPosition[]>([]);
  const [orders, setOrders] = useState<BrokerOrder[]>([]);
  const [quotes, setQuotes] = useState<BrokerQuote[]>([]);

  // Quote symbols input state
  const [symbolsInput, setSymbolsInput] = useState<string>('INFY, TCS, RELIANCE');

  // Async lifecycle state
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Clear stale data when switching brokerId
  useEffect(() => {
    setProfile(null);
    setHoldings([]);
    setPositions([]);
    setOrders([]);
    setQuotes([]);
    setError(null);
  }, [brokerId]);

  // Load data when activeTab or brokerId changes
  useEffect(() => {
    let isMounted = true;

    const loadTabData = async () => {
      if (!brokerId) return;

      setLoading(true);
      setError(null);

      try {
        if (activeTab === 'profile') {
          const res = await brokerDataApi.getProfile(brokerId);
          if (isMounted) setProfile(res);
        } else if (activeTab === 'holdings') {
          const res = await brokerDataApi.getHoldings(brokerId);
          if (isMounted) setHoldings(res);
        } else if (activeTab === 'positions') {
          const res = await brokerDataApi.getPositions(brokerId);
          if (isMounted) setPositions(res);
        } else if (activeTab === 'orders') {
          const res = await brokerDataApi.getOrders(brokerId);
          if (isMounted) setOrders(res);
        } else if (activeTab === 'quotes') {
          const parsedSymbols = symbolsInput
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

          if (parsedSymbols.length === 0) {
            if (isMounted) setQuotes([]);
          } else {
            const res = await brokerDataApi.getQuotes(brokerId, parsedSymbols);
            if (isMounted) setQuotes(res);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          if (err.status === 401) {
            setError('Authentication required. Please log in again.');
          } else if (err.status === 403) {
            setError('Access denied to broker data.');
          } else if (err.status === 404) {
            setError('Broker session unavailable or no data found.');
          } else {
            setError(err.message || 'Failed to load broker data.');
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadTabData();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerId, activeTab]);

  const handleFetchQuotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab !== 'quotes') return;

    setLoading(true);
    setError(null);

    try {
      const parsedSymbols = symbolsInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (parsedSymbols.length === 0) {
        setQuotes([]);
        return;
      }

      const res = await brokerDataApi.getQuotes(brokerId, parsedSymbols);
      setQuotes(res);
    } catch (err: any) {
      if (err.status === 404) {
        setError('No quote data found for requested symbols.');
      } else {
        setError(err.message || 'Failed to fetch quotes.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: '#0f172a',
      borderRadius: '0.75rem',
      border: '1px solid #334155',
      padding: '1.25rem',
      color: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      {/* Panel Header & Sub-navigation Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
            {brokerName} — Read-Only Broker Data
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Broker ID: <code style={{ color: '#cbd5e1' }}>{brokerId}</code>
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', background: '#1e293b', padding: '0.25rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
          {(['profile', 'holdings', 'positions', 'orders', 'quotes'] as BrokerDataTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '0.375rem',
                border: 'none',
                background: activeTab === tab ? '#0284c7' : 'transparent',
                color: activeTab === tab ? '#ffffff' : '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#38bdf8', fontSize: '0.875rem' }}>
          Loading {activeTab} data from broker...
        </div>
      ) : error ? (
        <div style={{
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          color: '#fca5a5',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setActiveTab(activeTab)}
            style={{
              padding: '0.35rem 0.75rem',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <div>
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div>
              {!profile ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No profile data available.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Account ID</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                      {profile.account_id}
                    </span>
                  </div>

                  <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Account Type</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1', textTransform: 'capitalize' }}>
                      {profile.account_type || 'N/A'}
                    </span>
                  </div>

                  <div style={{ background: '#1e293b', padding: '0.85rem 1rem', borderRadius: '0.5rem', border: '1px solid #334155' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Base Currency</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1' }}>
                      {profile.currency || 'INR'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HOLDINGS */}
          {activeTab === 'holdings' && (
            <div>
              {holdings.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No holdings found.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Symbol</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Quantity</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Average Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((h, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b', color: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#38bdf8' }}>{h.symbol}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>{h.quantity}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>₹{h.average_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: POSITIONS */}
          {activeTab === 'positions' && (
            <div>
              {positions.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No open positions.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Symbol</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Side</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Quantity</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Avg Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b', color: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#38bdf8' }}>{p.symbol}</td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.25rem',
                              color: p.side === 'buy' ? '#4ade80' : '#fca5a5',
                              background: p.side === 'buy' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              textTransform: 'uppercase',
                            }}>
                              {p.side}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>{p.quantity}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>₹{p.avg_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ORDERS */}
          {activeTab === 'orders' && (
            <div>
              {orders.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No orders found.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Order ID</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Symbol</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Side</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Quantity</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b', color: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: '#cbd5e1' }}>{o.order_id}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#38bdf8' }}>{o.symbol}</td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.5rem',
                              borderRadius: '0.25rem',
                              color: o.side.toLowerCase() === 'buy' ? '#4ade80' : '#fca5a5',
                              background: o.side.toLowerCase() === 'buy' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              textTransform: 'uppercase',
                            }}>
                              {o.side}
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace' }}>{o.quantity}</td>
                          <td style={{ padding: '0.65rem 0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#cbd5e1' }}>
                              {o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: QUOTES */}
          {activeTab === 'quotes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <form onSubmit={handleFetchQuotes} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={symbolsInput}
                  onChange={(e) => setSymbolsInput(e.target.value)}
                  placeholder="e.g. INFY, TCS, RELIANCE"
                  style={{
                    flex: 1,
                    padding: '0.55rem 0.75rem',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '0.375rem',
                    color: '#ffffff',
                    fontSize: '0.85rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: '0.55rem 1.1rem',
                    background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Fetch Quotes
                </button>
              </form>

              {quotes.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  No quote data.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Symbol</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Bid</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Ask</th>
                        <th style={{ padding: '0.6rem 0.75rem' }}>Last Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((q, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b', color: '#f8fafc' }}>
                          <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#38bdf8' }}>{q.symbol}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: '#4ade80' }}>₹{q.bid}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', color: '#fca5a5' }}>₹{q.ask}</td>
                          <td style={{ padding: '0.65rem 0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>₹{q.last_price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BrokerDataPanel;
