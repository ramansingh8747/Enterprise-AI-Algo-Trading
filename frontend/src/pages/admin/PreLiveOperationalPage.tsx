import React, { useEffect, useMemo, useState } from 'react';
import { brokersApi, BrokerResponse } from '@/services/api/brokersApi';
import { preLiveOperationalApi, PreLiveOperationalResponse, OperationalCheck } from '@/services/api/preLiveOperationalApi';

const statusStyles: Record<OperationalCheck['status'], { background: string; color: string }> = {
  PASS: { background: '#064e3b', color: '#a7f3d0' },
  WARN: { background: '#78350f', color: '#fde68a' },
  FAIL: { background: '#7f1d1d', color: '#fecaca' },
};

const verdictLabels = {
  READY_FOR_CONTROLLED_LIVE_ACTIVATION: '🟢 READY FOR CONTROLLED LIVE ACTIVATION',
  CONDITIONAL: '🟡 CONDITIONAL',
  NOT_READY: '🔴 NOT READY',
} as const;

const PreLiveOperationalPage: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerResponse[]>([]);
  const [brokerId, setBrokerId] = useState('');
  const [result, setResult] = useState<PreLiveOperationalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const runVerification = async () => {
    if (!brokerId) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await preLiveOperationalApi.verify(brokerId));
    } catch (err: any) {
      setError(err.message || 'Pre-live verification failed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const grouped = useMemo(() => ({
    readiness: result?.checks.filter((check) => check.mode === 'LIVE_READINESS') ?? [],
    static: result?.checks.filter((check) => check.mode === 'STATIC') ?? [],
    drills: result?.checks.filter((check) => check.mode === 'SIMULATED_DRILL') ?? [],
  }), [result]);

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ marginBottom: '.5rem' }}>Pre-Live Operational Hardening</h1>
        <p style={{ color: '#94a3b8', maxWidth: 900 }}>
          Read-only production verification with simulated failure drills. No broker order, modify, or cancel operation is performed.
        </p>
      </header>

      <section style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
        <label htmlFor="pre-live-broker" style={{ display: 'block', marginBottom: '.5rem', fontWeight: 600 }}>Broker account</label>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <select
            id="pre-live-broker"
            value={brokerId}
            onChange={(event) => setBrokerId(event.target.value)}
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
            onClick={runVerification}
            disabled={!brokerId || loading}
            style={{ padding: '.7rem 1.2rem', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: !brokerId || loading ? .6 : 1 }}
          >
            {loading ? 'Running verification…' : 'Run 34.172 Verification'}
          </button>
        </div>
      </section>

      {error && <div role="alert" style={{ background: '#7f1d1d', color: '#fecaca', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}

      {result && (
        <>
          <section style={{ background: result.verdict === 'READY_FOR_CONTROLLED_LIVE_ACTIVATION' ? '#052e16' : result.verdict === 'CONDITIONAL' ? '#451a03' : '#450a0a', border: '1px solid #475569', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 800 }}>{verdictLabels[result.verdict]}</div>
            <div style={{ color: '#cbd5e1', marginTop: '.5rem' }}>Verified {new Date(result.verified_at).toLocaleString()} · Broker {result.broker_id}</div>
            <div style={{ marginTop: '.5rem', fontWeight: 700 }}>Real broker order attempted: {result.real_broker_order_attempted ? 'YES — BLOCKER' : 'NO'}</div>
          </section>

          {([
            { title: 'LIVE Readiness', checks: grouped.readiness },
            { title: 'Static Hardening Checks', checks: grouped.static },
            { title: 'Simulated Failure Drills', checks: grouped.drills },
          ] as Array<{ title: string; checks: OperationalCheck[] }>).map(({ title, checks }) => (
            <section key={title} style={{ marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '.75rem' }}>{title}</h2>
              <div style={{ display: 'grid', gap: '.7rem' }}>
                {checks.map((check) => (
                  <article key={check.name} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>{check.name}</div>
                        <div style={{ color: '#cbd5e1', marginTop: '.25rem' }}>{check.message}</div>
                      </div>
                      <span style={{ ...statusStyles[check.status], padding: '.3rem .6rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 800 }}>{check.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
};

export default PreLiveOperationalPage;
