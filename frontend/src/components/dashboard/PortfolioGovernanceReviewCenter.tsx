import React, { useState, useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

export interface GovernanceReviewItem {
  id: string;
  category: 'Performance' | 'Risk' | 'Drawdown' | 'Allocation' | 'Position';
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
  reviewStatus: 'Review Required' | 'Review Recommended' | 'Monitoring' | 'Sufficiently Evidenced';
  evidenceStatus: 'Strong' | 'Moderate' | 'Limited';
  title: string;
  observation: string;
  whyReviewIsNeeded: string;
  sourceModule: string;
}

interface PortfolioGovernanceReviewCenterProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioGovernanceReviewCenter: React.FC<PortfolioGovernanceReviewCenterProps> = ({
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const [selectedReview, setSelectedReview] = useState<GovernanceReviewItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const reviewItems = useMemo<GovernanceReviewItem[]>(() => {
    const list: GovernanceReviewItem[] = [];

    // Margin Governance Item
    if (riskSummary.exposurePercent > 75) {
      list.push({
        id: 'gov-margin-exposure',
        category: 'Risk',
        priority: 'High',
        reviewStatus: 'Review Required',
        evidenceStatus: 'Strong',
        title: 'Capital Margin Governance Review',
        observation: `Margin exposure is ${riskSummary.exposurePercent.toFixed(1)}% of available virtual balance.`,
        whyReviewIsNeeded: 'Elevated capital allocation requires explicit operator verification against portfolio risk mandates.',
        sourceModule: 'Risk Intelligence Service',
      });
    }

    // Performance Governance Item
    if (analytics.unrealizedPnl < 0) {
      list.push({
        id: 'gov-pnl-drawdown',
        category: 'Drawdown',
        priority: 'Medium',
        reviewStatus: 'Review Recommended',
        evidenceStatus: 'Strong',
        title: 'Equity Drawdown Governance Review',
        observation: `Unrealized equity drawdown of ₹${Math.abs(analytics.unrealizedPnl).toLocaleString('en-IN')}.`,
        whyReviewIsNeeded: 'Unrealized loss accumulation should be audited for strategy stop-loss compliance.',
        sourceModule: 'Portfolio Performance Engine',
      });
    }

    // Individual Holding Governance Items
    holdings.forEach((h, idx) => {
      if (h.pnl < -2000) {
        list.push({
          id: `gov-holding-${h.symbol}-${idx}`,
          category: 'Position',
          priority: 'High',
          reviewStatus: 'Review Required',
          evidenceStatus: 'Strong',
          title: `Position Risk Governance: ${h.symbol}`,
          observation: `Paper position ${h.symbol} has accumulated ₹${Math.abs(h.pnl).toLocaleString('en-IN')} in unrealized loss.`,
          whyReviewIsNeeded: 'Individual position loss magnitude exceeds standard paper risk alert thresholds.',
          sourceModule: 'Position Risk Monitor',
        });
      }
    });

    // Default Sufficiently Evidenced Item if queue is clear
    if (list.length === 0) {
      list.push({
        id: 'gov-stable',
        category: 'Performance',
        priority: 'Informational',
        reviewStatus: 'Sufficiently Evidenced',
        evidenceStatus: 'Strong',
        title: 'Portfolio Governance State Nominal',
        observation: 'All paper holdings, margin exposure, and position parameters are compliant with default governance standards.',
        whyReviewIsNeeded: 'Regular quarterly human oversight and risk audit recommended.',
        sourceModule: 'Portfolio Governance Engine',
      });
    }

    return list;
  }, [analytics, riskSummary, holdings]);

  const filteredReviews = useMemo(() => {
    return reviewItems.filter(r => {
      if (filterStatus !== 'ALL' && r.reviewStatus.toUpperCase().replace(/\s+/g, '_') !== filterStatus) return false;
      return true;
    });
  }, [reviewItems, filterStatus]);

  const reviewRequiredCount = reviewItems.filter(r => r.reviewStatus === 'Review Required').length;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Governance & Review Readiness Center
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Read-only audit matrix verifying evidence quality, traceability, and human review readiness ({reviewItems.length} Mapped Items)
          </span>
        </div>

        {/* Status Badge */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.35rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>REVIEW REQUIRED:</span>
          <strong style={{ fontSize: '0.85rem', color: reviewRequiredCount > 0 ? '#f87171' : '#4ade80' }}>
            {reviewRequiredCount} Items
          </strong>
        </div>
      </div>

      {/* Review Status Filters */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'REVIEW_REQUIRED', 'REVIEW_RECOMMENDED', 'SUFFICIENTLY_EVIDENCED'].map(st => (
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
            {st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Governance Readiness Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredReviews.map(item => {
          const statusColor = item.reviewStatus === 'Review Required' ? '#f87171' : item.reviewStatus === 'Review Recommended' ? '#fbbf24' : '#4ade80';

          return (
            <div
              key={item.id}
              onClick={() => setSelectedReview(item)}
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
                    {item.reviewStatus.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>[{item.category}]</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{item.title}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>{item.observation}</p>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Evidence Quality: {item.evidenceStatus} | Source: {item.sourceModule}</span>
              </div>

              <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>Inspect Audit →</span>
            </div>
          );
        })}
      </div>

      {/* Governance Audit Detail Modal */}
      {selectedReview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '500px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
                Governance & Audit Evidence Detail
              </h4>
              <button type="button" onClick={() => setSelectedReview(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Title: </strong>{selectedReview.title}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Review Status: </strong>{selectedReview.reviewStatus}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Evidence Quality: </strong>{selectedReview.evidenceStatus}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Observation: </strong>{selectedReview.observation}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Why Review Is Needed: </strong>{selectedReview.whyReviewIsNeeded}</p>
              <p style={{ margin: 0 }}><strong>Traceable Source: </strong>{selectedReview.sourceModule}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedReview(null);
                onNavigate?.('/journal');
              }}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Open Audit & Journal Module →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
