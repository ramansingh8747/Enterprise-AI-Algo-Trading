import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import UserMenu from '@/components/dashboard/UserMenu';
import { SearchCommandCenter } from '@/components/dashboard/SearchCommandCenter';
import { getUnreadCount } from '@/services/paperTrading/alertService';

interface NavbarProps {
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  onSidebarToggle?: () => void;
  onMenuClick?: () => void;
  onOpenOrderForm?: (symbol?: string, side?: any, price?: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onSidebarToggle, onMenuClick, onOpenOrderForm }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => getUnreadCount());

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
    return location.pathname.startsWith(path);
  };

  const handleNavClick = (id: string, path: string) => {
    if (setActiveTab) setActiveTab(id);
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header style={{
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
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

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '1.25rem' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
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
          <span style={{ fontSize: '0.78rem' }}>Search...</span>
          <kbd style={{ background: '#1e293b', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', fontSize: '0.65rem', color: '#cbd5e1', fontWeight: 700 }}>
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
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-6px',
                background: '#ef4444',
                color: '#ffffff',
                borderRadius: '50%',
                width: '15px',
                height: '15px',
                fontSize: '0.65rem',
                fontWeight: 800,
                display: 'grid',
                placeItems: 'center',
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationsOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 12px)',
              width: '300px',
              background: '#0f172a',
              border: '1px solid rgba(148, 163, 184, 0.18)',
              borderRadius: '0.75rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.45)',
              zIndex: 100,
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#f8fafc' }}>
                  Notifications ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setUnreadCount(0)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Clear All
                  </button>
                )}
              </div>

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
              ) : (
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '1rem 0' }}>
                  No unread notifications
                </div>
              )}
            </div>
          )}
        </div>

        <UserMenu />
      </div>

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
