/**
 * Custom hook for subscribing to a WebSocket topic (Step 13.21I.34.118).
 * Subscribes to the specified topic on mount/topic change and unsubscribes on unmount/topic change.
 * Maintains current callback reference via useRef to prevent resubscription loops.
 */

import { useEffect, useRef } from 'react';
import { useWebSocketContext } from '@/context/WebSocketProvider';
import { WebSocketEventCallback } from '@/types/websocket';

export function useWebSocketSubscription(
  topic: string,
  callback: WebSocketEventCallback
): void {
  const { subscribe } = useWebSocketContext();
  const callbackRef = useRef<WebSocketEventCallback>(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!topic) return;

    const unsubscribe = subscribe(topic, (event) => {
      if (callbackRef.current) {
        callbackRef.current(event);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [topic, subscribe]);
}
