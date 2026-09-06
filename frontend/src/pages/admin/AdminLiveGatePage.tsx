import React, { useEffect, useMemo, useState } from 'react';
import { brokersApi, BrokerResponse } from '@/services/api/brokersApi';
import { adminLiveGateApi, AdminLiveGateResponse } from '@/services/api/adminLiveGateApi';

const statusStyle = (status: string) => {
  if (status === 'PASS') return { background: '#064e3b', color: '#a7f3d0' };
  if (status === 'WARN' || status === 'CONDITIONAL') return { background: '#78350f', color: '#fde68a' };
  return { background: '#7f1d1d', color: '#fecaca' };
};

const AdminLiveGatePage: React.FC = () => {
  const [brokers, setBrokers] = useState<BrokerResponse[]>([]);
  const [brokerId, setBrokerId] = useState('');
  const [result, setResult] = useState<AdminLiveGateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activationLoading, setActivationLoading] = useState(false);
  const [activationMessage, setActivationMessage] = useState<string | null>(null);

  useEffect(() => {
    brokersApi.listBrokers()
      .then((items) => {
        setBrokers(items);
        const savedId = localStorage.getItem('admin_live_gate_broker_id');
        const savedExists = savedId ? items.find((item) => item.id === savedId) : null;
        if (savedExists) {
          setBrokerId(savedExists.id);
          return;
        }
        const activeDhan = items.find((item) => item.broker_type.toLowerCase() === 'dhan' && item.is_active);
        const active = activeDhan
          ?? items.find((item) => item.is_active)
          ?? items[0];
        setBrokerId(active?.id ?? '');
        if (active?.id) {
          localStorage.setItem('admin_live_gate_broker_id', active.id);
        }
      })
      .catch((err: any) => setError(err.message || 'Unable to load broker accounts.'))
      .finally(() => setInitialLoading(false));
  }, []);

  const handleBrokerChange = (id: string) => {
    setBrokerId(id);
    if (id) {
      localStorage.setItem('admin_live_gate_broker_id', id);
    } else {
      localStorage.removeItem('admin_live_gate_broker_id');
    }
  };

  const evaluate = async () => {
    if (!brokerId) return;
    setLoading(true);
    setError(null);
    setActivationMessage(null);
    try {
      setResult(await adminLiveGateApi.evaluate(brokerId, true));
    } catch (err: any) {
      setError(err.message || 'LIVE Gate evaluation failed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const authorize = async () => {
    if (!brokerId) return;
    setActivationLoading(true);
    setActivationMessage(null);
    try {
      const response = await adminLiveGateApi.authorize(brokerId, true);
      setActivationMessage(
        response.verdict === 'ACTIVATION_AUTHORIZED'
          ? 'Activation authorization was returned by the server. LIVE execution is still controlled by server configuration.'
          : `Activation blocked: ${response.blocking_reasons.join(' ')}`,
      );
      setConfirmOpen(false);
      await evaluate();
    } catch (err: any) {
      setActivationMessage(err.message || 'Controlled activation request failed.');
      setConfirmOpen(false);
    } finally {
      setActivationLoading(false);
    }
  };

  const allChecks = useMemo(() => [
    ...(result?.readiness.checks ?? []).map((check) => ({ ...check, group: 'LIVE Readiness' })),
    ...(result?.operational.checks ?? []).map((check) => ({ ...check, group: check.mode === 'SIMULATED_DRILL' ? 'Failure Drills' : 'Operational Hardening' })),
  ], [result]);

  const canRequestAuthorization = result?.overall_verdict === 'READY_FOR_CONTROLLED_LIVE_ACTIVATION'
    && !result.live_trading_enabled
    && !result.kill_switch_active;

  return (
    <main style={{ maxWidth: 1250, margin: '0 auto', padding: '2rem', color: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0 }}>LIVE Gate</h1>
            <p style={{ color: '#94a3b8', maxWidth: 900 }}>
              Single Admin Control Center for LIVE readiness, pre-live operational hardening and controlled activation authorization. No order is ever placed by this page.
            </p>
          </div>
          <span style={{ ...statusStyle(result?.execution_state === 'DISABLED' ? 'PASS' : result?.execution_state === 'READY' ? 'PASS' : 'FAIL'), padding: '.45rem .8rem', borderRadius: 999, fontWeight: 800 }}>
            LIVE {result?.execution_state ?? 'NOT EVALUATED'}
          </span>
        </div>
      </header>

      <section style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
        <label htmlFor="live-gate-broker" style={{ display: 'block', marginBottom: '.5rem', fontWeight: 700 }}>Broker account</label>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <select id="live-gate-broker" value={brokerId} onChange={(e) => handleBrokerChange(e.target.value)} disabled={initialLoading || loading} style={{ minWidth: 320, padding: '.7rem', borderRadius: 8, background: '#020617', color: '#f8fafc', border: '1px solid #475569' }}>
            <option value="">Select broker</option>
            {brokers.map((broker) => <option key={broker.id} value={broker.id}>{broker.broker_name} ({broker.broker_type}){broker.is_active ? '' : ' — inactive'}</option>)}
          </select>
          <button type="button" onClick={evaluate} disabled={!brokerId || loading} style={{ padding: '.7rem 1.2rem', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', fontWeight: 800, opacity: !brokerId || loading ? .6 : 1 }}>
            {loading ? 'Running Gate…' : 'Run LIVE Gate'}
          </button>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '.85rem', marginBottom: 0 }}>The broker probe is read-only. No order, modification or cancellation call is made.</p>
      </section>

      {error && <div role="alert" style={{ background: '#7f1d1d', color: '#fecaca', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>{error}</div>}
      {activationMessage && <div role="status" style={{ background: '#1e293b', color: '#e2e8f0', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>{activationMessage}</div>}

      {result && (
        <>
          <section style={{ background: result.overall_verdict === 'READY_FOR_CONTROLLED_LIVE_ACTIVATION' ? '#052e16' : result.overall_verdict === 'CONDITIONAL' ? '#451a03' : '#450a0a', border: '1px solid #475569', borderRadius: 12, padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '1.35rem', fontWeight: 900 }}>{result.overall_verdict.replaceAll('_', ' ')}</div>
            <div style={{ color: '#cbd5e1', marginTop: '.5rem' }}>Verified {new Date(result.verified_at).toLocaleString()} · Broker {result.broker_id}</div>
            <div style={{ marginTop: '.5rem', fontWeight: 800 }}>{result.safety_message}</div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '.75rem', marginBottom: '1rem' }}>
            {[
              ['LIVE Trading', result.live_trading_enabled ? 'ENABLED' : 'OFF'],
              ['Scheduler', result.strategy_scheduler_enabled ? 'ENABLED' : 'OFF'],
              ['Kill Switch', result.kill_switch_active ? 'ACTIVE' : 'INACTIVE'],
              ['Execution Gate', result.execution_state],
            ].map(([label, value]) => <article key={label} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '1rem' }}><div style={{ color: '#94a3b8', fontSize: '.8rem' }}>{label}</div><div style={{ fontWeight: 900, marginTop: '.35rem' }}>{value}</div></article>)}
          </section>

          <section style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Controlled Activation Authorization</h2>
                <p style={{ color: '#94a3b8', marginBottom: 0 }}>Authorization never flips LIVE_TRADING_ENABLED. The server remains the final execution gate.</p>
              </div>
              <button type="button" onClick={() => setConfirmOpen(true)} disabled={!canRequestAuthorization || activationLoading} style={{ padding: '.7rem 1rem', borderRadius: 8, border: '1px solid #7c3aed', background: canRequestAuthorization ? '#4c1d95' : '#1e293b', color: '#fff', fontWeight: 800, opacity: canRequestAuthorization ? 1 : .55 }}>
                {activationLoading ? 'Authorizing…' : 'Request Controlled Authorization'}
              </button>
            </div>
            {!canRequestAuthorization && <p style={{ color: '#fbbf24', fontSize: '.85rem', marginBottom: 0, marginTop: '.75rem' }}>Authorization is unavailable until the combined gate is READY and no global kill switch is active. LIVE remains OFF.</p>}
          </section>

          <section style={{ display: 'grid', gap: '.7rem' }}>
            {allChecks.map((check) => <article key={`${check.group}-${check.name}`} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                <div><div style={{ color: '#94a3b8', fontSize: '.72rem', textTransform: 'uppercase' }}>{check.group}</div><div style={{ fontWeight: 800, marginTop: '.2rem' }}>{check.name}</div><div style={{ color: '#cbd5e1', marginTop: '.25rem' }}>{check.message}</div></div>
                <span style={{ ...statusStyle(check.status), padding: '.3rem .6rem', borderRadius: 999, fontSize: '.75rem', fontWeight: 900 }}>{check.status}</span>
              </div>
            </article>)}
          </section>
        </>
      )}

      {confirmOpen && <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,.78)', display: 'grid', placeItems: 'center', padding: '1rem', zIndex: 50 }}>
        <div style={{ maxWidth: 520, width: '100%', background: '#0f172a', border: '1px solid #475569', borderRadius: 12, padding: '1.25rem' }}>
          <h2 style={{ marginTop: 0 }}>Confirm Controlled Authorization</h2>
          <p style={{ color: '#cbd5e1' }}>You are requesting server-side authorization for the selected broker. This action does <strong>not</strong> enable LIVE trading and does not place any order.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '.75rem' }}><button type="button" onClick={() => setConfirmOpen(false)} disabled={activationLoading} style={{ padding: '.6rem 1rem', borderRadius: 8, background: '#1e293b', color: '#fff', border: '1px solid #475569' }}>Cancel</button><button type="button" onClick={authorize} disabled={activationLoading} style={{ padding: '.6rem 1rem', borderRadius: 8, background: '#7c3aed', color: '#fff', border: 0, fontWeight: 800 }}>{activationLoading ? 'Confirming…' : 'Confirm Authorization'}</button></div>
        </div>
      </div>}
    </main>
  );
};

export default AdminLiveGatePage;
