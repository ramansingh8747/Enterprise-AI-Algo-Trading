import React, { useState } from "react";

export interface PaperOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity: number;
  price: number;
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "PAPER_EXECUTED";
  orderSource?: string;
  stopLoss?: number;
  target?: number;
  timestamp: string;
  mode: "PAPER";
  createdAt?: string;
  productType?: string;
}

interface RecentPaperOrdersProps {
  orders: PaperOrder[];
  onCancel?: (orderId: string) => void;
  onAddToJournal?: (order: PaperOrder) => void;
}

export const RecentPaperOrders: React.FC<RecentPaperOrdersProps> = ({
  orders,
  onCancel,
  onAddToJournal,
}) => {
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const [modeFilter, setModeFilter] = useState<'ALL' | '15MIN_SCALPER' | 'FULL_DAY'>(() => {
    try {
      const saved = localStorage.getItem('active_session_mode');
      if (saved === '15MIN_SCALPER') return '15MIN_SCALPER';
      if (saved === 'FULL_DAY') return 'FULL_DAY';
    } catch {}
    return 'ALL';
  });

  const isScalperOrder = (order: PaperOrder) => {
    const sym = (order.symbol || "").toUpperCase();
    return (
      sym.includes("NIFTY") ||
      sym.includes("BANKNIFTY") ||
      (order.orderSource || "").toUpperCase().includes("SCALP")
    );
  };

  const filteredOrders = orders.filter((order) => {
    if (modeFilter === "15MIN_SCALPER") {
      return isScalperOrder(order);
    }
    if (modeFilter === "FULL_DAY") {
      return !isScalperOrder(order);
    }
    return true;
  });

  const handleConfirm = () => {
    if (confirmCancelId && onCancel) {
      onCancel(confirmCancelId);
    }
    setConfirmCancelId(null);
  };

  return (
    <section style={{
      background: "#111c2d",
      borderRadius: "0.85rem",
      border: "1px solid rgba(148, 163, 184, 0.16)",
      padding: "1.25rem",
      color: "#f8fafc",
      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    }}>
      {/* Confirmation Modal */}
      {confirmCancelId && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2, 6, 23, 0.75)",
          backdropFilter: "blur(4px)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}>
          <div style={{
            background: "#111c2d",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "0.85rem",
            padding: "1.5rem",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: "0.5rem" }}>⚠️</span>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#f8fafc" }}>
              Cancel Paper Order?
            </h3>
            <p style={{ margin: "0.5rem 0 1.25rem 0", fontSize: "0.85rem", color: "#94a3b8" }}>
              Are you sure you want to cancel this simulated paper trading order?
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setConfirmCancelId(null)}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.375rem",
                  background: "#1e293b",
                  border: "1px solid #334155",
                  color: "#cbd5e1",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  padding: "0.55rem 1.1rem",
                  borderRadius: "0.375rem",
                  background: "rgba(239, 68, 68, 0.25)",
                  border: "1px solid #ef4444",
                  color: "#fca5a5",
                  fontWeight: 700,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Mode Filter Tabs */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1rem",
        borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
        paddingBottom: "0.75rem",
        flexWrap: "wrap",
        gap: "0.75rem",
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#f8fafc" }}>
            Recent Paper Orders
          </h2>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
            {modeFilter === '15MIN_SCALPER'
              ? '⚡ Showing 15-20 Min Fast Scalper Mode Orders (NIFTY / BANKNIFTY)'
              : modeFilter === 'FULL_DAY'
              ? '🌐 Showing Full-Day Multi-Regime Orders (Stock Universe)'
              : 'All active and completed paper trading orders'}
          </p>
        </div>

        {/* Mode Filter Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setModeFilter('15MIN_SCALPER')}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "0.45rem",
              fontSize: "0.72rem",
              fontWeight: 800,
              cursor: "pointer",
              border: modeFilter === '15MIN_SCALPER' ? "1px solid #ec4899" : "1px solid rgba(148, 163, 184, 0.2)",
              background: modeFilter === '15MIN_SCALPER' ? "rgba(236, 72, 153, 0.25)" : "rgba(30, 41, 59, 0.5)",
              color: modeFilter === '15MIN_SCALPER' ? "#f472b6" : "#94a3b8",
              boxShadow: modeFilter === '15MIN_SCALPER' ? "0 0 12px rgba(236, 72, 153, 0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            ⚡ 15-Min Scalper ({orders.filter(isScalperOrder).length})
          </button>

          <button
            type="button"
            onClick={() => setModeFilter('FULL_DAY')}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "0.45rem",
              fontSize: "0.72rem",
              fontWeight: 800,
              cursor: "pointer",
              border: modeFilter === 'FULL_DAY' ? "1px solid #10b981" : "1px solid rgba(148, 163, 184, 0.2)",
              background: modeFilter === 'FULL_DAY' ? "rgba(16, 185, 129, 0.25)" : "rgba(30, 41, 59, 0.5)",
              color: modeFilter === 'FULL_DAY' ? "#4ade80" : "#94a3b8",
              boxShadow: modeFilter === 'FULL_DAY' ? "0 0 12px rgba(16, 185, 129, 0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            🌐 Full-Day Mode ({orders.filter(o => !isScalperOrder(o)).length})
          </button>

          <button
            type="button"
            onClick={() => setModeFilter('ALL')}
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "0.45rem",
              fontSize: "0.72rem",
              fontWeight: 800,
              cursor: "pointer",
              border: modeFilter === 'ALL' ? "1px solid #38bdf8" : "1px solid rgba(148, 163, 184, 0.2)",
              background: modeFilter === 'ALL' ? "rgba(56, 189, 248, 0.25)" : "rgba(30, 41, 59, 0.5)",
              color: modeFilter === 'ALL' ? "#38bdf8" : "#94a3b8",
              boxShadow: modeFilter === 'ALL' ? "0 0 12px rgba(56, 189, 248, 0.3)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            📊 All ({orders.length})
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div style={{
          borderRadius: "0.5rem",
          border: "1px dashed #334155",
          padding: "2.5rem 1rem",
          textAlign: "center",
          color: "#64748b",
        }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8", fontWeight: 600 }}>
            {modeFilter === '15MIN_SCALPER'
              ? 'No 15-Min Scalper orders recorded yet for this session.'
              : modeFilter === 'FULL_DAY'
              ? 'No Full-Day Multi-Regime orders recorded yet for this session.'
              : 'No paper orders recorded yet.'}
          </p>
          <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.75rem", color: "#64748b" }}>
            {modeFilter === '15MIN_SCALPER'
              ? 'When 15-Minute Scalper triggers on NIFTY/BANKNIFTY VWAP surge, orders will appear here.'
              : 'When Full-Day Multi-Regime strategies trigger across the stock universe, orders will appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "0.75rem" }}>Symbol</th>
                <th style={{ padding: "0.75rem" }}>Side</th>
                <th style={{ padding: "0.75rem" }}>Source</th>
                <th style={{ padding: "0.75rem" }}>Quantity</th>
                <th style={{ padding: "0.75rem" }}>Price</th>
                <th style={{ padding: "0.75rem" }}>Est. Value</th>
                <th style={{ padding: "0.75rem" }}>Status</th>
                <th style={{ padding: "0.75rem" }}>Time</th>
                <th style={{ padding: "0.75rem" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filteredOrders.map((order) => {
                const isBuy = order.side === "BUY";
                const isExecuted = order.status === "EXECUTED" || order.status === "PAPER_EXECUTED";
                const isCancelled = order.status === "CANCELLED";
                const estVal = order.quantity * order.price;

                const statusBg = isExecuted ? "rgba(74, 222, 128, 0.15)" : isCancelled ? "rgba(248, 113, 113, 0.15)" : "rgba(250, 204, 21, 0.15)";
                const statusColor = isExecuted ? "#4ade80" : isCancelled ? "#f87171" : "#facc15";

                const isAutoSL = order.orderSource === "AUTO_STOP_LOSS";
                const isAutoPilot = order.orderSource === "AUTO_PILOT" || order.orderSource === "AUTONOMOUS_STRATEGY" || order.orderSource === "STRATEGY" || !order.orderSource;
                const isManualBuy = order.orderSource === "MANUAL_BUY";
                const isManualSell = order.orderSource === "MANUAL_SELL";

                return (
                  <tr key={order.id} style={{ borderBottom: "1px solid #0f172a" }}>
                    <td style={{ padding: "0.75rem", fontWeight: 700, color: "#f8fafc" }}>
                      {order.symbol}
                    </td>

                    <td style={{ padding: "0.75rem" }}>
                      <span style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        backgroundColor: isBuy ? "rgba(74, 222, 128, 0.15)" : "rgba(248, 113, 113, 0.15)",
                        color: isBuy ? "#4ade80" : "#f87171",
                      }}>
                        {order.side}
                      </span>
                    </td>

                    <td style={{ padding: "0.75rem" }}>
                      <span style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        backgroundColor: isAutoSL ? "rgba(239, 68, 68, 0.2)" : "rgba(74, 222, 128, 0.18)",
                        color: isAutoSL ? "#f87171" : "#4ade80",
                        border: isAutoSL ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(74, 222, 128, 0.4)",
                      }}>
                        {isAutoSL ? "🛡️ Auto SL" : "⚡ Auto-Pilot"}
                      </span>
                    </td>

                    <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>
                      {order.quantity}
                    </td>

                    <td style={{ padding: "0.75rem", color: "#cbd5e1" }}>
                      ₹{order.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: "0.75rem", color: "#38bdf8", fontWeight: 600 }}>
                      ₹{estVal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td style={{ padding: "0.75rem" }}>
                      <span style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "1rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor: statusBg,
                        color: statusColor,
                      }}>
                        {order.status}
                      </span>
                    </td>

                    <td style={{ padding: "0.75rem", fontSize: "0.75rem", color: "#64748b" }}>
                      {new Date(order.timestamp).toLocaleString()}
                    </td>

                    <td style={{ padding: "0.75rem", display: "flex", gap: "0.4rem", alignItems: "center" }}>
                      {order.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(order.id)}
                          style={{
                            padding: "0.3rem 0.6rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            background: "rgba(239, 68, 68, 0.15)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#fca5a5",
                            cursor: "pointer",
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      {onAddToJournal && (
                        <button
                          type="button"
                          onClick={() => onAddToJournal(order)}
                          style={{
                            padding: "0.3rem 0.6rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            background: "rgba(56, 189, 248, 0.15)",
                            border: "1px solid rgba(56, 189, 248, 0.3)",
                            color: "#38bdf8",
                            cursor: "pointer",
                          }}
                        >
                          + Journal
                        </button>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default RecentPaperOrders;
