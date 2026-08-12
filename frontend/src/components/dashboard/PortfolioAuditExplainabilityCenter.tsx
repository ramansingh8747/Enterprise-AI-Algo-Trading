import React, { useState, useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

export interface PortfolioAuditItem {
  id: string;
  category: 'Performance' | 'Risk' | 'Drawdown' | 'Allocation' | 'Position';
  severity: 'Critical' | 'Warning' | 'Attention' | 'Informational';
  traceability: 'Fully Traceable' | 'Partially Traceable' | 'Limited Traceability';
  title: string;
  observation: string;
  explanation: string;
  evidence: string;
  sourceModule: string;
  affectedEntity: string;
}

interface PortfolioAuditExplainabilityCenterProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioAuditExplainabilityCenter: React.FC<PortfolioAuditExplainabilityCenterProps> = ({
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const [selectedAudit, setSelectedAudit] = useState<PortfolioAuditItem | null>(null);
  const [filterTraceability, setFilterTraceability] = useState<string>('ALL');

  const auditItems = useMemo<PortfolioAuditItem[]>(() => {
    const list: PortfolioAuditItem[] = [];

    // Equity Audit Item
    list.push({
      id: 'aud-equity-pnl',
      category: 'Performance',
      severity: analytics.unrealizedPnl >= 0 ? 'Informational' : 'Warning',
      traceability: 'Fully Traceable',
      title: 'Portfolio Valuation & Net P&L Audit',
      observation: `Calculated unrealized P&L is ${analytics.unrealizedPnl >= 0 ? '+' : ''}₹${analytics.unrealizedPnl.toLocaleString('en-IN')}.`,
      explanation: 'Net P&L is derived by summing individual holding current market values against entry purchase costs.',
      evidence: `Total Invested: ₹${analytics.totalInvested.toLocaleString('en-IN')} | Holdings Count: ${holdings.length}`,
      sourceModule: 'Portfolio Analytics Engine',
      affectedEntity: 'Total Paper Portfolio',
    });

    // Exposure Audit Item
    list.push({
      id: 'aud-margin-exposure',
      category: 'Risk',
      severity: riskSummary.exposurePercent > 75 ? 'Warning' : 'Informational',
      traceability: 'Fully Traceable',
      title: 'Margin Exposure Provenance Audit',
      observation: `Margin exposure is ${riskSummary.exposurePercent.toFixed(1)}% of available virtual balance.`,
      explanation: 'Exposure percentage measures active margin allocation relative to starting virtual paper balance.',
      evidence: `Total Exposure: ₹${riskSummary.totalExposure.toLocaleString('en-IN')}`,
      sourceModule: 'Risk Position Intelligence Service',
      affectedEntity: 'Virtual Margin Allocation',
    });

    // Holding Audit Items
    holdings.forEach((h, idx) => {
      list.push({
        id: `aud-holding-${h.symbol}-${idx}`,
        category: 'Position',
        severity: h.pnl < 0 ? 'Attention' : 'Informational',
        traceability: 'Fully Traceable',
        title: `Holding Audit: ${h.symbol}`,
        observation: `Position of ${h.quantity} units evaluated at market price ₹${h.currentPrice.toFixed(2)}.`,
        explanation: `Unrealized P&L of ₹${h.pnl.toLocaleString('en-IN')} computed directly from live tick pricing.`,
        evidence: `Avg Price: ₹${h.averagePrice.toFixed(2)} | Current Value: ₹${h.currentValue.toLocaleString('en-IN')}`,
        sourceModule: 'Paper Portfolio Service',
        affectedEntity: h.symbol,
      });
    });

    return list;
  }, [analytics, riskSummary, holdings]);

  const filteredAudits = useMemo(() => {
    return auditItems.filter(a => {
      if (filterTraceability !== 'ALL' && a.traceability.toUpperCase().replace(/\s+/g, '_') !== filterTraceability) return false;
      return true;
    });
  }, [auditItems, filterTraceability]);

  const fullyTraceableCount = auditItems.filter(a => a.traceability === 'Fully Traceable').length;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Audit & Explainability Center
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Source provenance and factual explainability log for all portfolio metrics ({auditItems.length} Audited Items)
          </span>
        </div>

        {/* Status Badge */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.35rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>TRACEABILITY:</span>
          <strong style={{ fontSize: '0.85rem', color: '#4ade80' }}>
            {fullyTraceableCount}/{auditItems.length} Fully Traceable
          </strong>
        </div>
      </div>

      {/* Traceability Filters */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'FULLY_TRACEABLE', 'PARTIALLY_TRACEABLE'].map(tr => (
          <button
            key={tr}
            type="button"
            onClick={() => setFilterTraceability(tr)}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.25rem',
              fontWeight: 700,
              fontSize: '0.7rem',
              cursor: 'pointer',
              background: filterTraceability === tr ? '#0284c7' : '#0f172a',
              border: '1px solid #334155',
              color: filterTraceability === tr ? '#ffffff' : '#94a3b8',
            }}
          >
            {tr.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Audit Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredAudits.map(item => {
          return (
            <div
              key={item.id}
              onClick={() => setSelectedAudit(item)}
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
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#4ade80', background: '#1e293b', padding: '0.1rem 0.45rem', borderRadius: '0.2rem' }}>
                    {item.traceability.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>[{item.category}]</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{item.title}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>{item.observation}</p>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Source: {item.sourceModule} | Entity: {item.affectedEntity}</span>
              </div>

              <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>Explain Metric →</span>
            </div>
          );
        })}
      </div>

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '500px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
                Factual Explainability & Metric Audit
              </h4>
              <button type="button" onClick={() => setSelectedAudit(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Title: </strong>{selectedAudit.title}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Traceability Classification: </strong>{selectedAudit.traceability}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Observation: </strong>{selectedAudit.observation}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Factual Explanation: </strong>{selectedAudit.explanation}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Supporting Evidence: </strong>{selectedAudit.evidence}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Affected Entity: </strong>{selectedAudit.affectedEntity}</p>
              <p style={{ margin: 0 }}><strong>Provenanced Source Module: </strong>{selectedAudit.sourceModule}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedAudit(null);
                onNavigate?.('/journal');
              }}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Open Audit Traceability Destination →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
