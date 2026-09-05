import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";

interface QuickNavigationProps {
  onNavigate?: () => void;
}

export default function QuickNavigation({
  onNavigate,
}: QuickNavigationProps) {
  const navigate = useNavigate();

  const items = [
    {
      label: "Markets",
      description: "Watchlist & market data",
      path: ROUTES.WATCHLIST,
      color: "#38bdf8",
    },
    {
      label: "Strategy",
      description: "Signals & setups",
      path: ROUTES.STRATEGY,
      color: "#a78bfa",
    },
    {
      label: "Portfolio",
      description: "Holdings & risk",
      path: ROUTES.PORTFOLIO,
      color: "#4ade80",
    },
    {
      label: "Orders",
      description: "Paper & broker orders",
      path: ROUTES.ORDERS,
      color: "#f59e0b",
    },
    {
      label: "Journal",
      description: "Trading history",
      path: ROUTES.JOURNAL,
      color: "#f472b6",
    },
    {
      label: "Brokers",
      description: "Broker connections",
      path: ROUTES.BROKERS,
      color: "#22d3ee",
    },
  ];

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 12,
      }}
    >
      {items.map((item) => (
        <button
          key={item.path}
          type="button"
          onClick={() => {
            navigate(item.path);
            onNavigate?.();
          }}
          style={{
            textAlign: "left",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid rgba(148, 163, 184, 0.12)",
            background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            cursor: "pointer",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.18s ease",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "3px",
              background: item.color,
            }}
          />

          <div
            style={{
              color: item.color,
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: "-0.01em",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>{item.label}</span>
            <span style={{ fontSize: 12, opacity: 0.6 }}>→</span>
          </div>

          <div
            style={{
              marginTop: 4,
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            {item.description}
          </div>
        </button>
      ))}
    </section>
  );
}
