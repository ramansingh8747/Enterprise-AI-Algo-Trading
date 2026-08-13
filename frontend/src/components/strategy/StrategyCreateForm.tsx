import React, { useState } from 'react';
import { strategyApi } from '@/services/api/strategyApi';
import { StrategyDefinitionCreatePayload } from '@/types/strategy';
import { ApiError } from '@/services/api/ApiError';
import '../styles/StrategyForm.css';

interface StrategyCreateFormProps {
  onSuccess?: (id: string) => void;
  onCancel?: () => void;
}

/**
 * Form for creating a new strategy definition.
 * Validates required fields and displays backend validation errors.
 */
export const StrategyCreateForm: React.FC<StrategyCreateFormProps> = ({
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [strategyType, setStrategyType] = useState('momentum');
  const [configJson, setConfigJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!name.trim()) {
      errors.name = 'Strategy name is required';
    }

    if (!strategyType.trim()) {
      errors.strategyType = 'Strategy type is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: StrategyDefinitionCreatePayload = {
        name: name.trim(),
        strategy_type: strategyType.trim(),
        config_json: configJson.trim() || undefined,
      };

      const result = await strategyApi.createDefinition(
        payload as any
      );

      setName('');
      setStrategyType('momentum');
      setConfigJson('');
      setFieldErrors({});

      if (onSuccess) {
        onSuccess(result.id);
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err.message);
        // If error details contain field-level errors, display them
        if (err.details && typeof err.details === 'object') {
          setFieldErrors(err.details as Record<string, string>);
        }
      } else {
        setError('Failed to create strategy');
      }
      console.error('Error creating strategy:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="strategy-form" onSubmit={handleSubmit}>
      <h2>Create New Strategy</h2>

      {error && <div className="form-error">{error}</div>}

      <div className="form-group">
        <label htmlFor="name">Strategy Name *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., My Momentum Strategy"
          disabled={loading}
          className={fieldErrors.name ? 'error' : ''}
        />
        {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
      </div>

      <div className="form-group">
        <label htmlFor="strategyType">Strategy Type *</label>
        <select
          id="strategyType"
          value={strategyType}
          onChange={(e) => setStrategyType(e.target.value)}
          disabled={loading}
          className={fieldErrors.strategyType ? 'error' : ''}
        >
          <option value="momentum">Momentum</option>
          <option value="mean_reversion">Mean Reversion</option>
          <option value="arbitrage">Arbitrage</option>
          <option value="trend_following">Trend Following</option>
          <option value="custom">Custom</option>
        </select>
        {fieldErrors.strategyType && (
          <span className="field-error">{fieldErrors.strategyType}</span>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="configJson">Configuration (JSON)</label>
        <textarea
          id="configJson"
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          placeholder='{"param1": "value1"}'
          disabled={loading}
          rows={6}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Creating...' : 'Create Strategy'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
};
