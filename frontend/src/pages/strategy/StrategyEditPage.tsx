import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { strategyApi, StrategyDefinition } from '@/services/api/strategyApi';
import { StrategyDefinitionUpdatePayload } from '@/types/strategy';
import { ApiError } from '@/services/api/ApiError';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import '../styles/StrategyEdit.css';

/**
 * Strategy Edit Page
 *
 * Loads existing strategy definition and allows editing.
 */
export default function StrategyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [strategy, setStrategy] = useState<StrategyDefinition | null>(null);
  const [name, setName] = useState('');
  const [configJson, setConfigJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Load existing strategy data
   */
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
        setName(data.name);
        setConfigJson(data.config_json || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load strategy');
        console.error('Failed to load strategy:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStrategy();
  }, [id]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Strategy name is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !id) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: StrategyDefinitionUpdatePayload = {
        name: name.trim(),
        config_json: configJson.trim() || undefined,
      };

      await strategyApi.updateDefinition(id, payload as any);
      navigate(`/strategies/${id}`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details && typeof err.details === 'object') {
          setFieldErrors(err.details as Record<string, string>);
        }
      } else {
        setError('Failed to update strategy');
      }
      console.error('Error updating strategy:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingState message="Loading strategy..." />;
  }

  if (error && !strategy) {
    return (
      <ErrorState
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="strategy-edit-page">
      <div className="edit-header">
        <button className="btn btn-outline" onClick={() => navigate(`/strategies/${id}`)}>
          ← Back
        </button>
        <h1>Edit Strategy</h1>
      </div>

      <form className="strategy-edit-form" onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <label htmlFor="name">Strategy Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            className={fieldErrors.name ? 'error' : ''}
          />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="strategyType">Strategy Type (Read-only)</label>
          <input
            id="strategyType"
            type="text"
            value={strategy?.strategy_type || ''}
            disabled
            title="Strategy type cannot be changed after creation"
          />
        </div>

        <div className="form-group">
          <label htmlFor="configJson">Configuration (JSON)</label>
          <textarea
            id="configJson"
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            disabled={saving}
            rows={8}
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={saving}
            onClick={() => navigate(`/strategies/${id}`)}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
