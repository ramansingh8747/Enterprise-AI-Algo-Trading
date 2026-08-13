import React, { useState, useEffect } from 'react';
import { strategyApi } from '@/services/api/strategyApi';
import { StrategyInstance } from '@/types/strategy';
import { Spinner } from '@/components/common/Spinner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { SignalHistory } from './SignalHistory';

interface Props {
  strategyDefinitionId: string;
}

type PendingAction = {
  action: 'start';
  instanceId: string;
  title: string;
  message: string;
} | null;

export const StrategyInstanceList: React.FC<Props> = ({ strategyDefinitionId }) => {
  const [instances, setInstances] = useState<StrategyInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const loadInstances = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await strategyApi.listInstances(strategyDefinitionId);
      setInstances(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load strategy instances');
    } finally {
      setLoading(false);
    }
  }, [strategyDefinitionId]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  async function handleAction(action: 'start' | 'pause' | 'stop' | 'resume', instanceId: string) {
    const instance = instances.find((item) => item.id === instanceId);

    if (action === 'start' && instance?.execution_mode === 'LIVE') {
      setPendingAction({
        action: 'start',
        instanceId,
        title: '⚠️ Start Live Strategy',
        message:
          'This strategy instance is configured for LIVE execution. Starting it may place real broker orders. Confirm that you intentionally want to begin live trading.',
      });
      return;
    }

    await executeAction(action, instanceId);
  }

  async function executeAction(action: 'start' | 'pause' | 'stop' | 'resume', instanceId: string) {
    setActionLoading(instanceId);
    setError(null);
    try {
      let updated: StrategyInstance;
      if (action === 'start') updated = await strategyApi.startInstance(strategyDefinitionId, instanceId);
      else if (action === 'pause') updated = await strategyApi.pauseInstance(strategyDefinitionId, instanceId);
      else if (action === 'stop') updated = await strategyApi.stopInstance(strategyDefinitionId, instanceId);
      else updated = await strategyApi.resumeInstance(strategyDefinitionId, instanceId);

      setInstances((current) => current.map((instance) => instance.id === updated.id ? updated : instance));
      setPendingAction(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to ${action} instance`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <div>{error} <button onClick={loadInstances}>Retry</button></div>;

  return (
    <div>
      <h3>Instances</h3>
      {instances.length === 0 ? (
        <p>No instances found.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Actions</th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody>
              {instances.map((inst) => (
                <tr key={inst.id}>
                  <td>{inst.id}</td>
                  <td>{inst.status}</td>
                  <td>{inst.execution_mode}</td>
                  <td>
                    {actionLoading === inst.id ? <Spinner /> : (
                      <>
                        {['DRAFT', 'READY'].includes(inst.status) && (
                          <button onClick={() => handleAction('start', inst.id)}>
                            {inst.execution_mode === 'LIVE' ? 'Start LIVE' : 'Start'}
                          </button>
                        )}
                        {inst.status === 'RUNNING' && <button onClick={() => handleAction('pause', inst.id)}>Pause</button>}
                        {inst.status === 'PAUSED' && <button onClick={() => handleAction('resume', inst.id)}>Resume</button>}
                        {['RUNNING', 'PAUSED', 'READY'].includes(inst.status) && <button onClick={() => handleAction('stop', inst.id)}>Stop</button>}
                      </>
                    )}
                  </td>
                  <td>
                    <button onClick={() => setSelectedInstanceId(inst.id === selectedInstanceId ? null : inst.id)}>
                      {inst.id === selectedInstanceId ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedInstanceId && <SignalHistory strategyDefinitionId={strategyDefinitionId} instanceId={selectedInstanceId} />}
        </>
      )}

      {pendingAction && (
        <ConfirmDialog
          title={pendingAction.title}
          message={pendingAction.message}
          onConfirm={() => executeAction(pendingAction.action, pendingAction.instanceId)}
          onCancel={() => setPendingAction(null)}
          confirmText="Start LIVE"
          cancelText="Cancel"
          isDangerous
        />
      )}
    </div>
  );
};
