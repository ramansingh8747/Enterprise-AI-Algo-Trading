import React, { useState, useEffect } from 'react';
import { strategyApi } from '@/services/api/strategyApi';
import { StrategyInstance } from '@/types/strategy';
import { Spinner } from '@/components/common/Spinner';
import { SignalHistory } from './SignalHistory';

interface Props {
  strategyDefinitionId: string;
}

export const StrategyInstanceList: React.FC<Props> = ({ strategyDefinitionId }) => {
  const [instances, setInstances] = useState<StrategyInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const loadInstances = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await strategyApi.listInstances(strategyDefinitionId);
      setInstances(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load strategy instances');
    } finally {
      setLoading(false);
    }
  }, [strategyDefinitionId]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  async function handleAction(action: 'start' | 'pause' | 'stop' | 'resume', instanceId: string) {
    setActionLoading(instanceId);
    setError(null);
    try {
      if (action === 'start') await strategyApi.startInstance(strategyDefinitionId, instanceId);
      else if (action === 'pause') await strategyApi.pauseInstance(strategyDefinitionId, instanceId);
      else if (action === 'stop') await strategyApi.stopInstance(strategyDefinitionId, instanceId);
      else if (action === 'resume') await strategyApi.resumeInstance(strategyDefinitionId, instanceId);
      await loadInstances();
    } catch (err) {
      setError(`Failed to ${action} instance`);
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
                        {['READY', 'DRAFT'].includes(inst.status) && <button onClick={() => handleAction('start', inst.id)}>Start</button>}
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
    </div>
  );
};
