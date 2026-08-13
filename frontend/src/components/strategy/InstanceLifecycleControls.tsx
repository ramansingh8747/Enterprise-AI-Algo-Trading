import React, { useState } from 'react';
import { StrategyInstance, strategyApi } from '@/services/api/strategyApi';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import '../styles/InstanceControls.css';

interface InstanceLifecycleControlsProps {
  instance: StrategyInstance;
  definitionId: string;
  onStateChange?: (newInstance: StrategyInstance) => void;
  onError?: (error: string) => void;
}

/**
 * Controls for managing strategy instance lifecycle.
 * Shows only valid state transitions based on current status.
 * LIVE mode requires explicit confirmation before start.
 */
export const InstanceLifecycleControls: React.FC<InstanceLifecycleControlsProps> = ({
  instance,
  definitionId,
  onStateChange,
  onError,
}) => {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    title: string;
    message: string;
  } | null>(null);

  const isLive = instance.execution_mode === 'LIVE';
  const isPaperTradingMode = !isLive;

  /**
   * Determine which actions are valid for the current state.
   */
  const canStart = ['DRAFT', 'READY'].includes(instance.status);
  const canPause = instance.status === 'RUNNING';
  const canResume = instance.status === 'PAUSED';
  const canStop = ['RUNNING', 'PAUSED', 'READY'].includes(instance.status);

  const handleAction = async (action: string) => {
    // Require confirmation for LIVE mode start
    if (action === 'start' && isLive) {
      setConfirmAction({
        action: 'start',
        title: '⚠️ Live Mode Execution',
        message: `This strategy will run in LIVE mode. Confirm that you want to start live execution for ${instance.execution_mode} mode.`,
      });
      return;
    }

    // For other actions, proceed directly
    await executeAction(action);
  };

  const executeAction = async (action: string) => {
    setLoading(true);
    try {
      let result: StrategyInstance;

      switch (action) {
        case 'start':
          result = await strategyApi.startInstance(definitionId, instance.id);
          break;
        case 'pause':
          result = await strategyApi.pauseInstance(definitionId, instance.id);
          break;
        case 'resume':
          result = await strategyApi.resumeInstance(definitionId, instance.id);
          break;
        case 'stop':
          result = await strategyApi.stopInstance(definitionId, instance.id);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (onStateChange) {
        onStateChange(result);
      }

      setConfirmAction(null);
    } catch (err: any) {
      const message = err.message || `Failed to ${action} instance`;
      if (onError) {
        onError(message);
      }
      console.error(`Error executing ${action}:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="instance-controls">
      {isLive && (
        <div className="mode-warning">⚠️ LIVE EXECUTION MODE - Real trading enabled</div>
      )}
      {isPaperTradingMode && (
        <div className="mode-info">📊 PAPER TRADING MODE - Simulation only</div>
      )}

      <div className="controls-buttons">
        {canStart && (
          <button
            className={`btn ${isLive ? 'btn-danger' : 'btn-success'}`}
            onClick={() => handleAction('start')}
            disabled={loading}
          >
            {loading ? 'Starting...' : 'Start'}
          </button>
        )}
        {canPause && (
          <button
            className="btn btn-warning"
            onClick={() => handleAction('pause')}
            disabled={loading}
          >
            {loading ? 'Pausing...' : 'Pause'}
          </button>
        )}
        {canResume && (
          <button
            className="btn btn-info"
            onClick={() => handleAction('resume')}
            disabled={loading}
          >
            {loading ? 'Resuming...' : 'Resume'}
          </button>
        )}
        {canStop && (
          <button
            className="btn btn-secondary"
            onClick={() => handleAction('stop')}
            disabled={loading}
          >
            {loading ? 'Stopping...' : 'Stop'}
          </button>
        )}
      </div>

      {confirmAction && (
        <ConfirmDialog
          title={confirmAction.title}
          message={confirmAction.message}
          onConfirm={() => executeAction(confirmAction.action)}
          onCancel={() => setConfirmAction(null)}
          confirmText="Confirm"
          cancelText="Cancel"
          isDangerous={true}
        />
      )}
    </div>
  );
};
