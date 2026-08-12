/**
 * Frontend WebSocket Provider & Context (Step 13.21I.34.118).
 * Manages WebSocket connection lifecycle, connection state, reconnect with exponential
 * backoff + jitter, heartbeat ping/pong, topic subscription registry, and fail-safe event routing.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  WebSocketConnectionState,
  WebSocketEventCallback,
  isValidWebSocketEvent,
} from '@/types/websocket';

export interface WebSocketContextValue {
  state: WebSocketConnectionState;
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string, callback: WebSocketEventCallback) => () => void;
}

export const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;

export const getWebSocketUrl = (token?: string | null): string => {
  const envApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  let wsUrl = envApiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');

  // Strip trailing slash if present
  if (wsUrl.endsWith('/')) {
    wsUrl = wsUrl.slice(0, -1);
  }

  // If path doesn't end with /ws or /api/v1/ws, append route
  if (!wsUrl.includes('/ws')) {
    wsUrl = `${wsUrl}/ws`;
  }

  if (token) {
    const urlObj = new URL(wsUrl, window.location.origin.replace(/^http/, 'ws'));
    urlObj.searchParams.set('token', token);
    return urlObj.toString();
  }

  return wsUrl;
};

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [state, setState] = useState<WebSocketConnectionState>('DISCONNECTED');

  const socketRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Map<string, Set<WebSocketEventCallback>>>(new Map());
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const isIntentionalDisconnectRef = useRef<boolean>(false);

  // Clear timers helper
  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  // Heartbeat helper
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    heartbeatTimerRef.current = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Fail silently on send error; socket onclose will handle reconnect
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, []);

  // Connect function
  const connect = useCallback(() => {
    clearTimers();
    isIntentionalDisconnectRef.current = false;

    if (socketRef.current) {
      if (
        socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING
      ) {
        return;
      }
      socketRef.current.close();
      socketRef.current = null;
    }

    setState((prev) => (prev === 'RECONNECTING' ? 'RECONNECTING' : 'CONNECTING'));

    const token = localStorage.getItem('access_token');
    const wsUrl = getWebSocketUrl(token);

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        retryCountRef.current = 0;
        setState('CONNECTED');
        startHeartbeat();

        // Restore active subscriptions on server after connection open
        subscriptionsRef.current.forEach((_, topic) => {
          try {
            ws.send(JSON.stringify({ type: 'subscribe', topic }));
          } catch {
            // Ignore send error
          }
        });
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // Handle heartbeat response
          if (data && data.type === 'pong') {
            return;
          }

          // Handle server error events
          if (data && data.event_type === 'error') {
            return;
          }

          if (isValidWebSocketEvent(data)) {
            // Route to subscribers by topic
            const matchingTopics: string[] = [];

            if (data.strategy_instance_id) {
              matchingTopics.push(`strategy:${data.strategy_instance_id}`);
              if (data.execution_mode) {
                matchingTopics.push(
                  `${data.execution_mode.toLowerCase()}:strategy:${data.strategy_instance_id}`
                );
              }
            }
            if (data.symbol) {
              matchingTopics.push(`market:${data.symbol.toUpperCase()}`);
            }

            // Also check for direct topic property if provided
            if ((data as unknown as Record<string, unknown>).topic) {
              matchingTopics.push(
                String((data as unknown as Record<string, unknown>).topic)
              );
            }

            // Forward event to callbacks of matching topics
            const notifiedCallbacks = new Set<WebSocketEventCallback>();

            matchingTopics.forEach((topicKey) => {
              const callbacks = subscriptionsRef.current.get(topicKey);
              if (callbacks) {
                callbacks.forEach((cb) => notifiedCallbacks.add(cb));
              }
            });

            notifiedCallbacks.forEach((cb) => {
              try {
                cb(data);
              } catch {
                // Isolate subscriber callback failure
              }
            });
          }
        } catch {
          // Malformed JSON ignored safely
        }
      };

      ws.onerror = () => {
        setState('ERROR');
      };

      ws.onclose = () => {
        clearTimers();
        socketRef.current = null;

        if (isIntentionalDisconnectRef.current) {
          setState('DISCONNECTED');
        } else {
          setState('RECONNECTING');
          const delay = Math.min(
            BASE_RETRY_DELAY_MS * 2 ** retryCountRef.current,
            MAX_RETRY_DELAY_MS
          );
          const jitter = Math.random() * 500;
          retryCountRef.current += 1;

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, delay + jitter);
        }
      };
    } catch {
      setState('ERROR');
    }
  }, [clearTimers, startHeartbeat]);

  // Disconnect function (intentional)
  const disconnect = useCallback(() => {
    isIntentionalDisconnectRef.current = true;
    clearTimers();
    retryCountRef.current = 0;

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setState('DISCONNECTED');
  }, [clearTimers]);

  // Subscribe function
  const subscribe = useCallback(
    (topic: string, callback: WebSocketEventCallback): (() => void) => {
      let callbacks = subscriptionsRef.current.get(topic);
      if (!callbacks) {
        callbacks = new Set();
        subscriptionsRef.current.set(topic, callbacks);
      }

      callbacks.add(callback);

      // Send subscribe frame if socket is connected
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        try {
          socketRef.current.send(JSON.stringify({ type: 'subscribe', topic }));
        } catch {
          // Ignore send error
        }
      }

      // Return unsubscribe cleanup function
      return () => {
        const topicCallbacks = subscriptionsRef.current.get(topic);
        if (topicCallbacks) {
          topicCallbacks.delete(callback);
          if (topicCallbacks.size === 0) {
            subscriptionsRef.current.delete(topic);
          }
        }
      };
    },
    []
  );

  // Auto connect/disconnect on auth state changes
  useEffect(() => {
    if (isAuthenticated) {
      connect();
    } else {
      disconnect();
    }

    const currentSubs = subscriptionsRef.current;
    return () => {
      clearTimers();
      if (socketRef.current) {
        isIntentionalDisconnectRef.current = true;
        socketRef.current.close();
        socketRef.current = null;
      }
      currentSubs.clear();
    };
  }, [isAuthenticated, connect, disconnect, clearTimers]);

  return (
    <WebSocketContext.Provider
      value={{
        state,
        connect,
        disconnect,
        subscribe,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};
