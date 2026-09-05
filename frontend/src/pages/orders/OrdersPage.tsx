import React, { useEffect, useState, useCallback, useMemo } from "react";
import { RecentPaperOrders } from "@/components/dashboard/RecentPaperOrders";
import { TradingExecutionAnalytics } from "@/components/dashboard/TradingExecutionAnalytics";
import { OrderForm, OrderSide, PaperOrder } from "@/components/dashboard/OrderForm";
import { brokerOrdersApi } from "@/services/api/brokerOrdersApi";
import { paperOrdersApi } from "@/services/api/paperOrdersApi";
import { BrokerOrderLedgerResponse, BrokerOrderResponse } from "@/types/brokerOrder";
import { calculateOrderAnalytics } from "@/services/paperTrading/orderAnalyticsService";
import { JournalEntryModal, JournalEntryModalProps } from "@/components/dashboard/JournalEntryModal";
import { getMarketSessionStatus } from "@/utils/marketTiming";



export const OrdersPage: React.FC = () => {
  const [mode, setMode] = useState<'PAPER' | 'LIVE'>('PAPER');
  const [brokerId, setBrokerId] = useState<string>("c2ce3afe-4468-49fc-9278-880111831207");
  const [liveOrders, setLiveOrders] = useState<BrokerOrderLedgerResponse[]>([]);

  const [paperOrders, setPaperOrders] = useState<PaperOrder[]>([]);
  const [paperLoading, setPaperLoading] = useState<boolean>(false);
  const [paperError, setPaperError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Cancel Modal state
  const [cancelLiveOrder, setCancelLiveOrder] = useState<BrokerOrderResponse | null>(null);

  // OrderForm state
  const [tradeRequest, setTradeRequest] = useState<{
    symbol: string;
    side: OrderSide;
    price: number;
  } | null>(null);

  // Journal Entry Modal state
  const [journalModalData, setJournalModalData] = useState<JournalEntryModalProps['initialData'] | null>(null);


  const fetchPaperOrders = useCallback(async (background: boolean | React.SyntheticEvent = false) => {
    const isBg = typeof background === 'boolean' ? background : false;
    if (!isBg) setPaperLoading(true);
    setPaperError(null);
    try {
      const data = await paperOrdersApi.listOrders();
      setPaperOrders(data.map((order) => ({
        id: order.id,
        order_id: order.order_id,
        symbol: order.symbol,
        side: order.side,
        orderType: "MARKET",
        quantity: Number(order.quantity),
        price: Number(order.price),
        status: "PAPER_EXECUTED",
        timestamp: order.executed_at,
        mode: "PAPER",
        createdAt: order.executed_at,
        broker_id: order.broker_id,
        paper_portfolio_id: order.paper_portfolio_id,
        orderSource: (order as any).order_source || (order as any).orderSource || "AUTO_PILOT",
      })));
    } catch (err: any) {
      if (err.status === 401) {
        setPaperError("Authentication required to view paper orders.");
      } else {
        setPaperError(err.message || "Failed to load persisted paper orders.");
      }
    } finally {
      if (!isBg) setPaperLoading(false);
    }
  }, []);

  const fetchLiveOrders = useCallback(async (background: boolean | React.SyntheticEvent = false) => {
    const isBg = typeof background === 'boolean' ? background : false;
    if (!brokerId.trim() || mode !== 'LIVE') return;
    if (!isBg) setLoading(true);
    setError(null);
    try {
      await brokerOrdersApi.getOrders(brokerId);
      const data = await brokerOrdersApi.getLedger(brokerId);
      setLiveOrders(data);
    } catch (err: any) {
      if (err.status === 401) {
        setError("Authentication required to view live broker orders.");
      } else if (err.status === 403) {
        setError("Access denied to broker orders.");
      } else if (err.status === 404) {
        setError("Broker or active session not found.");
      } else {
        setError(err.message || "Failed to load live broker orders.");
      }
    } finally {
      if (!isBg) setLoading(false);
    }
  }, [brokerId, mode]);

  const reconcileLiveOrders = useCallback(async () => {
    if (!brokerId.trim() || mode !== 'LIVE') return;
    setLoading(true);
    setError(null);
    try {
      await brokerOrdersApi.reconcileOrders(brokerId);
      const data = await brokerOrdersApi.getLedger(brokerId);
      setLiveOrders(data);
      setNotification('Broker order lifecycle reconciled successfully.');
      setTimeout(() => setNotification(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reconcile broker order lifecycle.');
    } finally {
      setLoading(false);
    }
  }, [brokerId, mode]);

  // Real-time Auto-Sync: Refresh Orders during active market hours only
  useEffect(() => {
    if (mode === 'PAPER') {
      fetchPaperOrders(false);
    } else {
      fetchLiveOrders();
    }

    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (!session.isOpen && !session.canExit) return;

      if (mode === 'PAPER') {
        fetchPaperOrders(true);
      } else {
        fetchLiveOrders();
      }
    }, 2500);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const session = getMarketSessionStatus();
        if (session.isOpen || session.canExit) {
          if (mode === 'PAPER') {
            fetchPaperOrders(true);
          } else {
            fetchLiveOrders();
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mode, fetchPaperOrders, fetchLiveOrders]);

  const executeCancelLiveOrder = async () => {
    if (!cancelLiveOrder || !brokerId) return;

    setCancelLoading(true);
    setError(null);

    try {
      await brokerOrdersApi.cancelOrder(brokerId, cancelLiveOrder.order_id);
      setNotification(`Live order ${cancelLiveOrder.order_id} cancelled successfully.`);
      setTimeout(() => setNotification(null), 3000);
      setCancelLiveOrder(null);
      fetchLiveOrders();
    } catch (err: any) {
      setError(err.message || "Failed to cancel live broker order.");
    } finally {
      setCancelLoading(false);
    }
  };

  const [orderModeFilter] = useState<'ALL' | '15MIN_SCALPER' | 'FULL_DAY'>(() => {
    try {
      const saved = localStorage.getItem('active_session_mode');
      if (saved === '15MIN_SCALPER') return '15MIN_SCALPER';
      if (saved === 'FULL_DAY') return 'FULL_DAY';
    } catch {}
    return 'ALL';
  });

  const isScalperOrder = useCallback((order: PaperOrder) => {
    const sym = (order.symbol || "").toUpperCase();
    return (
      sym.includes("NIFTY") ||
      sym.includes("BANKNIFTY") ||
      ((order as any).orderSource || "").toUpperCase().includes("SCALP")
    );
  }, []);

  const displayedPaperOrders = useMemo(() => {
    if (orderModeFilter === '15MIN_SCALPER') {
      return paperOrders.filter(isScalperOrder);
    }
    if (orderModeFilter === 'FULL_DAY') {
      return paperOrders.filter(o => !isScalperOrder(o));
    }
    return paperOrders;
  }, [paperOrders, orderModeFilter, isScalperOrder]);

  const analyticsSummary = useMemo(() => calculateOrderAnalytics(displayedPaperOrders), [displayedPaperOrders]);

  return (
    <div style={{ padding: "clamp(0.5rem, 2vw, 1.5rem)", color: "#f8fafc", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Bar Header & Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800 }}>Order Management</h1>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            {mode === 'LIVE' ? "LIVE BROKER ORDER EXECUTION" : "PAPER TRADING SIMULATION"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Mode Selector Tabs */}
          <div style={{ display: "flex", background: "#1e293b", padding: "0.25rem", borderRadius: "0.5rem", border: "1px solid #334155" }}>
            <button
              onClick={() => { setMode('PAPER'); setError(null); }}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "0.375rem",
                border: "none",
                background: mode === 'PAPER' ? "#f59e0b" : "transparent",
                color: mode === 'PAPER' ? "#000000" : "#94a3b8",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              ● Paper Orders
            </button>
            <button
              onClick={() => { setMode('LIVE'); setError(null); }}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "0.375rem",
                border: "none",
                background: mode === 'LIVE' ? "#0284c7" : "transparent",
                color: mode === 'LIVE' ? "#ffffff" : "#94a3b8",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              ⚡ Live Broker Orders
            </button>
          </div>

          <button
            onClick={() => setTradeRequest({ symbol: "NIFTY50", side: "BUY", price: 22000 })}
            style={{
              padding: "0.6rem 1.25rem",
              borderRadius: "0.5rem",
              background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: 800,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            + Place New Order
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(74, 222, 128, 0.15)", border: "1px solid #4ade80", borderRadius: "0.5rem", color: "#4ade80", fontSize: "0.85rem" }}>
          ✓ {notification}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div style={{ padding: "0.75rem 1rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "0.5rem", color: "#fca5a5", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠️ {error}</span>
          {mode === 'LIVE' && (
            <button onClick={fetchLiveOrders} style={{ padding: "0.35rem 0.75rem", background: "#ef4444", color: "#ffffff", border: "none", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>
              Retry
            </button>
          )}
        </div>
      )}

      {/* MODE 1: PAPER ORDERS */}
      {mode === 'PAPER' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <TradingExecutionAnalytics orders={displayedPaperOrders} analytics={analyticsSummary} />

          {paperError && (
            <div style={{ padding: "0.75rem 1rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "0.5rem", color: "#fca5a5", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⚠️ {paperError}</span>
              <button onClick={fetchPaperOrders} style={{ padding: "0.35rem 0.75rem", background: "#ef4444", color: "#ffffff", border: "none", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>Retry</button>
            </div>
          )}
          {paperLoading && (
            <div style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontSize: "0.85rem" }}>Loading persisted paper orders…</div>
          )}
          <div style={{ background: "#0f172a", borderRadius: "0.75rem", border: "1px solid #334155", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#fbbf24" }}>
              Paper Order History (Simulated Sandbox)
            </h3>
            <RecentPaperOrders
              orders={paperOrders}
              onAddToJournal={(order) => {
                setJournalModalData({
                  symbol: order.symbol,
                  side: order.side,
                  quantity: order.quantity,
                  entry_price: order.price,
                  paper_trade_id: order.id,
                  notes: `Paper Order #${order.id} executed at ₹${order.price}`,
                });
              }}
            />

          </div>
        </div>
      )}

      {/* MODE 2: LIVE BROKER ORDERS */}
      {mode === 'LIVE' && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Broker Selector Bar */}
          <div style={{ background: "#1e293b", padding: "0.85rem 1rem", borderRadius: "0.5rem", border: "1px solid #334155", display: "flex", alignItems: "center", gap: "1rem" }}>
            <label style={{ fontSize: "0.85rem", color: "#94a3b8" }}>Selected Broker Account:</label>
            <input
              type="text"
              value={brokerId}
              onChange={(e) => setBrokerId(e.target.value)}
              placeholder="Enter Broker UUID"
              style={{
                flex: 1,
                maxWidth: "360px",
                padding: "0.5rem 0.75rem",
                background: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "0.375rem",
                color: "#ffffff",
                fontSize: "0.85rem",
                fontFamily: "monospace",
              }}
            />
            <button
              onClick={fetchLiveOrders}
              disabled={loading}
              style={{
                padding: "0.5rem 1rem",
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                fontWeight: 700,
                fontSize: "0.8rem",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Refreshing..." : "Refresh Live Orders"}
            </button>
            <button
              onClick={reconcileLiveOrders}
              disabled={loading}
              style={{
                padding: "0.5rem 1rem", background: "#334155", color: "#e2e8f0",
                border: "1px solid #475569", borderRadius: "0.375rem", fontWeight: 700,
                fontSize: "0.8rem", cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              Reconcile Lifecycle
            </button>
          </div>

          {/* Live Broker Orders Table */}
          {paperError && (
            <div style={{ padding: "0.75rem 1rem", background: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", borderRadius: "0.5rem", color: "#fca5a5", fontSize: "0.85rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>⚠️ {paperError}</span>
              <button onClick={fetchPaperOrders} style={{ padding: "0.35rem 0.75rem", background: "#ef4444", color: "#ffffff", border: "none", borderRadius: "0.25rem", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" }}>Retry</button>
            </div>
          )}
          {paperLoading && (
            <div style={{ padding: "0.75rem 1rem", color: "#94a3b8", fontSize: "0.85rem" }}>Loading persisted paper orders…</div>
          )}
          <div style={{ background: "#0f172a", borderRadius: "0.75rem", border: "1px solid #334155", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#38bdf8" }}>
              Live Broker Orders (`GET /broker-orders/{brokerId}`)
            </h3>

            {loading ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#38bdf8" }}>Loading live orders from broker...</div>
            ) : liveOrders.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>No live broker orders found for this account.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Order ID</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Symbol</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Side</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Quantity</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Filled</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Status</th>
                      <th style={{ padding: "0.6rem 0.75rem" }}>Last Sync</th>
                      <th style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveOrders.map((o) => (
                      <tr key={o.order_id} style={{ borderBottom: "1px solid #1e293b" }}>
                        <td style={{ padding: "0.65rem 0.75rem", fontFamily: "monospace", color: "#cbd5e1" }}>{o.order_id}</td>
                        <td style={{ padding: "0.65rem 0.75rem", fontWeight: 700, color: "#38bdf8" }}>{o.symbol}</td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.2rem 0.5rem",
                            borderRadius: "0.25rem",
                            color: o.side.toLowerCase() === 'buy' ? '#4ade80' : '#fca5a5',
                            background: o.side.toLowerCase() === 'buy' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            textTransform: 'uppercase',
                          }}>
                            {o.side}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", fontFamily: "monospace" }}>{o.quantity}</td>
                        <td style={{ padding: "0.65rem 0.75rem", fontFamily: "monospace" }}>{o.filled_quantity}</td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1" }}>
                            {o.status}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{new Date(o.last_broker_sync_at).toLocaleString()}</td>
                        <td style={{ padding: "0.65rem 0.75rem", textAlign: "right", display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => {
                              setJournalModalData({
                                symbol: o.symbol,
                                side: o.side,
                                quantity: Number(o.quantity),
                                entry_price: 0,
                                broker_order_id: o.order_id,
                                notes: `Live Broker Order #${o.order_id}`,
                              });
                            }}

                            style={{
                              padding: "0.35rem 0.75rem",
                              borderRadius: "0.25rem",
                              background: "rgba(56, 189, 248, 0.15)",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              color: "#38bdf8",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            + Journal
                          </button>
                          <button
                            onClick={() => setCancelLiveOrder(o)}
                            style={{
                              padding: "0.35rem 0.75rem",
                              borderRadius: "0.25rem",
                              background: "rgba(239, 68, 68, 0.15)",
                              border: "1px solid #ef4444",
                              color: "#fca5a5",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Cancel Order
                          </button>
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Live Order Confirmation Modal */}
      {cancelLiveOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1050, background: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#0f172a", border: "1px solid #ef4444", borderRadius: "0.75rem", padding: "1.5rem", maxWidth: "420px", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3 style={{ margin: 0, color: "#fca5a5", fontSize: "1.1rem" }}>Cancel Live Broker Order</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#cbd5e1" }}>
              Are you sure you want to cancel live order <strong>{cancelLiveOrder.order_id}</strong> for <strong>{cancelLiveOrder.symbol}</strong> ({cancelLiveOrder.quantity} shares)?
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setCancelLiveOrder(null)} disabled={cancelLoading} style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: "0.375rem", cursor: "pointer" }}>Keep Order</button>
              <button onClick={executeCancelLiveOrder} disabled={cancelLoading} style={{ padding: "0.5rem 1rem", background: "#ef4444", border: "none", color: "#ffffff", borderRadius: "0.375rem", fontWeight: 700, cursor: cancelLoading ? "not-allowed" : "pointer" }}>
                {cancelLoading ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OrderForm Modal */}
      {tradeRequest && (
        <OrderForm
          initialSymbol={tradeRequest.symbol}
          initialSide={tradeRequest.side}
          initialPrice={tradeRequest.price}
          selectedBrokerId={brokerId}
          selectedBrokerName="Zerodha Pro"
          hasActiveSession={true}
          onClose={() => setTradeRequest(null)}
          onPaperOrderCreated={(newOrder) => {
            setPaperOrders((prev) => [newOrder, ...prev.filter((order) => order.id !== newOrder.id)]);
            setNotification("Paper order persisted and executed successfully.");
            setTimeout(() => setNotification(null), 3000);
          }}
          onLiveOrderCreated={(liveOrder) => {
            setNotification(`Live order ${liveOrder.order_id} submitted to broker successfully!`);
            setTimeout(() => setNotification(null), 3500);
            fetchLiveOrders();
          }}
        />
      )}

      {/* JournalEntryModal */}
      {journalModalData && (
        <JournalEntryModal
          initialData={journalModalData}
          onClose={() => setJournalModalData(null)}
          onSuccess={(entry) => {
            setNotification(`Journal entry created successfully for ${entry.symbol}!`);
            setTimeout(() => setNotification(null), 3000);
          }}
        />
      )}
    </div>
  );
};

export default OrdersPage;

