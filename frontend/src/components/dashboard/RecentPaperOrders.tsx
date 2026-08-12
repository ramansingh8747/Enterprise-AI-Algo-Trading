import React, { useState } from "react";

export interface PaperOrder {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  orderType: "MARKET" | "LIMIT";
  quantity: number;
  price: number;
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "PAPER_EXECUTED";
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
                  border: "1px solid rgba(248, 113, 113, 0.35)",
                  color: "#fca5a5",
                  fontWeight: 800,
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.125rem", color: "#38bdf8", fontWeight: 700 }}>
            Recent Paper Orders ({orders.length})
          </h2>
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>
            Local paper trading activity & status
          </p>
        </div>

        <span style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          color: "#facc15",
          background: "rgba(250, 204, 21, 0.15)",
          border: "1px solid rgba(250, 204, 21, 0.3)",
          padding: "0.25rem 0.65rem",
          borderRadius: "1rem",
        }}>
          PAPER MODE
        </span>
      </div>

      {orders.length === 0 ? (
        <div style={{
          borderRadius: "0.5rem",
          border: "1px dashed #334155",
          padding: "2.5rem 1rem",
          textAlign: "center",
          color: "#64748b",
        }}>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8", fontWeight: 600 }}>
            No paper orders recorded yet.
          </p>
          <p style={{ margin: "0.35rem 0 0 0", fontSize: "0.75rem", color: "#64748b" }}>
            Place a BUY or SELL paper order from Watchlist or Quick Actions to track it here.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #334155", color: "#94a3b8" }}>
                <th style={{ padding: "0.75rem" }}>Symbol</th>
                <th style={{ padding: "0.75rem" }}>Side</th>
                <th style={{ padding: "0.75rem" }}>Quantity</th>
                <th style={{ padding: "0.75rem" }}>Price</th>
                <th style={{ padding: "0.75rem" }}>Est. Value</th>
                <th style={{ padding: "0.75rem" }}>Status</th>
                <th style={{ padding: "0.75rem" }}>Time</th>
                <th style={{ padding: "0.75rem" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => {
                const isBuy = order.side === "BUY";
                const isExecuted = order.status === "EXECUTED" || order.status === "PAPER_EXECUTED";
                const isCancelled = order.status === "CANCELLED";
                const estVal = order.quantity * order.price;

                const statusBg = isExecuted ? "rgba(74, 222, 128, 0.15)" : isCancelled ? "rgba(248, 113, 113, 0.15)" : "rgba(250, 204, 21, 0.15)";
                const statusColor = isExecuted ? "#4ade80" : isCancelled ? "#f87171" : "#facc15";

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
