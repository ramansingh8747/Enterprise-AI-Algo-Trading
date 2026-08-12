import React, { useState, useMemo, useCallback } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

/* ─────────────────────────────────────────────────────────────── */
/* Types                                                           */
/* ─────────────────────────────────────────────────────────────── */

type AreaState = 'Healthy' | 'Attention' | 'Incomplete' | 'Limited' | 'Not Available';

interface ReportSection {
  id: string;
  area: string;
  state: AreaState;
  source: string;
  evidenceStatus: 'Complete' | 'Partial' | 'Not Available';
  keyInfo: string;
  attentionNote: string;
  navigationTarget: string;
}

interface PortfolioExecutiveIntelligenceReportCenterProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  paperBalance: number;
  portfolioValue: number;
  onNavigate?: (route: string) => void;
}

/* ─────────────────────────────────────────────────────────────── */
/* Helpers                                                         */
/* ─────────────────────────────────────────────────────────────── */

const stateColor = (s: AreaState): string => {
  if (s === 'Healthy') return '#4ade80';
  if (s === 'Attention') return '#fbbf24';
  if (s === 'Incomplete') return '#f87171';
  if (s === 'Limited') return '#94a3b8';
  return '#64748b';
};

const evidenceColor = (e: ReportSection['evidenceStatus']): string => {
  if (e === 'Complete') return '#4ade80';
  if (e === 'Partial') return '#fbbf24';
  return '#64748b';
};

