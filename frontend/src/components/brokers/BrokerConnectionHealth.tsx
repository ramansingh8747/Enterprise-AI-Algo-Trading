import React from "react";
import { BrokerConnection } from "@/types/brokerConnection";

interface BrokerConnectionHealthProps {
  connection: BrokerConnection;
}

export const BrokerConnectionHealth: React.FC<BrokerConnectionHealthProps> = ({ connection }) => {
  const isConnected = connection.status === "connected";

  return (
    <div style={{
      background: "#1e293b",
      borderRadius: "0.75rem",
      border: "1px solid #334155",
      padding: "1.25rem",
      color: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      gap: "1rem",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#38bdf8" }}>
          Connection Health — {connection.brokerName}
        </h3>
        <span style={{
          fontSize: "0.75rem",
          fontWeight: 700,
          padding: "0.2rem 0.6rem",
          borderRadius: "1rem",
          color: isConnected ? "#4ade80" : "#fca5a5",
          background: isConnected ? "rgba(74, 222, 128, 0.15)" : "rgba(239, 68, 68, 0.15)",
          border: isConnected ? "1px solid rgba(74, 222, 128, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
        }}>
          {isConnected ? "● Healthy" : "● Disconnected"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
        <div style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #1e293b" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>API Status</span>
          <strong style={{ fontSize: "0.9rem", color: isConnected ? "#4ade80" : "#94a3b8" }}>
            {isConnected ? (connection.isDemo ? "Demo API" : "Connected") : "Inactive"}
          </strong>
        </div>

        <div style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #1e293b" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Session Status</span>
          <strong style={{ fontSize: "0.9rem", color: isConnected ? "#38bdf8" : "#94a3b8" }}>
            {isConnected ? (connection.isDemo ? "Demo Session Active" : "Active Session") : "Ended"}
          </strong>
        </div>

        <div style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #1e293b" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>Last Sync</span>
          <strong style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>
            {isConnected ? "Just now" : "N/A"}
          </strong>
        </div>

        <div style={{ background: "#0f172a", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid #1e293b" }}>
          <span style={{ fontSize: "0.75rem", color: '#64748b', display: "block" }}>Response</span>
          <strong style={{ fontSize: "0.9rem", color: isConnected ? "#facc15" : "#94a3b8" }}>
            {isConnected ? "Simulated (Paper)" : "Offline"}
          </strong>
        </div>
      </div>
    </div>
  );
};

export default BrokerConnectionHealth;
