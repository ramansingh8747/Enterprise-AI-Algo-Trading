import React, { useEffect, useState } from 'react';
import { strategyApi, StrategyInstance } from '@/services/api/strategyApi';
import { brokersApi, BrokerResponse } from '@/services/api/brokersApi';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import '../styles/StrategyInstanceForm.css';

interface StrategyCreateInstanceFormProps {
  definitionId: string;
  onSuccess?: (instance: StrategyInstance) => void;
  onCancel?: () => void;
}

export const StrategyCreateInstanceForm: React.FC<StrategyCreateInstanceFormProps> = ({
  definitionId,
  onSuccess,
  onCancel,
}) => {
  const [brokers, setBrokers] = useState<BrokerResponse[]>([]);
  const [brokerId, setBrokerId] = useState('');
  const [executionMode, setExecutionMode] = useState<'PAPER' | 'LIVE'>('PAPER');
  const [loadingBrokers, setLoadingBrokers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLive, setConfirmLive] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadBrokers = async () => {
      try {
        setLoadingBrokers(true);
        setError(null);
        const data = await brokersApi.listBrokers();
        if (mounted) {
          const activeBrokers = data.filter((broker) => broker.is_active);
          setBrokers(activeBrokers);
          if (activeBrokers.length > 0) setBrokerId(activeBrokers[0].id);
        }
      } catch (err: unknown) {
        if (mounted) setError(err instanceof Error ? err.message : 'Failed to load brokers');
      } finally {
        if (mounted) setLoadingBrokers(false);
      }
    };
    loadBrokers();
    return () => { mounted = false; };
  }, []);

  const submit = async () => {
    if (!brokerId) {
      setError('Please select an active broker.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const instance = await strategyApi.createInstance(definitionId, {
        broker_id: brokerId,
        execution_mode: executionMode,
      });
      setConfirmLive(false);
      onSuccess?.(instance);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create strategy instance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (executionMode === 'LIVE') {
      setConfirmLive(true);
      return;
    }
    submit();
  };

  return (
    <>
      <form className="strategy-instance-form" onSubmit={handleSubmit}>
        <div className="strategy-instance-form-header">
          <div>
            <h3>Create Strategy Instance</h3>
            <p>Select the broker and execution mode for this strategy instance.</p>
          </div>
          {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>Cancel</button>}
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="form-group">
          <label htmlFor="instance-broker">Broker *</label>
          {loadingBrokers ? (
            <div>Loading active brokers...</div>
          ) : brokers.length === 0 ? (
            <div className="form-error">No active broker is available. Configure an active broker before creating an instance.</div>
          ) : (
            <select id="instance-broker" value={brokerId} onChange={(e) => setBrokerId(e.target.value)} disabled={submitting} required>
              <option value="">Select broker</option>
              {brokers.map((broker) => (
                <option key={broker.id} value={broker.id}>{broker.broker_name} ({broker.broker_type})</option>
              ))}
            </select>
          )}
        </div>

        <fieldset className="form-group">
          <legend>Execution Mode *</legend>
          <label>
            <input type="radio" name="execution-mode" value="PAPER" checked={executionMode === 'PAPER'} onChange={() => setExecutionMode('PAPER')} disabled={submitting} />
            <span><strong>PAPER</strong> — simulation only</span>
          </label>
          <label>
            <input type="radio" name="execution-mode" value="LIVE" checked={executionMode === 'LIVE'} onChange={() => setExecutionMode('LIVE')} disabled={submitting} />
            <span><strong>LIVE</strong> — real trading execution</span>
          </label>
        </fieldset>

        {executionMode === 'LIVE' && (
          <div className="live-warning" role="alert">
            ⚠️ LIVE mode can result in real broker orders. Creating the instance does not start it, but the instance must be explicitly confirmed before LIVE start.
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={submitting || loadingBrokers || !brokerId || brokers.length === 0}>
          {submitting ? 'Creating...' : 'Create Instance'}
        </button>
      </form>

      {confirmLive && (
        <ConfirmDialog
          title="Confirm LIVE Strategy Instance"
          message="You selected LIVE execution mode. This instance is configured for real trading. Do you want to create it? Starting the instance later will require a separate confirmation."
          onConfirm={submit}
          onCancel={() => setConfirmLive(false)}
          confirmText="Create LIVE Instance"
          cancelText="Cancel"
          isDangerous
        />
      )}
    </>
  );
};
