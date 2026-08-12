import React from 'react';
import { TradingSignal } from '@/types/signal';

interface SignalSummaryProps {
  signals: TradingSignal[];
}

export const SignalSummary: React.FC<SignalSummaryProps> = ({ signals }) => {
  const buySignals = signals.filter(s => s.action === "BUY").length;
  const sellSignals = signals.filter(s => s.action === "SELL").length;
  const holdSignals = signals.filter(s => s.action === "HOLD").length;

  const bullish = signals.filter(s => s.trend === "BULLISH").length;
  const bearish = signals.filter(s => s.trend === "BEARISH").length;
  const neutral = signals.filter(s => s.trend === "NEUTRAL").length;

  const cards = [
    { label: "BUY", value: buySignals, color: "#4ade80" },
    { label: "SELL", value: sellSignals, color: "#f87171" },
    { label: "HOLD", value: holdSignals, color: "#fbbf24" },
    { label: "Bullish", value: bullish, color: "#4ade80" },
    { label: "Bearish", value: bearish, color: "#f87171" },
    { label: "Neutral", value: neutral, color: "#38bdf8" },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
      gap: "0.85rem",
    }}>
      {cards.map((card, i) => (
        <div
          key={i}
          style={{
            background: "linear-gradient(135deg, #0f1a2b 0%, #111c2f 100%)",
            borderRadius: "0.75rem",
            border: "1px solid rgba(148, 163, 184, 0.14)",
            padding: "1rem",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "90px",
          }}
        >
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>
            {card.label}
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 900, color: card.color }}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
};
