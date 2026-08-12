import React, { useState, useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

export interface PortfolioRelationshipNode {
  id: string;
  sourceType: 'Strategy' | 'Symbol' | 'Position' | 'Risk' | 'Performance';
  sourceName: string;
  targetType: 'Position' | 'Risk' | 'Portfolio' | 'Order' | 'Journal';
  targetName: string;
  relationshipType: 'Contributes To' | 'Exposes' | 'Depends On' | 'Generated';
  strength: 'Strong' | 'Moderate' | 'Weak';
  evidence: string;
  sourceModule: string;
}

interface PortfolioCorrelationDependencyMapProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioCorrelationDependencyMap: React.FC<PortfolioCorrelationDependencyMapProps> = ({
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const [selectedRel, setSelectedRel] = useState<PortfolioRelationshipNode | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  const relationships = useMemo<PortfolioRelationshipNode[]>(() => {
    const list: PortfolioRelationshipNode[] = [];

    // Equity to portfolio relationship
    list.push({
      id: 'rel-equity-portfolio',
      sourceType: 'Performance',
      sourceName: 'Unrealized P&L',
      targetType: 'Portfolio',
      targetName: 'Total Portfolio Equity',
      relationshipType: 'Contributes To',
      strength: 'Strong',
      evidence: `₹${analytics.unrealizedPnl.toLocaleString('en-IN')} net P&L impact`,
      sourceModule: 'Portfolio Performance Engine',
    });

    // Risk to portfolio relationship
    list.push({
      id: 'rel-risk-portfolio',
      sourceType: 'Risk',
      sourceName: 'Margin Exposure Ratio',
      targetType: 'Portfolio',
      targetName: 'Available Capital Margin',
      relationshipType: 'Exposes',
      strength: riskSummary.exposurePercent > 75 ? 'Strong' : 'Moderate',
      evidence: `${riskSummary.exposurePercent.toFixed(1)}% margin utilization`,
      sourceModule: 'Risk Intelligence Service',
    });

    // Holding specific relationships
    holdings.forEach((h, idx) => {
      list.push({
        id: `rel-holding-${h.symbol}-${idx}`,
        sourceType: 'Symbol',
        sourceName: h.symbol,
        targetType: 'Position',
        targetName: `${h.quantity} units @ ₹${h.averagePrice.toFixed(2)}`,
        relationshipType: 'Contributes To',
        strength: Math.abs(h.pnl) > 5000 ? 'Strong' : 'Moderate',
        evidence: `₹${h.currentValue.toLocaleString('en-IN')} market valuation`,
        sourceModule: 'Position Analytics',
      });
    });

    return list;
  }, [analytics, riskSummary, holdings]);

  const filteredRelationships = useMemo(() => {
    return relationships.filter(r => {
      if (filterType !== 'ALL' && r.sourceType.toUpperCase() !== filterType) return false;
      return true;
    });
  }, [relationships, filterType]);

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Intelligence Correlation & Dependency Map
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Map of inter-component dependencies and impact relations across portfolio dimensions ({filteredRelationships.length} Mapped Links)
          </span>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {['ALL', 'PERFORMANCE', 'RISK', 'SYMBOL'].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilterType(f)}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '0.25rem',
                fontWeight: 700,
                fontSize: '0.7rem',
                cursor: 'pointer',
                background: filterType === f ? '#0284c7' : '#0f172a',
                border: '1px solid #334155',
                color: filterType === f ? '#ffffff' : '#94a3b8',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Dependency Links Map Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {filteredRelationships.map(rel => {
          const strengthColor = rel.strength === 'Strong' ? '#4ade80' : '#fbbf24';

          return (
            <div
              key={rel.id}
              onClick={() => setSelectedRel(rel)}
              style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '0.5rem',
                padding: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>{rel.sourceType} → {rel.targetType}</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: strengthColor, background: '#1e293b', padding: '0.1rem 0.4rem', borderRadius: '0.2rem' }}>
                  {rel.strength}
                </span>
              </div>
              <strong style={{ fontSize: '0.85rem', color: '#f8fafc', display: 'block', marginBottom: '0.2rem' }}>
                {rel.sourceName} <span style={{ color: '#94a3b8', fontWeight: 400 }}>[{rel.relationshipType}]</span> {rel.targetName}
              </strong>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Evidence: {rel.evidence}</span>
            </div>
          );
        })}
      </div>

      {/* Relationship Detail Modal */}
      {selectedRel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '480px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
                Dependency Node Detail
              </h4>
              <button type="button" onClick={() => setSelectedRel(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Source Entity: </strong>{selectedRel.sourceName} ({selectedRel.sourceType})</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Relationship Type: </strong>{selectedRel.relationshipType}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Target Entity: </strong>{selectedRel.targetName} ({selectedRel.targetType})</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Strength: </strong>{selectedRel.strength}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Observed Evidence: </strong>{selectedRel.evidence}</p>
              <p style={{ margin: 0 }}><strong>Source Module: </strong>{selectedRel.sourceModule}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedRel(null);
                onNavigate?.('/strategy');
              }}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Explore Connected Module →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
