import React, { useState } from 'react';
import { tradingJournalApi, TradingJournalEntryCreate } from '@/services/api/tradingJournalApi';
import { TradingJournalEntry } from '@/types/tradingJournal';

export interface JournalEntryModalProps {
  initialData?: {
    symbol?: string;
    side?: string;
    quantity?: number;
    entry_price?: number;
    exit_price?: number;
    realized_pnl?: number;
    result?: string;
    notes?: string;
    tags?: string;
    paper_trade_id?: string;
    broker_order_id?: string;
    strategy_instance_id?: string;
    strategy_signal_id?: string;
  };
  onClose: () => void;
  onSuccess: (newEntry: TradingJournalEntry) => void;
}

export const JournalEntryModal: React.FC<JournalEntryModalProps> = ({
  initialData,
  onClose,
  onSuccess,
}) => {
  const [symbol, setSymbol] = useState(initialData?.symbol || '');
  const [side, setSide] = useState(initialData?.side || 'BUY');
  const [quantity, setQuantity] = useState<number>(initialData?.quantity || 1);
  const [entryPrice, setEntryPrice] = useState<number>(initialData?.entry_price || 0);
  const [exitPrice, setExitPrice] = useState<number | undefined>(initialData?.exit_price);
  const [realizedPnl, setRealizedPnl] = useState<number | undefined>(initialData?.realized_pnl);
  const [result, setResult] = useState<string>(initialData?.result || 'OPEN');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [tags, setTags] = useState(initialData?.tags || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) {
      setError('Symbol is required');
      return;
    }

    setLoading(true);
    setError(null);

    const payload: TradingJournalEntryCreate = {
      symbol: symbol.trim().toUpperCase(),
      side: side.toUpperCase(),
      quantity: Number(quantity),
      entry_price: Number(entryPrice),
      exit_price: exitPrice !== undefined && exitPrice !== null ? Number(exitPrice) : undefined,
      realized_pnl: realizedPnl !== undefined && realizedPnl !== null ? Number(realizedPnl) : undefined,
      result: result || undefined,
      notes: notes.trim() || undefined,
      tags: tags.trim() || undefined,
      paper_trade_id: initialData?.paper_trade_id,
      broker_order_id: initialData?.broker_order_id,
      strategy_instance_id: initialData?.strategy_instance_id,
      strategy_signal_id: initialData?.strategy_signal_id,
    };

    try {
      const created = await tradingJournalApi.createEntry(payload);
      onSuccess(created);
      onClose();
    } catch (err: any) {
      if (err?.status === 409) {
        setError('A journal entry for this trade/order context already exists.');
      } else {
        setError(err?.message || 'Failed to save trading journal entry.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSourceLabel = () => {
    if (initialData?.paper_trade_id) return `Paper Trade #${initialData.paper_trade_id}`;
    if (initialData?.broker_order_id) return `Broker Order #${initialData.broker_order_id}`;
    if (initialData?.strategy_signal_id) return `Strategy Signal #${initialData.strategy_signal_id.substring(0, 8)}`;
    if (initialData?.strategy_instance_id) return `Strategy Instance #${initialData.strategy_instance_id.substring(0, 8)}`;
    return null;
  };

  const sourceBadge = getSourceLabel();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(2, 6, 23, 0.75)',
      backdropFilter: 'blur(4px)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: '#0f172a',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '0.85rem',
        padding: '1.5rem',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#38bdf8' }}>
              📖 Add Journal Entry
            </h3>
            {sourceBadge && (
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '0.2rem 0.6rem',
                borderRadius: '0.375rem',
                display: 'inline-block',
                marginTop: '0.35rem',
              }}>
                Linked: {sourceBadge}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.25rem', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            padding: '0.65rem 0.85rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            borderRadius: '0.375rem',
            color: '#fca5a5',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Symbol & Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Symbol *</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="e.g. RELIANCE"
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Side *</label>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </div>
          </div>

          {/* Quantity & Entry Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Quantity *</label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Entry Price (₹) *</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Exit Price & Realized PnL */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Exit Price (₹)</label>
              <input
                type="number"
                step="any"
                value={exitPrice ?? ''}
                onChange={(e) => setExitPrice(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Realized P&L (₹)</label>
              <input
                type="number"
                step="any"
                value={realizedPnl ?? ''}
                onChange={(e) => setRealizedPnl(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Optional"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Result & Tags */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Result</label>
              <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              >
                <option value="OPEN">OPEN</option>
                <option value="WIN">WIN</option>
                <option value="LOSS">LOSS</option>
                <option value="BREAKEVEN">BREAKEVEN</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Tags</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. Momentum, Breakout"
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '0.375rem',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Journal Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add trade rationale, technical observations, or risk notes..."
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '0.375rem',
                color: '#ffffff',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Form Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '0.55rem 1.1rem',
                borderRadius: '0.375rem',
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#94a3b8',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '0.375rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.8125rem',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Saving Entry...' : 'Save Journal Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
