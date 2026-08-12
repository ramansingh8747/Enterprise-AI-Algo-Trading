import React, { useState } from 'react';
import { brokerSessionsApi } from '@/services/api/brokerSessionsApi';

interface BrokerSessionCreateModalProps {
  open: boolean;
  brokerId: string;
  brokerName: string;
  onClose: () => void;
  onCreated: () => void;
  onShowToast: (msg: string) => void;
}

export const BrokerSessionCreateModal: React.FC<BrokerSessionCreateModalProps> = ({
  open,
  brokerId,
  brokerName,
  onClose,
  onCreated,
  onShowToast,
}) => {
  const [accessToken, setAccessToken] = useState<string>('');
  
  // Default expires_at to 24 hours from now in ISO format
  const [expiresAt, setExpiresAt] = useState<string>(() => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const tokenTrimmed = accessToken.trim();
    if (!tokenTrimmed) {
      setError('Broker Access Token is required.');
      return;
    }

    if (!expiresAt) {
      setError('Expiration Date & Time is required.');
      return;
    }

    setLoading(true);

    try {
      // Format datetime to full ISO 8601 string
      const isoExpiresAt = new Date(expiresAt).toISOString();

      await brokerSessionsApi.createSession({
        broker_id: brokerId,
        access_token: tokenTrimmed,
        expires_at: isoExpiresAt,
      });

      onShowToast(`Broker session created for ${brokerName}.`);
      onCreated();
      onClose();
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const msg = err.details.map((d: any) => d.msg || 'Invalid field').join(', ');
        setError(`Validation error: ${msg}`);
      } else {
        setError(err.message || 'Failed to create broker session.');
      }
    } finally {
      // SECURITY REQUIREMENT: Clear sensitive access_token from component state immediately
      setAccessToken('');
      setLoading(false);
    }
  };

  const handleClose = () => {
    // SECURITY: Clear sensitive state on cancel
    setAccessToken('');
    setError(null);
    onClose();
  };

  return (
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
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        background: '#0f172a',
        borderRadius: '0.85rem',
        border: '1px solid #334155',
        padding: '1.75rem',
        color: '#f8fafc',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8' }}>
              Create Session: {brokerName}
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              POST /broker-sessions
            </span>
          </div>

          <button
            type="button"
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '0.5rem',
          fontSize: '0.8rem',
          color: '#38bdf8',
          marginBottom: '1.25rem',
          lineHeight: 1.4,
        }}>
          🛡️ <strong>Security Notice:</strong> The broker session access token is used only for session creation. It is <strong>never</strong> logged, stored in browser local storage, or returned in session API responses.
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '0.5rem',
            color: '#fca5a5',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
              Broker ID
            </label>
            <input
              type="text"
              value={brokerId}
              disabled
              style={{
                width: '100%',
                padding: '0.65rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#94a3b8',
                boxSizing: 'border-box',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
              Broker Access Token *
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="••••••••••••••••"
              required
              style={{
                width: '100%',
                padding: '0.65rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#ffffff',
                boxSizing: 'border-box',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
              Session Expiration Date & Time *
            </label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.65rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                color: '#ffffff',
                boxSizing: 'border-box',
                fontSize: '0.9rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={handleClose}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: '0.375rem',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#cbd5e1',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.65rem',
                borderRadius: '0.375rem',
                background: loading ? '#334155' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BrokerSessionCreateModal;
