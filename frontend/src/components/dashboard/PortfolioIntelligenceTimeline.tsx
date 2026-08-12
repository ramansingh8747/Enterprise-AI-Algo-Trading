import React, { useState, useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

export interface IntelligenceTimelineEvent {
  id: string;
  timestamp: string;
  category: 'Performance' | 'Risk' | 'Drawdown' | 'Allocation' | 'Position';
  severity: 'Critical' | 'Warning' | 'Attention' | 'Informational';
  title: string;
  summary: string;
  symbol?: string;
  pnl?: number;
  exposure?: number;
  source: string;
}

interface PortfolioIntelligenceTimelineProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioIntelligenceTimeline: React.FC<PortfolioIntelligenceTimelineProps> = ({
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<IntelligenceTimelineEvent | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Normalize chronological events from actual current holdings & risk summary
  const events = useMemo<IntelligenceTimelineEvent[]>(() => {
    const list: IntelligenceTimelineEvent[] = [];
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Portfolio overall equity status event
    list.push({
      id: 'evt-equity-status',
      timestamp: now,
      category: 'Performance',
      severity: analytics.unrealizedPnl >= 0 ? 'Informational' : 'Warning',
      title: analytics.unrealizedPnl >= 0 ? 'Portfolio Equity at Positive Trajectory' : 'Portfolio Unrealized Equity Drawdown',
      summary: `Current unrealized P&L is ${analytics.unrealizedPnl >= 0 ? '+' : ''}₹${analytics.unrealizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })} across ${holdings.length} paper holdings.`,
      pnl: analytics.unrealizedPnl,
      source: 'Portfolio Performance Engine',
    });

    // Risk exposure status event
    list.push({
      id: 'evt-risk-status',
      timestamp: now,
      category: 'Risk',
      severity: riskSummary.exposurePercent > 75 ? 'Warning' : 'Informational',
      title: riskSummary.exposurePercent > 75 ? 'Elevated Capital Utilization Alert' : 'Normal Risk Margin Posture',
      summary: `Total portfolio exposure is ${riskSummary.exposurePercent.toFixed(1)}% of available virtual margin.`,
      exposure: riskSummary.totalExposure,
      source: 'Risk Intelligence Service',
    });

    // Individual holding events
    holdings.forEach((h, idx) => {
      list.push({
        id: `evt-holding-${h.symbol}-${idx}`,
        timestamp: now,
        category: 'Position',
        severity: h.pnl < 0 ? 'Attention' : 'Informational',
        title: `Paper Holding Monitored: ${h.symbol}`,
        summary: `Position size ${h.quantity} units @ avg ₹${h.averagePrice.toFixed(2)}. Current P&L: ₹${h.pnl.toLocaleString('en-IN')}.`,
        symbol: h.symbol,
        pnl: h.pnl,
        source: 'Position Monitor Service',
      });
    });

    return list;
  }, [analytics, riskSummary, holdings]);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      if (categoryFilter !== 'ALL' && e.category.toUpperCase() !== categoryFilter) return false;
      return true;
    });
  }, [events, categoryFilter]);

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Intelligence Timeline & Historical Context
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Chronological log of measurable paper portfolio state changes and risk observations ({filteredEvents.length} Events)
          </span>
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {['ALL', 'PERFORMANCE', 'RISK', 'POSITION'].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '0.25rem',
                fontWeight: 700,
                fontSize: '0.7rem',
                cursor: 'pointer',
                background: categoryFilter === cat ? '#0284c7' : '#0f172a',
                border: '1px solid #334155',
                color: categoryFilter === cat ? '#ffffff' : '#94a3b8',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredEvents.map(evt => {
          const badgeColor = evt.severity === 'Warning' ? '#f87171' : evt.severity === 'Attention' ? '#fbbf24' : '#4ade80';

          return (
            <div
              key={evt.id}
              onClick={() => setSelectedEvent(evt)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>[{evt.timestamp}]</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: badgeColor, background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
                    {evt.severity.toUpperCase()}
                  </span>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{evt.title}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>{evt.summary}</p>
              </div>

              <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>Details →</span>
            </div>
          );
        })}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '480px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
                Timeline Event Detail
              </h4>
              <button type="button" onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Title: </strong>{selectedEvent.title}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Category: </strong>{selectedEvent.category}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Severity: </strong>{selectedEvent.severity}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Timestamp: </strong>{selectedEvent.timestamp}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Summary: </strong>{selectedEvent.summary}</p>
              <p style={{ margin: 0 }}><strong>Source Traceability: </strong>{selectedEvent.source}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedEvent(null);
                onNavigate?.('/strategy');
              }}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Open Relevant Module →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
