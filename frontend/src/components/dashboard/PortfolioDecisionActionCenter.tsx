import React, { useState, useMemo } from 'react';
import { PaperHolding } from '@/types/paperPortfolio';
import { PortfolioAnalyticsSummary } from '@/types/portfolioAnalytics';
import { RiskIntelligenceSummary } from '@/types/riskPositionIntelligence';

export interface PortfolioDecisionItem {
  id: string;
  category: 'Performance' | 'Risk' | 'Drawdown' | 'Allocation' | 'Position';
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
  title: string;
  summary: string;
  evidence: string;
  whyItMatters: string;
  recommendedReview: string;
  sourceModule: string;
}

interface PortfolioDecisionActionCenterProps {
  analytics: PortfolioAnalyticsSummary;
  riskSummary: RiskIntelligenceSummary;
  holdings: PaperHolding[];
  onNavigate?: (route: string) => void;
}

export const PortfolioDecisionActionCenter: React.FC<PortfolioDecisionActionCenterProps> = ({
  analytics,
  riskSummary,
  holdings,
  onNavigate,
}) => {
  const [selectedItem, setSelectedItem] = useState<PortfolioDecisionItem | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  const decisionItems = useMemo<PortfolioDecisionItem[]>(() => {
    const list: PortfolioDecisionItem[] = [];

    // Margin Exposure Action Item
    if (riskSummary.exposurePercent > 75) {
      list.push({
        id: 'dec-high-exposure',
        category: 'Risk',
        priority: 'High',
        title: 'Capital Margin Utilization High',
        summary: `Current exposure is ${riskSummary.exposurePercent.toFixed(1)}% of available paper balance.`,
        evidence: `Total Exposure: ₹${riskSummary.totalExposure.toLocaleString('en-IN')}`,
        whyItMatters: 'High capital allocation leaves limited buffer for potential adverse price movements.',
        recommendedReview: 'Review Portfolio Risk Budget & Exposure Limits',
        sourceModule: 'Risk Intelligence Service',
      });
    }

    // P&L Drawdown Action Item
    if (analytics.unrealizedPnl < 0) {
      list.push({
        id: 'dec-pnl-drawdown',
        category: 'Drawdown',
        priority: 'Medium',
        title: 'Unrealized Equity Drawdown Observed',
        summary: `Unrealized P&L is negative (-₹${Math.abs(analytics.unrealizedPnl).toLocaleString('en-IN')}).`,
        evidence: `Drawdown %: ${analytics.unrealizedPnlPercent.toFixed(2)}%`,
        whyItMatters: 'Paper holdings are currently below total invested capital cost.',
        recommendedReview: 'Review Drawdown Recovery Trajectory',
        sourceModule: 'Portfolio Performance Engine',
      });
    }

    // Holding specific action items
    holdings.forEach((h, idx) => {
      if (h.pnl < -2000) {
        list.push({
          id: `dec-loser-${h.symbol}-${idx}`,
          category: 'Position',
          priority: 'High',
          title: `Position Risk Alert: ${h.symbol}`,
          summary: `${h.symbol} position is showing unrealized loss of ₹${Math.abs(h.pnl).toLocaleString('en-IN')}.`,
          evidence: `Current Loss: ${h.pnlPercent.toFixed(2)}% (₹${h.pnl.toLocaleString('en-IN')})`,
          whyItMatters: 'Significant single-position loss impacts overall portfolio performance posture.',
          recommendedReview: 'Review Position Stop-Loss & Risk Metrics',
          sourceModule: 'Position Risk Monitor',
        });
      }
    });

    // Default Informational item if queue is empty
    if (list.length === 0) {
      list.push({
        id: 'dec-stable',
        category: 'Performance',
        priority: 'Informational',
        title: 'Portfolio Health & Exposure Stable',
        summary: 'All paper holdings and margin exposure metrics remain within nominal operational parameters.',
        evidence: 'No active critical alerts or elevated risk flags',
        whyItMatters: 'Current portfolio posture is balanced with positive trajectory.',
        recommendedReview: 'Maintain Regular Portfolio Monitoring',
        sourceModule: 'Portfolio Command Center',
      });
    }

    return list;
  }, [analytics, riskSummary, holdings]);

  const filteredItems = useMemo(() => {
    return decisionItems.filter(i => {
      if (priorityFilter !== 'ALL' && i.priority.toUpperCase() !== priorityFilter) return false;
      return true;
    });
  }, [decisionItems, priorityFilter]);

  const highPriorityCount = decisionItems.filter(i => i.priority === 'Critical' || i.priority === 'High').length;

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '0.75rem', padding: '1.25rem', color: '#f8fafc' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#38bdf8' }}>
            Portfolio Decision & Action Priority Center
          </h3>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Evidence-backed executive priority queue consolidating risk, drawdown and performance observations ({decisionItems.length} Total Items)
          </span>
        </div>

        {/* Status Badge */}
        <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.35rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>HIGH PRIORITY:</span>
          <strong style={{ fontSize: '0.85rem', color: highPriorityCount > 0 ? '#f87171' : '#4ade80' }}>
            {highPriorityCount} Active
          </strong>
        </div>
      </div>

      {/* Priority Filters */}
      <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['ALL', 'HIGH', 'MEDIUM', 'INFORMATIONAL'].map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPriorityFilter(p)}
            style={{
              padding: '0.3rem 0.6rem',
              borderRadius: '0.25rem',
              fontWeight: 700,
              fontSize: '0.7rem',
              cursor: 'pointer',
              background: priorityFilter === p ? '#0284c7' : '#0f172a',
              border: '1px solid #334155',
              color: priorityFilter === p ? '#ffffff' : '#94a3b8',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Decision Items Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        {filteredItems.map(item => {
          const priorityColor = item.priority === 'High' || item.priority === 'Critical' ? '#f87171' : item.priority === 'Medium' ? '#fbbf24' : '#4ade80';

          return (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
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
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: priorityColor, background: '#1e293b', padding: '0.1rem 0.45rem', borderRadius: '0.2rem' }}>
                    {item.priority.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>[{item.category}]</span>
                  <strong style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{item.title}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#cbd5e1' }}>{item.summary}</p>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Evidence: {item.evidence}</span>
              </div>

              <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700 }}>Inspect Evidence →</span>
            </div>
          );
        })}
      </div>

      {/* Decision Detail Modal */}
      {selectedItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.8)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#111c2d', border: '1px solid #334155', borderRadius: '0.85rem', padding: '1.5rem', maxWidth: '500px', width: '100%', color: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>
                Priority Action Evidence Detail
              </h4>
              <button type="button" onClick={() => setSelectedItem(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.1rem', cursor: 'pointer', fontWeight: 800 }}>✕</button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.6, marginBottom: '1rem' }}>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Observation: </strong>{selectedItem.title}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Priority Level: </strong>{selectedItem.priority}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Category: </strong>{selectedItem.category}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Why It Matters: </strong>{selectedItem.whyItMatters}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Supporting Evidence: </strong>{selectedItem.evidence}</p>
              <p style={{ margin: '0 0 0.4rem 0' }}><strong>Recommended Review: </strong>{selectedItem.recommendedReview}</p>
              <p style={{ margin: 0 }}><strong>Source Module: </strong>{selectedItem.sourceModule}</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedItem(null);
                if (selectedItem.category === 'Risk') onNavigate?.('/orders');
                else if (selectedItem.category === 'Position') onNavigate?.('/strategy');
                else onNavigate?.('/journal');
              }}
              style={{ width: '100%', padding: '0.55rem', borderRadius: '0.375rem', background: '#0284c7', border: 'none', color: '#ffffff', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Open Inspection Module →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
