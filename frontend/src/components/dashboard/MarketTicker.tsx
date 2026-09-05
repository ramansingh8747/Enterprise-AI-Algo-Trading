import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { marketApi } from "@/services/api/marketApi";
import { MarketIndex } from "@/types/market";
import { initialIndices } from "@/data/marketData";
import { getMarketSessionStatus } from "@/utils/marketTiming";

export default function MarketTicker() {
  const navigate = useNavigate();
  const [indices, setIndices] = useState<MarketIndex[]>(initialIndices);

  useEffect(() => {
    let isMounted = true;
    const fetchLiveIndices = async () => {
      try {
        const data = await marketApi.getLiveIndices();
        if (isMounted && data && Array.isArray(data) && data.length > 0) {
          setIndices(data);
        }
      } catch (err) {
        console.warn("Live ticker fetch note:", err);
      }
    };
    fetchLiveIndices();
    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        fetchLiveIndices();
      }
    }, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12,
        marginBottom: 16,
      }}
    >
      {indices.map((item) => {
        const positive = item.changePercent >= 0;

        return (
          <div
            key={item.symbol}
            role="button"
            tabIndex={0}
            onClick={() => navigate(ROUTES.WATCHLIST)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(ROUTES.WATCHLIST);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 18px",
              borderRadius: 12,
              border: "1px solid rgba(148, 163, 184, 0.12)",
              background: "linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.45) 100%)",
              backdropFilter: "blur(8px)",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
              cursor: "pointer",
              transition: "transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease",
            }}
          >
            <div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: ".06em",
                  textTransform: "uppercase",
                }}
              >
                {item.name}
              </div>

              <div
                style={{
                  marginTop: 4,
                  color: "#f8fafc",
                  fontSize: 18,
                  fontWeight: 900,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                ₹{item.value.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                borderRadius: 6,
                background: positive ? "rgba(34, 197, 94, 0.16)" : "rgba(239, 68, 68, 0.16)",
                border: `1px solid ${positive ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                color: positive ? "#4ade80" : "#f87171",
                fontSize: 12,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span>{positive ? "▲" : "▼"}</span>
              <span>{positive ? "+" : ""}{item.changePercent.toFixed(2)}%</span>
            </div>
          </div>
        );
      })}
    </section>
  );
}
