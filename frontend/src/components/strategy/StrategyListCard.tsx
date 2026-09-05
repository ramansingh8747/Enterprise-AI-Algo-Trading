import React from 'react';
import { StrategyDefinition } from '@/types/strategy';
import './styles/StrategyCard.css';

interface StrategyListCardProps {
  strategy: StrategyDefinition;
  isActive?: boolean;
  onView: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDeleteConfirm?: (id: string) => Promise<void>;
  deleteConfirm?: string | null;
  deleting?: string | null;
  onTogglePause?: (strategy: StrategyDefinition) => void;
  pausing?: boolean;
}

/**
 * Card component for displaying a strategy definition in the list.
 * Shows name, type, status, timestamps, and action buttons.
 */
export const StrategyListCard: React.FC<StrategyListCardProps> = ({
  strategy,
  isActive,
  onView,
  onEdit,
  onDelete,
  onDeleteConfirm,
  deleteConfirm,
  deleting,
  onTogglePause,
  pausing = false,
}) => {
  const isConfirming = deleteConfirm === strategy.id;
  const isDeleting = deleting === strategy.id;
  
  const [localActive, setLocalActive] = React.useState<boolean>(
    isActive !== undefined ? isActive : !!strategy.is_active
  );

  React.useEffect(() => {
    if (isActive !== undefined) {
      setLocalActive(isActive);
    } else {
      setLocalActive(!!strategy.is_active);
    }
  }, [isActive, strategy.is_active]);

  const active = localActive;

  const handleActionClick = () => {
    setLocalActive(!active);
    if (onTogglePause) {
      onTogglePause(strategy);
    }
  };

  // Parse config_json for rich quant metadata if present
  let config: Record<string, any> | null = null;
  try {
    if (strategy.config_json) {
      config = JSON.parse(strategy.config_json);
    }
  } catch {
    config = null;
  }

  const regime = config?.market_regime || 'ALL_REGIMES';
  const description = config?.description || null;

  const regimeBadge = {
    TRENDING: { label: '🟢 TRENDING REGIME', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)' },
    SIDEWAYS: { label: '🟡 SIDEWAYS REGIME', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)' },
    HIGH_VOLATILITY: { label: '🔴 HIGH VOLATILITY', color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)' },
    ALL_REGIMES: { label: '🌐 ALL REGIMES', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  }[regime as 'TRENDING' | 'SIDEWAYS' | 'HIGH_VOLATILITY' | 'ALL_REGIMES'] || { label: regime, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' };

  const isAutoPilot = config?.auto_pilot !== false;
  const isScalper =
    strategy.strategy_type?.includes('SCALP') ||
    strategy.strategy_type === 'ULTRA_FAST_SCALPER' ||
    strategy.name.toLowerCase().includes('scalp') ||
    strategy.name.toLowerCase().includes('option buying');

  let budgetDisplay = '💰 Dynamic Cash';
  if (config?.capital) {
    const num = parseFloat(config.capital);
    budgetDisplay = isNaN(num) ? `💰 ₹${config.capital}` : `💰 ₹${num.toLocaleString('en-IN')}`;
  } else if (config?.allocated_capital) {
    const num = parseFloat(config.allocated_capital);
    budgetDisplay = isNaN(num) ? `💰 ₹${config.allocated_capital}` : `💰 ₹${num.toLocaleString('en-IN')}`;
  } else if (config?.position_sizing_mode === 'DYNAMIC_RISK') {
    budgetDisplay = '💰 Dynamic (1% Risk)';
  } else {
    budgetDisplay = '💰 Dynamic Cash';
  }

  return (
    <div className="strategy-card" style={{
      background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 41, 59, 0.5) 100%)',
      borderRadius: '0.85rem',
      border: `1px solid ${active ? 'rgba(74, 222, 128, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '1rem',
      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
      backdropFilter: 'blur(8px)',
    }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc', lineHeight: 1.3 }}>
            {strategy.name}
          </h3>
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 800,
            padding: '0.2rem 0.55rem',
            borderRadius: '1rem',
            background: active ? 'rgba(74, 222, 128, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: active ? '#4ade80' : '#fbbf24',
            border: `1px solid ${active ? 'rgba(74, 222, 128, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
            whiteSpace: 'nowrap',
          }}>
            {active ? '🟢 Active' : '🟡 Stopped'}
          </span>
        </div>

        {/* Mode, Budget & Regime Tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {isScalper && (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              padding: '0.2rem 0.6rem',
              borderRadius: '0.35rem',
              background: 'rgba(236, 72, 153, 0.15)',
              color: '#f472b6',
              border: '1px solid rgba(236, 72, 153, 0.4)',
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              ⚡ 15-MIN SCALPER
            </span>
          )}
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '0.2rem 0.6rem',
            borderRadius: '0.35rem',
            background: isAutoPilot ? 'rgba(74, 222, 128, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            color: isAutoPilot ? '#4ade80' : '#38bdf8',
            border: `1px solid ${isAutoPilot ? 'rgba(74, 222, 128, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            {isAutoPilot ? '⚡ AUTO-PILOT ON' : '📋 ADVISORY'}
          </span>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '0.2rem 0.6rem',
            borderRadius: '0.35rem',
            background: 'rgba(234, 179, 8, 0.12)',
            color: '#facc15',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            letterSpacing: '0.04em',
          }}>
            {budgetDisplay}
          </span>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '0.2rem 0.6rem',
            borderRadius: '0.35rem',
            background: regimeBadge.bg,
            color: regimeBadge.color,
            border: `1px solid ${regimeBadge.color}35`,
            letterSpacing: '0.04em',
          }}>
            {regimeBadge.label}
          </span>
        </div>

        {description && (
          <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>
            {description}
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', fontSize: '0.75rem', color: '#64748b' }}>
          <div>
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>Type: </span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>{strategy.strategy_type}</span>
          </div>
          <div>
            <span style={{ fontWeight: 700, color: '#94a3b8' }}>Updated: </span>
            <span>{new Date(strategy.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      <div className="strategy-card-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {/* Dedicated Single Stop / Resume Button */}
        {onTogglePause && (
          active ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleActionClick}
              style={{
                flex: 1,
                fontWeight: 800,
                fontSize: '0.8rem',
                padding: '0.48rem 0.85rem',
                borderRadius: '0.45rem',
                cursor: 'pointer',
                border: '1px solid rgba(239, 68, 68, 0.6)',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              ⏹️ Stop Strategy
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm"
              onClick={handleActionClick}
              style={{
                flex: 1,
                fontWeight: 800,
                fontSize: '0.8rem',
                padding: '0.48rem 0.85rem',
                borderRadius: '0.45rem',
                cursor: 'pointer',
                border: '1px solid rgba(74, 222, 128, 0.6)',
                background: 'rgba(74, 222, 128, 0.2)',
                color: '#4ade80',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
            >
              ▶️ Resume Strategy
            </button>
          )
        )}
        <button className="btn btn-sm btn-info" onClick={onView} style={{ padding: '0.45rem 0.85rem' }}>
          View
        </button>
        {onEdit && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={onEdit}
            style={{
              padding: '0.45rem 0.85rem',
              fontWeight: 700,
              background: 'rgba(99, 102, 241, 0.25)',
              border: '1px solid rgba(99, 102, 241, 0.6)',
              color: '#a5b4fc',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            ✏️ Edit
          </button>
        )}
      </div>
    </div>
  );
};
