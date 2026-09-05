import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { strategyApi, StrategyDefinition } from '@/services/api/strategyApi';
import { brokersApi } from '@/services/api/brokersApi';
import { StrategyListCard } from '@/components/strategy/StrategyListCard';
import { getMarketSessionStatus } from '@/utils/marketTiming';
import '@/styles/StrategyManagement.css';

export default function StrategyManagementPage() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [runningInstancesCount, setRunningInstancesCount] = useState<number>(0);
  const [batchActionLoading, setBatchActionLoading] = useState<boolean>(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [autoPilotMode, setAutoPilotMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('global_auto_pilot') !== 'false';
    } catch {
      return true;
    }
  });

  // Bulk Capital & Risk Allocator Modal State
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [bulkMorningBudget, setBulkMorningBudget] = useState<string>('5000.00');
  const [bulkHeroZeroBudget, setBulkHeroZeroBudget] = useState<string>('500.00');
  const [bulkFullDayBudget, setBulkFullDayBudget] = useState<string>('10000.00');
  const [bulkRiskPerTrade, setBulkRiskPerTrade] = useState<string>('500.00');
  const [bulkSizingMode, setBulkSizingMode] = useState<string>('DYNAMIC_RISK');
  const [bulkUpdating, setBulkUpdating] = useState<boolean>(false);

  const [runningMap, setRunningMap] = useState<Record<string, boolean>>({});
  const [activeSessionMode, setActiveSessionMode] = useState<'FULL_DAY' | '15MIN_SCALPER' | 'CUSTOM'>(() => {
    try {
      const saved = localStorage.getItem('active_session_mode');
      if (saved === '15MIN_SCALPER' || saved === 'FULL_DAY' || saved === 'CUSTOM') {
        return saved;
      }
    } catch {}
    return 'FULL_DAY';
  });

  const handleSwitchToScalper15Min = async () => {
    try {
      setBatchActionLoading(true);
      setBatchMessage(null);
      setActiveSessionMode('15MIN_SCALPER');
      try { localStorage.setItem('active_session_mode', '15MIN_SCALPER'); } catch {}

      // Optimistically update runningMap: scalpers = true, others = false
      const map: Record<string, boolean> = {};
      strategies.forEach(s => {
        const isScalper =
          s.strategy_type?.includes('SCALP') ||
          s.strategy_type === 'ULTRA_FAST_SCALPER' ||
          s.name.toLowerCase().includes('scalp') ||
          s.name.toLowerCase().includes('option buying');
        map[s.id] = isScalper;
      });
      setRunningMap(map);
      setStrategies(curr => curr.map(s => ({ ...s, is_active: !!map[s.id] })));

      const res = await strategyApi.switchModeScalper15Min();
      setBatchMessage(`⚡ ${res.message || '15-20 Min Fast Scalper Mode Activated!'}`);
      await loadStrategies(true);
      setTimeout(() => setBatchMessage(null), 5000);
    } catch (err: any) {
      setBatchMessage(`❌ Error: ${err?.message || 'Failed to switch to scalper mode'}`);
      await loadStrategies(true);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleSwitchToFullDay = async () => {
    try {
      setBatchActionLoading(true);
      setBatchMessage(null);
      setActiveSessionMode('FULL_DAY');
      try { localStorage.setItem('active_session_mode', 'FULL_DAY'); } catch {}

      // Optimistically update runningMap: all = true
      const map: Record<string, boolean> = {};
      strategies.forEach(s => { map[s.id] = true; });
      setRunningMap(map);
      setRunningInstancesCount(strategies.length);
      setStrategies(curr => curr.map(s => ({ ...s, is_active: true })));

      const res = await strategyApi.switchModeFullDay();
      setBatchMessage(`🌐 ${res.message || 'Full-Day Multi-Regime Mode Activated!'}`);
      await loadStrategies(true);
      setTimeout(() => setBatchMessage(null), 5000);
    } catch (err: any) {
      setBatchMessage(`❌ Error: ${err?.message || 'Failed to switch to full-day mode'}`);
      await loadStrategies(true);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleBulkUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkUpdating(true);
    try {
      const payload = {
        morning_scalper_budget_inr: parseFloat(bulkMorningBudget) || 5000.0,
        hero_zero_budget_inr: parseFloat(bulkHeroZeroBudget) || 500.0,
        full_day_equity_budget_inr: parseFloat(bulkFullDayBudget) || 10000.0,
        risk_per_trade_inr: parseFloat(bulkRiskPerTrade) || 500.0,
        position_sizing_mode: bulkSizingMode,
        auto_pilot: autoPilotMode,
      };
      const res = await strategyApi.bulkUpdateConfig(payload);
      setShowBulkModal(false);
      setBatchMessage(`🚀 ${res.message || `Successfully applied budget to all ${res.updated_count} strategies in 1 click!`}`);
      await loadStrategies(true);
      setTimeout(() => setBatchMessage(null), 8000);
    } catch (err: any) {
      setBatchMessage(`❌ Error: ${err?.message || 'Failed to bulk update strategies'}`);
    } finally {
      setBulkUpdating(false);
    }
  };

  const loadInstancesState = useCallback(async () => {
    try {
      const instances = await strategyApi.getAllUserInstances();
      const running = instances.filter(i => i.status === 'RUNNING' && i.execution_mode === 'PAPER');
      setRunningInstancesCount(running.length);
      
      // Auto-detect mode based on live running instances count
      if (running.length > 0 && running.length <= 10) {
        setActiveSessionMode('15MIN_SCALPER');
        try { localStorage.setItem('active_session_mode', '15MIN_SCALPER'); } catch {}
      } else if (running.length > 50) {
        setActiveSessionMode('FULL_DAY');
        try { localStorage.setItem('active_session_mode', 'FULL_DAY'); } catch {}
      }

      const map: Record<string, boolean> = {};
      for (const inst of instances) {
        if (inst.execution_mode === 'PAPER') {
          map[inst.strategy_definition_id] = (inst.status === 'RUNNING');
        }
      }
      setRunningMap(map);
    } catch {
      // Non-critical fallback
    }
  }, []);

  const loadStrategies = useCallback(async (background = false) => {
    try {
      background ? setRefreshing(true) : setLoading(true);
      setError(null);
      const data = await strategyApi.listDefinitions();
      setStrategies(Array.isArray(data) ? data : []);
      await loadInstancesState();
    } catch (err: any) {
      console.error('Failed to load strategies:', err);
      setError(err?.message || 'Backend API is not reachable. Make sure FastAPI is running on port 8000.');
    } finally {
      background ? setRefreshing(false) : setLoading(false);
    }
  }, [loadInstancesState]);

  useEffect(() => {
    void loadStrategies();
  }, [loadStrategies]);

  // Live Autopilot status polling — refresh running count during active market hours
  useEffect(() => {
    const pollInterval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        void loadInstancesState();
        void loadStrategies(true);
      }
    }, 2500);
    return () => clearInterval(pollInterval);
  }, [loadInstancesState, loadStrategies]);


  const handleDeployAll = async () => {
    try {
      setBatchActionLoading(true);
      setBatchMessage(null);
      
      // Optimistically update UI so all cards immediately turn Active with Stop Strategy buttons
      const map: Record<string, boolean> = {};
      strategies.forEach(s => { map[s.id] = true; });
      setRunningMap(map);
      setRunningInstancesCount(strategies.length);
      setStrategies(curr => curr.map(s => ({ ...s, is_active: true })));

      const res = await strategyApi.deployAllPaper();
      setBatchMessage(`🚀 ${res.message || 'All strategies deployed to Autopilot Paper Mode!'}`);
      await loadStrategies(true);
      setTimeout(() => setBatchMessage(null), 5000);
    } catch (err: any) {
      setBatchMessage(`❌ Error: ${err?.message || 'Failed to deploy strategies'}`);
      await loadStrategies(true);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const handleStopAll = async () => {
    try {
      setBatchActionLoading(true);
      setBatchMessage(null);
      
      // Optimistically update UI so all cards immediately turn Stopped with Resume Strategy buttons
      const map: Record<string, boolean> = {};
      strategies.forEach(s => { map[s.id] = false; });
      setRunningMap(map);
      setRunningInstancesCount(0);
      setStrategies(curr => curr.map(s => ({ ...s, is_active: false })));

      const res = await strategyApi.stopAllPaper();
      setBatchMessage(`⏹️ ${res.message || 'All Autopilot strategies stopped.'}`);
      await loadStrategies(true);
      setTimeout(() => setBatchMessage(null), 5000);
    } catch (err: any) {
      setBatchMessage(`❌ Error: ${err?.message || 'Failed to stop strategies'}`);
      await loadStrategies(true);
    } finally {
      setBatchActionLoading(false);
    }
  };

  const filteredStrategies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return strategies.filter((strategy) => {
      const matchesQuery = !query ||
        strategy.name.toLowerCase().includes(query) ||
        strategy.strategy_type.toLowerCase().includes(query);
      const isRunning = runningMap[strategy.id] !== undefined ? !!runningMap[strategy.id] : strategy.is_active;
      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? isRunning : !isRunning);
      return matchesQuery && matchesStatus;
    });
  }, [search, statusFilter, strategies, runningMap]);

  const [pausingId, setPausingId] = useState<string | null>(null);

  const handleTogglePause = async (strategy: StrategyDefinition) => {
    try {
      setPausingId(strategy.id);
      const isCurrentlyRunning = runningMap[strategy.id] !== undefined ? !!runningMap[strategy.id] : strategy.is_active;
      const nextRunning = !isCurrentlyRunning;

      // Optimistically update UI immediately so user instantly sees "⏹️ Stop Strategy" or "▶️ Resume Strategy"
      setRunningMap(prev => ({ ...prev, [strategy.id]: nextRunning }));
      setStrategies(curr => curr.map(s => s.id === strategy.id ? { ...s, is_active: nextRunning } : s));

      try {
        const res = await strategyApi.togglePauseStrategy(strategy.id);
        const isNowRunning = res.is_active;
        setRunningMap(prev => ({ ...prev, [strategy.id]: isNowRunning }));
        setStrategies(curr => curr.map(s => s.id === strategy.id ? { ...s, is_active: isNowRunning } : s));
        setBatchMessage(`✓ ${res.message || `Strategy "${strategy.name}" is now ${isNowRunning ? 'Active (Running)' : 'Stopped'}`}`);
      } catch {
        // Direct instance API fallback
        const instances = await strategyApi.listInstances(strategy.id);
        const paperInst = instances.find(i => i.execution_mode === 'PAPER');

        if (nextRunning) {
          if (paperInst) {
            if (paperInst.status === 'PAUSED') {
              await strategyApi.resumeInstance(strategy.id, paperInst.id);
            } else {
              await strategyApi.startInstance(strategy.id, paperInst.id);
            }
          } else {
            const brokers = await brokersApi.listBrokers();
            const activeBroker = brokers.find(b => b.is_active) || brokers[0];
            const newInst = await strategyApi.createInstance(strategy.id, {
              broker_id: activeBroker ? activeBroker.id : 'b9f3fe20-510f-4cff-86d8-e310413d43bc',
              execution_mode: 'PAPER'
            });
            await strategyApi.startInstance(strategy.id, newInst.id);
          }
          await strategyApi.updateDefinition(strategy.id, { is_active: true });
          setRunningMap(prev => ({ ...prev, [strategy.id]: true }));
          setStrategies(curr => curr.map(s => s.id === strategy.id ? { ...s, is_active: true } : s));
          setBatchMessage(`✓ Strategy "${strategy.name}" is now Active (Running)`);
        } else {
          if (paperInst) {
            await strategyApi.pauseInstance(strategy.id, paperInst.id);
          }
          await strategyApi.updateDefinition(strategy.id, { is_active: false });
          setRunningMap(prev => ({ ...prev, [strategy.id]: false }));
          setStrategies(curr => curr.map(s => s.id === strategy.id ? { ...s, is_active: false } : s));
          setBatchMessage(`✓ Strategy "${strategy.name}" is now Stopped`);
        }
      }

      setTimeout(() => setBatchMessage(null), 4000);
      await loadInstancesState();
    } catch (err: any) {
      setBatchMessage(`❌ Error: ${err?.message || 'Failed to toggle strategy status'}`);
      await loadInstancesState();
    } finally {
      setPausingId(null);
    }
  };

  const handleDeleteStrategy = async (strategyId: string) => {
    try {
      setDeleting(strategyId);
      setError(null);
      await strategyApi.deleteDefinition(strategyId);
      setStrategies((current) => current.filter((strategy) => strategy.id !== strategyId));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete strategy.');
    } finally {
      setDeleting(null);
    }
  };

  const activeCount = strategies.filter((strategy) => strategy.is_active).length;
  const inactiveCount = strategies.length - activeCount;

  return (
    <div className="strategy-management-page">
      <section className="strategy-page-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="strategy-eyebrow">TRADING AUTOMATION</span>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '0.2rem 0.65rem',
              borderRadius: '1rem',
              background: runningInstancesCount > 0 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(148, 163, 184, 0.15)',
              color: runningInstancesCount > 0 ? '#4ade80' : '#94a3b8',
              border: `1px solid ${runningInstancesCount > 0 ? 'rgba(74, 222, 128, 0.35)' : 'rgba(148, 163, 184, 0.35)'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: runningInstancesCount > 0 ? '#4ade80' : '#94a3b8',
                display: 'inline-block'
              }} />
              {runningInstancesCount > 0 ? `AUTOPILOT RUNNING (${runningInstancesCount} ACTIVE)` : 'AUTOPILOT STANDBY'}
            </span>
          </div>
          <h1>Strategy Management &amp; Autopilot</h1>
          <p>Deploy quantitative strategies to monitor markets, generate BUY/SELL signals, and calculate suggested quantities for your review.</p>
        </div>
        <div className="strategy-page-actions">
          <button
            className="strategy-btn"
            onClick={handleDeployAll}
            disabled={batchActionLoading}
            style={{
              background: 'linear-gradient(135deg, #15803d 0%, #16a34a 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            }}
          >
            {batchActionLoading ? 'Deploying…' : '🚀 Deploy All to Paper'}
          </button>
          {runningInstancesCount > 0 && (
            <button
              className="strategy-btn"
              onClick={handleStopAll}
              disabled={batchActionLoading}
              style={{
                background: 'rgba(239, 68, 68, 0.18)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                fontWeight: 700,
              }}
            >
              ⏹️ Stop All
            </button>
          )}
          <button
            className="strategy-btn"
            onClick={() => navigate('/paper-trading/coalindia')}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
            }}
          >
            🛡️ COALINDIA Frozen Paper Engine
          </button>
          <button className="strategy-btn strategy-btn-secondary" onClick={() => void loadStrategies(true)} disabled={loading || refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="strategy-btn strategy-btn-secondary" onClick={() => navigate('/strategies/import')}>
            Import File
          </button>
          <button className="strategy-btn strategy-btn-primary" onClick={() => navigate('/strategies/new')}>
            + Create Strategy
          </button>
        </div>
      </section>

      {batchMessage && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '0.5rem',
          background: batchMessage.includes('❌') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(6, 78, 59, 0.5)',
          border: `1px solid ${batchMessage.includes('❌') ? '#ef4444' : '#10b981'}`,
          color: batchMessage.includes('❌') ? '#fca5a5' : '#a7f3d0',
          fontWeight: 700,
          fontSize: '0.875rem',
          marginBottom: '1.25rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        }}>
          {batchMessage}
        </div>
      )}

      {/* 1-Click Mutually Exclusive Mode Switcher */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {/* Mode A: 15-20 Min Fast Scalper */}
        <div
          onClick={handleSwitchToScalper15Min}
          style={{
            cursor: 'pointer',
            padding: '1.15rem 1.25rem',
            borderRadius: '0.85rem',
            border: activeSessionMode === '15MIN_SCALPER'
              ? '2px solid #ec4899'
              : '1px solid rgba(236, 72, 153, 0.25)',
            background: activeSessionMode === '15MIN_SCALPER'
              ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
            boxShadow: activeSessionMode === '15MIN_SCALPER'
              ? '0 0 22px rgba(236, 72, 153, 0.35)'
              : '0 4px 12px rgba(0, 0, 0, 0.2)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚡</span>
              <strong style={{ fontSize: '1.02rem', color: '#f472b6', fontWeight: 800 }}>
                15-20 Min Fast Scalper Mode
              </strong>
              {activeSessionMode === '15MIN_SCALPER' && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '1rem',
                  background: '#ec4899',
                  color: '#ffffff',
                  letterSpacing: '0.05em',
                }}>
                  ACTIVE
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
              Fast 1m/3m VWAP volume burst scalp with rapid +15% target &amp; 20m hard time-exit. Pauses all full-day swing strategies.
            </p>
          </div>
          <button
            type="button"
            disabled={batchActionLoading}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '0.45rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              background: activeSessionMode === '15MIN_SCALPER' ? '#ec4899' : 'rgba(236, 72, 153, 0.15)',
              color: activeSessionMode === '15MIN_SCALPER' ? '#ffffff' : '#f472b6',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {activeSessionMode === '15MIN_SCALPER' ? '✓ Selected' : 'Select Mode'}
          </button>
        </div>

        {/* Mode B: Full-Day Multi-Regime */}
        <div
          onClick={handleSwitchToFullDay}
          style={{
            cursor: 'pointer',
            padding: '1.15rem 1.25rem',
            borderRadius: '0.85rem',
            border: activeSessionMode === 'FULL_DAY'
              ? '2px solid #10b981'
              : '1px solid rgba(16, 185, 129, 0.25)',
            background: activeSessionMode === 'FULL_DAY'
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.4) 100%)',
            boxShadow: activeSessionMode === 'FULL_DAY'
              ? '0 0 22px rgba(16, 185, 129, 0.35)'
              : '0 4px 12px rgba(0, 0, 0, 0.2)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🌐</span>
              <strong style={{ fontSize: '1.02rem', color: '#4ade80', fontWeight: 800 }}>
                Full-Day Multi-Regime Mode
              </strong>
              {activeSessionMode === 'FULL_DAY' && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 900,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '1rem',
                  background: '#10b981',
                  color: '#ffffff',
                  letterSpacing: '0.05em',
                }}>
                  ACTIVE
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.4 }}>
              Runs all 132 strategies (Hull MA, Keltner Squeeze, EMA Ribbon, Pairs Arbitrage) throughout 09:15 AM - 03:30 PM.
            </p>
          </div>
          <button
            type="button"
            disabled={batchActionLoading}
            style={{
              padding: '0.45rem 0.9rem',
              borderRadius: '0.45rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              border: 'none',
              background: activeSessionMode === 'FULL_DAY' ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
              color: activeSessionMode === 'FULL_DAY' ? '#ffffff' : '#4ade80',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {activeSessionMode === 'FULL_DAY' ? '✓ Selected' : 'Select Mode'}
          </button>
        </div>
      </div>

      {/* Autopilot Status Bar */}
      <div style={{
        background: autoPilotMode
          ? 'linear-gradient(90deg, rgba(6, 78, 59, 0.6) 0%, rgba(15, 23, 42, 0.8) 100%)'
          : 'linear-gradient(90deg, rgba(30, 58, 138, 0.5) 0%, rgba(15, 23, 42, 0.8) 100%)',
        border: `1px solid ${autoPilotMode ? 'rgba(74, 222, 128, 0.4)' : 'rgba(96, 165, 250, 0.4)'}`,
        borderRadius: '0.75rem',
        padding: '0.9rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.85rem',
        boxShadow: autoPilotMode ? '0 4px 18px rgba(16, 185, 129, 0.15)' : '0 4px 18px rgba(59, 130, 246, 0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            background: autoPilotMode ? 'rgba(74, 222, 128, 0.2)' : 'rgba(96, 165, 250, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.2rem',
          }}>
            {autoPilotMode ? '⚡' : '📋'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <strong style={{ color: autoPilotMode ? '#4ade80' : '#60a5fa', fontSize: '0.95rem', display: 'inline-block' }}>
                {autoPilotMode ? '⚡ Auto-Pilot Mode: FULL AUTONOMOUS' : '📋 Mode: MANUAL ADVISORY'}
              </strong>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                padding: '0.15rem 0.5rem',
                borderRadius: '0.35rem',
                background: autoPilotMode ? 'rgba(74, 222, 128, 0.2)' : 'rgba(96, 165, 250, 0.2)',
                color: autoPilotMode ? '#4ade80' : '#93c5fd',
                border: `1px solid ${autoPilotMode ? 'rgba(74, 222, 128, 0.4)' : 'rgba(96, 165, 250, 0.4)'}`,
              }}>
                {runningInstancesCount > 0 ? `${runningInstancesCount} Running` : 'Standby'}
              </span>
            </div>
            <span style={{ color: '#94a3b8', fontSize: '0.78rem', display: 'block', marginTop: '0.15rem' }}>
              {autoPilotMode
                ? 'System automatically places BUY orders, manages ATR Trailing Stop-Loss, and auto-exits on target without manual clicking.'
                : 'System generates proposed BUY/SELL signals with suggested quantities and protective Stop-Loss for your manual confirmation.'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={async () => {
              const next = !autoPilotMode;
              setAutoPilotMode(next);
              try { localStorage.setItem('global_auto_pilot', String(next)); } catch {}
              // Persist auto_pilot setting to all user strategy definitions
              try {
                await Promise.all(strategies.map(s => {
                  const cfg = s.config_json ? (typeof s.config_json === 'string' ? JSON.parse(s.config_json) : s.config_json) : {};
                  cfg.auto_pilot = next;
                  return strategyApi.updateDefinition(s.id, { config_json: JSON.stringify(cfg) }).catch(() => null);
                }));
              } catch {}
            }}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: autoPilotMode ? '1px solid rgba(74, 222, 128, 0.5)' : '1px solid rgba(148, 163, 184, 0.3)',
              background: autoPilotMode ? 'rgba(74, 222, 128, 0.15)' : 'rgba(148, 163, 184, 0.1)',
              color: autoPilotMode ? '#4ade80' : '#94a3b8',
            }}
          >
            {autoPilotMode ? '⚡ Auto-Pilot: ON' : '📋 Switch to Auto-Pilot'}
          </button>
          <button
            type="button"
            onClick={() => setShowBulkModal(true)}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '0.35rem',
              fontSize: '0.75rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: '1px solid rgba(234, 179, 8, 0.7)',
              background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25) 0%, rgba(202, 138, 4, 0.35) 100%)',
              color: '#facc15',
              boxShadow: '0 2px 8px rgba(234, 179, 8, 0.2)',
            }}
          >
            ⚡ Bulk Budget Allocator (All 133)
          </button>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(234, 179, 8, 0.12)',
            color: '#facc15',
            padding: '0.35rem 0.65rem',
            borderRadius: '0.35rem',
            border: '1px solid rgba(234, 179, 8, 0.3)',
          }}>
            💰 Dynamic Funds Sizing
          </span>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'rgba(56, 189, 248, 0.12)',
            color: '#38bdf8',
            padding: '0.35rem 0.65rem',
            borderRadius: '0.35rem',
            border: '1px solid rgba(56, 189, 248, 0.25)',
          }}>
            🛡️ Paper Mode
          </span>
        </div>
      </div>

      {error && (
        <div className="strategy-alert" role="alert">
          <div><strong>Strategy service unavailable</strong><span>{error}</span></div>
          <button type="button" onClick={() => void loadStrategies(true)}>Try Again</button>
        </div>
      )}

      <section className="strategy-toolbar">
        <div className="strategy-stat"><span>Total Strategies</span><strong>{strategies.length}</strong></div>
        <div className="strategy-stat"><span>Active</span><strong>{activeCount}</strong></div>
        <div className="strategy-stat"><span>Inactive</span><strong>{inactiveCount}</strong></div>
        <label className="strategy-search"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search strategy or type…" /></label>
        <label className="strategy-filter"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">All</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
      </section>

      {loading ? (
        <div className="strategy-state-card"><div className="strategy-spinner" /><strong>Loading strategies…</strong><span>Reading your persisted strategy library from the backend.</span></div>
      ) : filteredStrategies.length === 0 ? (
        <div className="strategy-empty-card">
          <div className="strategy-empty-icon">⌁</div>
          <h2>{strategies.length ? 'No matching strategies' : 'No strategies yet'}</h2>
          <p>{strategies.length ? 'Try another search or status filter.' : 'Create a strategy manually or import a PDF, DOCX, TXT or Excel strategy source.'}</p>
          {!strategies.length && <div className="strategy-empty-actions"><button className="strategy-btn strategy-btn-primary" onClick={() => navigate('/strategies/new')}>Create Strategy</button><button className="strategy-btn strategy-btn-secondary" onClick={() => navigate('/strategies/import')}>Import File</button></div>}
        </div>
      ) : (
        <div className="strategy-grid">
          {filteredStrategies.map((strategy) => (
            <StrategyListCard
              key={strategy.id}
              strategy={strategy}
              isActive={!!runningMap[strategy.id]}
              onView={() => navigate(`/strategies/${strategy.id}`)}
              onEdit={() => navigate(`/strategies/${strategy.id}/edit`)}
              onTogglePause={handleTogglePause}
              pausing={pausingId === strategy.id}
            />
          ))}
        </div>
      )}

      {/* Bulk Capital & Risk Allocation Modal */}
      {showBulkModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="app-modal-box" style={{
            background: 'linear-gradient(145deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            borderRadius: '1rem',
            maxWidth: '620px',
            width: '100%',
            padding: '1.75rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.75)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#facc15', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ⚡ Bulk Capital & Risk Allocator
                </h2>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Ek baar settings daalein — single click me sabhi 133 strategies par ek sath apply ho jayengi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0 0.5rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleBulkUpdateSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#facc15', marginBottom: '0.35rem' }}>
                    🌅 Morning Scalper Budget (INR)
                  </label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    value={bulkMorningBudget}
                    onChange={(e) => setBulkMorningBudget(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.35rem',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>
                    09:20 AM Bank Nifty momentum scalper budget
                  </span>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#fb7185', marginBottom: '0.35rem' }}>
                    🚀 Afternoon Hero-Zero Budget (INR)
                  </label>
                  <input
                    type="number"
                    step="50"
                    min="100"
                    max="50000"
                    value={bulkHeroZeroBudget}
                    onChange={(e) => setBulkHeroZeroBudget(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.35rem',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>
                    03:10 PM Expiry blast budget (e.g. ₹500 or ₹1,000)
                  </span>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.35rem' }}>
                    🌐 Full-Day Equity Budget (INR)
                  </label>
                  <input
                    type="number"
                    step="500"
                    min="500"
                    value={bulkFullDayBudget}
                    onChange={(e) => setBulkFullDayBudget(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.35rem',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>
                    Capital pool for multi-regime equity trades
                  </span>
                </div>

                <div style={{ background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(74, 222, 128, 0.25)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#4ade80', marginBottom: '0.35rem' }}>
                    🛡️ Risk Per Trade (INR)
                  </label>
                  <input
                    type="number"
                    step="50"
                    min="50"
                    value={bulkRiskPerTrade}
                    onChange={(e) => setBulkRiskPerTrade(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '0.35rem',
                      color: '#ffffff',
                      fontSize: '0.9rem',
                      boxSizing: 'border-box',
                    }}
                    required
                  />
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: '0.25rem' }}>
                    Pillar 4 capital guard max risk per trade
                  </span>
                </div>
              </div>

              <div style={{ background: 'rgba(30, 41, 59, 0.5)', border: '1px solid #334155', borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '0.35rem' }}>
                  Position Sizing Mode
                </label>
                <select
                  value={bulkSizingMode}
                  onChange={(e) => setBulkSizingMode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '0.35rem',
                    color: '#ffffff',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="DYNAMIC_RISK">DYNAMIC_RISK (1% Risk / Trade with ATR-adjusted sizing)</option>
                  <option value="DYNAMIC_CASH">DYNAMIC_CASH (Scales quantity with available cash)</option>
                  <option value="FIXED">FIXED (Uses strategy defined fixed lot size)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  disabled={bulkUpdating}
                  style={{
                    padding: '0.6rem 1.2rem',
                    borderRadius: '0.45rem',
                    border: '1px solid #475569',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkUpdating}
                  style={{
                    padding: '0.65rem 1.35rem',
                    borderRadius: '0.45rem',
                    border: 'none',
                    background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                    color: '#000000',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    boxShadow: '0 4px 14px rgba(234, 179, 8, 0.4)',
                  }}
                >
                  {bulkUpdating ? '⏳ Applying to All 133 Strategies...' : '🚀 Apply to All 133 Strategies'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
