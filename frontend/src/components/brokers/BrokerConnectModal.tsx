import React, { useState } from "react";
import { BrokerType, BrokerConnection } from "@/types/brokerConnection";

interface BrokerConnectModalProps {
  broker: BrokerType;
  open: boolean;
  onClose: () => void;
  onConnected?: (connection: BrokerConnection) => void;
}

export const BrokerConnectModal: React.FC<BrokerConnectModalProps> = ({
  broker,
  open,
  onClose,
  onConnected,
}) => {
  const isZerodha = broker === "zerodha";
  const brokerName = isZerodha ? "Zerodha (Kite)" : "Angel One (SmartAPI)";

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [clientId, setClientId] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("http://localhost:5173/brokers/callback");

  const [confirmedSafety, setConfirmedSafety] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError("API Key is required.");
      return;
    }

    if (!apiSecret.trim()) {
      setError("API Secret is required.");
      return;
    }

    if (!isZerodha && !clientId.trim()) {
      setError("Client ID is required for Angel One.");
      return;
    }

    if (!confirmedSafety) {
      setError("You must acknowledge that live trading is disabled.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Simulate safe broker connection
      await new Promise((resolve) => setTimeout(resolve, 600));

      const connection: BrokerConnection = {
        brokerType: broker,
        brokerName,
        status: "connected",
        accountId: isZerodha ? "ZR-DEMO-994" : "AO-DEMO-882",
        clientName: isZerodha ? "Zerodha Demo Client" : "Angel One Demo Client",
        connectedAt: new Date().toISOString(),
        isDemo: true,
        message: "Demo Connection Mode Active — Live Order Execution Disabled",
      };

      // SECURITY: Clear sensitive state immediately after submission
      setApiKey("");
      setApiSecret("");
      setClientId("");

      onConnected?.(connection);
      onClose();
    } catch {
      setError("Unable to connect broker. Please verify configuration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100,
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
        maxWidth: '520px',
        borderRadius: '1rem',
        border: '1px solid #334155',
        background: '#0f172a',
        padding: '1.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        color: '#f8fafc',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              Connect {brokerName}
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#facc15', fontWeight: 600 }}>
              PAPER TRADING MODE — Demo Broker Connection
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.25rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Safety Notice */}
        <div style={{
          padding: '0.75rem 1rem',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '0.5rem',
          fontSize: '0.8rem',
          color: '#38bdf8',
          marginBottom: '1.25rem',
          lineHeight: 1.4,
        }}>
          🛡️ Your credentials are used only for broker data connection. Do not share your API secret. Live order execution is currently disabled.
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* API Key */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
              API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="e.g. 12345abcdef"
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                padding: '0.65rem 0.85rem',
                color: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Client ID for Angel One */}
          {!isZerodha && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                Client ID / User Code
              </label>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="e.g. A123456"
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  padding: '0.65rem 0.85rem',
                  color: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          )}

          {/* API Secret (password field) */}
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
              API Secret
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="••••••••••••••••"
              style={{
                width: '100%',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                background: '#1e293b',
                padding: '0.65rem 0.85rem',
                color: '#ffffff',
                outline: 'none',
                boxSizing: 'border-box',
                fontSize: '0.9rem',
              }}
            />
          </div>

          {/* Redirect URL for Zerodha */}
          {isZerodha && (
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', color: '#cbd5e1', marginBottom: '0.35rem', fontWeight: 500 }}>
                Redirect URL
              </label>
              <input
                type="text"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  padding: '0.65rem 0.85rem',
                  color: '#94a3b8',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          )}

          {/* Safety Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input
              type="checkbox"
              id="safetyCheck"
              checked={confirmedSafety}
              onChange={(e) => setConfirmedSafety(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label htmlFor="safetyCheck" style={{ fontSize: '0.8rem', color: '#cbd5e1', cursor: 'pointer' }}>
              I understand that live trading is disabled.
            </label>
          </div>

          {error && (
            <div style={{
              borderRadius: '0.5rem',
              border: '1px solid #ef4444',
              background: 'rgba(239, 68, 68, 0.15)',
              padding: '0.65rem 0.85rem',
              fontSize: '0.85rem',
              color: '#fca5a5',
            }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontWeight: 600,
                color: '#94a3b8',
                background: '#1e293b',
                border: '1px solid #334155',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !confirmedSafety}
              style={{
                flex: 2,
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontWeight: 700,
                color: '#ffffff',
                border: 'none',
                cursor: (loading || !confirmedSafety) ? 'not-allowed' : 'pointer',
                background: (loading || !confirmedSafety) ? '#334155' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                opacity: (loading || !confirmedSafety) ? 0.6 : 1,
              }}
            >
              {loading ? "Connecting..." : "Connect Broker"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BrokerConnectModal;
