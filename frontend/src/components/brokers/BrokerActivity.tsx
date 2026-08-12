import React from "react";
import { BrokerType } from "@/types/brokerConnection";

interface ActivityItem {
  id: string;
  timestamp: string;
  event: string;
  broker: BrokerType;
  type: "success" | "info" | "warning";
}

interface BrokerActivityProps {
  brokerType?: BrokerType;
}

export const BrokerActivity: React.FC<BrokerActivityProps> = ({ brokerType }) => {
  const activities: ActivityItem[] = [
    {
      id: "act-1",
      timestamp: "Today, 4:32 PM",
      event: "Demo Session Active & Initialized",
      broker: brokerType || "zerodha",
      type: "success",
    },
    {
      id: "act-2",
      timestamp: "Today, 4:30 PM",
      event: "Broker holdings & quotes synchronized",
      broker: brokerType || "zerodha",
      type: "info",
    },
    {
      id: "act-3",
      timestamp: "Today, 4:28 PM",
      event: "Account profile & margin loaded",
      broker: brokerType || "zerodha",
      type: "info",
    },
    {
      id: "act-4",
      timestamp: "Yesterday",
      event: "Previous session unlinked gracefully",
      broker: brokerType || "zerodha",
      type: "warning",
    },
  ];

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
        <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#818cf8" }}>
          Connection Activity Timeline
        </h3>
        <span style={{ fontSize: "0.7rem", color: "#facc15", background: "rgba(250, 204, 21, 0.15)", padding: "0.15rem 0.5rem", borderRadius: "0.25rem", fontWeight: 700 }}>
          DEMO ACTIVITY
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {activities.map((item) => (
          <div key={item.id} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
            <span style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              marginTop: "0.35rem",
              background: item.type === "success" ? "#4ade80" : item.type === "info" ? "#38bdf8" : "#facc15",
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f1f5f9" }}>{item.event}</span>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{item.timestamp}</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                Target: {item.broker.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BrokerActivity;
