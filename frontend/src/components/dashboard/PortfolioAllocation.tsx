import React, { useMemo } from "react";

export interface AllocationItem {
  symbol: string;
  value: number;
  percentage: number;
}

interface PortfolioAllocationProps {
  items: AllocationItem[];
}

const colors = [
  "#22c55e",
  "#38bdf8",
  "#a78bfa",
  "#f59e0b",
  "#f43f5e",
  "#14b8a6",
];

export default function PortfolioAllocation({
  items,
}: PortfolioAllocationProps) {
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.value, 0),
    [items],
  );

  if (!items.length || total <= 0) {
    return (
      <div
        style={{
          padding: 20,
          borderRadius: 14,
          border: "1px solid rgba(148,163,184,.15)",
          background: "rgba(15,23,42,.65)",
          color: "#94a3b8",
        }}
      >
        <div style={{ fontWeight: 800, color: "#e2e8f0" }}>
          Portfolio Allocation
        </div>

        <div style={{ marginTop: 10, fontSize: 13 }}>
          No portfolio allocation available.
        </div>
      </div>
    );
  }

  return (
    <section
      style={{
        padding: 20,
        borderRadius: 14,
        border: "1px solid rgba(148,163,184,.15)",
        background: "rgba(15,23,42,.65)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#f8fafc",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            Portfolio Allocation
          </div>

          <div
            style={{
              marginTop: 4,
              color: "#64748b",
              fontSize: 12,
            }}
          >
            Current portfolio distribution
          </div>
        </div>

        <div
          style={{
            color: "#94a3b8",
            fontSize: 12,
          }}
        >
          Total Value ₹{total.toLocaleString("en-IN")}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          height: 16,
          marginTop: 22,
          borderRadius: 999,
          overflow: "hidden",
          background: "#1e293b",
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.symbol}
            title={`${item.symbol} ${item.percentage.toFixed(1)}%`}
            style={{
              width: `${item.percentage}%`,
              background: colors[index % colors.length],
              minWidth: item.percentage > 0 ? 3 : 0,
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          gap: 10,
          marginTop: 18,
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.symbol}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(30,41,59,.55)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: colors[index % colors.length],
                  flexShrink: 0,
                }}
              />

              <span
                style={{
                  color: "#e2e8f0",
                  fontWeight: 700,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.symbol}
              </span>
            </div>

            <span
              style={{
                color: "#94a3b8",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
