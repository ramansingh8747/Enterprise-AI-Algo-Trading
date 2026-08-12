import React, { useEffect } from 'react';
import { TradingSignal } from '@/types/signal';

interface SignalDetailProps {
  signal: TradingSignal;
  onClose: () => void;
  onTrade?: (signal: TradingSignal, side: "BUY" | "SELL") => void;
  onNavigate?: (route: string) => void;
}

export const SignalDetail: React.FC<SignalDetailProps> = ({ signal, onClose, onTrade, onNavigate }) => {
  // Keydown Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getActionColor = (action: string) => {
    switch (action) {
      case "BUY": return "#4ade80";
      case "SELL": return "#f87171";
      default: return "#fbbf24";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "BULLISH": return "#4ade80";
      case "BEARISH": return "#f87171";
      default: return "#38bdf8";
    }
  };

  const actionColor = getActionColor(signal.action);
  const trendColor = getTrendColor(signal.trend);

  const getStrengthTier = (strength: number) => {
    if (strength >= 75) return { label: "Strong Signal", color: "#4ade80" };
    if (strength >= 50) return { label: "Moderate Signal", color: "#fbbf24" };
    return { label: "Weak Signal", color: "#f87171" };
  };

  const strengthTier = getStrengthTier(signal.strength);

  // Risk / Reward calculation
  const reward = Math.abs((signal.targetPrice || signal.price * 1.03) - (signal.entryPrice || signal.price));
  const risk = Math.abs((signal.entryPrice || signal.price) - (signal.stopLoss || signal.price * 0.98));
  const rrRatio = risk > 0 ? (reward / risk).toFixed(1) : "1.5";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="signal-detail-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(900px, 100%)',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'linear-gradient(145deg, #0f1a2b 0%, #07111f 100%)',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: '1.125rem',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.55)',
          padding: '1.5rem',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🎯</span>
              <h2 id="signal-detail-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
                Signal Analysis
              </h2>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              MOCK SIGNAL • PAPER TRADING SIMULATION
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close signal details"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '1.5rem',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
              borderRadius: '0.375rem',
            }}
          >
            ✕
          </button>
        </div>

        {/* Symbol Header Banner */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'rgba(15, 23, 42, 0.75)',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(148, 163, 184, 0.12)',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 900, color: '#f8fafc' }}>
              {signal.symbol}
            </h1>
            <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              {signal.name || `${signal.symbol} Equity`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 800,
              color: actionColor,
              background: `${actionColor}18`,
              border: `1px solid ${actionColor}40`,
            }}>
              {signal.action}
            </span>

            <span style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 800,
              color: trendColor,
              background: `${trendColor}18`,
              border: `1px solid ${trendColor}40`,
            }}>
              {signal.trend}
            </span>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Current Price</span>
              <strong style={{ fontSize: "1.5rem", fontWeight: 900, color: "#f8fafc" }}>
                ₹{signal.price.toFixed(2)}
              </strong>
            </div>
          </div>
        </div>

        {/* Signal Strength Section */}
        <div style={{ background: '#08111f', padding: '1rem 1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#cbd5e1' }}>Signal Confidence Strength</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: strengthTier.color }}>{strengthTier.label}</span>
              <strong style={{ fontSize: '1rem', color: '#38bdf8' }}>{signal.strength}%</strong>
            </div>
          </div>

          <div style={{
            height: '10px',
            width: '100%',
            background: '#1e293b',
            borderRadius: '9999px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${signal.strength}%`,
              background: 'linear-gradient(90deg, #22c55e 0%, #38bdf8 100%)',
              borderRadius: '9999px',
            }} />
          </div>
        </div>

        {/* 4-Card Overview Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '0.625rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>ACTION</span>
            <strong style={{ fontSize: '1.1rem', color: actionColor, fontWeight: 800 }}>{signal.action}</strong>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '0.625rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>TREND</span>
            <strong style={{ fontSize: '1.1rem', color: trendColor, fontWeight: 800 }}>{signal.trend}</strong>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '0.625rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>STRATEGY</span>
            <strong style={{ fontSize: '0.95rem', color: '#f8fafc', fontWeight: 700 }}>{signal.strategy}</strong>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1rem', borderRadius: '0.625rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>RISK / REWARD</span>
            <strong style={{ fontSize: '1.1rem', color: '#4ade80', fontWeight: 800 }}>{rrRatio} : 1</strong>
          </div>
        </div>

        {/* Trade Plan & Price Levels */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            Trade Execution Plan
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(56, 189, 248, 0.25)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 800, display: 'block' }}>ENTRY PRICE</span>
              <strong style={{ fontSize: '1.35rem', color: '#f8fafc' }}>₹{signal.entryPrice}</strong>
            </div>

            <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(74, 222, 128, 0.25)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 800, display: 'block' }}>TARGET PRICE</span>
              <strong style={{ fontSize: '1.35rem', color: '#4ade80' }}>₹{signal.targetPrice}</strong>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(239, 68, 68, 0.25)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 800, display: 'block' }}>STOP LOSS</span>
              <strong style={{ fontSize: '1.35rem', color: '#f87171' }}>₹{signal.stopLoss}</strong>
            </div>
          </div>

          {/* Vertical Price Plan Visualization */}
          <div style={{ background: '#08111f', padding: '1rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4ade80' }}></span>
              <span style={{ fontSize: '0.85rem', color: '#4ade80', fontWeight: 700 }}>TARGET ── ₹{signal.targetPrice}</span>
            </div>

            <div style={{ width: '2px', height: '16px', background: '#334155', marginLeft: '5px' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#38bdf8' }}></span>
              <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 700 }}>ENTRY ── ₹{signal.entryPrice}</span>
            </div>

            <div style={{ width: '2px', height: '16px', background: '#334155', marginLeft: '5px' }}></div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f87171' }}></span>
              <span style={{ fontSize: '0.85rem', color: '#f87171', fontWeight: 700 }}>STOP LOSS ── ₹{signal.stopLoss}</span>
            </div>
          </div>
        </div>

        {/* Technical Indicators */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: '#a78bfa' }}>
            Technical Indicators Breakdown
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
            <div style={{ background: '#0b1422', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>RSI Index</span>
              <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>{signal.indicators.rsi}</strong>
              <span style={{ fontSize: '0.7rem', color: signal.indicators.rsi >= 70 ? '#f87171' : signal.indicators.rsi <= 30 ? '#4ade80' : '#94a3b8', display: 'block', marginTop: '2px' }}>
                {signal.indicators.rsi >= 70 ? 'Overbought' : signal.indicators.rsi <= 30 ? 'Oversold' : 'Neutral'}
              </span>
            </div>

            <div style={{ background: '#0b1422', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Moving Average 20</span>
              <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>₹{signal.indicators.movingAverage20}</strong>
              <span style={{ fontSize: '0.7rem', color: signal.price > signal.indicators.movingAverage20 ? '#4ade80' : '#f87171', display: 'block', marginTop: '2px' }}>
                {signal.price > signal.indicators.movingAverage20 ? 'Above MA20' : 'Below MA20'}
              </span>
            </div>

            <div style={{ background: '#0b1422', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Moving Average 50</span>
              <strong style={{ fontSize: '0.95rem', color: '#f8fafc' }}>₹{signal.indicators.movingAverage50}</strong>
              <span style={{ fontSize: '0.7rem', color: signal.price > signal.indicators.movingAverage50 ? '#4ade80' : '#f87171', display: 'block', marginTop: '2px' }}>
                {signal.price > signal.indicators.movingAverage50 ? 'Above MA50' : 'Below MA50'}
              </span>
            </div>

            <div style={{ background: '#0b1422', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Momentum Oscillator</span>
              <strong style={{ fontSize: '0.95rem', color: signal.indicators.momentum > 0 ? '#4ade80' : '#f87171' }}>
                {signal.indicators.momentum > 0 ? '+Bullish' : '-Bearish'}
              </strong>
            </div>
          </div>
        </div>

        {/* Why This Signal? Explanation */}
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid rgba(148, 163, 184, 0.12)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
            Why This Signal?
          </h3>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            {signal.strategy === 'Momentum Breakout' && 'The Momentum Breakout algorithm detected an upward volume surge and positive technical alignment, creating a favorable paper-trading buying setup.'}
            {signal.strategy === 'Momentum Reversal' && 'The Reversal Scanner identified overextended price levels and bearish momentum divergence, favoring a short paper-trading position.'}
            {signal.strategy === 'Trend Watch' && 'Trend Watch indicates a consolidation phase with potential breakout probability. Monitor price action before initiating a paper trade.'}
          </p>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', display: 'block', marginTop: '0.75rem' }}>
            * This is a mock paper-trading signal and is not financial advice.
          </span>
        </div>

        {/* Navigation Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => { onClose(); onNavigate?.('/portfolio'); }}
            style={{ padding: '0.6rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Portfolio
          </button>

          <button
            type="button"
            onClick={() => { onClose(); onNavigate?.('/orders'); }}
            style={{ padding: '0.6rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Orders
          </button>

          <button
            type="button"
            onClick={() => { onClose(); onNavigate?.('/journal'); }}
            style={{ padding: '0.6rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
          >
            View Journal
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: '0.5rem',
              background: '#1e293b',
              border: '1px solid #334155',
              color: '#cbd5e1',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Close
          </button>

          {signal.action !== "SELL" && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onTrade?.(signal, "BUY");
              }}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #059669 0%, #16a34a 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Paper BUY ({signal.symbol})
            </button>
          )}

          {signal.action !== "BUY" && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onTrade?.(signal, "SELL");
              }}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              Paper SELL ({signal.symbol})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
