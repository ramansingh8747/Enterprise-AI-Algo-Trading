import React, { useState, useEffect } from 'react';
import { brokerSessionsApi, BrokerSessionResponse } from '@/services/api/brokerSessionsApi';
import { BrokerSessionCreateModal } from './BrokerSessionCreateModal';

interface BrokerSessionCardProps {
  brokerId: string;
  brokerName: string;
  onShowToast: (msg: string) => void;
}

export type DerivedSessionStatus = 'connected' | 'expiring_soon' | 'expired' | 'not_connected';

export const deriveSessionStatus = (expiresAtStr: string | null | undefined): DerivedSessionStatus => {
  if (!expiresAtStr) return 'not_connected';
  const expiresAt = new Date(expiresAtStr).getTime();
  if (isNaN(expiresAt)) return 'not_connected';

  const now = Date.now();
  if (now >= expiresAt) {
    return 'expired';
  }

  // If expiring in less than 1 hour (3600000 ms)
  if (expiresAt - now < 3600000) {
    return 'expiring_soon';
  }

  return 'connected';
};

export const BrokerSessionCard: React.FC<BrokerSessionCardProps> = ({
  brokerId,
  brokerName,
  onShowToast,
}) => {
  const [session, setSession] = useState<BrokerSessionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showRevokeModal, setShowRevokeModal] = useState<boolean>(false);
  const [revokeLoading, setRevokeLoading] = useState<boolean>(false);

  const fetchSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await brokerSessionsApi.getSession(brokerId);
      setSession(data);
    } catch (err: any) {
      if (err.status === 404) {
        // 404 means no active session exists for this broker
        setSession(null);
      } else {
        setError(err.message || 'Failed to check broker session status.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brokerId) {
      fetchSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerId]);

  const handleRevoke = async () => {
    if (!session) return;

    setRevokeLoading(true);
    try {
      await brokerSessionsApi.deleteSession(session.id);
      onShowToast(`Session revoked for ${brokerName}.`);
      setSession(null);
      setShowRevokeModal(false);
    } catch (err: any) {
      onShowToast(`Failed to revoke session: ${err.message}`);
    } finally {
      setRevokeLoading(false);
    }
  };

  const status = session ? deriveSessionStatus(session.expires_at) : 'not_connected';

  const renderStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#4ade80',
            background: 'rgba(74, 222, 128, 0.15)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
            padding: '0.25rem 0.65rem',
            borderRadius: '1rem',
          }}>
            ● Connected
          </span>
        );
      case 'expiring_soon':
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#facc15',
            background: 'rgba(250, 204, 21, 0.15)',
            border: '1px solid rgba(250, 204, 21, 0.3)',
            padding: '0.25rem 0.65rem',
            borderRadius: '1rem',
          }}>
            ⚠️ Expiring Soon
          </span>
        );
      case 'expired':
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#fca5a5',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '0.25rem 0.65rem',
            borderRadius: '1rem',
          }}>
            ❌ Expired
          </span>
        );
      default:
        return (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#94a3b8',
            background: 'rgba(148, 163, 184, 0.15)',
            border: '1px solid #334155',
            padding: '0.25rem 0.65rem',
            borderRadius: '1rem',
          }}>
            Disconnected
          </span>
        );
    }
  };

  return (
    <div style={{
      background: '#1e293b',
      borderRadius: '0.75rem',
      border: session && (status === 'connected' || status === 'expiring_soon')
        ? '1px solid #10b981'
        : '1px solid #334155',
      padding: '1.5rem',
      color: '#f8fafc',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#38bdf8', fontWeight: 700 }}>
            {brokerName} Session Status
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Broker ID: <code style={{ color: '#cbd5e1' }}>{brokerId}</code>
          </span>
        </div>

        {renderStatusBadge()}
      </div>

      {loading ? (
        <div style={{ fontSize: '0.85rem', color: '#38bdf8', padding: '1rem 0' }}>
          Checking active broker session...
        </div>
      ) : error ? (
        <div style={{
          padding: '0.75rem',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          fontSize: '0.85rem',
          color: '#fca5a5',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>{error}</span>
          <button
            onClick={fetchSession}
            style={{
              padding: '0.3rem 0.65rem',
              background: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      ) : session ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Session ID</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
                {session.id}
              </span>
            </div>

            <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>User ID</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1', fontFamily: 'monospace' }}>
                {session.user_id}
              </span>
            </div>

            <div style={{ background: '#0f172a', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>Session Expiration</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: status === 'expired' ? '#fca5a5' : '#cbd5e1' }}>
                {new Date(session.expires_at).toLocaleString()}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              onClick={() => setShowRevokeModal(true)}
              style={{
                flex: 1,
                padding: '0.6rem',
                borderRadius: '0.375rem',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Revoke Session
            </button>

            {status === 'expired' && (
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  borderRadius: '0.375rem',
                  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Reconnect Session
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.4 }}>
            No active broker session found. Connect a session using a valid broker access token to enable read-only broker data operations.
          </p>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.65rem 1.2rem',
              borderRadius: '0.375rem',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            + Start Broker Session
          </button>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <BrokerSessionCreateModal
          open={showCreateModal}
          brokerId={brokerId}
          brokerName={brokerName}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchSession}
          onShowToast={onShowToast}
        />
      )}

      {/* Revoke Confirmation Modal */}
      {showRevokeModal && session && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 110,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          padding: '1rem',
        }}>
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: '#0f172a',
            borderRadius: '0.85rem',
            border: '1px solid #ef4444',
            padding: '1.5rem',
            color: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fca5a5' }}>
              Revoke Session for {brokerName}?
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Are you sure you want to revoke broker session <code>{session.id}</code>? Read-only broker operations will stop until a new session is connected.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowRevokeModal(false)}
                disabled={revokeLoading}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.375rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revokeLoading}
                style={{
                  padding: '0.6rem 1.2rem',
                  borderRadius: '0.375rem',
                  background: '#dc2626',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: revokeLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {revokeLoading ? 'Revoking...' : 'Confirm Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrokerSessionCard;
