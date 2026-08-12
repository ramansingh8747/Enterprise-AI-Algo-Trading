import React, { useEffect, useState, useCallback, useMemo } from "react";
import { RecentPaperOrders } from "@/components/dashboard/RecentPaperOrders";
import { TradingExecutionAnalytics } from "@/components/dashboard/TradingExecutionAnalytics";
import { OrderForm, OrderSide, PaperOrder } from "@/components/dashboard/OrderForm";
import { brokerOrdersApi } from "@/services/api/brokerOrdersApi";
import { BrokerOrderResponse } from "@/types/brokerOrder";
import { calculateOrderAnalytics } from "@/services/paperTrading/orderAnalyticsService";
import { JournalEntryModal, JournalEntryModalProps } from "@/components/dashboard/JournalEntryModal";



const PAPER_ORDERS_KEY = "algo_trading_paper_orders";

export const OrdersPage: React.FC = () => {
  const [mode, setMode] = useState<'PAPER' | 'LIVE'>('PAPER');
  const [brokerId, setBrokerId] = useState<string>("c2ce3afe-4468-49fc-9278-880111831207");
  const [liveOrders, setLiveOrders] = useState<BrokerOrderResponse[]>([]);

  const [paperOrders, setPaperOrders] = useState<PaperOrder[]>(() => {
    try {
      const stored = localStorage.getItem(PAPER_ORDERS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to load paper orders:", e);
      return [];
    }
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Cancel Modal state
  const [cancelPaperOrderId, setCancelPaperOrderId] = useState<string | null>(null);
  const [cancelLiveOrder, setCancelLiveOrder] = useState<BrokerOrderResponse | null>(null);

  // OrderForm state
  const [tradeRequest, setTradeRequest] = useState<{
    symbol: string;
    side: OrderSide;
    price: number;
  } | null>(null);

  // Journal Entry Modal state
  const [journalModalData, setJournalModalData] = useState<JournalEntryModalProps['initialData'] | null>(null);


  // Persist paperOrders changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(PAPER_ORDERS_KEY, JSON.stringify(paperOrders));
    } catch (_err) {
      // Ignored localStorage access error
    }
  }, [paperOrders]);

  const fetchLiveOrders = useCallback(async () => {
    if (!brokerId.trim() || mode !== 'LIVE') return;
    setLoading(true);
    setError(null);
    try {
      const data = await brokerOrdersApi.getOrders(brokerId);
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
      setLoading(false);
    }
  }, [brokerId, mode]);

  useEffect(() => {
    if (mode === 'LIVE') {
      fetchLiveOrders();
    }
  }, [mode, fetchLiveOrders]);

  const handleCancelPaperOrder = (orderId: string) => {
    setCancelPaperOrderId(orderId);
  };

  const executeCancelPaperOrder = () => {
    if (!cancelPaperOrderId) return;
    setPaperOrders((current) =>
      current.map((order) =>
        order.id === cancelPaperOrderId
          ? {
              ...order,
              status: "CANCELLED",
            }
          : order
      )
    );
    setCancelPaperOrderId(null);
    setNotification("Paper order cancelled successfully.");
    setTimeout(() => setNotification(null), 3000);
  };

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

  const analyticsSummary = useMemo(() => calculateOrderAnalytics(paperOrders), [paperOrders]);

  return (
    <div style={{ padding: "1.5rem", color: "#f8fafc", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Top Bar Header & Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800 }}>Order Management</h1>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
            {mode === 'LIVE' ? "LIVE BROKER ORDER EXECUTION" : "PAPER TRADING SIMULATION"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
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
          <TradingExecutionAnalytics orders={paperOrders} analytics={analyticsSummary} />

          <div style={{ background: "#0f172a", borderRadius: "0.75rem", border: "1px solid #334155", padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem", color: "#fbbf24" }}>
              Paper Order History (Simulated Sandbox)
            </h3>
            <RecentPaperOrders
              orders={paperOrders}
              onCancel={handleCancelPaperOrder}
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
          </div>

          {/* Live Broker Orders Table */}
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
                      <th style={{ padding: "0.6rem 0.75rem" }}>Status</th>
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
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#cbd5e1" }}>
                            {o.status}
                          </span>
                        </td>
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

      {/* Cancel Paper Order Modal */}
      {cancelPaperOrderId && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1050, background: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: "0.75rem", padding: "1.5rem", maxWidth: "400px", width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3 style={{ margin: 0, color: "#f8fafc", fontSize: "1.1rem" }}>Cancel Paper Order</h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#94a3b8" }}>Are you sure you want to cancel paper order {cancelPaperOrderId}?</p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setCancelPaperOrderId(null)} style={{ padding: "0.5rem 1rem", background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", borderRadius: "0.375rem", cursor: "pointer" }}>No, Keep</button>
              <button onClick={executeCancelPaperOrder} style={{ padding: "0.5rem 1rem", background: "#ef4444", border: "none", color: "#ffffff", borderRadius: "0.375rem", fontWeight: 700, cursor: "pointer" }}>Yes, Cancel</button>
            </div>
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
            setPaperOrders((prev) => [newOrder, ...prev]);
            setNotification("Paper order created successfully.");
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

