import React, { useState, useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

export interface PortfolioControlItem {
  id: string;
  category: 'Performance' | 'Risk' | 'Drawdown' | 'Allocation' | 'Position' | 'Monitoring';
  status: 'Ready' | 'Attention' | 'Incomplete' | 'Limited';
  title: string;
  observation: string;
  evidence: string;
  whyItMatters: string;
  sourceModule: string;
  affectedEntity: string;
}

interface PortfolioComplianceControlCenterProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioComplianceControlCenter: React.FC<PortfolioComplianceControlCenterProps> = ({
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const [selectedControl, setSelectedControl] = useState<PortfolioControlItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const controlItems = useMemo<PortfolioControlItem[]>(() => {
    const list: PortfolioControlItem[] = [];

    // Margin Exposure Control Item
    list.push({
      id: 'ctrl-margin-exposure',
      category: 'Risk',
      status: riskSummary.exposurePercent > 75 ? 'Attention' : 'Ready',
      title: 'Margin Exposure Limit Control',
      observation: `Active margin allocation is ${riskSummary.exposurePercent.toFixed(1)}% of starting paper balance.`,
      evidence: `Margin Exposure: ₹${riskSummary.totalExposure.toLocaleString('en-IN')}`,
      whyItMatters: 'Control monitoring ensures total position exposure remains within defined paper risk parameters.',
      sourceModule: 'Risk Position Intelligence Service',
      affectedEntity: 'Paper Balance',
    });

    // P&L Drawdown Control Item
    list.push({
      id: 'ctrl-pnl-drawdown',
      category: 'Drawdown',
      status: analytics.unrealizedPnl < 0 ? 'Attention' : 'Ready',
      title: 'Equity Drawdown Control Visibility',
      observation: `Unrealized equity P&L is ${analytics.unrealizedPnl >= 0 ? '+' : ''}₹${analytics.unrealizedPnl.toLocaleString('en-IN')}.`,
      evidence: `Unrealized P&L %: ${analytics.unrealizedPnlPercent.toFixed(2)}%`,
      whyItMatters: 'Continuous drawdown tracking provides clear operational visibility into portfolio equity trajectory.',
      sourceModule: 'Portfolio Performance Engine',
      affectedEntity: 'Total Holdings',
    });

    // Holding Control Items
    holdings.forEach((h, idx) => {
      list.push({
        id: `ctrl-holding-${h.symbol}-${idx}`,
        category: 'Position',
        status: h.pnl < -2000 ? 'Attention' : 'Ready',
        title: `Position Risk Control: ${h.symbol}`,
        observation: `Position evaluated at market price ₹${h.currentPrice.toFixed(2)} with P&L ₹${h.pnl.toLocaleString('en-IN')}.`,
        evidence: `Units: ${h.quantity} | Value: ₹${h.currentValue.toLocaleString('en-IN')}`,
        whyItMatters: 'Individual position loss monitoring ensures capital allocation is strictly auditable.',
        sourceModule: 'Position Risk Monitor',
        affectedEntity: h.symbol,
      });
    });

    return list;
  }, [analytics, riskSummary, holdings]);

  const filteredControls = useMemo(() => {
    return controlItems.filter(c => {
      if (filterStatus !== 'ALL' && c.status.toUpperCase() !== filterStatus) return false;
      return true;
    });
  }, [controlItems, filterStatus]);

  const attentionCount = controlItems.filter(c => c.status === 'Attention').length;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Compliance & Control Readiness Center
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Executive control visibility and evidence audit matrix for portfolio operational posture ({controlItems.length} Mapped Controls)
          </span>
        </div>

        {/* Status Badge */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.35rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>CONTROL STATUS:</span>
          <strong style={{ fontSize: '0.85rem', color: attentionCount > 0 ? '#fbbf24' : '#4ade80' }}>
            {attentionCount > 0 ? `${attentionCount} Need Attention` : 'Control Ready'}
          </strong>
        </div>
      </div>

      {/* Control Filters */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'READY', 'ATTENTION'].map(st => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterStatus(st)}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.25rem',
              fontWeight: 700,
              fontSize: '0.7rem',
              cursor: 'pointer',
              background: filterStatus === st ? '#0284c7' : '#0f172a',
              border: '1px solid #334155',
              color: filterStatus === st ? '#ffffff' : '#94a3b8',
            }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Control Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredControls.map(item => {
          const statusColor = item.status === 'Attention' ? '#fbbf24' : '#4ade80';

          return (
            <div
              key={item.id}
              onClick={() => setSelectedControl(item)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                padding: '0.85rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: statusColor, background: '#1e293b', padding: '0.1rem 0.45rem', borderRadius: '0.2rem' }}>
                    {item.status.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>[{item.category}]</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{item.title}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>{item.observation}</p>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Evidence: {item.evidence} | Source: {item.sourceModule}</span>
              </div>

              <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>Inspect Control →</span>
            </div>
          );
        })}
      </div>

      {/* Control Detail Modal */}
      {selectedControl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '500px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
                Operational Control Evidence Detail
              </h4>
              <button type="button" onClick={() => setSelectedControl(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Title: </strong>{selectedControl.title}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Control Readiness Status: </strong>{selectedControl.status}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Factual Observation: </strong>{selectedControl.observation}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Supporting Evidence: </strong>{selectedControl.evidence}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Control Impact: </strong>{selectedControl.whyItMatters}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Affected Entity: </strong>{selectedControl.affectedEntity}</p>
              <p style={{ margin: 0 }}><strong>Traceable Source Module: </strong>{selectedControl.sourceModule}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedControl(null);
                onNavigate?.('/journal');
              }}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Open Compliance & Control Audit Module →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
