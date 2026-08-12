import React, { useState } from "react";

import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useWebSocketSubscription } from "@/hooks/useWebSocketSubscription";
import { WebSocketEvent } from "@/types/websocket";

interface MarketTickerItem {
  symbol: string;
  value: number;
  changePercent: number;
}

const initialMarketData: Record<string, MarketTickerItem> = {
  "NIFTY 50": { symbol: "NIFTY 50", value: 24750.35, changePercent: 0.82 },
  "BANK NIFTY": { symbol: "BANK NIFTY", value: 54820.45, changePercent: 0.64 },
  "SENSEX": { symbol: "SENSEX", value: 81240.18, changePercent: -0.21 },
};

export default function MarketTicker() {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState<Record<string, MarketTickerItem>>(initialMarketData);

  // Subscribe to symbols
  Object.keys(initialMarketData).forEach((symbol) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useWebSocketSubscription(`market:${symbol}`, (event: WebSocketEvent) => {
      if (event.event_type === "quote.updated") {
        const payload = event.payload as { price: number; changePercent: number };
        setMarketData((prev) => ({
          ...prev,
          [symbol]: {
            ...prev[symbol],
            value: payload.price,
            changePercent: payload.changePercent,
          },
        }));
      }
    });
  });

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(190px,1fr))",
        gap: 10,
        marginBottom: 18,
      }}
    >
      {Object.values(marketData).map((item) => {
        const positive = item.changePercent > 0;
        const negative = item.changePercent < 0;

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
              padding: "12px 15px",
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,.14)",
              background: "linear-gradient(135deg,rgba(15,23,42,.92),rgba(15,23,42,.65))",
              cursor: "pointer",
            }}
          >
            <div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: ".06em",
                }}
              >
                {item.symbol}
              </div>

              <div
                style={{
                  marginTop: 4,
                  color: "#f8fafc",
                  fontSize: 17,
                  fontWeight: 850,
                }}
              >
                {item.value.toLocaleString("en-IN", {
                  maximumFractionDigits: 2,
                })}
              </div>
            </div>

            <div
              style={{
                color: positive
                  ? "#4ade80"
                  : negative
                    ? "#f87171"
                    : "#94a3b8",
                fontWeight: 850,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {positive ? "+" : ""}
              {item.changePercent.toFixed(2)}%
            </div>
          </div>
        );
      })}
    </section>
  );
}
