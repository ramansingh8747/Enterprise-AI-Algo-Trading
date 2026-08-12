import React, { useEffect, useState } from 'react';
import { riskApi, KillSwitchStatusResponse } from '@/services/api/riskApi';

export const KillSwitchStatus: React.FC = () => {
  const [statusData, setStatusData] = useState<KillSwitchStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Confirmation Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<'ACTIVATE' | 'DEACTIVATE' | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await riskApi.getKillSwitchStatus();
      setStatusData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch Emergency Kill Switch status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const openConfirmation = (action: 'ACTIVATE' | 'DEACTIVATE') => {
    setPendingAction(action);
    setModalOpen(true);
  };

  const closeConfirmation = () => {
    setModalOpen(false);
    setPendingAction(null);
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    setPending(true);
    setError(null);
    setSuccessMessage(null);
    setModalOpen(false);

    try {
      let res: KillSwitchStatusResponse;
      if (pendingAction === 'ACTIVATE') {
        res = await riskApi.activateKillSwitch();
      } else {
        res = await riskApi.deactivateKillSwitch();
      }

      setStatusData(res);
      setSuccessMessage(res.message || `Kill Switch successfully ${res.status.toLowerCase()}d.`);
    } catch (err: any) {
      setError(err?.message || `Failed to ${pendingAction.toLowerCase()} Emergency Kill Switch.`);
    } finally {
      setPending(false);
      setPendingAction(null);
    }
  };

  const isActive = statusData?.kill_switch_active ?? false;

  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: '0.75rem',
        border: '1px solid #334155',
        padding: '1.5rem',
        color: '#f8fafc',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
            🚨 Emergency Kill Switch Admin Control
          </h2>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            System-wide trading safety override. Activating immediately halts all strategy cycles and order executions.
          </p>
        </div>

        <button
          onClick={fetchStatus}
          disabled={loading || pending}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '0.375rem',
            background: '#334155',
            color: '#f8fafc',
            border: 'none',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Refreshing...' : '🔄 Refresh Status'}
        </button>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div
          aria-label="success-alert"
          style={{
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid rgba(74, 222, 128, 0.4)',
            color: '#4ade80',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          ✅ {successMessage}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          aria-label="error-alert"
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !statusData ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          ⏳ Fetching Emergency Kill Switch Status from Backend...
        </div>
      ) : (
        <div>
          {/* Status Display Banner */}
          <div
            aria-label="status-banner"
            style={{
              padding: '1.25rem',
              borderRadius: '0.5rem',
              background: isActive ? 'rgba(239, 68, 68, 0.2)' : 'rgba(74, 222, 128, 0.15)',
              border: isActive ? '2px solid #ef4444' : '2px solid #22c55e',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{isActive ? '🔴' : '🟢'}</span>
                <div>
                  <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                    Current Platform State
                  </span>
                  <div
                    aria-label="status-text"
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: isActive ? '#f87171' : '#4ade80',
                    }}
                  >
                    {isActive ? 'ACTIVE — SYSTEM HALTED' : 'INACTIVE — NORMAL TRADING'}
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '0.5rem', marginBottom: 0 }}>
                {isActive
                  ? 'All automated strategy execution cycles and live/paper order placements are strictly blocked by RiskEngine.'
                  : 'Trading engine is operational. RiskEngine active parameters are enforcing standard risk limits.'}
              </p>
            </div>

            {statusData?.updated_at && (
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right' }}>
                Last Updated:
                <br />
                {new Date(statusData.updated_at).toLocaleTimeString()}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button
              aria-label="activate-button"
              onClick={() => openConfirmation('ACTIVATE')}
              disabled={pending || isActive}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                background: isActive ? '#475569' : '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: isActive || pending ? 'not-allowed' : 'pointer',
                opacity: isActive || pending ? 0.6 : 1,
              }}
            >
              {pending && pendingAction === 'ACTIVATE' ? 'Activating...' : '🛑 ACTIVATE KILL SWITCH'}
            </button>

            <button
              aria-label="deactivate-button"
              onClick={() => openConfirmation('DEACTIVATE')}
              disabled={pending || !isActive}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                background: !isActive ? '#475569' : '#16a34a',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: !isActive || pending ? 'not-allowed' : 'pointer',
                opacity: !isActive || pending ? 0.6 : 1,
              }}
            >
              {pending && pendingAction === 'DEACTIVATE' ? 'Deactivating...' : '✅ DEACTIVATE KILL SWITCH'}
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalOpen && (
        <div
          aria-label="confirmation-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#0f172a',
              borderRadius: '0.75rem',
              border: pendingAction === 'ACTIVATE' ? '2px solid #ef4444' : '2px solid #22c55e',
              padding: '1.75rem',
              maxWidth: '500px',
              width: '90%',
              color: '#f8fafc',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginTop: 0, color: pendingAction === 'ACTIVATE' ? '#f87171' : '#4ade80' }}>
              {pendingAction === 'ACTIVATE' ? '🚨 Confirm Emergency Kill Switch Activation' : '✅ Confirm Kill Switch Deactivation'}
            </h3>

            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              {pendingAction === 'ACTIVATE'
                ? 'Warning: Activating the Emergency Kill Switch will IMMEDIATELY HALT all live and paper strategy executions and reject all order requests across the entire platform.'
                : 'Deactivating the Emergency Kill Switch will restore normal trading operations. Ensure that any underlying market anomalies or risk issues have been fully resolved.'}
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                aria-label="modal-cancel-button"
                onClick={closeConfirmation}
                disabled={pending}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.375rem',
                  background: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                aria-label="modal-confirm-button"
                onClick={handleConfirmAction}
                disabled={pending}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.375rem',
                  background: pendingAction === 'ACTIVATE' ? '#dc2626' : '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: pending ? 'not-allowed' : 'pointer',
                }}
              >
                {pending ? 'Processing...' : pendingAction === 'ACTIVATE' ? 'Yes, Halt Trading Now' : 'Yes, Restore Trading'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KillSwitchStatus;
