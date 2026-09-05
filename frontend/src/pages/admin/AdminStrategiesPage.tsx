import React, { useCallback, useEffect, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { adminStrategiesApi, AdminStrategyItem } from '@/services/api/adminStrategiesApi';
import { strategyApi } from '@/services/api/strategyApi';
import './AdminStrategiesPage.css';

const AdminStrategiesPage: React.FC = () => {
  const [items, setItems] = useState<AdminStrategyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminStrategyItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('CUSTOM');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminStrategiesApi.list();
      setItems(result.items);
    } catch (err: any) {
      setError(err?.message || 'Unable to load strategies.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    try {
      setCreating(true);
      await strategyApi.createDefinition({ name: createName.trim(), strategy_type: createType.trim() || 'CUSTOM' });
      setCreateName('');
      setCreateType('CUSTOM');
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to create strategy.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (item: AdminStrategyItem) => {
    if (!window.confirm(`Delete strategy "${item.name}"? This also removes its strategy instances.`)) return;
    try {
      setDeleting(item.id);
      await adminStrategiesApi.delete(item.id);
      setItems((current) => current.filter((strategy) => strategy.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete strategy.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="admin-control-center admin-strategies-page">
      <AdminSidebar activeLabel="Strategies" />
      <main className="admin-strategies-content">
        <header className="admin-overview-header">
          <div>
            <span className="admin-eyebrow">STRATEGY OPERATIONS</span>
            <h1>Strategies</h1>
            <p>Database-backed strategy library across all users. LIVE execution remains server-side disabled.</p>
          </div>
          <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
            <button type="button" className="admin-refresh-button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Close' : '+ Add Strategy'}</button>
            <button type="button" className="admin-refresh-button" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </header>

        {error && <div className="admin-alert" role="alert"><strong>Strategy service unavailable.</strong><span>{error}</span><button type="button" onClick={() => void load()}>Retry</button></div>}

        {showCreate && (
          <section className="admin-panel strategy-admin-create">
            <div className="admin-panel-heading"><div><span className="admin-section-label">CREATE</span><h2>Add Strategy</h2></div></div>
            <div className="strategy-create-grid">
              <label><span>Name</span><input value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder="Strategy name" /></label>
              <label><span>Type</span><input value={createType} onChange={(event) => setCreateType(event.target.value)} placeholder="CUSTOM" /></label>
              <button type="button" className="admin-refresh-button" disabled={!createName.trim() || creating} onClick={() => void handleCreate()}>{creating ? 'Saving…' : 'Save Strategy'}</button>
            </div>
          </section>
        )}

        <section className="admin-panel strategy-library-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-section-label">STRATEGY LIBRARY</span><h2>{items.length} saved strateg{items.length === 1 ? 'y' : 'ies'}</h2></div>
          </div>

          {loading ? <div className="strategy-admin-state">Loading strategies…</div> : items.length === 0 ? (
            <div className="strategy-admin-state"><strong>No strategies found</strong><span>Create or import a strategy from the Trader Strategy Management page.</span></div>
          ) : (
            <div className="strategy-admin-table-wrap">
              <table className="strategy-admin-table">
                <thead><tr><th>Strategy</th><th>Owner</th><th>Type</th><th>Status</th><th>Source</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong><small>{item.id}</small></td>
                      <td>{item.user_name}<small>@{item.username}</small></td>
                      <td>{item.strategy_type}</td>
                      <td><span className={`strategy-admin-badge ${item.is_active ? 'active' : 'inactive'}`}>{item.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                      <td>{item.imported_file_name ? <><span>FILE IMPORT</span><small>{item.imported_file_name}</small></> : <span>MANUAL</span>}</td>
                      <td>{new Date(item.created_at).toLocaleString()}</td>
                      <td>
                        <div className="strategy-admin-actions">
                          <button type="button" onClick={() => setSelected(item)}>View</button>
                          {item.imported_file_id && <button type="button" onClick={() => void adminStrategiesApi.download(item.id)}>Download</button>}
                          <button type="button" className="danger" disabled={deleting === item.id} onClick={() => void handleDelete(item)}>{deleting === item.id ? 'Deleting…' : 'Delete'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selected && (
          <section className="admin-panel strategy-admin-details">
            <div className="admin-panel-heading"><div><span className="admin-section-label">STRATEGY DETAILS</span><h2>{selected.name}</h2></div><button type="button" className="admin-refresh-button" onClick={() => setSelected(null)}>Close</button></div>
            <div className="strategy-detail-grid">
              <div><span>Owner</span><strong>{selected.user_name} (@{selected.username})</strong></div>
              <div><span>Type</span><strong>{selected.strategy_type}</strong></div>
              <div><span>Status</span><strong>{selected.is_active ? 'Active' : 'Inactive'}</strong></div>
              <div><span>Created</span><strong>{new Date(selected.created_at).toLocaleString()}</strong></div>
            </div>
            {selected.config_json && <pre className="strategy-config-preview">{(() => { try { return JSON.stringify(JSON.parse(selected.config_json), null, 2); } catch { return selected.config_json; } })()}</pre>}
          </section>
        )}
      </main>
    </div>
  );
};

export default AdminStrategiesPage;
