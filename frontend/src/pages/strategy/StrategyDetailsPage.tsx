import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { strategyApi, StrategyDefinition, StrategyInstance } from '@/services/api/strategyApi';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { StrategyInstanceList } from '@/components/strategy/StrategyInstanceList';
import { StrategyCreateInstanceForm } from '@/components/strategy/StrategyCreateInstanceForm';
import '../styles/StrategyDetails.css';

export default function StrategyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [strategy, setStrategy] = useState<StrategyDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  const [instanceRefreshKey, setInstanceRefreshKey] = useState(0);
  const [instanceCreatedMessage, setInstanceCreatedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Strategy ID is missing');
      setLoading(false);
      return;
    }

    const loadStrategy = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await strategyApi.getDefinition(id);
        setStrategy(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load strategy');
        console.error('Failed to load strategy:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStrategy();
  }, [id]);

  if (loading) return <LoadingState message="Loading strategy details..." />;

  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  if (!strategy) {
    return <ErrorState message="Strategy not found" onRetry={() => navigate('/strategies')} />;
  }

  const handleInstanceCreated = (instance: StrategyInstance) => {
    setShowCreateInstance(false);
    setInstanceRefreshKey((key) => key + 1);
    setInstanceCreatedMessage(`Strategy instance ${instance.id} created in ${instance.execution_mode} mode.`);
    window.setTimeout(() => setInstanceCreatedMessage(null), 4000);
  };

  return (
    <div className="strategy-details">
      <div className="details-header">
        <button className="btn btn-outline" onClick={() => navigate('/strategies')}>
          ← Back
        </button>
        <h1>{strategy.name}</h1>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => navigate(`/strategies/${id}/edit`)}>
            Edit
          </button>
        </div>
      </div>

      <div className="details-content">
        <section className="details-section">
          <h2>Strategy Information</h2>
          <div className="details-grid">
            <div className="detail-item"><label>Name:</label><span>{strategy.name}</span></div>
            <div className="detail-item"><label>Type:</label><span>{strategy.strategy_type}</span></div>
            <div className="detail-item">
              <label>Status:</label>
              <span className={`badge ${strategy.is_active ? 'active' : 'inactive'}`}>
                {strategy.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="detail-item"><label>Created:</label><span>{new Date(strategy.created_at).toLocaleString()}</span></div>
            <div className="detail-item"><label>Last Updated:</label><span>{new Date(strategy.updated_at).toLocaleString()}</span></div>
          </div>
        </section>

        {strategy.config_json && (
          <section className="details-section">
            <h2>Configuration</h2>
            <pre className="config-json">
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(strategy.config_json), null, 2);
                } catch {
                  return strategy.config_json;
                }
              })()}
            </pre>
          </section>
        )}

        <section className="details-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h2>Strategy Instances</h2>
              <p style={{ margin: 0 }}>Create an execution instance and manage its lifecycle.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreateInstance((visible) => !visible)}>
              {showCreateInstance ? 'Cancel' : '+ Create Instance'}
            </button>
          </div>

          {instanceCreatedMessage && (
            <div className="live-warning" role="status" style={{ marginTop: '1rem' }}>
              ✓ {instanceCreatedMessage}
            </div>
          )}

          {showCreateInstance && (
            <div style={{ marginTop: '1rem' }}>
              <StrategyCreateInstanceForm
                definitionId={strategy.id}
                onSuccess={handleInstanceCreated}
                onCancel={() => setShowCreateInstance(false)}
              />
            </div>
          )}

          <div style={{ marginTop: '1.25rem' }}>
            <StrategyInstanceList key={instanceRefreshKey} strategyDefinitionId={strategy.id} />
          </div>
        </section>
      </div>
    </div>
  );
}
