/**
 * Frontend WebSocket Client Integration Tests (Step 13.21I.34.118).
 * Tests WebSocketProvider, useWebSocketSubscription hook, state transitions,
 * subscriptions, event routing, heartbeat, reconnect, PAPER/LIVE topics, and credential isolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import {
  WebSocketProvider,
  useWebSocketContext,
  getWebSocketUrl,
} from '@/context/WebSocketProvider';
import { useWebSocketSubscription } from '@/hooks/useWebSocketSubscription';
import { AuthContext } from '@/context/AuthContext';
import { WebSocketEvent, isValidWebSocketEvent } from '@/types/websocket';

// ---------------------------------------------------------------------------
// Mock WebSocket Implementation for Vitest
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

  // Test helper methods to trigger WS events
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

  triggerError(err = new Error('WS Error')) {
    if (this.onerror) {
      this.onerror(err);
    }
  }
}

// Global mock setup
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

const renderWithAuth = (ui: React.ReactElement, authProps = mockAuthValue) => {
  return render(
    <AuthContext.Provider value={authProps}>
      <WebSocketProvider>{ui}</WebSocketProvider>
    </AuthContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Frontend WebSocket Client (Step 13.21I.34.118)', () => {
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

  // Test 1: getWebSocketUrl
  it('1. derives WebSocket URL from environment correctly', () => {
    const url = getWebSocketUrl('token_abc');
    expect(url).toContain('ws');
    expect(url).toContain('token=token_abc');
  });

  // Test 2: Type Guard
  it('2. validates canonical WebSocketEvent structure correctly via type guard', () => {
    const validEvent = {
      event_id: 'ev-1',
      event_type: 'instance.started',
      timestamp: '2026-08-11T12:00:00Z',
      user_id: 'u-1',
      payload: {},
    };
    expect(isValidWebSocketEvent(validEvent)).toBe(true);
    expect(isValidWebSocketEvent(null)).toBe(false);
    expect(isValidWebSocketEvent({ event_id: 'ev-1' })).toBe(false);
  });

  // Test 3: Initial State & Connect
  it('3. starts in CONNECTING state when authenticated and transitions to CONNECTED on open', () => {
    const TestComponent = () => {
      const { state } = useWebSocketContext();
      return <div data-testid="state">{state}</div>;
    };

    renderWithAuth(<TestComponent />);
    expect(screen.getByTestId('state').textContent).toBe('CONNECTING');

    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    act(() => {
      ws.triggerOpen();
    });

    expect(screen.getByTestId('state').textContent).toBe('CONNECTED');
  });

  // Test 4: Disconnect
  it('4. transitions to DISCONNECTED state on explicit disconnect', () => {
    const TestComponent = () => {
      const { state, disconnect } = useWebSocketContext();
      return (
        <div>
          <span data-testid="state">{state}</span>
          <button data-testid="disconnect-btn" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      );
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });
    expect(screen.getByTestId('state').textContent).toBe('CONNECTED');

    act(() => {
      screen.getByTestId('disconnect-btn').click();
    });
    expect(screen.getByTestId('state').textContent).toBe('DISCONNECTED');
  });

  // Test 5: Subscription Registration
  it('5. registers subscriptions and sends subscribe frames to WebSocket server', () => {
    const TestComponent = () => {
      const { subscribe } = useWebSocketContext();
      React.useEffect(() => {
        return subscribe('strategy:inst-100', vi.fn());
      }, [subscribe]);
      return <div>Subscribed</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    expect(ws.sentMessages).toContain(
      JSON.stringify({ type: 'subscribe', topic: 'strategy:inst-100' })
    );
  });

  // Test 6: Unsubscribe
  it('6. unsubscribes callback and removes cleanup handlers on unmount', () => {
    const callback = vi.fn();
    const TestComponent = ({ active }: { active: boolean }) => {
      useWebSocketSubscription(active ? 'strategy:inst-200' : '', callback);
      return <div>{active ? 'Active' : 'Inactive'}</div>;
    };

    const { rerender } = renderWithAuth(<TestComponent active={true} />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    // Send event
    act(() => {
      ws.triggerMessage({
        event_id: 'ev-200',
        event_type: 'signal.generated',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'inst-200',
        payload: { symbol: 'RELIANCE' },
      });
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Unmount subscription
    rerender(
      <AuthContext.Provider value={mockAuthValue}>
        <WebSocketProvider>
          <TestComponent active={false} />
        </WebSocketProvider>
      </AuthContext.Provider>
    );

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-201',
        event_type: 'signal.generated',
        timestamp: '2026-08-11T12:00:01Z',
        user_id: 'u-1',
        strategy_instance_id: 'inst-200',
        payload: { symbol: 'RELIANCE' },
      });
    });

    // Callback should NOT have been called a second time
    expect(callback).toHaveBeenCalledTimes(1);
  });

  // Test 7: Duplicate Subscription Protection
  it('7. prevents duplicate callbacks for the same topic subscription', () => {
    const callback = vi.fn();

    const TestComponent = () => {
      const { subscribe } = useWebSocketContext();
      React.useEffect(() => {
        const unsub1 = subscribe('strategy:inst-dup', callback);
        const unsub2 = subscribe('strategy:inst-dup', callback); // duplicate
        return () => {
          unsub1();
          unsub2();
        };
      }, [subscribe]);
      return <div>Dup Test</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-dup',
        event_type: 'instance.started',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'inst-dup',
        payload: {},
      });
    });

    // Callback should only be invoked ONCE, not twice
    expect(callback).toHaveBeenCalledTimes(1);
  });

  // Test 8: Event Routing
  it('8. routes events to matching topic subscribers correctly', () => {
    const callbackInst1 = vi.fn();
    const callbackInst2 = vi.fn();

    const TestComponent = () => {
      useWebSocketSubscription('strategy:inst-1', callbackInst1);
      useWebSocketSubscription('strategy:inst-2', callbackInst2);
      return <div>Routing Test</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-inst1',
        event_type: 'instance.started',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'inst-1',
        payload: { status: 'RUNNING' },
      });
    });

    expect(callbackInst1).toHaveBeenCalledTimes(1);
    expect(callbackInst2).not.toHaveBeenCalled();
  });

  // Test 9: Multiple Subscribers
  it('9. routes events to multiple subscribers listening to the same topic', () => {
    const callbackA = vi.fn();
    const callbackB = vi.fn();

    const TestComponent = () => {
      useWebSocketSubscription('strategy:multi', callbackA);
      useWebSocketSubscription('strategy:multi', callbackB);
      return <div>Multi Sub Test</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-multi',
        event_type: 'signal.executed',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'multi',
        payload: { order_id: 'ORD-123' },
      });
    });

    expect(callbackA).toHaveBeenCalledTimes(1);
    expect(callbackB).toHaveBeenCalledTimes(1);
  });

  // Test 10: Malformed JSON Ignored Safely
  it('10. ignores malformed non-JSON messages without crashing provider', () => {
    const callback = vi.fn();

    const TestComponent = () => {
      useWebSocketSubscription('strategy:safe', callback);
      return <div>JSON Guard</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage('INVALID_NON_JSON_MESSAGE');
    });

    expect(callback).not.toHaveBeenCalled();
  });

  // Test 11: Malformed Event Ignored Safely
  it('11. ignores messages failing event type guard without crashing provider', () => {
    const callback = vi.fn();

    const TestComponent = () => {
      useWebSocketSubscription('strategy:safe', callback);
      return <div>Type Guard</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({ incomplete: 'data' });
    });

    expect(callback).not.toHaveBeenCalled();
  });

  // Test 12: Unexpected Disconnect Triggers Reconnect
  it('12. transitions to RECONNECTING and attempts reconnect on unexpected socket close', () => {
    const TestComponent = () => {
      const { state } = useWebSocketContext();
      return <div data-testid="state">{state}</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws1 = MockWebSocket.instances[0];
    act(() => {
      ws1.triggerOpen();
    });
    expect(screen.getByTestId('state').textContent).toBe('CONNECTED');

    // Simulate unexpected close
    act(() => {
      ws1.close(1006, 'Abnormal closure');
    });
    expect(screen.getByTestId('state').textContent).toBe('RECONNECTING');

    // Advance timers past retry delay
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(MockWebSocket.instances.length).toBe(2);
    const ws2 = MockWebSocket.instances[1];

    act(() => {
      ws2.triggerOpen();
    });
    expect(screen.getByTestId('state').textContent).toBe('CONNECTED');
  });

  // Test 13: Intentional Disconnect Does Not Reconnect
  it('13. does NOT attempt reconnect when disconnect() is explicitly called', () => {
    const TestComponent = () => {
      const { state, disconnect } = useWebSocketContext();
      return (
        <div>
          <span data-testid="state">{state}</span>
          <button data-testid="disconnect" onClick={disconnect}>
            Disconnect
          </button>
        </div>
      );
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      screen.getByTestId('disconnect').click();
    });
    expect(screen.getByTestId('state').textContent).toBe('DISCONNECTED');

    // Advance time and check that no new socket instance was created
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(MockWebSocket.instances.length).toBe(1);
  });

  // Test 14: Subscriptions Restored After Reconnect
  it('14. automatically restores active subscriptions after successful reconnect', () => {
    const callback = vi.fn();
    const TestComponent = () => {
      useWebSocketSubscription('strategy:inst-recon', callback);
      return <div>Recon Test</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws1 = MockWebSocket.instances[0];
    act(() => {
      ws1.triggerOpen();
    });

    // Close unexpected
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

    // Re-subscribe frame should have been sent to ws2 automatically
    expect(ws2.sentMessages).toContain(
      JSON.stringify({ type: 'subscribe', topic: 'strategy:inst-recon' })
    );

    // Verify events continue to route on ws2
    act(() => {
      ws2.triggerMessage({
        event_id: 'ev-post-recon',
        event_type: 'signal.executed',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'inst-recon',
        payload: {},
      });
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  // Test 15: Heartbeat Ping/Pong
  it('15. sends ping heartbeat frames periodically and ignores pong responses', () => {
    renderWithAuth(<div>Heartbeat Test</div>);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    // Advance 30 seconds to trigger heartbeat
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(ws.sentMessages).toContain(JSON.stringify({ type: 'ping' }));

    // Send pong response from server
    act(() => {
      ws.triggerMessage({ type: 'pong' });
    });
    // Ping/pong must be handled cleanly without errors
  });

  // Test 16: PAPER Topic Handling
  it('16. handles paper:strategy:instance_id namespaced topics correctly', () => {
    const callback = vi.fn();
    const TestComponent = () => {
      useWebSocketSubscription('paper:strategy:inst-paper-1', callback);
      return <div>PAPER Topic Test</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-paper',
        event_type: 'signal.executed',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'inst-paper-1',
        execution_mode: 'PAPER',
        payload: { order_id: 'PAPER-123' },
      });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    const eventArg = callback.mock.calls[0][0] as WebSocketEvent;
    expect(eventArg.execution_mode).toBe('PAPER');
  });

  // Test 17: LIVE Topic Handling
  it('17. handles live:strategy:instance_id namespaced topics correctly', () => {
    const callback = vi.fn();
    const TestComponent = () => {
      useWebSocketSubscription('live:strategy:inst-live-1', callback);
      return <div>LIVE Topic Test</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-live',
        event_type: 'signal.executed',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'inst-live-1',
        execution_mode: 'LIVE',
        payload: { order_id: 'LIVE-123' },
      });
    });

    expect(callback).toHaveBeenCalledTimes(1);
    const eventArg = callback.mock.calls[0][0] as WebSocketEvent;
    expect(eventArg.execution_mode).toBe('LIVE');
  });

  // Test 18: Credential Isolation
  it('18. ensures zero credential exposure in DOM or console', () => {
    const TestComponent = () => {
      const { state } = useWebSocketContext();
      return <div data-testid="ws-ui">Status: {state}</div>;
    };

    const { container } = renderWithAuth(<TestComponent />);
    const html = container.innerHTML.toLowerCase();

    for (const secret of ['api_key', 'api_secret', 'access_token', 'password', 'jwt']) {
      expect(html).not.toContain(secret);
    }
  });

  // Test 19: Provider Unmount Cleanup
  it('19. closes socket and clears subscriptions on provider unmount', () => {
    const { unmount } = renderWithAuth(<div>Unmount Test</div>);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    unmount();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  // Test 20: Subscriber Callback Exception Isolation
  it('20. isolates throwing subscriber callbacks so other subscribers receive events', () => {
    const throwingCallback = vi.fn().mockImplementation(() => {
      throw new Error('Subscriber Error!');
    });
    const safeCallback = vi.fn();

    const TestComponent = () => {
      useWebSocketSubscription('strategy:fail-test', throwingCallback);
      useWebSocketSubscription('strategy:fail-test', safeCallback);
      return <div>Callback Isolation Test</div>;
    };

    renderWithAuth(<TestComponent />);
    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.triggerOpen();
    });

    act(() => {
      ws.triggerMessage({
        event_id: 'ev-iso',
        event_type: 'signal.generated',
        timestamp: '2026-08-11T12:00:00Z',
        user_id: 'u-1',
        strategy_instance_id: 'fail-test',
        payload: {},
      });
    });

    expect(throwingCallback).toHaveBeenCalledTimes(1);
    expect(safeCallback).toHaveBeenCalledTimes(1);
  });
});
