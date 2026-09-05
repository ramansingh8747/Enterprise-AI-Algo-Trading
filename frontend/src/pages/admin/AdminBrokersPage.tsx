import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { adminBrokersApi, AdminBrokerItem } from '@/services/api/adminBrokersApi';
import { brokersApi, BrokerRequest } from '@/services/api/brokersApi';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { getMarketSessionStatus } from '@/utils/marketTiming';
import './AdminDashboardPage.css';
import './AdminBrokersPage.css';


type ModalMode = 'create' | 'edit' | null;

const formatDate = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const AdminBrokersPage: React.FC = () => {
  const [brokers, setBrokers] = useState<AdminBrokerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<AdminBrokerItem | null>(null);
  const [form, setForm] = useState({
    broker_name: '',
    broker_type: 'zerodha',
    api_key: '',
    api_secret: '',
    client_id: '',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBrokers = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await adminBrokersApi.list();
      setBrokers(result.items);
    } catch (err: any) {
      setError(err?.message || 'Unable to load broker management data.');
      if (!background) setBrokers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBrokers();
    const interval = window.setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        void loadBrokers(true);
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [loadBrokers]);

  const openCreate = () => {
    setSelected(null);
    setForm({ broker_name: '', broker_type: 'zerodha', api_key: '', api_secret: '', client_id: '', is_active: true });
    setFormError(null);
    setModalMode('create');
  };

  const openEdit = (broker: AdminBrokerItem) => {
    setSelected(broker);
    setForm({
      broker_name: broker.broker_name,
      broker_type: broker.broker_type,
      api_key: '',
      api_secret: '',
      client_id: broker.client_id || '',
      is_active: broker.is_active,
    });
    setFormError(null);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setSelected(null);
    setForm({ broker_name: '', broker_type: 'zerodha', api_key: '', api_secret: '', client_id: '', is_active: true });
    setFormError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.broker_name.trim() || !form.broker_type.trim()) {
      setFormError('Broker name and broker type are required.');
      return;
    }
    if (modalMode === 'create' && (!form.api_key.trim() || !form.api_secret.trim())) {
      setFormError('API key and API secret are required for a new broker.');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        const payload: BrokerRequest = {
          broker_name: form.broker_name.trim(),
          broker_type: form.broker_type.trim(),
          api_key: form.api_key.trim(),
          api_secret: form.api_secret.trim(),
          client_id: form.client_id.trim() || undefined,
          is_active: form.is_active,
        };
        await brokersApi.createBroker(payload);
        setToast(`Broker "${form.broker_name}" created.`);
      } else if (modalMode === 'edit' && selected) {
        const payload: Partial<BrokerRequest> = {
          broker_name: form.broker_name.trim(),
          broker_type: form.broker_type.trim(),
          client_id: form.client_id.trim() || undefined,
          is_active: form.is_active,
        };
        if (form.api_key.trim()) payload.api_key = form.api_key.trim();
        if (form.api_secret.trim()) payload.api_secret = form.api_secret.trim();
        await brokersApi.updateBroker(selected.id, payload);
        setToast(`Broker "${form.broker_name}" updated.`);
      }
      closeModal();
      await loadBrokers(true);
    } catch (err: any) {
      setFormError(err?.message || 'Unable to save broker configuration.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBroker = async (broker: AdminBrokerItem) => {
    if (!window.confirm(`Delete broker "${broker.broker_name}"? This removes its broker configuration.`)) return;
    try {
      await brokersApi.deleteBroker(broker.id);
      setToast(`Broker "${broker.broker_name}" deleted.`);
      await loadBrokers(true);
    } catch (err: any) {
      setError(err?.message || 'Unable to delete broker.');
    }
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const connectedCount = brokers.filter((broker) => broker.session.active).length;
  const activeCount = brokers.filter((broker) => broker.is_active).length;

  return (
    <div className="admin-control-center">
      <AdminSidebar activeLabel="Brokers" />

      <main className="admin-control-center__content">
        <header className="admin-control-center__header">
          <div>
            <p className="admin-control-center__eyebrow">ADMIN CONTROL CENTER</p>
            <h1>Brokers</h1>
            <p className="admin-control-center__subtitle">Manage broker configuration and inspect real session-backed connectivity without exposing credentials.</p>
          </div>
          <div className="admin-brokers__header-actions">
            <button type="button" onClick={() => void loadBrokers(true)} disabled={refreshing} className="admin-control-center__refresh">{refreshing ? 'Refreshing…' : 'Refresh'}</button>
            <button type="button" onClick={openCreate} className="admin-brokers__primary">+ Register Broker</button>
          </div>
        </header>

        {toast && <div className="admin-brokers__toast" role="status">{toast}</div>}
        {error && <div className="admin-control-center__alert" role="alert"><strong>Broker management unavailable.</strong><span>{error}</span><button type="button" onClick={() => void loadBrokers()}>Retry</button></div>}

        <section className="admin-brokers__summary" aria-label="Broker summary">
          <article><span>Total Brokers</span><strong>{brokers.length}</strong></article>
          <article><span>Active Configurations</span><strong>{activeCount}</strong></article>
          <article><span>Session Connected</span><strong>{connectedCount}</strong></article>
          <article><span>Live Trading</span><strong>OFF</strong><small>Server-side safety gate</small></article>
        </section>

        <section className="admin-control-center__panel" aria-labelledby="broker-management-heading">
          <div className="admin-control-center__panel-header">
            <div><h2 id="broker-management-heading">Broker Connectivity &amp; Configuration</h2><p>Credentials are never returned by the API. Session status is derived from persisted broker sessions.</p></div>
          </div>

          {loading ? (
            <div className="admin-control-center__loading" role="status">Loading broker configuration and session status…</div>
          ) : brokers.length === 0 ? (
            <div className="admin-control-center__empty"><strong>No brokers configured.</strong><span>Register a broker to make it available to the trading platform.</span><button type="button" onClick={openCreate}>Register first broker</button></div>
          ) : (
            <div className="admin-brokers__table-wrap">
              <table className="admin-brokers__table">
                <thead><tr><th>Broker</th><th>Type</th><th>Configuration</th><th>Session</th><th>Expiry</th><th>Updated</th><th>Actions</th></tr></thead>
                <tbody>
                  {brokers.map((broker) => (
                    <tr key={broker.id}>
                      <td><strong>{broker.broker_name}</strong><small>{broker.client_id || 'No client ID'}</small></td>
                      <td><span className="admin-brokers__type">{broker.broker_type}</span></td>
                      <td><span className={`admin-brokers__status ${broker.is_active ? 'is-good' : 'is-muted'}`}>{broker.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                      <td><span className={`admin-brokers__status ${broker.session.active ? 'is-good' : 'is-bad'}`}>{broker.session.active ? 'CONNECTED' : 'NOT CONNECTED'}</span><small>{broker.session.active_session_count} active / {broker.session.session_count} total</small></td>
                      <td>{formatDate(broker.session.earliest_expiry)}</td>
                      <td>{formatDate(broker.updated_at)}</td>
                      <td><div className="admin-brokers__actions"><button type="button" onClick={() => openEdit(broker)}>Edit</button><button type="button" className="danger" onClick={() => void deleteBroker(broker)}>Delete</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="admin-control-center__panel admin-control-center__panel--compact">
          <div className="admin-brokers__security"><strong>Security boundary</strong><span>API secrets and broker access tokens are never displayed in this UI. Broker configuration changes are ADMIN-only, while LIVE execution remains independently blocked server-side.</span></div>
        </section>
      </main>

      {modalMode && (
        <div className="admin-brokers__modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeModal(); }}>
          <form className="admin-brokers__modal" onSubmit={submit}>
            <div className="admin-brokers__modal-header"><div><p className="admin-control-center__eyebrow">ADMIN BROKERS</p><h2>{modalMode === 'create' ? 'Register Broker' : 'Edit Broker'}</h2></div><button type="button" onClick={closeModal}>×</button></div>
            {formError && <div className="admin-control-center__alert" role="alert">{formError}</div>}
            <label>Broker Name<input value={form.broker_name} onChange={(e) => setForm({ ...form, broker_name: e.target.value })} autoComplete="off" /></label>
            <label>Broker Type<input value={form.broker_type} onChange={(e) => setForm({ ...form, broker_type: e.target.value })} autoComplete="off" /></label>
            <label>Client ID<input value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} autoComplete="off" /></label>
            <label>API Key<input value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} autoComplete="new-password" placeholder={modalMode === 'edit' ? 'Leave blank to keep existing key' : ''} /></label>
            <label>API Secret<input type="password" value={form.api_secret} onChange={(e) => setForm({ ...form, api_secret: e.target.value })} autoComplete="new-password" placeholder={modalMode === 'edit' ? 'Leave blank to keep existing secret' : ''} /></label>
            <label className="admin-brokers__checkbox"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Configuration active</label>
            <div className="admin-brokers__modal-actions"><button type="button" onClick={closeModal}>Cancel</button><button type="submit" disabled={saving} className="admin-brokers__primary">{saving ? 'Saving…' : modalMode === 'create' ? 'Register Broker' : 'Save Changes'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminBrokersPage;