const fmtInr = (v: number) =>
  `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

/* ─────────────────────────────────────────────────────────────── */
/* Main Component                                                  */
/* ─────────────────────────────────────────────────────────────── */

export const PortfolioExecutiveIntelligenceReportCenter: React.FC<
  PortfolioExecutiveIntelligenceReportCenterProps
> = ({ analytics, riskSummary, holdings, paperBalance, portfolioValue: _portfolioValue, onNavigate }) => {
  /* UI state */
  const [selectedSection, setSelectedSection] = useState<ReportSection | null>(null);
  const [filterState, setFilterState] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'Area' | 'State' | 'Evidence'>('Area');
  const [copied, setCopied] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);

  /* ── Derive report sections once ─────────────────────────────── */
  const reportSections = useMemo<ReportSection[]>(() => {
    const pnlPositive = analytics.unrealizedPnl >= 0;
    const riskElevated = riskSummary.exposurePercent > 75;
    const hasHoldings = holdings.length > 0;
    const hasLargeLoser = holdings.some(h => h.pnl < -2000);

    return [
      {
        id: 'rpt-portfolio',
        area: 'Portfolio',
        state: hasHoldings ? 'Healthy' : 'Incomplete',
        source: 'Paper Portfolio Service',
        evidenceStatus: hasHoldings ? 'Complete' : 'Not Available',
        keyInfo: hasHoldings
          ? `${holdings.length} position(s) | Invested: ${fmtInr(analytics.totalInvested)} | Current Value: ${fmtInr(analytics.currentValue)}`
          : 'No active paper holdings.',
        attentionNote: hasHoldings
          ? 'Portfolio evidence available from paper trading service.'
          : 'No paper holdings are active. Portfolio evidence is unavailable.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-performance',
        area: 'Performance',
        state: pnlPositive ? 'Healthy' : 'Attention',
        source: 'Portfolio Analytics Engine',
        evidenceStatus: hasHoldings ? 'Complete' : 'Not Available',
        keyInfo: hasHoldings
          ? `Unrealized P&L: ${fmtInr(analytics.unrealizedPnl)} (${fmtPct(analytics.unrealizedPnlPercent)}) | Winners: ${analytics.winningCount} | Losers: ${analytics.losingCount}`
          : 'Not Available',
        attentionNote: pnlPositive
          ? 'Performance evidence is available — positive unrealized returns.'
          : 'Unrealized drawdown is active. Human review recommended.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-risk',
        area: 'Risk',
        state: riskElevated ? 'Attention' : 'Healthy',
        source: 'Risk Position Intelligence Service',
        evidenceStatus: hasHoldings ? 'Partial' : 'Not Available',
        keyInfo: `Exposure: ${riskSummary.exposurePercent.toFixed(1)}% | Health: ${riskSummary.healthStatus} | Safe: ${riskSummary.safeCount} | Warning: ${riskSummary.warningCount} | Danger: ${riskSummary.dangerCount}`,
        attentionNote: riskElevated
          ? 'Risk exposure is elevated. Human oversight recommended.'
          : 'Risk context available — exposure within observable range.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-drawdown',
        area: 'Drawdown',
        state: analytics.unrealizedPnl < 0 ? 'Attention' : 'Healthy',
        source: 'Portfolio Analytics Engine',
        evidenceStatus: hasHoldings ? 'Partial' : 'Not Available',
        keyInfo: hasHoldings
          ? `Unrealized P&L: ${fmtInr(analytics.unrealizedPnl)} | Net: ${fmtPct(analytics.unrealizedPnlPercent)}`
          : 'Not Available',
        attentionNote:
          analytics.unrealizedPnl < 0
            ? 'Portfolio is in unrealized drawdown. Historical drawdown data unavailable from paper service.'
            : 'No active unrealized drawdown. Historical drawdown data not available from paper service.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-allocation',
        area: 'Allocation',
        state: hasHoldings ? 'Healthy' : 'Incomplete',
        source: 'Portfolio Analytics Engine',
        evidenceStatus: hasHoldings ? 'Complete' : 'Not Available',
        keyInfo: hasHoldings
          ? `${holdings.length} position(s) | Total Invested: ${fmtInr(analytics.totalInvested)} | Available Margin: ${fmtInr(paperBalance)}`
          : 'No allocation data available.',
        attentionNote: hasHoldings
          ? 'Allocation evidence available from paper holdings.'
          : 'No allocation evidence available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-execution',
        area: 'Execution',
        state: 'Limited',
        source: 'Paper Portfolio Service',
        evidenceStatus: 'Partial',
        keyInfo: 'Paper trade execution only. Real broker execution: Not Available. External execution data: Not Available.',
        attentionNote: 'Only paper execution evidence is available. Real broker execution evidence is not available.',
        navigationTarget: '/orders',
      },
      {
        id: 'rpt-strategy',
        area: 'Strategy',
        state: hasHoldings ? 'Healthy' : 'Incomplete',
        source: 'Strategy Allocation Intelligence',
        evidenceStatus: hasHoldings ? 'Partial' : 'Not Available',
        keyInfo: hasHoldings
          ? `Strategy composition inferred from ${holdings.length} paper position(s).`
          : 'No strategy allocation evidence available.',
        attentionNote: hasHoldings
          ? 'Strategy context available from paper holdings composition.'
          : 'No active strategy allocation detected.',
        navigationTarget: '/strategy',
      },
      {
        id: 'rpt-position',
        area: 'Position',
        state: hasLargeLoser ? 'Attention' : hasHoldings ? 'Healthy' : 'Incomplete',
        source: 'Position Risk Monitor',
        evidenceStatus: hasHoldings ? 'Complete' : 'Not Available',
        keyInfo: hasHoldings
          ? `${holdings.length} position(s) | Winners: ${analytics.winningCount} | Losers: ${analytics.losingCount} | ${analytics.topGainer ? `Top Gainer: ${analytics.topGainer.symbol}` : ''}`
          : 'No active positions.',
        attentionNote: hasLargeLoser
          ? 'Position(s) exceeding paper loss threshold detected. Human review recommended.'
          : 'Position evidence available.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-monitoring',
        area: 'Monitoring',
        state: riskElevated ? 'Attention' : 'Healthy',
        source: 'Portfolio Monitoring Engine',
        evidenceStatus: 'Partial',
        keyInfo: `Risk Health: ${riskSummary.healthStatus} | Exposure: ${riskSummary.exposurePercent.toFixed(1)}%`,
        attentionNote: riskElevated
          ? 'Monitoring has flagged elevated exposure. Attention required.'
          : 'Monitoring context available — no critical alerts from available data.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-decisions',
        area: 'Decisions',
        state: 'Limited',
        source: 'Portfolio Decision Action Center',
        evidenceStatus: 'Not Available',
        keyInfo: 'Decision records are derived from paper trading activity. No real decision history available.',
        attentionNote: 'Decision evidence is limited to paper trading context. No unresolved decisions from external sources.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-governance',
        area: 'Governance',
        state: 'Healthy',
        source: 'Portfolio Governance Engine',
        evidenceStatus: 'Partial',
        keyInfo: 'Governance review readiness layer is operational. Executive review context available.',
        attentionNote: 'Governance evidence available. Human oversight review recommended before any operational decisions.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-controls',
        area: 'Controls',
        state: 'Healthy',
        source: 'Compliance & Control Center',
        evidenceStatus: 'Partial',
        keyInfo: 'Control readiness layer is available. Traceability evidence available from existing intelligence layers.',
        attentionNote: 'Control evidence is traceable. No legal or regulatory compliance certification implied.',
        navigationTarget: '/portfolio',
      },
      {
        id: 'rpt-audit',
        area: 'Audit',
        state: 'Healthy',
        source: 'Portfolio Audit Engine',
        evidenceStatus: 'Partial',
        keyInfo: 'Audit & explainability traceability available. Source provenance is traceable from paper portfolio service.',
        attentionNote: 'Audit context available. External audit or regulatory audit evidence is not available.',
        navigationTarget: '/portfolio',
      },
    ];
  }, [analytics, riskSummary, holdings, paperBalance]);

  /* ── Computed overall status ──────────────────────────────────── */
  const attentionCount = reportSections.filter(s => s.state === 'Attention').length;
  const overallStatus =
    attentionCount > 3
      ? 'Operationally Incomplete'
      : attentionCount > 0
      ? 'Ready With Attention'
      : 'Operationally Ready';
  const overallColor =
    overallStatus === 'Operationally Ready'
      ? '#4ade80'
      : overallStatus === 'Ready With Attention'
      ? '#fbbf24'
      : '#f87171';

  const contextTs = useMemo(() => new Date().toLocaleString('en-IN', { hour12: true }), []);

  /* ── Filter + Search + Sort ───────────────────────────────────── */
  const filteredSections = useMemo(() => {
    let items = [...reportSections];
    if (filterState !== 'ALL') {
      items = items.filter(s => s.state.toUpperCase().replace(/\s+/g, '_') === filterState);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        s =>
          s.area.toLowerCase().includes(q) ||
          s.state.toLowerCase().includes(q) ||
          s.source.toLowerCase().includes(q) ||
          s.keyInfo.toLowerCase().includes(q) ||
          s.attentionNote.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      if (sortBy === 'State') {
        const order: AreaState[] = ['Attention', 'Incomplete', 'Limited', 'Not Available', 'Healthy'];
        return order.indexOf(a.state) - order.indexOf(b.state);
      }
      if (sortBy === 'Evidence') {
        const order = ['Not Available', 'Partial', 'Complete'];
        return order.indexOf(a.evidenceStatus) - order.indexOf(b.evidenceStatus);
      }
      return a.area.localeCompare(b.area);
    });
    return items;
  }, [reportSections, filterState, searchQuery, sortBy]);

  /* ── Report text builders ─────────────────────────────────────── */
  const buildExecutiveSummaryText = useCallback((): string => {
    const lines: string[] = [
      `PORTFOLIO EXECUTIVE INTELLIGENCE REPORT`,
      `Generated Context: ${contextTs}`,
      `Operational Status: ${overallStatus}`,
      ``,
      `EXECUTIVE SUMMARY`,
      `─────────────────`,
      `• Portfolio health context is ${holdings.length > 0 ? 'available' : 'unavailable — no active paper holdings'}.`,
      `• Performance evidence ${analytics.unrealizedPnl >= 0 ? 'indicates positive unrealized returns' : 'indicates an unrealized drawdown — human review recommended'}.`,
      `• Risk exposure is ${riskSummary.exposurePercent > 75 ? 'elevated and requires human attention' : 'within observable range'}.`,
      `• ${holdings.length} active paper position(s). Winners: ${analytics.winningCount}. Losers: ${analytics.losingCount}.`,
      `• Governance review layer: operational. Audit traceability: available.`,
      `• Real broker execution evidence: Not Available.`,
      `• External market data: Not Available.`,
      ``,
      `DISCLAIMER: This report is generated from paper trading simulation data only.`,
      `No real orders, positions, or broker connections are present.`,
      `No investment recommendation, regulatory certification, or legal compliance is implied.`,
    ];
    return lines.join('\n');
  }, [analytics, riskSummary, holdings, overallStatus, contextTs]);

  const buildFullReportText = useCallback((): string => {
    const divider = '═'.repeat(60);
    const lines: string[] = [
      divider,
      `PORTFOLIO EXECUTIVE INTELLIGENCE REPORT`,
      `Generated Context: ${contextTs}`,
      `Operational Status: ${overallStatus}`,
      `Attention Areas: ${attentionCount}`,
      divider,
      ``,
      `EXECUTIVE SUMMARY`,
      `─────────────────`,
      buildExecutiveSummaryText(),
      ``,
      divider,
      `REPORT SECTIONS`,
      divider,
    ];
    reportSections.forEach(s => {
      lines.push(``, `[${s.area.toUpperCase()}]`, `  State:    ${s.state}`, `  Evidence: ${s.evidenceStatus}`, `  Source:   ${s.source}`, `  Info:     ${s.keyInfo}`, `  Note:     ${s.attentionNote}`);
    });
    lines.push(``, divider, `DATA QUALITY`, `─────────────────`,
      `Paper Portfolio:         Available`,
      `Risk Intelligence:       Available`,
      `Historical Context:      Limited`,
      `External Market Data:    Not Available`,
      `Broker Execution:        Not Available`,
      ``, divider,
      `DISCLAIMER`,
      `─────────────────`,
      `This report is generated solely from paper trading simulation data.`,
      `No investment advice, regulatory compliance, or legal certification is implied.`,
      `Real trading is disabled. Automated trading is disabled.`,
      divider,
    );
    return lines.join('\n');
  }, [reportSections, buildExecutiveSummaryText, overallStatus, attentionCount, contextTs]);

  /* ── Copy handlers ────────────────────────────────────────────── */
  const handleCopySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildExecutiveSummaryText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard not available */
    }
  }, [buildExecutiveSummaryText]);

  const handleCopyFull = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildFullReportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard not available */
    }
  }, [buildFullReportText]);

  /* ── Download handler ─────────────────────────────────────────── */
  const handleDownloadMd = useCallback(() => {
    const content = buildFullReportText();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-executive-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildFullReportText]);

  /* ─────────────────────────────────────────────────────────────── */
  /* Render                                                          */
  /* ─────────────────────────────────────────────────────────────── */

  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '0.75rem',
        padding: '1.25rem',
        color: '#f8fafc',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#a78bfa' }}>
            Portfolio Executive Intelligence Export &amp; Report Center
          </h3>
          <span style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
            Read-only executive report derived from existing portfolio intelligence layers · Paper Trading Only
          </span>
        </div>

        {/* Overall Status */}
        <div
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.15rem',
          }}
        >
          <span style={{ fontSize: '0.63rem', color: '#94a3b8', fontWeight: 600 }}>
            OPERATIONAL STATUS
          </span>
          <strong style={{ fontSize: '0.85rem', color: overallColor }}>{overallStatus}</strong>
          <span style={{ fontSize: '0.63rem', color: '#64748b' }}>
            Context: {contextTs}
          </span>
        </div>
      </div>

      {/* ── Status Strip ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.4rem',
          marginBottom: '1rem',
        }}
      >
        {reportSections.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedSection(s)}
            aria-label={`${s.area}: ${s.state}`}
            style={{
              background: '#0f172a',
              border: `1px solid ${stateColor(s.state)}33`,
              borderRadius: '0.4rem',
              padding: '0.45rem 0.6rem',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.15rem' }}>
              {s.area.toUpperCase()}
            </div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, color: stateColor(s.state) }}>
              {s.state}
            </div>
            <div style={{ fontSize: '0.6rem', color: evidenceColor(s.evidenceStatus), marginTop: '0.1rem' }}>
              Evidence: {s.evidenceStatus}
            </div>
          </button>
        ))}
      </div>

      {/* ── Executive Summary ─────────────────────────────────────── */}
      <div
        style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '0.5rem',
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
        }}
      >
        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a78bfa', marginBottom: '0.5rem' }}>
          Executive Summary
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • Portfolio health context is {holdings.length > 0 ? 'available' : 'unavailable — no active paper holdings'}.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • Performance evidence {analytics.unrealizedPnl >= 0 ? 'indicates positive unrealized returns' : 'indicates an unrealized drawdown — human review recommended'}.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • Risk exposure is {riskSummary.exposurePercent > 75 ? 'elevated and requires human attention' : 'within observable range — source: Risk Position Intelligence Service'}.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • {holdings.length} active paper position(s). Winners: {analytics.winningCount}. Losers: {analytics.losingCount}.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
            • Governance review layer is operational. Audit traceability is available.
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            • Real broker execution evidence: Not Available. External market data: Not Available.
          </span>
          <span style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.25rem' }}>
            Disclaimer: This report is generated from paper trading simulation data. No investment recommendation, regulatory certification, or legal compliance is implied.
          </span>
        </div>
      </div>

      {/* ── Toolbar: Search / Filter / Sort / Export ──────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '0.85rem',
          alignItems: 'center',
        }}
      >
        {/* Search */}
        <input
          type="search"
          aria-label="Search report sections"
          placeholder="Search sections, source, status…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 180px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            padding: '0.35rem 0.65rem',
            color: '#f8fafc',
            fontSize: '0.75rem',
          }}
        />

        {/* Filter */}
        <select
          aria-label="Filter by state"
          value={filterState}
          onChange={e => setFilterState(e.target.value)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            padding: '0.35rem 0.55rem',
            color: '#f8fafc',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          {['ALL', 'HEALTHY', 'ATTENTION', 'INCOMPLETE', 'LIMITED', 'NOT_AVAILABLE'].map(o => (
            <option key={o} value={o}>{o === 'ALL' ? 'All States' : o}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          aria-label="Sort sections"
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '0.375rem',
            padding: '0.35rem 0.55rem',
            color: '#f8fafc',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          <option value="Area">Sort: Area</option>
          <option value="State">Sort: State</option>
          <option value="Evidence">Sort: Evidence</option>
        </select>

        {/* Export buttons */}
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          style={btnStyle('#7c3aed')}
          aria-label="Preview executive report"
        >
          Preview Report
        </button>
        <button
          type="button"
          onClick={handleCopySummary}
          style={btnStyle('#0284c7')}
          aria-label="Copy executive summary to clipboard"
        >
          {copied ? '✓ Copied' : 'Copy Summary'}
        </button>
        <button
          type="button"
          onClick={handleCopyFull}
          style={btnStyle('#0369a1')}
          aria-label="Copy full report to clipboard"
        >
          Copy Full Report
        </button>
        <button
          type="button"
          onClick={handleDownloadMd}
          style={btnStyle('#047857')}
          aria-label="Download report as markdown"
        >
          ↓ Download .md
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          style={btnStyle('#374151')}
          aria-label="Print report"
        >
          Print
        </button>
      </div>

      {/* ── Operational Readiness Report Matrix ───────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
              <th style={thStyle}>Area</th>
              <th style={thStyle}>State</th>
              <th style={thStyle}>Evidence</th>
              <th style={thStyle}>Key Information</th>
              <th style={thStyle}>Source</th>
              <th style={thStyle}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filteredSections.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #0f172a' }}>
                <td style={{ padding: '0.55rem 0.7rem', fontWeight: 700, color: '#f8fafc' }}>
                  {s.area}
                </td>
                <td style={{ padding: '0.55rem 0.7rem' }}>
                  <span
                    style={{
                      fontSize: '0.63rem',
                      fontWeight: 800,
                      color: stateColor(s.state),
                      background: '#0f172a',
                      border: `1px solid ${stateColor(s.state)}33`,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '0.2rem',
                    }}
                  >
                    {s.state.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '0.55rem 0.7rem' }}>
                  <span style={{ fontSize: '0.63rem', fontWeight: 700, color: evidenceColor(s.evidenceStatus) }}>
                    {s.evidenceStatus}
                  </span>
                </td>
                <td
                  style={{
                    padding: '0.55rem 0.7rem',
                    color: '#cbd5e1',
                    maxWidth: '240px',
                    wordBreak: 'break-word',
                  }}
                >
                  {s.keyInfo}
                </td>
                <td style={{ padding: '0.55rem 0.7rem', color: '#94a3b8', fontSize: '0.7rem' }}>
                  {s.source}
                </td>
                <td style={{ padding: '0.55rem 0.7rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedSection(s)}
                    aria-label={`Inspect ${s.area} detail`}
                    style={{
                      background: 'none',
                      border: '1px solid #334155',
                      borderRadius: '0.25rem',
                      padding: '0.2rem 0.45rem',
                      color: '#a78bfa',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Inspect →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredSections.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.82rem' }}>
            No report sections match the current filter or search.
          </div>
        )}
      </div>

      {/* ── Data Quality Footer ───────────────────────────────────── */}
      <div
        style={{
          marginTop: '1rem',
          borderTop: '1px solid #0f172a',
          paddingTop: '0.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>DATA QUALITY:</span>
        <span style={{ fontSize: '0.68rem', color: '#4ade80', fontWeight: 700 }}>Paper Portfolio — Available</span>
        <span style={{ fontSize: '0.68rem', color: '#4ade80', fontWeight: 700 }}>Risk Intelligence — Available</span>
        <span style={{ fontSize: '0.68rem', color: '#fbbf24', fontWeight: 700 }}>Historical Context — Limited</span>
        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>External Market Data — Not Available</span>
        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>Broker Execution — Not Available</span>
      </div>

      {/* ── Report Preview Modal ──────────────────────────────────── */}
      {showPreview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Executive Report Preview"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.88)',
            backdropFilter: 'blur(4px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2rem 1rem',
            overflowY: 'auto',
          }}
          onKeyDown={e => { if (e.key === 'Escape') setShowPreview(false); }}
        >
          <div
            style={{
              background: '#111c2d',
              border: '1px solid #7c3aed',
              borderRadius: '0.85rem',
              padding: '1.75rem',
              maxWidth: '700px',
              width: '100%',
              color: '#f8fafc',
            }}
          >
            {/* Preview Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
                borderBottom: '1px solid #334155',
                paddingBottom: '0.75rem',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#a78bfa' }}>
                  Portfolio Executive Intelligence Report
                </h2>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.72rem', color: '#64748b' }}>
                  Generated context: {contextTs} · Paper Trading Only · Read-Only
                </p>
              </div>
              <button
                type="button"
                aria-label="Close report preview"
                onClick={() => setShowPreview(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>

            {/* Operational Status Banner */}
            <div
              style={{
                background: '#0f172a',
                border: `1px solid ${overallColor}44`,
                borderRadius: '0.5rem',
                padding: '0.65rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1' }}>
                Operational Status:&nbsp;
                <strong style={{ color: overallColor }}>{overallStatus}</strong>
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Attention Areas: {attentionCount} | Holdings: {holdings.length} | Balance: {fmtInr(paperBalance)}
              </span>
            </div>

            {/* Executive Summary in Preview */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#a78bfa', marginBottom: '0.4rem' }}>
                Executive Summary
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 1.1rem', listStyle: 'disc', color: '#cbd5e1', fontSize: '0.75rem', lineHeight: 1.8 }}>
                <li>Portfolio health context is {holdings.length > 0 ? 'available' : 'unavailable — no active holdings'}.</li>
                <li>Performance evidence {analytics.unrealizedPnl >= 0 ? 'indicates positive unrealized returns' : 'indicates unrealized drawdown — human review recommended'}.</li>
                <li>Risk exposure: {riskSummary.exposurePercent.toFixed(1)}% — {riskSummary.exposurePercent > 75 ? 'elevated, human attention required' : 'within observable range'}.</li>
                <li>{holdings.length} paper position(s). Winners: {analytics.winningCount}. Losers: {analytics.losingCount}.</li>
                <li>Governance, audit, and traceability layers are operational.</li>
                <li>Real broker execution evidence: Not Available.</li>
              </ul>
            </div>

            {/* Report Sections in Preview */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#a78bfa', marginBottom: '0.5rem' }}>
                Report Sections ({reportSections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {reportSections.map(s => (
                  <div
                    key={s.id}
                    style={{
                      background: '#0f172a',
                      border: `1px solid ${stateColor(s.state)}22`,
                      borderRadius: '0.4rem',
                      padding: '0.55rem 0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '0.35rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc' }}>
                        {s.area}
                      </span>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.7rem', color: '#94a3b8' }}>
                        {s.attentionNote}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                      <span style={{ fontSize: '0.63rem', fontWeight: 800, color: stateColor(s.state) }}>
                        {s.state}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: evidenceColor(s.evidenceStatus) }}>
                        {s.evidenceStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Quality in Preview */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#a78bfa', marginBottom: '0.4rem' }}>
                Data Quality
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {[
                  { label: 'Paper Portfolio', state: 'Available', color: '#4ade80' },
                  { label: 'Risk Intelligence', state: 'Available', color: '#4ade80' },
                  { label: 'Historical Context', state: 'Limited', color: '#fbbf24' },
                  { label: 'External Market Data', state: 'Not Available', color: '#64748b' },
                  { label: 'Broker Execution', state: 'Not Available', color: '#64748b' },
                ].map(d => (
                  <span
                    key={d.label}
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      color: d.color,
                      background: '#0f172a',
                      border: `1px solid ${d.color}33`,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '0.25rem',
                    }}
                  >
                    {d.label}: {d.state}
                  </span>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.4rem',
                padding: '0.55rem 0.75rem',
                marginBottom: '1.25rem',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.68rem', color: '#475569', lineHeight: 1.6 }}>
                <strong style={{ color: '#64748b' }}>DISCLAIMER:</strong> This report is generated from paper trading simulation data only.
                No investment recommendation, regulatory certification, or legal compliance is implied.
                Real trading, automated trading, and real broker connections are disabled.
              </p>
            </div>

            {/* Preview Export Buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDownloadMd}
                style={btnStyle('#047857')}
                aria-label="Download as markdown"
              >
                ↓ Download .md
              </button>
              <button
                type="button"
                onClick={handleCopyFull}
                style={btnStyle('#0284c7')}
                aria-label="Copy full report"
              >
                {copied ? '✓ Copied' : 'Copy Full Report'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={btnStyle('#374151')}
                aria-label="Print report"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '0.375rem', background: '#1e293b', border: '1px solid #334155', color: '#94a3b8', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report Detail Panel Modal ─────────────────────────────── */}
      {selectedSection && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Report detail for ${selectedSection.area}`}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.87)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onKeyDown={e => { if (e.key === 'Escape') setSelectedSection(null); }}
        >
          <div
            style={{
              background: '#111c2d',
              border: '1px solid #334155',
              borderRadius: '0.85rem',
              padding: '1.5rem',
              maxWidth: '540px',
              width: '100%',
              color: '#f8fafc',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: '1px solid #334155',
                paddingBottom: '0.5rem',
              }}
            >
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#a78bfa' }}>
                Report Section Detail
              </h4>
              <button
                type="button"
                aria-label="Close detail panel"
                onClick={() => setSelectedSection(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.75 }}>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Area:</strong> {selectedSection.area}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}>
                <strong>State:</strong>{' '}
                <span style={{ color: stateColor(selectedSection.state), fontWeight: 800 }}>
                  {selectedSection.state}
                </span>
              </p>
              <p style={{ margin: '0 0 0.35rem 0' }}>
                <strong>Evidence Status:</strong>{' '}
                <span style={{ color: evidenceColor(selectedSection.evidenceStatus), fontWeight: 700 }}>
                  {selectedSection.evidenceStatus}
                </span>
              </p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Source:</strong> {selectedSection.source}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Key Information:</strong> {selectedSection.keyInfo}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Attention Note:</strong> {selectedSection.attentionNote}</p>
              <p style={{ margin: '0 0 0.35rem 0' }}><strong>Broker Execution Evidence:</strong> Not Available</p>
              <p style={{ margin: 0 }}><strong>External Market Data:</strong> Not Available</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedSection(null);
                  onNavigate?.(selectedSection.navigationTarget);
                }}
                style={btnStyle('#7c3aed')}
                aria-label={`Navigate to ${selectedSection.area} module`}
              >
                Navigate to {selectedSection.area} →
              </button>
              <button
                type="button"
                onClick={() => setSelectedSection(null)}
                style={{
                  padding: '0.5rem 0.8rem',
                  borderRadius: '0.375rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#94a3b8',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                }}
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

/* ─────────────────────────────────────────────────────────────── */
/* Shared style helpers (module-level, no closure overhead)        */
/* ─────────────────────────────────────────────────────────────── */

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '0.38rem 0.7rem',
    borderRadius: '0.375rem',
    background: bg,
    border: 'none',
    color: '#ffffff',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
  };
}

const thStyle: React.CSSProperties = {
  padding: '0.55rem 0.7rem',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: '0.72rem',
};
