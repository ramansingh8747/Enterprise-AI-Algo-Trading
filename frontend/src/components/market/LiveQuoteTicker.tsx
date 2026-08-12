/**
 * Live Quote Ticker Component (Step 13.21I.34.119).
 * Subscribes to `market:<symbol>` topic using `useWebSocketSubscription` and renders
 * real-time market data updates, string-safe Decimal prices, and Stale Data Guard status.
 */

import React, { useState, useCallback } from 'react';
import { useWebSocketSubscription } from '@/hooks/useWebSocketSubscription';
import { useWebSocketContext } from '@/context/WebSocketProvider';
import { WebSocketEvent } from '@/types/websocket';

export interface MarketQuotePayload {
  symbol: string;
  last_price?: string;
  bid?: string;
  ask?: string;
  change?: string;
  change_percent?: string;
  volume?: number;
  timestamp?: string;
  is_stale?: boolean;
  reason?: string;
}

export interface LiveQuoteTickerProps {
  symbol: string;
  className?: string;
  showDetails?: boolean;
}

export const LiveQuoteTicker: React.FC<LiveQuoteTickerProps> = ({
  symbol,
  className = '',
  showDetails = true,
}) => {
  const normSymbol = (symbol || '').trim().toUpperCase();
  const topic = normSymbol ? `market:${normSymbol}` : '';

  const { state: connectionState } = useWebSocketContext();
  const [quote, setQuote] = useState<MarketQuotePayload | null>(null);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [staleReason, setStaleReason] = useState<string | null>(null);

  const handleQuoteEvent = useCallback(
    (event: WebSocketEvent<Record<string, unknown>>) => {
      if (!event || typeof event !== 'object') return;

      if (event.event_type === 'quote.stale') {
        setIsStale(true);
        setStaleReason(
          typeof event.payload?.reason === 'string'
            ? event.payload.reason
            : 'Quote data stale'
        );
        return;
      }

      if (event.event_type === 'quote.updated') {
        const payload = event.payload as unknown as MarketQuotePayload;
        if (!payload || typeof payload !== 'object') return;

        setQuote({
          symbol: normSymbol,
          last_price: payload.last_price,
          bid: payload.bid,
          ask: payload.ask,
          change: payload.change,
          change_percent: payload.change_percent,
          volume: payload.volume,
          timestamp: payload.timestamp || event.timestamp,
          is_stale: payload.is_stale || false,
        });

        if (payload.is_stale) {
          setIsStale(true);
          setStaleReason(payload.reason || 'Quote marked stale by provider');
        } else {
          setIsStale(false);
          setStaleReason(null);
        }
      }
    },
    [normSymbol]
  );

  // Subscribe to market:<symbol> topic via custom hook
  useWebSocketSubscription(topic, handleQuoteEvent);

  if (!normSymbol) {
    return (
      <div className={`live-quote-ticker live-quote-error ${className}`}>
        No symbol specified
      </div>
    );
  }

  return (
    <div
      className={`live-quote-ticker ${isStale ? 'is-stale' : ''} ${className}`}
      data-testid={`quote-ticker-${normSymbol}`}
    >
      <div className="quote-header">
        <span className="quote-symbol" data-testid="quote-symbol">
          {normSymbol}
        </span>
        {isStale && (
          <span
            className="quote-stale-badge"
            data-testid="quote-stale-badge"
            title={staleReason || 'Stale Quote'}
          >
            STALE
          </span>
        )}
        {connectionState === 'RECONNECTING' && (
          <span className="quote-reconnecting-badge" data-testid="quote-reconnecting">
            RECONNECTING...
          </span>
        )}
      </div>

      {!quote ? (
        <div className="quote-loading" data-testid="quote-loading">
          Waiting for live data...
        </div>
      ) : (
        <div className="quote-body">
          <div className="quote-price-main">
            <span className="quote-price-label">Price: </span>
            <span className="quote-price-value" data-testid="quote-price">
              {quote.last_price ? `₹${quote.last_price}` : 'N/A'}
            </span>
            {quote.change && (
              <span
                className={`quote-change ${
                  parseFloat(quote.change) >= 0 ? 'positive' : 'negative'
                }`}
                data-testid="quote-change"
              >
                {quote.change} ({quote.change_percent}%)
              </span>
            )}
          </div>

          {showDetails && (
            <div className="quote-details" data-testid="quote-details">
              {quote.bid && (
                <span className="quote-detail-item">
                  Bid: <strong data-testid="quote-bid">{quote.bid}</strong>
                </span>
              )}
              {quote.ask && (
                <span className="quote-detail-item">
                  Ask: <strong data-testid="quote-ask">{quote.ask}</strong>
                </span>
              )}
              {quote.volume !== undefined && quote.volume !== null && (
                <span className="quote-detail-item">
                  Vol: <strong data-testid="quote-volume">{quote.volume}</strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
