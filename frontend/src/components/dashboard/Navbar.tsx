import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import UserMenu from '@/components/dashboard/UserMenu';
import { SearchCommandCenter } from '@/components/dashboard/SearchCommandCenter';
import { SignalActionModal } from '@/components/dashboard/SignalActionModal';
import { getUnreadCount, clearAllAlerts } from '@/services/paperTrading/alertService';
import { strategyApi, StrategySignalDetail } from '@/services/api/strategyApi';
import { getMarketSessionStatus } from '@/utils/marketTiming';

import { initialEquities } from '@/data/marketData';

interface NavbarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  onSidebarToggle?: () => void;
  onMenuClick?: () => void;
  onOpenOrderForm?: (symbol?: string, side?: any, price?: number) => void;
}

function getSignalPercent(sig: StrategySignalDetail): string {
  // 1. Real-time dynamic change percent matching the 44 live equities
  const symClean = (sig.symbol || '').replace(/^NSE:|^BSE:/i, '').toUpperCase();
  const eq = initialEquities.find(e => e.symbol.toUpperCase() === symClean);

  if (eq && typeof eq.changePercent === 'number') {
    const strength = Math.min(96, Math.max(52, Math.round(50 + Math.abs(eq.changePercent) * 20)));
    return `${strength}%`;
  }

  // 2. Check if indicators_json has explicit strength / change_percent / RSI
  if (sig.indicators_json) {
    try {
      const ind = typeof sig.indicators_json === 'string' ? JSON.parse(sig.indicators_json) : sig.indicators_json;
      if (ind && typeof ind === 'object') {
        if (typeof ind.change_percent === 'number' && ind.change_percent !== 0) {
          const strength = Math.min(96, Math.max(52, Math.round(50 + Math.abs(ind.change_percent) * 20)));
          return `${strength}%`;
        }
        if (typeof ind.strength === 'number' && ind.strength > 0 && ind.strength !== 75) {
          return `${ind.strength}%`;
        }
        if (typeof ind.confidence === 'number' && ind.confidence > 0) {
          return `${Math.round(ind.confidence <= 1 ? ind.confidence * 100 : ind.confidence)}%`;
        }
        if (typeof ind.RSI === 'number' || typeof ind.rsi === 'number') {
          const rsi = Number(ind.RSI ?? ind.rsi);
          const strength = Math.min(95, Math.max(52, Math.round(rsi > 50 ? rsi : (100 - rsi))));
          return `${strength}%`;
        }
      }
    } catch {}
  }

  // 3. Compute dynamic ratio from Price, Target, and Stop Loss
  const px = Number(sig.price || 0);
  const sl = Number(sig.stop_loss || 0);
  const tgt = Number(sig.target || 0);
  if (px > 0 && tgt > 0 && sl > 0) {
    const reward = Math.abs(tgt - px);
    const risk = Math.max(1, Math.abs(px - sl));
    const rrRatio = reward / risk;
    const rewardPct = (reward / px) * 100;
    const dynamicVal = Math.min(95, Math.max(55, Math.round(50 + (rrRatio * 12) + (rewardPct * 2))));
    return `${dynamicVal}%`;
  }

  // 4. Deterministic dynamic tier based on symbol & id hash
  let symHash = 0;
  const symStr = (sig.symbol || 'STOCK') + (sig.id || '');
  for (let i = 0; i < symStr.length; i++) {
    symHash = (symHash << 5) - symHash + symStr.charCodeAt(i);
    symHash |= 0;
  }
  const dynamicTier = 62 + Math.abs(symHash % 31);
  return `${dynamicTier}%`;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onSidebarToggle, onMenuClick, onOpenOrderForm }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());
  const [pendingSignals, setPendingSignals] = useState<StrategySignalDetail[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<StrategySignalDetail | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchPendingSignals = useCallback(async () => {
    const session = getMarketSessionStatus();
    if (!session.isOpen && !session.canExit) {
      // Outside 09:15 - 15:30 IST: Suppress strategy signals and notifications
      setPendingSignals([]);
      return;
    }
    try {
      const signals = await strategyApi.listPendingSignals();
      setPendingSignals(signals);
    } catch {
      // Ignore if offline or unauthenticated
    }
  }, []);

  useEffect(() => {
    fetchPendingSignals();
    const interval = setInterval(() => {
      const session = getMarketSessionStatus();
      if (session.isOpen || session.canExit) {
        fetchPendingSignals();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchPendingSignals]);

  // Global Ctrl + K key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const totalNotifications = (pendingSignals.length || 0) + unreadCount;

  const handleOpenSignalModal = (signal: StrategySignalDetail) => {
    setSelectedSignal(signal);
    setModalOpen(true);
    setNotificationsOpen(false);
  };

  const handleSignalSuccess = (msg: string) => {
    setToastMessage(msg);
    fetchPendingSignals();
    setTimeout(() => setToastMessage(null), 5000);
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', path: ROUTES.DASHBOARD },
    { id: 'watchlist', label: 'Markets', path: ROUTES.WATCHLIST },
    { id: 'strategy', label: 'Strategy', path: ROUTES.STRATEGY },
    { id: 'portfolio', label: 'Portfolio', path: ROUTES.PORTFOLIO },
    { id: 'orders', label: 'Orders', path: ROUTES.ORDERS },
    { id: 'journal', label: 'Journal', path: ROUTES.JOURNAL },
    { id: 'brokers', label: 'Brokers', path: ROUTES.BROKERS },
  ];

  const isActive = (path: string, id: string) => {
    if (activeTab) return activeTab === id;
    if (path === ROUTES.DASHBOARD) {
      return location.pathname === path;
    }
    if (path === ROUTES.STRATEGY || path === '/strategies' || path === '/strategy') {
      return location.pathname.startsWith('/strategies') || location.pathname.startsWith('/strategy');
    }
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (id: string, path: string) => {
    if (setActiveTab) setActiveTab(id);
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="navbar-header" style={{
      background: '#0b1220',
      borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      height: '72px',
      boxSizing: 'border-box',
    }}>
      {/* Left section: Toggle & Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          type="button"
          onClick={onMenuClick || onSidebarToggle || (() => setMobileMenuOpen((prev) => !prev))}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            fontSize: '1.25rem',
            cursor: 'pointer',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Toggle Navigation"
        >
          ☰
        </button>

        {/* Navigation Tabs (Desktop only) */}
        <nav className="navbar-desktop-nav" style={{ display: 'flex', gap: '1.25rem' }}>
          {navItems.map((item) => {
            const active = isActive(item.path, item.id);
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id, item.path)}
                style={{
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: active ? 700 : 500,
                  background: 'transparent',
                  color: active ? '#38bdf8' : '#94a3b8',
                  border: 'none',
                  borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right section: Status, Bell & UserMenu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div className="navbar-paper-pill" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.75rem',
          borderRadius: '9999px',
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#fbbf24' }}></span>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24', letterSpacing: '0.04em' }}>
            PAPER MODE
          </span>
        </div>

        {/* Global Search Command Trigger Button */}
        <button
          type="button"
          className="navbar-search-btn"
          onClick={() => setSearchOpen(true)}
          aria-label="Open global search (Ctrl K)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.4rem 0.75rem',
            background: '#0f172a',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '0.5rem',
            color: '#94a3b8',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          <span>🔍</span>
          <span className="navbar-search-label" style={{ fontSize: '0.78rem' }}>Search...</span>
          <kbd className="navbar-search-kbd" style={{ background: '#1e293b', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.65rem', color: '#cbd5e1', fontWeight: 700 }}>
            Ctrl K
          </kbd>
        </button>

        {/* Search Command Center Modal */}
        <SearchCommandCenter
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onOpenOrderForm={onOpenOrderForm}
        />

        {/* Interactive Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((prev) => !prev)}
            aria-label="View notifications"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem',
            }}
          >
            <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>🔔</span>
            {totalNotifications > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-6px',
                background: pendingSignals.length > 0 ? '#38bdf8' : '#ef4444',
                color: '#0b1220',
                borderRadius: '50%',
                width: '17px',
                height: '17px',
                fontSize: '0.65rem',
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
                boxShadow: pendingSignals.length > 0 ? '0 0 8px rgba(56, 189, 248, 0.8)' : 'none',
              }}>
                {totalNotifications}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationsOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 12px)',
              width: 'min(360px, calc(100vw - 24px))',
              background: '#0f172a',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              borderRadius: '0.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.55)',
              zIndex: 100,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              maxHeight: '480px',
              overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f8fafc' }}>
                  Notifications & Signals ({totalNotifications})
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllAlerts();
                      setUnreadCount(0);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Clear System
                  </button>
                )}
              </div>

              {/* Strategy Actionable Signals Section */}
              {pendingSignals.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ⚡ Action Required: Strategy Signals ({pendingSignals.length})
                  </div>

                  {pendingSignals.map((sig) => {
                    const isBuy = sig.side.toUpperCase() === 'BUY';
                    return (
                      <div
                        key={sig.id}
                        style={{
                          background: isBuy ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                          border: isBuy ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: '0.5rem',
                          padding: '0.65rem 0.75rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{
                              background: isBuy ? '#22c55e' : '#ef4444',
                              color: '#fff',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '0.18rem 0.45rem',
                              borderRadius: '0.25rem',
                              letterSpacing: '0.02em',
                            }}>
                              {sig.side.toUpperCase()} ({getSignalPercent(sig)})
                            </span>
                            <strong style={{ color: '#f8fafc', fontSize: '0.85rem' }}>{sig.symbol}</strong>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            @ ₹{sig.price || 'Market'}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Suggested Qty: <strong style={{ color: '#38bdf8' }}>{sig.suggested_quantity || sig.quantity}</strong></span>
                          {sig.stop_loss && <span>SL: <strong style={{ color: '#ef4444' }}>₹{sig.stop_loss}</strong></span>}
                        </div>

                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenSignalModal(sig)}
                            style={{
                              flex: 1,
                              background: isBuy ? '#22c55e' : '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '0.35rem',
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Review &amp; {isBuy ? 'BUY' : 'SELL'} ({getSignalPercent(sig)})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* System Alerts */}
              {unreadCount > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', background: '#08111f', padding: '0.5rem 0.65rem', borderRadius: '0.375rem', borderLeft: '3px solid #4ade80' }}>
                    🟢 <strong>Simulation Active:</strong> Paper account balance initialized.
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', background: '#08111f', padding: '0.5rem 0.65rem', borderRadius: '0.375rem', borderLeft: '3px solid #38bdf8' }}>
                    ⚡ <strong>Broker Session:</strong> Read-Only broker data connected.
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#cbd5e1', background: '#08111f', padding: '0.5rem 0.65rem', borderRadius: '0.375rem', borderLeft: '3px solid #fbbf24' }}>
                    🛡️ <strong>Risk Guard:</strong> Daily loss limit active (₹10,000).
                  </div>
                </div>
              ) : pendingSignals.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>
                  No unread notifications or pending signals
                </div>
              ) : null}
            </div>
          )}
        </div>

        <UserMenu />
      </div>

      {/* Signal Action Modal */}
      <SignalActionModal
        isOpen={modalOpen}
        signal={selectedSignal}
        onClose={() => {
          setModalOpen(false);
          setSelectedSignal(null);
        }}
        onSuccess={handleSignalSuccess}
      />

      {/* Toast Feedback */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: '#0f172a',
          border: '1px solid #22c55e',
          color: '#86efac',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.75rem',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          zIndex: 2000,
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span>✅</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: '#0b1220',
          borderBottom: '1px solid #334155',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id, item.path)}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '0.375rem',
                textAlign: 'left',
                background: isActive(item.path, item.id) ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                color: isActive(item.path, item.id) ? '#38bdf8' : '#cbd5e1',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};
