import React, { useEffect, useState } from 'react';
import { brokersApi, BrokerResponse } from '@/services/api/brokersApi';
import { liveReadinessApi, LiveReadinessResponse, LiveActivationResponse, ReadinessCheck } from '@/services/api/liveReadinessApi';

const statusStyles: Record<ReadinessCheck['status'], { background: string; color: string }> = {
  PASS: { background: '#064e3b', color: '#a7f3d0' },
  WARN: { background: '#78350f', color: '#fde68a' },
  FAIL: { background: '#7f1d1d', color: '#fecaca' },
};

const verdictStyles = {
  LIVE_READY: { background: '#064e3b', color: '#a7f3d0', label: '🟢 LIVE READY' },
  CONDITIONAL: { background: '#78350f', color: '#fde68a', label: '🟡 CONDITIONAL' },
  NOT_READY: { background: '#7f1d1d', color: '#fecaca', label: '🔴 NOT READY' },
} as const;

const LiveReadinessPage: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerResponse[]>([]);
  const [brokerId, setBrokerId] = useState('');
  const [result, setResult] = useState<LiveReadinessResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activation, setActivation] = useState<LiveActivationResponse | null>(null);
  const [activationLoading, setActivationLoading] = useState(false);

  useEffect(() => {
    brokersApi.listBrokers()
      .then((items) => {
        setBrokers(items);
        const zerodha = items.find((item) => item.broker_type.toLowerCase() === 'zerodha' && item.is_active);
        setBrokerId(zerodha?.id ?? items.find((item) => item.is_active)?.id ?? '');
      })
      .catch((err: any) => setError(err.message || 'Unable to load broker accounts.'))
      .finally(() => setInitialLoading(false));
  }, []);

  const verify = async (probeBroker = false) => {
    if (!brokerId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await liveReadinessApi.verify(brokerId, probeBroker));
      setActivation(null);
    } catch (err: any) {
      setError(err.message || 'Readiness verification failed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '.5rem' }}>Controlled LIVE Readiness Gate</h1>
        <p style={{ color: '#94a3b8', maxWidth: 850 }}>
          Non-invasive pre-production verification. This check never places, modifies, or cancels a broker order.
        </p>
      </header>

      <section style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <label htmlFor="readiness-broker" style={{ display: 'block', marginBottom: '.5rem', fontWeight: 600 }}>Broker account</label>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <select
            id="readiness-broker"
            value={brokerId}
            onChange={(e) => setBrokerId(e.target.value)}
            disabled={initialLoading || loading}
            style={{ minWidth: 320, padding: '.7rem', borderRadius: 8, background: '#020617', color: '#f8fafc', border: '1px solid #475569' }}
          >
            <option value="">Select broker</option>
            {brokers.map((broker) => (
              <option key={broker.id} value={broker.id}>
                {broker.broker_name} ({broker.broker_type}){broker.is_active ? '' : ' — inactive'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => verify(false)}
            disabled={!brokerId || loading}
            style={{ padding: '.7rem 1.2rem', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: !brokerId || loading ? .6 : 1 }}
          >
            {loading ? 'Verifying…' : 'Run Readiness Check'}
          </button>
          <button
            type="button"
            onClick={() => verify(true)}
            disabled={!brokerId || loading}
            style={{ padding: '.7rem 1.2rem', borderRadius: 8, border: '1px solid #22c55e', background: '#052e16', color: '#bbf7d0', fontWeight: 700, cursor: 'pointer', opacity: !brokerId || loading ? .6 : 1 }}
          >
            {loading ? 'Verifying…' : 'Verify Zerodha Session (Read-only)'}
          </button>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '.85rem', marginBottom: 0 }}>
          The gate performs configuration, risk, session, persistence, reconciliation, and event-system checks only.
        </p>
      </section>

      {error && <div role="alert" style={{ background: '#7f1d1d', color: '#fecaca', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}

      {result && (
        <>
          <section style={{ background: verdictStyles[result.verdict].background, color: verdictStyles[result.verdict].color, borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{verdictStyles[result.verdict].label}</div>
            <div style={{ marginTop: '.5rem', fontSize: '.9rem' }}>
              Verified {new Date(result.verified_at).toLocaleString()} · Broker {result.broker_id}
            </div>
            <div style={{ marginTop: '.35rem', fontWeight: 700 }}>
              Order execution attempted: {result.order_execution_attempted ? 'YES' : 'NO'}
            </div>
          </section>

          {result.verdict === 'LIVE_READY' && (
            <section style={{ background: '#0f172a', border: '1px solid #475569', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 800, marginBottom: '.4rem' }}>Controlled LIVE Activation Gate</div>
              <p style={{ color: '#cbd5e1', marginTop: 0 }}>This does not enable LIVE trading and never places an order. It only authorizes the next controlled activation step after a fresh read-only broker verification.</p>
              <button
                type="button"
                disabled={activationLoading}
                onClick={async () => {
                  setActivationLoading(true);
                  setError(null);
                  try {
                    setActivation(await liveReadinessApi.authorizeActivation(brokerId, true));
                  } catch (err: any) {
                    setError(err.message || 'Activation gate failed.');
                  } finally {
                    setActivationLoading(false);
                  }
                }}
                style={{ padding: '.7rem 1.2rem', borderRadius: 8, border: 0, background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                {activationLoading ? 'Authorizing…' : 'Run Controlled Activation Gate'}
              </button>
            </section>
          )}

          {activation && (
            <section style={{ background: activation.verdict === 'ACTIVATION_AUTHORIZED' ? '#052e16' : '#450a0a', border: '1px solid #475569', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 800 }}>{activation.verdict === 'ACTIVATION_AUTHORIZED' ? '🟢 ACTIVATION AUTHORIZED' : '🔴 ACTIVATION BLOCKED'}</div>
              <div style={{ color: '#cbd5e1', marginTop: '.5rem' }}>Order execution attempted: {activation.order_execution_attempted ? 'YES' : 'NO'}</div>
              {activation.blocking_reasons.length > 0 && <ul>{activation.blocking_reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
              <ul>{activation.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ul>
            </section>
          )}

          <section style={{ display: 'grid', gap: '.75rem' }}>
            {result.checks.map((check) => (
              <article key={check.name} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{check.name}</div>
                    <div style={{ color: '#cbd5e1', marginTop: '.25rem' }}>{check.message}</div>
                  </div>
                  <span style={{ ...statusStyles[check.status], padding: '.3rem .6rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 800 }}>
                    {check.status}
                  </span>
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </main>
  );
};

export default LiveReadinessPage;
