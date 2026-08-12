import React from 'react';
import { TradingSignal } from '@/types/signal';

interface SignalCardProps {
  signal: TradingSignal;
  onTrade?: (signal: TradingSignal, side: "BUY" | "SELL") => void;
  onDetails?: (signal: TradingSignal) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({ signal, onTrade, onDetails }) => {
  const getActionStyles = (action: string) => {
    switch (action) {
      case "BUY":
        return { color: "#4ade80", bg: "rgba(34, 197, 94, 0.12)", border: "rgba(34, 197, 94, 0.25)" };
      case "SELL":
        return { color: "#f87171", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.25)" };
      default:
        return { color: "#fbbf24", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.25)" };
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "BULLISH": return "#4ade80";
      case "BEARISH": return "#f87171";
      default: return "#38bdf8";
    }
  };

  const actionStyle = getActionStyles(signal.action);
  const trendColor = getTrendColor(signal.trend);

  return (
    <div style={{
      background: "linear-gradient(180deg, #0f1a2b 0%, #0b1422 100%)",
      borderRadius: "0.85rem",
      border: "1px solid rgba(148, 163, 184, 0.14)",
      padding: "1.25rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.85rem",
      boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
      transition: "all 0.2s ease",
    }}>
      {/* Symbol & Action Badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#f8fafc" }}>
            {signal.symbol}
          </h4>
          <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
            {signal.name || `${signal.symbol} Equity`}
          </span>
        </div>

        <span style={{
          padding: "0.25rem 0.65rem",
          borderRadius: "0.375rem",
          fontSize: "0.75rem",
          fontWeight: 800,
          color: actionStyle.color,
          background: actionStyle.bg,
          border: `1px solid ${actionStyle.border}`,
        }}>
          {signal.action}
        </span>
      </div>

      {/* Current Price */}
      <div style={{ fontSize: "1.65rem", fontWeight: 900, color: "#f8fafc" }}>
        ₹{signal.price.toFixed(2)}
      </div>

      {/* Trend & Strength Bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.35rem" }}>
          <span style={{ color: "#94a3b8" }}>
            Trend: <strong style={{ color: trendColor }}>{signal.trend}</strong>
          </span>
          <span style={{ color: "#94a3b8", fontWeight: 700 }}>
            Strength: {signal.strength}%
          </span>
        </div>

        <div style={{
          height: "6px",
          width: "100%",
          background: "#1e293b",
          borderRadius: "999px",
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            width: `${signal.strength}%`,
            background: "linear-gradient(90deg, #22c55e 0%, #38bdf8 100%)",
            borderRadius: "999px",
          }} />
        </div>
      </div>

      {/* Strategy Badge */}
      <div style={{
        fontSize: "0.75rem",
        color: "#cbd5e1",
        background: "rgba(15, 23, 42, 0.7)",
        padding: "0.4rem 0.6rem",
        borderRadius: "0.375rem",
        border: "1px solid #1e293b",
        fontWeight: 600,
      }}>
        🎯 Strategy: {signal.strategy}
      </div>

      {/* Trade Metrics Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "0.5rem",
        background: "#08111f",
        padding: "0.6rem",
        borderRadius: "0.5rem",
        textAlign: "center",
      }}>
        <div>
          <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>Entry</span>
          <strong style={{ fontSize: "0.85rem", color: "#f8fafc" }}>₹{signal.entryPrice}</strong>
        </div>

        <div>
          <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>Target</span>
          <strong style={{ fontSize: "0.85rem", color: "#4ade80" }}>₹{signal.targetPrice}</strong>
        </div>

        <div>
          <span style={{ fontSize: "0.65rem", color: "#64748b", display: "block" }}>Stop Loss</span>
          <strong style={{ fontSize: "0.85rem", color: "#f87171" }}>₹{signal.stopLoss}</strong>
        </div>
      </div>

      {/* Technical Indicator Chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", background: "#111827", border: "1px solid #1e293b", color: "#94a3b8" }}>
          RSI 68
        </span>
        <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", background: "#111827", border: "1px solid #1e293b", color: "#94a3b8" }}>
          MACD Bullish
        </span>
        <span style={{ fontSize: "0.65rem", padding: "0.15rem 0.4rem", borderRadius: "0.25rem", background: "#111827", border: "1px solid #1e293b", color: "#94a3b8" }}>
          EMA 20 &gt; 50
        </span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
        {signal.action !== "SELL" && (
          <button
            type="button"
            onClick={() => onTrade?.(signal, "BUY")}
            style={{
              flex: 1,
              padding: "0.55rem",
              borderRadius: "0.375rem",
              background: "linear-gradient(135deg, #059669 0%, #16a34a 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: 800,
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            Paper BUY
          </button>
        )}

        {signal.action !== "BUY" && (
          <button
            type="button"
            onClick={() => onTrade?.(signal, "SELL")}
            style={{
              flex: 1,
              padding: "0.55rem",
              borderRadius: "0.375rem",
              background: "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)",
              color: "#ffffff",
              border: "none",
              fontWeight: 800,
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            Paper SELL
          </button>
        )}

        <button
          type="button"
          onClick={() => onDetails?.(signal)}
          style={{
            padding: "0.55rem 0.75rem",
            borderRadius: "0.375rem",
            background: "#111827",
            border: "1px solid rgba(56, 189, 248, 0.25)",
            color: "#38bdf8",
            fontWeight: 800,
            fontSize: "0.8125rem",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          VIEW DETAILS
        </button>
      </div>
    </div>
  );
};
