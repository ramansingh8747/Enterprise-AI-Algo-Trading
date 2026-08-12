import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchResult } from '@/types/globalSearch';
import {
  searchGlobalAsync,
  getRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
} from '@/services/paperTrading/globalSearchService';
import { OrderSide } from './OrderForm';

interface SearchCommandCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenOrderForm?: (symbol?: string, side?: OrderSide, price?: number) => void;
}

export const SearchCommandCenter: React.FC<SearchCommandCenterProps> = ({
  isOpen,
  onClose,
  onOpenOrderForm,
}) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => getRecentSearches());
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced Async Server Search (300ms)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(async () => {
      try {
        const res = await searchGlobalAsync(query);
        setResults(res);
      } catch (err) {
        console.warn('Global search error:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
        setSelectedIndex(0);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleSelectResult = React.useCallback((item: SearchResult) => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
      setRecentSearches(getRecentSearches());
    }

    onClose();

    if (item.action === 'OPEN_ORDER') {
      onOpenOrderForm?.(item.symbol, item.metadata?.side || 'BUY', item.metadata?.price || 0);
    } else if (item.route) {
      navigate(item.route);
    }
  }, [query, onClose, onOpenOrderForm, navigate]);

  // Keyboard navigation & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results.length > 0 && results[selectedIndex]) {
          handleSelectResult(results[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, handleSelectResult, onClose]);

  if (!isOpen) return null;

  const handleRecentClick = (recentQuery: string) => {
    setQuery(recentQuery);
  };

  const getCategoryBadge = (category: SearchResult['category']) => {
    switch (category) {
      case 'EQUITY': return { label: 'Equity', bg: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' };
      case 'STRATEGY': return { label: 'Strategy', bg: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' };
      case 'ORDER': return { label: 'Order', bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' };
      case 'JOURNAL': return { label: 'Journal', bg: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' };
      case 'ALERT': return { label: 'Alert', bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
      case 'ACTION': return { label: 'Action', bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' };
      default: return { label: 'Page', bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' };
    }
  };

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global search command center"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(2, 6, 23, 0.8)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        paddingLeft: '1rem',
        paddingRight: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          background: '#0f172a',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '0.85rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid #1e293b', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1rem', color: '#38bdf8' }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search stocks, strategies, journal, alerts, routes... (Press ESC to close)"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              color: '#f8fafc',
              fontSize: '1rem',
              fontWeight: 600,
              outline: 'none',
            }}
          />
          {isSearching && (
            <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Searching...
            </span>
          )}
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Results Area */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', padding: '0.75rem' }}>
          {query.trim() === '' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem' }}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Recent Searches</span>
                    <button
                      onClick={() => {
                        clearRecentSearches();
                        setRecentSearches([]);
                      }}
                      style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.7rem', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {recentSearches.map((qs, i) => (
                      <button
                        key={i}
                        onClick={() => handleRecentClick(qs)}
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '0.375rem',
                          color: '#cbd5e1',
                          fontSize: '0.75rem',
                          padding: '0.3rem 0.6rem',
                          cursor: 'pointer',
                        }}
                      >
                        🕒 {qs}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Commands */}
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Quick Navigation</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button onClick={() => { onClose(); navigate('/dashboard'); }} style={{ textAlign: 'left', padding: '0.65rem 0.85rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    ⚡ Dashboard
                  </button>
                  <button onClick={() => { onClose(); navigate('/watchlist'); }} style={{ textAlign: 'left', padding: '0.65rem 0.85rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    📈 Markets
                  </button>
                  <button onClick={() => { onClose(); navigate('/strategy'); }} style={{ textAlign: 'left', padding: '0.65rem 0.85rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    🧠 Strategy & Signals
                  </button>
                  <button onClick={() => { onClose(); navigate('/portfolio'); }} style={{ textAlign: 'left', padding: '0.65rem 0.85rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem', color: '#f8fafc', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                    💼 Portfolio Holdings
                  </button>
                </div>
              </div>
            </div>
          ) : isSearching ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#38bdf8' }}>Searching server workspace...</p>
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8' }}>No results found for "{query}".</p>
              <span style={{ fontSize: '0.75rem' }}>Try searching for a symbol like RELIANCE, TCS, a strategy name, or journal entry.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const badge = getCategoryBadge(item.category);

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                      border: isSelected ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: isSelected ? '#38bdf8' : '#f8fafc' }}>
                          {item.title}
                        </strong>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, background: badge.bg, color: badge.color, padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>
                          {badge.label}
                        </span>
                      </div>
                      {item.subtitle && (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginTop: '0.15rem' }}>
                          {item.subtitle}
                        </span>
                      )}
                      {item.description && (
                        <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginTop: '0.1rem' }}>
                          {item.description}
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                      {item.action === 'OPEN_ORDER' ? 'Trade ↵' : 'Go ↵'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div style={{ padding: '0.65rem 1.25rem', background: '#08111f', borderTop: '1px solid #1e293b', display: 'flex', gap: '1.25rem', fontSize: '0.7rem', color: '#64748b' }}>
          <span>↑↓ to navigate</span>
          <span>↵ to select</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
