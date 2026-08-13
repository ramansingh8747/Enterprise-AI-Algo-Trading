import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { strategyApi, StrategyDefinition } from '@/services/api/strategyApi';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { StrategyInstanceList } from '@/components/strategy/StrategyInstanceList';
import '../styles/StrategyDetails.css';

/**
 * Strategy Details Page
 *
 * Displays:
 * - Strategy definition metadata
 * - Configuration
 * - List of instances with lifecycle controls
 * - Signal history
 */
export default function StrategyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [strategy, setStrategy] = useState<StrategyDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err: any) {
        setError(err.message || 'Failed to load strategy');
        console.error('Failed to load strategy:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStrategy();
  }, [id]);

  if (loading) {
    return <LoadingState message="Loading strategy details..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!strategy) {
    return (
      <ErrorState
        message="Strategy not found"
        onRetry={() => navigate('/strategies')}
      />
    );
  }

  return (
    <div className="strategy-details">
      <div className="details-header">
        <button className="btn btn-outline" onClick={() => navigate('/strategies')}>
          ← Back
        </button>
        <h1>{strategy.name}</h1>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate(`/strategies/${id}/edit`)}
          >
            Edit
          </button>
        </div>
      </div>

      <div className="details-content">
        <section className="details-section">
          <h2>Strategy Information</h2>
          <div className="details-grid">
            <div className="detail-item">
              <label>Name:</label>
              <span>{strategy.name}</span>
            </div>
            <div className="detail-item">
              <label>Type:</label>
              <span>{strategy.strategy_type}</span>
            </div>
            <div className="detail-item">
              <label>Status:</label>
              <span className={`badge ${strategy.is_active ? 'active' : 'inactive'}`}>
                {strategy.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="detail-item">
              <label>Created:</label>
              <span>{new Date(strategy.created_at).toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <label>Last Updated:</label>
              <span>{new Date(strategy.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </section>

        {strategy.config_json && (
          <section className="details-section">
            <h2>Configuration</h2>
            <pre className="config-json">{JSON.stringify(JSON.parse(strategy.config_json), null, 2)}</pre>
          </section>
        )}

        <section className="details-section">
          <h2>Strategy Instances</h2>
          {strategy.id && <StrategyInstanceList strategyDefinitionId={strategy.id} />}
        </section>
      </div>
    </div>
  );
}
