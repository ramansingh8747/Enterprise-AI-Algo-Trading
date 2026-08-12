import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/constants/routes';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleStartTrading = () => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD);
    } else {
      navigate(ROUTES.LOGIN);
    }
  };

  const handleLogin = () => {
    if (isAuthenticated) {
      navigate(ROUTES.DASHBOARD);
    } else {
      navigate(ROUTES.LOGIN);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#020617',
      color: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box',
    }}>
      {/* 1. NAVBAR */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1e293b',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <div
          onClick={() => navigate(ROUTES.HOME)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer' }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '0.5rem',
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '1.2rem',
            boxShadow: '0 0 15px rgba(2, 132, 199, 0.4)',
          }}>
            ⚡
          </div>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.025em' }}>
            Antigravity<span style={{ color: '#38bdf8' }}>Algo</span>
          </span>
        </div>

        {/* Links */}
        <nav style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
          <button onClick={() => navigate(ROUTES.WATCHLIST)} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.925rem', fontWeight: 500, cursor: 'pointer' }}>Markets</button>
          <button onClick={() => navigate(ROUTES.STRATEGY)} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.925rem', fontWeight: 500, cursor: 'pointer' }}>Strategies</button>
          <button onClick={() => scrollToSection('features')} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.925rem', fontWeight: 500, cursor: 'pointer' }}>Features</button>
          <button onClick={() => scrollToSection('paper-trading')} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.925rem', fontWeight: 500, cursor: 'pointer' }}>Paper Trading</button>
        </nav>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate(ROUTES.DASHBOARD)}
                style={{
                  padding: '0.55rem 1.2rem',
                  borderRadius: '0.5rem',
                  background: 'transparent',
                  color: '#f8fafc',
                  border: '1px solid #38bdf8',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Dashboard
              </button>
              <button
                onClick={logout}
                style={{
                  padding: '0.55rem 1.2rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#fca5a5',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              style={{
                padding: '0.55rem 1.2rem',
                borderRadius: '0.5rem',
                background: 'transparent',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Login
            </button>
          )}

          <button
            onClick={handleStartTrading}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            {isAuthenticated ? 'Go to Trading Dashboard' : 'Start Paper Trading'}
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '4rem' }}>
        
        {/* 2. HERO SECTION */}
        <section style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', paddingTop: '2rem' }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#facc15',
            background: 'rgba(250, 204, 21, 0.1)',
            border: '1px solid rgba(250, 204, 21, 0.3)',
            padding: '0.35rem 1rem',
            borderRadius: '2rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            ⚡ PAPER TRADING PLATFORM
          </span>

          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
            fontWeight: 900,
            lineHeight: 1.1,
            margin: 0,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(180deg, #ffffff 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            maxWidth: '850px',
          }}>
            Trade Smarter. <span style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Analyze Faster.</span>
          </h1>

          <p style={{
            fontSize: '1.125rem',
            color: '#94a3b8',
            maxWidth: '680px',
            margin: 0,
            lineHeight: 1.6,
          }}>
            Explore market signals, paper trading, portfolio analytics and risk management in one professional algo trading platform.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleStartTrading}
              style={{
                padding: '0.9rem 2rem',
                borderRadius: '0.75rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 800,
                fontSize: '1rem',
                cursor: 'pointer',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
              }}
            >
              {isAuthenticated ? 'ENTER TRADING DASHBOARD' : 'START PAPER TRADING'}
            </button>

            <button
              onClick={() => scrollToSection('features')}
              style={{
                padding: '0.9rem 2rem',
                borderRadius: '0.75rem',
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #334155',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              EXPLORE PLATFORM
            </button>
          </div>
        </section>

        {/* 3. MARKET PREVIEW (Clickable Cards -> /watchlist) */}
        <section id="markets" style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '1rem',
          padding: '1.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              MARKET OVERVIEW PREVIEW
            </span>
            <button
              onClick={() => navigate(ROUTES.WATCHLIST)}
              style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Explore Full Watchlist →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div
              onClick={() => navigate(ROUTES.WATCHLIST)}
              style={{ background: '#020617', border: '1px solid #1e293b', padding: '1.25rem', borderRadius: '0.75rem', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>NIFTY 50</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0' }}>24,850.40</div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                +1.24% (+304.50)
              </span>
            </div>

            <div
              onClick={() => navigate(ROUTES.WATCHLIST)}
              style={{ background: '#020617', border: '1px solid #1e293b', padding: '1.25rem', borderRadius: '0.75rem', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>BANK NIFTY</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0' }}>52,430.15</div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                +0.87% (+452.10)
              </span>
            </div>

            <div
              onClick={() => navigate(ROUTES.WATCHLIST)}
              style={{ background: '#020617', border: '1px solid #1e293b', padding: '1.25rem', borderRadius: '0.75rem', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>SENSEX</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc', margin: '0.35rem 0' }}>81,920.35</div>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4ade80', background: 'rgba(74, 222, 128, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>
                +0.94% (+762.30)
              </span>
            </div>
          </div>
        </section>

        {/* 4. ACCOUNT PREVIEW */}
        <section style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          border: '1px solid #312e81',
          borderRadius: '1rem',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#818cf8' }}>
              Virtual Account Dashboard Preview
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#cbd5e1' }}>
              Real-time P&L tracking, paper margin status, and automated win rate stats.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '1.25rem', borderRadius: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 500 }}>Portfolio Value</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f8fafc', margin: '0.3rem 0' }}>₹10,24,850</div>
              <span style={{ fontSize: '0.75rem', color: '#818cf8' }}>Paper Trading Margin</span>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '1.25rem', borderRadius: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 500 }}>Today's P&L</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#4ade80', margin: '0.3rem 0' }}>+₹8,420</div>
              <span style={{ fontSize: '0.75rem', color: '#4ade80' }}>+0.82% Overall Gains</span>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '1.25rem', borderRadius: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 500 }}>Win Rate</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8', margin: '0.3rem 0' }}>68%</div>
              <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>16 Winning Trades</span>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(99, 102, 241, 0.3)', padding: '1.25rem', borderRadius: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 500 }}>Paper Orders</span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#facc15', margin: '0.3rem 0' }}>24</div>
              <span style={{ fontSize: '0.75rem', color: '#facc15' }}>Executed In Sandbox</span>
            </div>
          </div>
        </section>

        {/* 5. FEATURES GRID */}
        <section id="features" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              Engineered for Enterprise Algo Traders
            </h2>
            <p style={{ color: '#94a3b8', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>
              Modular architecture powering paper execution, strategy signals, and risk controls.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            <div onClick={() => navigate(ROUTES.WATCHLIST)} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.75rem', borderRadius: '0.85rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>📈</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#38bdf8' }}>Market Watch</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                Track live market indices and equity watchlists with real-time price updates and percentage changes.
              </p>
            </div>

            <div onClick={() => navigate(ROUTES.STRATEGY)} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.75rem', borderRadius: '0.85rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>🤖</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#818cf8' }}>Strategy Signals</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                Automated technical analysis rules issuing BUY, SELL, and HOLD confidence signals across equity instruments.
              </p>
            </div>

            <div onClick={handleStartTrading} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.75rem', borderRadius: '0.85rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>⚡</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#facc15' }}>Paper Trading</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                Simulate orders with virtual capital in a zero-risk sandbox. Practice strategy execution safely.
              </p>
            </div>

            <div onClick={() => navigate(ROUTES.PORTFOLIO)} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.75rem', borderRadius: '0.85rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>💼</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#4ade80' }}>Portfolio Analytics</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                Detailed asset holdings break-down, average buy prices, unrealized P&L calculations, and net positions.
              </p>
            </div>

            <div onClick={() => navigate(ROUTES.PORTFOLIO)} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.75rem', borderRadius: '0.85rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>🛡️</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#f43f5e' }}>Risk Management</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                Strict position sizing limits, maximum order thresholds, daily stop loss rules, and risk/reward ratios.
              </p>
            </div>

            <div onClick={() => navigate(ROUTES.JOURNAL)} style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.75rem', borderRadius: '0.85rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>📓</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#a855f7' }}>Trading Journal</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                Comprehensive execution history log recording entry prices, exit signals, trade notes, and P&L results.
              </p>
            </div>
          </div>
        </section>

        {/* 6. STRATEGY PREVIEW (Clickable Cards -> /strategy) */}
        <section id="strategies" style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '1rem',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
                Automated Strategy Signals Preview
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>
                Sample algorithmic evaluation of market leaders.
              </p>
            </div>

            <button
              onClick={() => navigate(ROUTES.STRATEGY)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              VIEW ALL SIGNALS →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            <div
              onClick={() => navigate(ROUTES.STRATEGY)}
              style={{ background: '#020617', border: '1px solid #1e293b', padding: '1.25rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#f8fafc', display: 'block' }}>RELIANCE</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Reliance Industries</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#4ade80', background: 'rgba(74, 222, 128, 0.15)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
                  BUY (Strong)
                </span>
              </div>
            </div>

            <div
              onClick={() => navigate(ROUTES.STRATEGY)}
              style={{ background: '#020617', border: '1px solid #1e293b', padding: '1.25rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#f8fafc', display: 'block' }}>TCS</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Tata Consultancy</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#facc15', background: 'rgba(250, 204, 21, 0.15)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
                  HOLD (Neutral)
                </span>
              </div>
            </div>

            <div
              onClick={() => navigate(ROUTES.STRATEGY)}
              style={{ background: '#020617', border: '1px solid #1e293b', padding: '1.25rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            >
              <div>
                <span style={{ fontWeight: 700, color: '#f8fafc', display: 'block' }}>INFY</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Infosys Ltd</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f87171', background: 'rgba(248, 113, 113, 0.15)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem' }}>
                  SELL (Moderate)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 7. PAPER TRADING */}
        <section id="paper-trading" style={{
          background: 'rgba(250, 204, 21, 0.05)',
          border: '1px solid rgba(250, 204, 21, 0.25)',
          borderRadius: '1rem',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#facc15' }}>
                PRACTICE WITHOUT REAL MONEY
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#cbd5e1' }}>
                All trades are simulated locally. No real broker order is executed.
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#facc15', background: 'rgba(250, 204, 21, 0.15)', padding: '0.3rem 0.75rem', borderRadius: '1rem' }}>
              PAPER MODE ACTIVE
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#020617', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Virtual Paper Balance</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4ade80', marginTop: '0.2rem' }}>₹10,00,000</div>
            </div>

            <div style={{ background: '#020617', padding: '1rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #1e293b' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Real Orders Placed</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#cbd5e1', marginTop: '0.2rem' }}>0 (Safe)</div>
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <button
              onClick={handleStartTrading}
              style={{
                padding: '0.75rem 1.75rem',
                borderRadius: '0.5rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
              }}
            >
              {isAuthenticated ? 'LAUNCH PAPER TRADING DASHBOARD' : 'START PAPER TRADING NOW'}
            </button>
          </div>
        </section>

        {/* 8. RISK MANAGEMENT (With View Risk Controls CTA) */}
        <section style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '1rem',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#f43f5e' }}>
                Automated Risk Controls
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>
                Enforce disciplined position sizing and capital protection limits.
              </p>
            </div>

            <button
              onClick={() => navigate(ROUTES.PORTFOLIO)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                background: 'rgba(244, 63, 94, 0.15)',
                color: '#fb7185',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              VIEW RISK CONTROLS →
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: '#020617', border: '1px solid #1e293b', padding: '1rem 1.25rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Maximum Order</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>₹1,00,000</div>
            </div>

            <div style={{ background: '#020617', border: '1px solid #1e293b', padding: '1rem 1.25rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Maximum Position</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>₹2,00,000</div>
            </div>

            <div style={{ background: '#020617', border: '1px solid #1e293b', padding: '1rem 1.25rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Daily Loss Limit</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f87171', marginTop: '0.2rem' }}>₹10,000</div>
            </div>

            <div style={{ background: '#020617', border: '1px solid #1e293b', padding: '1rem 1.25rem', borderRadius: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Risk / Reward Ratio</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>1.5 : 1</div>
            </div>
          </div>
        </section>

        {/* 9. HOW IT WORKS SECTION */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              How AntigravityAlgo Works
            </h2>
            <p style={{ color: '#94a3b8', margin: '0.35rem 0 0 0', fontSize: '0.95rem' }}>
              4 steps to test and execute your algorithmic trading workflow.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            <div
              onClick={() => navigate(ROUTES.LOGIN)}
              style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0284c7' }}>STEP 01</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.25rem 0' }}>Create Account</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Sign in securely to unlock your paper trading profile.</p>
            </div>

            <div
              onClick={() => navigate(ROUTES.WATCHLIST)}
              style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8' }}>STEP 02</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.25rem 0' }}>Explore Markets</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Search equity quotes and setup your custom watchlist.</p>
            </div>

            <div
              onClick={handleStartTrading}
              style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#facc15' }}>STEP 03</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.25rem 0' }}>Place Paper Trades</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Simulate market and limit BUY/SELL orders safely.</p>
            </div>

            <div
              onClick={() => navigate(ROUTES.PORTFOLIO)}
              style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '1.5rem', borderRadius: '0.75rem', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#4ade80' }}>STEP 04</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', margin: '0.4rem 0 0.25rem 0' }}>Track Portfolio & Risk</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: 0 }}>Monitor average prices, unrealized P&L, and position risks.</p>
            </div>
          </div>
        </section>

        {/* 10. FINAL CTA */}
        <section style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
          borderRadius: '1rem',
          padding: '3.5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          boxShadow: '0 20px 40px -10px rgba(37, 99, 235, 0.4)',
        }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 900, margin: 0, color: '#ffffff' }}>
            Ready to Explore Algo Trading?
          </h2>
          <p style={{ fontSize: '1.05rem', color: '#e0f2fe', maxWidth: '580px', margin: 0, lineHeight: 1.5 }}>
            Access live market overview, paper execution, strategy signals, and risk analytics instantly.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleStartTrading}
              style={{
                padding: '1rem 2.25rem',
                borderRadius: '0.75rem',
                background: '#ffffff',
                color: '#0284c7',
                border: 'none',
                fontWeight: 900,
                fontSize: '1.05rem',
                cursor: 'pointer',
                boxShadow: '0 10px 20px rgba(0,0,0,0.2)',
              }}
            >
              {isAuthenticated ? 'ENTER TRADING DASHBOARD' : 'START PAPER TRADING'}
            </button>

            <button
              onClick={() => navigate(ROUTES.WATCHLIST)}
              style={{
                padding: '1rem 2.25rem',
                borderRadius: '0.75rem',
                background: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                fontWeight: 800,
                fontSize: '1.05rem',
                cursor: 'pointer',
              }}
            >
              EXPLORE MARKETS
            </button>
          </div>
        </section>
      </main>

      {/* 11. FOOTER */}
      <footer style={{
        background: '#0f172a',
        borderTop: '1px solid #1e293b',
        padding: '3rem 2rem 2rem 2rem',
        marginTop: '4rem',
        color: '#64748b',
        fontSize: '0.875rem',
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 800, color: '#f8fafc', fontSize: '1.2rem' }}>Antigravity<span style={{ color: '#38bdf8' }}>Algo</span></span>
              </div>
              <p style={{ margin: 0, color: '#94a3b8', maxWidth: '360px' }}>
                Enterprise AI Algorithmic Trading & Paper Simulation Platform.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ color: '#f8fafc', fontSize: '0.9rem', margin: '0 0 0.75rem 0' }}>Platform Navigation</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button onClick={() => navigate(ROUTES.HOME)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>Home</button>
                  <button onClick={() => navigate(ROUTES.WATCHLIST)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>Markets & Watchlist</button>
                  <button onClick={() => navigate(ROUTES.STRATEGY)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>Strategy Signals</button>
                  <button onClick={() => scrollToSection('features')} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>Platform Features</button>
                </div>
              </div>

              <div>
                <h4 style={{ color: '#f8fafc', fontSize: '0.9rem', margin: '0 0 0.75rem 0' }}>Trading Tools</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button onClick={() => navigate(ROUTES.ORDERS)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>Orders History</button>
                  <button onClick={() => navigate(ROUTES.PORTFOLIO)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>Portfolio Analytics</button>
                  <button onClick={() => navigate(ROUTES.JOURNAL)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>Trading Journal</button>
                  <button onClick={() => navigate(ROUTES.LOGIN)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'left' }}>User Login</button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #1e293b', paddingTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
              Real trading currently disabled. Simulated paper environment for research & educational testing.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
