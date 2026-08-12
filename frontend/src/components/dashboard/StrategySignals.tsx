import React, { useState } from 'react';
import { TradingSignal } from '@/types/signal';
import { SignalCard } from './SignalCard';

interface StrategySignalsProps {
  signals: TradingSignal[];
  onTrade?: (signal: TradingSignal, side: "BUY" | "SELL") => void;
  onDetails?: (signal: TradingSignal) => void;
}

export const StrategySignals: React.FC<StrategySignalsProps> = ({ signals, onTrade, onDetails }) => {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"ALL" | "BUY" | "SELL" | "HOLD">("ALL");
  const [trendFilter, setTrendFilter] = useState<"ALL" | "BULLISH" | "BEARISH" | "NEUTRAL">("ALL");

  const filteredSignals = signals.filter((signal) => {
    const matchesSearch = signal.symbol.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "ALL" || signal.action === actionFilter;
    const matchesTrend = trendFilter === "ALL" || signal.trend === trendFilter;
    return matchesSearch && matchesAction && matchesTrend;
  });

  const topSignal = [...signals].sort((a, b) => b.strength - a.strength)[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Top Signal Featured Card */}
      {topSignal && (
        <div style={{
          background: "linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(15, 23, 42, 0.95) 100%)",
          borderRadius: "1rem",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          padding: "1.5rem",
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "1.1rem" }}>🔥</span>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#38bdf8" }}>
                TOP SIGNAL (Mock Signal)
              </h3>
            </div>
            <span style={{
              fontSize: "0.75rem",
              fontWeight: 800,
              color: "#4ade80",
              background: "rgba(74, 222, 128, 0.15)",
              border: "1px solid rgba(74, 222, 128, 0.3)",
              padding: "0.2rem 0.6rem",
              borderRadius: "1rem",
            }}>
              High Confidence Setup
            </span>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "1rem",
            alignItems: "center",
          }}>
            <div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block" }}>Symbol</span>
              <strong style={{ fontSize: "1.25rem", color: "#f8fafc" }}>{topSignal.symbol}</strong>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block" }}>Action</span>
              <span style={{ fontSize: "1rem", fontWeight: 800, color: topSignal.action === "BUY" ? "#4ade80" : "#f87171" }}>
                {topSignal.action}
              </span>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block" }}>Strength</span>
              <strong style={{ fontSize: "1.1rem", color: "#38bdf8" }}>{topSignal.strength}%</strong>
            </div>

            <div>
              <span style={{ fontSize: "0.75rem", color: "#94a3b8", display: "block" }}>Strategy</span>
              <span style={{ fontSize: "0.85rem", color: "#cbd5e1" }}>{topSignal.strategy}</span>
            </div>

            <div>
              <button
                type="button"
                onClick={() => onTrade?.(topSignal, "BUY")}
                style={{
                  width: "100%",
                  padding: "0.65rem 1.25rem",
                  borderRadius: "0.5rem",
                  background: "linear-gradient(135deg, #059669 0%, #16a34a 100%)",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 800,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
                }}
              >
                Paper BUY ({topSignal.symbol})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signal Explorer Filter Card */}
      <div style={{
        background: "#0f172a",
        borderRadius: "0.75rem",
        border: "1px solid #334155",
        padding: "1rem 1.25rem",
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        alignItems: "center",
      }}>
        <div style={{ flex: 1, minWidth: "220px" }}>
          <input
            type="text"
            placeholder="Search Symbol (e.g. RELIANCE, TCS)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#08111f",
              border: "1px solid rgba(148,163,184,.18)",
              color: "#f8fafc",
              borderRadius: "0.5rem",
              padding: "0.6rem 0.85rem",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>

        <div style={{ width: "160px" }}>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as any)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#08111f",
              border: "1px solid rgba(148,163,184,.18)",
              color: "#f8fafc",
              borderRadius: "0.5rem",
              padding: "0.6rem 0.85rem",
              fontSize: "0.875rem",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Actions</option>
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
            <option value="HOLD">HOLD</option>
          </select>
        </div>

        <div style={{ width: "160px" }}>
          <select
            value={trendFilter}
            onChange={(e) => setTrendFilter(e.target.value as any)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "#08111f",
              border: "1px solid rgba(148,163,184,.18)",
              color: "#f8fafc",
              borderRadius: "0.5rem",
              padding: "0.6rem 0.85rem",
              fontSize: "0.875rem",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="ALL">All Trends</option>
            <option value="BULLISH">Bullish</option>
            <option value="BEARISH">Bearish</option>
            <option value="NEUTRAL">Neutral</option>
          </select>
        </div>
      </div>

      {/* Equity Signal Grid */}
      {filteredSignals.length === 0 ? (
        <div style={{
          padding: "3rem",
          textAlign: "center",
          background: "#0f172a",
          borderRadius: "0.75rem",
          border: "1px dashed #334155",
          color: "#94a3b8",
        }}>
          <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>No Signals Found</h4>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem" }}>Try adjusting your search term or filters.</p>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.25rem",
        }}>
          {filteredSignals.map((s) => (
            <SignalCard key={s.symbol} signal={s} onTrade={onTrade} onDetails={onDetails} />
          ))}
        </div>
      )}
    </div>
  );
};
