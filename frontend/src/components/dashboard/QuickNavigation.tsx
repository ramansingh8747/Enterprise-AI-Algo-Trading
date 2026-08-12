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
        gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
        gap: 10,
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
            padding: 14,
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,.14)",
            background: "rgba(15,23,42,.7)",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              color: item.color,
              fontWeight: 850,
              fontSize: 13,
            }}
          >
            {item.label}
          </div>

          <div
            style={{
              marginTop: 5,
              color: "#64748b",
              fontSize: 11,
            }}
          >
            {item.description}
          </div>
        </button>
      ))}
    </section>
  );
}
