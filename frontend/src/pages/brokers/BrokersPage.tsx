import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { brokersApi, BrokerResponse, BrokerRequest } from "@/services/api/brokersApi";
import { BrokerSessionCard } from "@/components/brokers/BrokerSessionCard";
import { BrokerDataPanel } from "@/components/brokers/BrokerDataPanel";

export default function BrokersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  // Broker list state
  const [brokers, setBrokers] = useState<BrokerResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal states
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'detail' | null>(null);
  const [selectedBroker, setSelectedBroker] = useState<BrokerResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);

  // Delete modal state
  const [deleteConfirmBroker, setDeleteConfirmBroker] = useState<BrokerResponse | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Live Broker Data Panel toggle state
  const [expandedDataBrokerId, setExpandedDataBrokerId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<string>('zerodha');
  const [formApiKey, setFormApiKey] = useState<string>('');
  const [formApiSecret, setFormApiSecret] = useState<string>('');
  const [formClientId, setFormClientId] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchBrokers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await brokersApi.listBrokers();
      setBrokers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load registered brokers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchBrokers();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const openCreateModal = () => {
    setFormName('');
    setFormType('zerodha');
    setFormApiKey('');
    setFormApiSecret('');
    setFormClientId('');
    setFormIsActive(true);
    setFormError(null);
    setSelectedBroker(null);
    setModalMode('create');
  };

  const openEditModal = (broker: BrokerResponse) => {
    setSelectedBroker(broker);
    setFormName(broker.broker_name);
    setFormType(broker.broker_type);
    setFormApiKey(''); // Never prefill credentials
    setFormApiSecret(''); // Never prefill credentials
    setFormClientId(broker.client_id || '');
    setFormIsActive(broker.is_active);
    setFormError(null);
    setModalMode('edit');
  };

  const openDetailModal = async (broker: BrokerResponse) => {
    setSelectedBroker(broker);
    setModalMode('detail');
    setDetailLoading(true);
    try {
      const freshData = await brokersApi.getBroker(broker.id);
      setSelectedBroker(freshData);
    } catch (err: any) {
      showToast(`Unable to fetch detail: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedBroker(null);
    setFormApiKey('');
    setFormApiSecret('');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (modalMode === 'create') {
      if (!formName.trim() || !formType.trim() || !formApiKey.trim() || !formApiSecret.trim()) {
        setFormError('Broker Name, Type, API Key, and API Secret are required.');
        return;
      }
    }

    setFormLoading(true);

    try {
      if (modalMode === 'create') {
        const payload: BrokerRequest = {
          broker_name: formName.trim(),
          broker_type: formType.trim(),
          api_key: formApiKey.trim(),
          api_secret: formApiSecret.trim(),
          client_id: formClientId.trim() || undefined,
          is_active: formIsActive,
        };

        await brokersApi.createBroker(payload);
        showToast(`Broker "${formName}" registered successfully.`);
      } else if (modalMode === 'edit' && selectedBroker) {
        const payload: Partial<BrokerRequest> = {};
        if (formName.trim()) payload.broker_name = formName.trim();
        if (formType.trim()) payload.broker_type = formType.trim();
        if (formApiKey.trim()) payload.api_key = formApiKey.trim();
        if (formApiSecret.trim()) payload.api_secret = formApiSecret.trim();
        if (formClientId.trim() !== '') payload.client_id = formClientId.trim();
        payload.is_active = formIsActive;

        await brokersApi.updateBroker(selectedBroker.id, payload);
        showToast(`Broker "${formName}" updated successfully.`);
      }

      // SECURITY CLEAR: Immediately purge transient credentials
      setFormApiKey('');
      setFormApiSecret('');
      closeModal();
      await fetchBrokers();
    } catch (err: any) {
      if (err.details && Array.isArray(err.details)) {
        const msg = err.details.map((d: any) => d.msg || 'Invalid field').join(', ');
        setFormError(`Validation error: ${msg}`);
      } else {
        setFormError(err.message || 'Failed to save broker configuration.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmBroker) return;

    setDeleteLoading(true);
    try {
      await brokersApi.deleteBroker(deleteConfirmBroker.id);
      showToast(`Broker "${deleteConfirmBroker.broker_name}" deleted.`);
      setDeleteConfirmBroker(null);
      await fetchBrokers();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ color: "#f8fafc", fontFamily: "system-ui, sans-serif" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          top: "1.25rem",
          right: "1.25rem",
          zIndex: 100,
          background: "#064e3b",
          border: "1px solid #10b981",
          borderRadius: "0.5rem",
          padding: "0.85rem 1.25rem",
          color: "#a7f3d0",
          fontSize: "0.875rem",
          fontWeight: 600,
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}>
          <span>⚡ {toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            style={{ background: "none", border: "none", color: "#a7f3d0", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.75rem" }}>
        {/* Header & Controls */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, color: "#f8fafc" }}>
                Broker Configuration & Management
              </h1>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#38bdf8",
                background: "rgba(56, 189, 248, 0.15)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                padding: "0.2rem 0.65rem",
                borderRadius: "1rem",
              }}>
                {isAdmin ? 'ADMIN CONTROL' : 'READ-ONLY VIEW'}
              </span>
            </div>
            <p style={{ margin: "0.5rem 0 0 0", color: "#94a3b8", fontSize: "0.875rem" }}>
              Configure and manage broker connections, API credentials, and integration status.
            </p>
          </div>

          {isAdmin && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={fetchBrokers}
                disabled={loading}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.375rem",
                  background: "#1e293b",
                  color: "#cbd5e1",
                  border: "1px solid #334155",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                ↻ Refresh List
              </button>
              <button
                onClick={openCreateModal}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.375rem",
                  background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                + Register New Broker
              </button>
            </div>
          )}
        </div>

        {/* Security & Access Banner */}
        {!isAdmin ? (
          <div style={{
            padding: "1rem 1.25rem",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            color: "#fbbf24",
            lineHeight: 1.5,
          }}>
            ℹ️ <strong>Access Restricted:</strong> Broker management configuration requires system administrator privileges (ADMIN role required). You are logged in as <strong>{user?.role || 'TRADER'}</strong>. Backend API calls for broker creation, editing, and deletion remain strictly protected by backend authorization.
          </div>
        ) : (
          <div style={{
            padding: "1rem 1.25rem",
            background: "rgba(56, 189, 248, 0.08)",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            borderRadius: "0.75rem",
            fontSize: "0.85rem",
            color: "#38bdf8",
            lineHeight: 1.5,
          }}>
            🛡️ <strong>Security Notice:</strong> Broker credentials (`api_key` & `api_secret`) are processed securely and sent to the backend. Credentials are <strong>never</strong> logged, stored in browser local state, or returned in API response envelopes.
          </div>
        )}

        {/* Admin Broker List Section */}
        {isAdmin && (
          <section>
            {loading ? (
              <div style={{
                padding: "3rem",
                textAlign: "center",
                background: "#1e293b",
                borderRadius: "0.75rem",
                border: "1px solid #334155",
                color: "#38bdf8",
                fontWeight: 600,
              }}>
                Loading registered brokers from platform API...
              </div>
            ) : error ? (
              <div style={{
                padding: "1.5rem",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #ef4444",
                borderRadius: "0.75rem",
                color: "#fca5a5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <div>
                  <strong>Broker List Error:</strong> {error}
                </div>
                <button
                  onClick={fetchBrokers}
                  style={{
                    padding: "0.45rem 0.85rem",
                    background: "#ef4444",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Retry
                </button>
              </div>
            ) : brokers.length === 0 ? (
              <div style={{
                padding: "3rem",
                textAlign: "center",
                background: "#1e293b",
                borderRadius: "0.75rem",
                border: "1px solid #334155",
                color: "#94a3b8",
              }}>
                <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#cbd5e1" }}>
                  No registered brokers found.
                </p>
                <p style={{ margin: "0.5rem 0 1.25rem 0", fontSize: "0.85rem" }}>
                  Click below to configure your first broker integration.
                </p>
                <button
                  onClick={openCreateModal}
                  style={{
                    padding: "0.6rem 1.2rem",
                    background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.375rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  + Register New Broker
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem" }}>
                {brokers.map((broker) => (
                  <div
                    key={broker.id}
                    style={{
                      background: "#1e293b",
                      borderRadius: "0.75rem",
                      border: broker.is_active ? "1px solid #10b981" : "1px solid #334155",
                      padding: "1.5rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.25rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
                        <div style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "0.5rem",
                          background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "1.25rem",
                          color: "#ffffff",
                          fontWeight: 800,
                        }}>
                          {broker.broker_name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#f8fafc" }}>
                            {broker.broker_name}
                          </h3>
                          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            Type: {broker.broker_type} {broker.client_id ? `| Client: ${broker.client_id}` : ''}
                          </span>
                        </div>
                      </div>

                      <span style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.25rem 0.65rem",
                        borderRadius: "1rem",
                        color: broker.is_active ? "#4ade80" : "#94a3b8",
                        background: broker.is_active ? "rgba(74, 222, 128, 0.15)" : "rgba(148, 163, 184, 0.15)",
                        border: broker.is_active ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid #334155",
                      }}>
                        {broker.is_active ? "● Active" : "Inactive"}
                      </span>
                    </div>

                    <div style={{ fontSize: "0.8rem", color: "#cbd5e1", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      <div><strong>ID:</strong> <code style={{ color: "#38bdf8" }}>{broker.id}</code></div>
                    </div>

                    {/* Integrated Broker Session Management */}
                    <BrokerSessionCard
                      brokerId={broker.id}
                      brokerName={broker.broker_name}
                      onShowToast={showToast}
                    />

                    {/* Integrated Read-Only Broker Data Expand/Collapse */}
                    <button
                      onClick={() => setExpandedDataBrokerId(expandedDataBrokerId === broker.id ? null : broker.id)}
                      style={{
                        padding: "0.5rem 0.85rem",
                        borderRadius: "0.375rem",
                        background: expandedDataBrokerId === broker.id ? "rgba(56, 189, 248, 0.2)" : "#0f172a",
                        border: "1px solid #334155",
                        color: "#38bdf8",
                        fontWeight: 600,
                        fontSize: "0.8rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                      }}
                    >
                      📊 {expandedDataBrokerId === broker.id ? 'Hide Live Broker Data' : 'View Live Broker Data'}
                    </button>

                    {expandedDataBrokerId === broker.id && (
                      <BrokerDataPanel
                        brokerId={broker.id}
                        brokerName={broker.broker_name}
                        onShowToast={showToast}
                      />
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "auto" }}>
                      <button
                        onClick={() => openDetailModal(broker)}
                        style={{
                          flex: 1,
                          padding: "0.5rem",
                          borderRadius: "0.375rem",
                          background: "#0f172a",
                          border: "1px solid #334155",
                          color: "#cbd5e1",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Details
                      </button>

                      <button
                        onClick={() => openEditModal(broker)}
                        style={{
                          flex: 1,
                          padding: "0.5rem",
                          borderRadius: "0.375rem",
                          background: "#0284c7",
                          border: "none",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => setDeleteConfirmBroker(broker)}
                        style={{
                          padding: "0.5rem 0.85rem",
                          borderRadius: "0.375rem",
                          background: "rgba(239, 68, 68, 0.15)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "#fca5a5",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Modal: Create / Edit Broker */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          padding: "1rem",
        }}>
          <div style={{
            width: "100%",
            maxWidth: "500px",
            background: "#0f172a",
            borderRadius: "0.85rem",
            border: "1px solid #334155",
            padding: "1.75rem",
            color: "#f8fafc",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8" }}>
                {modalMode === 'create' ? 'Register New Broker' : `Edit Broker (${selectedBroker?.broker_name})`}
              </h3>
              <button
                onClick={closeModal}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {formError && (
              <div style={{
                padding: "0.75rem",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #ef4444",
                borderRadius: "0.5rem",
                color: "#fca5a5",
                fontSize: "0.85rem",
                marginBottom: "1rem",
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                  Broker Name *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Zerodha Pro"
                  required={modalMode === 'create'}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    color: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                  Broker Type *
                </label>
                <input
                  type="text"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="e.g. zerodha or angelone"
                  required={modalMode === 'create'}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    color: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                  API Key {modalMode === 'create' ? '*' : '(Leave blank to keep unchanged)'}
                </label>
                <input
                  type="text"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder="e.g. api_key_12345"
                  required={modalMode === 'create'}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    color: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                  API Secret {modalMode === 'create' ? '*' : '(Leave blank to keep unchanged)'}
                </label>
                <input
                  type="password"
                  value={formApiSecret}
                  onChange={(e) => setFormApiSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  required={modalMode === 'create'}
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    color: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#cbd5e1", marginBottom: "0.35rem" }}>
                  Client ID (Optional)
                </label>
                <input
                  type="text"
                  value={formClientId}
                  onChange={(e) => setFormClientId(e.target.value)}
                  placeholder="e.g. ZB1234"
                  style={{
                    width: "100%",
                    padding: "0.65rem",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "0.5rem",
                    color: "#ffffff",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  id="formIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  style={{ cursor: "pointer", width: "16px", height: "16px" }}
                />
                <label htmlFor="formIsActive" style={{ fontSize: "0.85rem", color: "#cbd5e1", cursor: "pointer" }}>
                  Active Broker Integration
                </label>
              </div>

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1,
                    padding: "0.65rem",
                    borderRadius: "0.375rem",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    color: "#cbd5e1",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  style={{
                    flex: 1,
                    padding: "0.65rem",
                    borderRadius: "0.375rem",
                    background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                    color: "#ffffff",
                    border: "none",
                    fontWeight: 700,
                    cursor: formLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {formLoading ? 'Saving...' : (modalMode === 'create' ? 'Register Broker' : 'Update Broker')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Detail Broker */}
      {modalMode === 'detail' && selectedBroker && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          padding: "1rem",
        }}>
          <div style={{
            width: "100%",
            maxWidth: "460px",
            background: "#0f172a",
            borderRadius: "0.85rem",
            border: "1px solid #334155",
            padding: "1.75rem",
            color: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8" }}>
                Broker Configuration Details
              </h3>
              <button
                onClick={closeModal}
                style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div style={{ color: "#38bdf8", padding: "1rem", textAlign: "center" }}>Loading latest details...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", fontSize: "0.9rem" }}>
                <div><strong>ID:</strong> <code style={{ color: "#38bdf8" }}>{selectedBroker.id}</code></div>
                <div><strong>Name:</strong> {selectedBroker.broker_name}</div>
                <div><strong>Type:</strong> {selectedBroker.broker_type}</div>
                <div><strong>Client ID:</strong> {selectedBroker.client_id || 'Not specified'}</div>
                <div><strong>Status:</strong> {selectedBroker.is_active ? '● Active' : 'Inactive'}</div>
                <div style={{ padding: "0.5rem", background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "0.375rem", fontSize: "0.75rem", color: "#38bdf8" }}>
                  🔒 Security Note: API credentials (`api_key`, `api_secret`) are stored server-side and never returned to the browser.
                </div>
              </div>
            )}

            <button
              onClick={closeModal}
              style={{
                width: "100%",
                padding: "0.65rem",
                borderRadius: "0.375rem",
                background: "#1e293b",
                border: "1px solid #334155",
                color: "#cbd5e1",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteConfirmBroker && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 110,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          padding: "1rem",
        }}>
          <div style={{
            width: "100%",
            maxWidth: "420px",
            background: "#0f172a",
            borderRadius: "0.85rem",
            border: "1px solid #ef4444",
            padding: "1.5rem",
            color: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#fca5a5" }}>
              Delete Broker "{deleteConfirmBroker.broker_name}"?
            </h3>
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#cbd5e1", lineHeight: 1.5 }}>
              Are you sure you want to delete broker configuration <strong>{deleteConfirmBroker.broker_name}</strong> (ID: <code>{deleteConfirmBroker.id}</code>)? This action will remove the registered broker.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteConfirmBroker(null)}
                disabled={deleteLoading}
                style={{
                  padding: "0.6rem 1.2rem",
                  borderRadius: "0.375rem",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#cbd5e1",
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                style={{
                  padding: "0.6rem 1.2rem",
                  borderRadius: "0.375rem",
                  background: "#dc2626",
                  border: "none",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                }}
              >
                {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
