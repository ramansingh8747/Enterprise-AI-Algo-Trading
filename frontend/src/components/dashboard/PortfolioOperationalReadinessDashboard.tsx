import React, { useState, useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

interface OperationalArea {
  id: string;
  area: string;
  state: 'Healthy' | 'Attention' | 'Incomplete' | 'Limited' | 'Not Available';
  evidence: string;
  source: string;
  attentionNote: string;
  navigationTarget: string;
}

interface PortfolioOperationalReadinessDashboardProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  paperBalance: number;
  portfolioValue: number;
  onNavigate?: (route: string) => void;
}

export const PortfolioOperationalReadinessDashboard: React.FC<PortfolioOperationalReadinessDashboardProps> = ({
  analytics,
  riskSummary,
  holdings,
  paperBalance: _paperBalance,
  portfolioValue: _portfolioValue,
  onNavigate,
}) => {
  const [selectedArea, setSelectedArea] = useState<OperationalArea | null>(null);
  const [filterState, setFilterState] = useState<string>('ALL');

  const operationalAreas = useMemo<OperationalArea[]>(() => {
    const performanceState: OperationalArea['state'] = analytics.unrealizedPnl >= 0 ? 'Healthy' : 'Attention';
    const riskState: OperationalArea['state'] = riskSummary.exposurePercent > 75 ? 'Attention' : 'Healthy';
    const drawdownState: OperationalArea['state'] = analytics.unrealizedPnl < 0 ? 'Attention' : 'Healthy';
    const allocationState: OperationalArea['state'] = holdings.length > 0 ? 'Healthy' : 'Incomplete';
    const positionState: OperationalArea['state'] = holdings.some(h => h.pnl < -2000) ? 'Attention' : 'Healthy';
    const monitoringState: OperationalArea['state'] = riskSummary.exposurePercent > 75 ? 'Attention' : 'Healthy';

    return [
      {
        id: 'op-performance',
        area: 'Performance',
        state: performanceState,
        evidence: `Unrealized P&L: ${analytics.unrealizedPnl >= 0 ? '+' : ''}₹${analytics.unrealizedPnl.toLocaleString('en-IN')} (${analytics.unrealizedPnlPercent.toFixed(2)}%)`,
        source: 'Portfolio Performance Engine',
        attentionNote: analytics.unrealizedPnl < 0 ? 'Unrealized drawdown requires attention.' : 'Performance evidence available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-risk',
        area: 'Risk',
        state: riskState,
        evidence: `Exposure: ${riskSummary.exposurePercent.toFixed(1)}% of balance`,
        source: 'Risk Position Intelligence Service',
        attentionNote: riskSummary.exposurePercent > 75 ? 'Margin exposure elevated. Human review recommended.' : 'Risk evidence available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-drawdown',
        area: 'Drawdown',
        state: drawdownState,
        evidence: `Unrealized P&L: ₹${analytics.unrealizedPnl.toLocaleString('en-IN')}`,
        source: 'Portfolio Analytics Engine',
        attentionNote: analytics.unrealizedPnl < 0 ? 'Equity drawdown is active.' : 'Drawdown evidence available — no active drawdown.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-allocation',
        area: 'Allocation',
        state: allocationState,
        evidence: `Holdings: ${holdings.length} | Total Invested: ₹${analytics.totalInvested.toLocaleString('en-IN')}`,
        source: 'Portfolio Analytics Engine',
        attentionNote: holdings.length === 0 ? 'No active holdings available.' : 'Allocation evidence available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-position',
        area: 'Position',
        state: positionState,
        evidence: `${holdings.length} position(s). Losers: ${analytics.losingCount}`,
        source: 'Position Risk Monitor',
        attentionNote: holdings.some(h => h.pnl < -2000) ? 'Position(s) exceeding paper loss threshold.' : 'Position evidence available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-monitoring',
        area: 'Monitoring',
        state: monitoringState,
        evidence: `Risk Health Status: ${riskSummary.healthStatus}`,
        source: 'Portfolio Monitoring Engine',
        attentionNote: riskSummary.exposurePercent > 75 ? 'Monitoring flagged elevated exposure.' : 'Monitoring context available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-governance',
        area: 'Governance',
        state: 'Healthy',
        evidence: 'Governance review readiness layer available.',
        source: 'Portfolio Governance Engine',
        attentionNote: 'Governance review is operational. Human oversight recommended.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-controls',
        area: 'Controls',
        state: 'Healthy',
        evidence: 'Control readiness layer available.',
        source: 'Compliance & Control Center',
        attentionNote: 'Control evidence is traceable.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-audit',
        area: 'Audit',
        state: 'Healthy',
        evidence: 'Audit & Explainability layer available.',
        source: 'Portfolio Audit Engine',
        attentionNote: 'Source provenance and metric traceability available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'op-execution',
        area: 'Execution',
        state: 'Limited',
        evidence: 'Paper trade execution context — external broker execution: Not Available.',
        source: 'Paper Portfolio Service',
        attentionNote: 'Real execution evidence is not available. Paper trading only.',
        navigationTarget: '/orders',
      },
      {
        id: 'op-strategy',
        area: 'Strategy',
        state: holdings.length > 0 ? 'Healthy' : 'Incomplete',
        evidence: 'Strategy allocation visible from paper holdings composition.',
        source: 'Strategy Allocation Intelligence',
        attentionNote: holdings.length === 0 ? 'No active strategy allocation.' : 'Strategy context available.',
        navigationTarget: '/strategy',
      },
    ];
  }, [analytics, riskSummary, holdings]);

  const filteredAreas = useMemo(() => {
    return operationalAreas.filter(a => {
      if (filterState !== 'ALL' && a.state.toUpperCase().replace(/\s+/g, '_') !== filterState) return false;
      return true;
    });
  }, [operationalAreas, filterState]);

  const attentionCount = operationalAreas.filter(a => a.state === 'Attention').length;
  const healthyCount = operationalAreas.filter(a => a.state === 'Healthy').length;
  const overallStatus = attentionCount > 2
    ? 'Operationally Incomplete'
    : attentionCount > 0
    ? 'Ready With Attention'
    : 'Operationally Ready';

  const overallColor = overallStatus === 'Operationally Ready' ? '#4ade80' : overallStatus === 'Ready With Attention' ? '#fbbf24' : '#f87171';

  const stateColor = (state: OperationalArea['state']) => {
    if (state === 'Healthy') return '#4ade80';
    if (state === 'Attention') return '#fbbf24';
    if (state === 'Incomplete') return '#f87171';
    if (state === 'Limited') return '#94a3b8';
    return '#64748b';
  };

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>

      {/* Executive Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Operational Readiness & Executive Summary
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Consolidated read-only executive view across all portfolio intelligence layers
          </span>
        </div>

        {/* Overall Status Badge */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.5rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>OPERATIONAL STATUS</span>
          <strong style={{ fontSize: '0.85rem', color: overallColor }}>{overallStatus}</strong>
          <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{healthyCount}/{operationalAreas.length} Areas Healthy</span>
        </div>
      </div>

      {/* Executive Status Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
        {operationalAreas.map(area => (
          <button
            key={area.id}
            type="button"
            onClick={() => setSelectedArea(area)}
            style={{
              background: '#0f172a',
              border: `1px solid ${stateColor(area.state)}33`,
              borderRadius: '0.5rem',
              padding: '0.5rem 0.65rem',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.2rem' }}>{area.area.toUpperCase()}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: stateColor(area.state) }}>{area.state}</div>
          </button>
        ))}
      </div>

      {/* Executive Summary */}
      <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', marginBottom: '0.5rem' }}>Executive Summary</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • Performance context is {analytics.unrealizedPnl >= 0 ? 'positive' : 'showing unrealized drawdown'} — evidence available from portfolio analytics engine.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • Risk exposure is {riskSummary.exposurePercent > 75 ? 'elevated and requires human review' : 'within observable range'} — source: Risk Position Intelligence.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • {holdings.length} active paper position(s). Winning: {analytics.winningCount}, Losing: {analytics.losingCount}.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • Governance review layer is operational. Audit & explainability traceability is available.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            • Real broker execution evidence: Not Available. External market data: Not Available.
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
        {['ALL', 'HEALTHY', 'ATTENTION', 'INCOMPLETE', 'LIMITED'].map(st => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterState(st)}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.25rem',
              fontWeight: 700,
              fontSize: '0.7rem',
              cursor: 'pointer',
              background: filterState === st ? '#0284c7' : '#0f172a',
              border: '1px solid #334155',
              color: filterState === st ? '#ffffff' : '#94a3b8',
            }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Operational Readiness Matrix */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Area</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>State</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Evidence</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Source</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Note</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filteredAreas.map(area => (
              <tr key={area.id} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#f8fafc' }}>{area.area}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: stateColor(area.state), background: '#0f172a', border: `1px solid ${stateColor(area.state)}33`, padding: '0.1rem 0.45rem', borderRadius: '0.2rem' }}>
                    {area.state.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#cbd5e1', maxWidth: '220px' }}>{area.evidence}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.7rem' }}>{area.source}</td>
                <td style={{ padding: '0.6rem 0.75rem', color: '#94a3b8', fontSize: '0.7rem', maxWidth: '200px' }}>{area.attentionNote}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedArea(area)}
                    style={{ background: 'none', border: '1px solid #334155', borderRadius: '0.25rem', padding: '0.2rem 0.5rem', color: '#38bdf8', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                  >
                    Inspect →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAreas.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            No operational readiness items match the selected filter.
          </div>
        )}
      </div>

      {/* Data Quality Footer */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>DATA QUALITY:</span>
        <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700 }}>Paper Portfolio — Available</span>
        <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700 }}>Risk Intelligence — Available</span>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>Historical Context — Limited</span>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>External Market Data — Not Available</span>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>Broker Execution Evidence — Not Available</span>
      </div>

      {/* Operational Detail Modal */}
      {selectedArea && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Operational detail for ${selectedArea.area}`}
          style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onKeyDown={e => { if (e.key === 'Escape') setSelectedArea(null); }}
        >
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '520px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
                Operational Readiness Detail
              </h4>
              <button
                type="button"
                aria-label="Close detail panel"
                onClick={() => setSelectedArea(null)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.7, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Area: </strong>{selectedArea.area}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Operational State: </strong>
                <span style={{ color: stateColor(selectedArea.state), fontWeight: 700 }}>{selectedArea.state}</span>
              </p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Evidence: </strong>{selectedArea.evidence}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Source Module: </strong>{selectedArea.source}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Attention Note: </strong>{selectedArea.attentionNote}</p>
              <p style={{ margin: 0 }}><strong>External Broker Data: </strong>Not Available</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedArea(null);
                  onNavigate?.(selectedArea.navigationTarget);
                }}
                style={{ flex: 1, padding: '0.55rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Navigate to {selectedArea.area} Module →
              </button>
              <button
                type="button"
                onClick={() => setSelectedArea(null)}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
