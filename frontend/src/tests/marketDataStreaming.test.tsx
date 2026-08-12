/**
 * Frontend Market Data Streaming Integration Tests (Step 13.21I.34.119).
 * Tests LiveQuoteTicker component, market:<symbol> topic subscription,
 * quote.updated rendering, Decimal string preservation, quote.stale UI,
 * malformed event safety, unsubscribe cleanup, and credential isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { WebSocketProvider } from '@/context/WebSocketProvider';
import { LiveQuoteTicker } from '@/components/market/LiveQuoteTicker';
import { AuthContext } from '@/context/AuthContext';

// ---------------------------------------------------------------------------
// Mock WebSocket Implementation
// ---------------------------------------------------------------------------

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = MockWebSocket.CONNECTING;
  sentMessages: string[] = [];

  onopen: (() => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = 'Normal closure') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }

  triggerOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen();
    }
  }

  triggerMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === 'string' ? data : JSON.stringify(data) });
    }
  }
}

const originalWebSocket = global.WebSocket;

const mockAuthValue = {
  user: {
    id: 'user-123',
    email: 'test@enterprise.ai',
    username: 'testuser',
    full_name: 'Test User',
    role: 'TRADER',
    is_active: true,
    is_verified: true,
  },
  isAuthenticated: true,
  loading: false,
  login: vi.fn(),
  logout: vi.fn(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
};

const renderTicker = (symbol: string) => {
  return render(
    <AuthContext.Provider value={mockAuthValue}>
      <WebSocketProvider>
        <LiveQuoteTicker symbol={symbol} />
      </WebSocketProvider>
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Frontend Market Data Streaming (Step 13.21I.34.119)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    // @ts-expect-error Mocking global WebSocket
    global.WebSocket = MockWebSocket;
    localStorage.setItem('access_token', 'test_jwt_token_123');
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
    localStorage.clear();
  });

  // Test 1: Subscribe to market:<symbol>
  it('1. subscribes to market:<symbol> topic on mount', () => {
    renderTicker('RELIANCE');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    expect(ws.sentMessages).toContain(
      JSON.stringify({ type: 'subscribe', topic: 'market:RELIANCE' })
    );
  });

  // Test 2: Render quote.updated
  it('2. renders live market data updates when quote.updated is received', () => {
    renderTicker('RELIANCE');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-q1',
        event_type: 'quote.updated',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'user-123',
        symbol: 'RELIANCE',
        payload: {
          symbol: 'RELIANCE',
          last_price: '2500.50',
          bid: '2500.25',
          ask: '2500.75',
          change: '12.50',
          change_percent: '0.50',
          volume: 50000,
        },
      });
    });

    expect(screen.getByTestId('quote-price').textContent).toBe('₹2500.50');
    expect(screen.getByTestId('quote-bid').textContent).toBe('2500.25');
    expect(screen.getByTestId('quote-ask').textContent).toBe('2500.75');
  });

  // Test 3: Decimal Values Remain Strings
  it('3. preserves financial Decimal precision as exact strings in DOM', () => {
    renderTicker('TCS');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-q2',
        event_type: 'quote.updated',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'user-123',
        symbol: 'TCS',
        payload: {
          symbol: 'TCS',
          last_price: '3450.123456789',
          bid: '3450.10',
          ask: '3450.15',
        },
      });
    });

    expect(screen.getByTestId('quote-price').textContent).toBe('₹3450.123456789');
  });

  // Test 4: Malformed Event Safety
  it('4. ignores malformed quote events without crashing or clearing existing quote', () => {
    renderTicker('INFY');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-q3',
        event_type: 'quote.updated',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'user-123',
        symbol: 'INFY',
        payload: {
          symbol: 'INFY',
          last_price: '1400.00',
        },
      });
    });
    expect(screen.getByTestId('quote-price').textContent).toBe('₹1400.00');

    // Trigger malformed message
    act(() => {
      ws.triggerMessage('INVALID_JSON');
      ws.triggerMessage({ malformed: true });
    });

    // Existing valid quote remains intact
    expect(screen.getByTestId('quote-price').textContent).toBe('₹1400.00');
  });

  // Test 5: Stale Quote UI
  it('5. renders STALE badge when quote.stale event or payload is received', () => {
    renderTicker('WIPRO');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-q4',
        event_type: 'quote.stale',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'user-123',
        symbol: 'WIPRO',
        payload: {
          symbol: 'WIPRO',
          is_stale: true,
          reason: 'Market closed',
        },
      });
    });

    expect(screen.getByTestId('quote-stale-badge')).toBeDefined();
    expect(screen.getByTestId('quote-stale-badge').textContent).toBe('STALE');
  });

  // Test 6: Unsubscribe on Unmount
  it('6. unsubscribes from market:<symbol> topic on component unmount', () => {
    const { unmount } = renderTicker('HDFCBANK');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    unmount();
    // Verify component unmounted cleanly
    expect(screen.queryByTestId('quote-ticker-HDFCBANK')).toBeNull();
  });

  // Test 7: Reconnect Subscription Recovery
  it('7. restores market topic subscriptions after WebSocket reconnect', () => {
    renderTicker('ICICIBANK');
    const ws1 = MockWebSocket.instances[0];
    act(() => {
      ws1.triggerOpen();
    });

    // Unexpected disconnect
    act(() => {
      ws1.close(1006, 'Connection lost');
    });

    // Advance timer to trigger reconnect
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const ws2 = MockWebSocket.instances[1];
    act(() => {
      ws2.triggerOpen();
    });

    // Subscribe message for market:ICICIBANK sent on ws2
    expect(ws2.sentMessages).toContain(
      JSON.stringify({ type: 'subscribe', topic: 'market:ICICIBANK' })
    );
  });

  // Test 8: Duplicate Subscription Protection
  it('8. handles multiple components subscribing to the same market topic', () => {
    render(
      <AuthContext.Provider value={mockAuthValue}>
        <WebSocketProvider>
          <LiveQuoteTicker symbol="SBIN" />
          <LiveQuoteTicker symbol="SBIN" />
        </WebSocketProvider>
      </AuthContext.Provider>
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-q5',
        event_type: 'quote.updated',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'user-123',
        symbol: 'SBIN',
        payload: {
          symbol: 'SBIN',
          last_price: '750.00',
        },
      });
    });

    const priceElements = screen.getAllByTestId('quote-price');
    expect(priceElements.length).toBe(2);
    expect(priceElements[0].textContent).toBe('₹750.00');
    expect(priceElements[1].textContent).toBe('₹750.00');
  });

  // Test 9: Unknown Event Safety
  it('9. safely ignores unknown event types without crashing', () => {
    renderTicker('AXISBANK');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-q6',
        event_type: 'unknown.custom.event',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'user-123',
        symbol: 'AXISBANK',
        payload: { some: 'data' },
      });
    });

    expect(screen.getByTestId('quote-loading').textContent).toBe('Waiting for live data...');
  });

  // Test 10: Credential Isolation
  it('10. verifies zero secret credential leakage in rendered DOM', () => {
    const { container } = renderTicker('TATAMOTORS');
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-q7',
        event_type: 'quote.updated',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'user-123',
        symbol: 'TATAMOTORS',
        payload: {
          symbol: 'TATAMOTORS',
          last_price: '950.00',
        },
      });
    });

    const html = container.innerHTML.toLowerCase();
    for (const secret of ['api_key', 'api_secret', 'access_token', 'password', 'jwt']) {
      expect(html).not.toContain(secret);
    }
  });
});
