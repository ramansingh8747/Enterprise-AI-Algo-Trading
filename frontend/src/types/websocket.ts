/**
 * Frontend WebSocket Type Definitions & Contract (Step 13.21I.34.118).
 * Defines connection states, canonical event envelope, payload structures,
 * message types, callbacks, and type guard helper.
 */

export type WebSocketConnectionState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING"
  | "ERROR";

export interface WebSocketEvent<T = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  timestamp: string;
  user_id: string;
  broker_id?: string;
  strategy_id?: string;
  strategy_instance_id?: string;
  symbol?: string;
  execution_mode?: string;
  payload: T;
}

export interface WebSocketErrorEvent {
  event_type: "error";
  payload: {
    message: string;
    code?: string | number;
  };
}

export type WebSocketMessage<T = Record<string, unknown>> =
  | WebSocketEvent<T>
  | WebSocketErrorEvent;

export type WebSocketEventCallback<T = Record<string, unknown>> = (
  event: WebSocketEvent<T>
) => void;

/**
 * Type guard for validating canonical WebSocketEvent structure.
 */
export function isValidWebSocketEvent(value: unknown): value is WebSocketEvent {
  if (!value || typeof value !== "object") {
    return false;
  }

  const event = value as Record<string, unknown>;

  return (
    typeof event.event_id === "string" &&
    typeof event.event_type === "string" &&
    typeof event.timestamp === "string" &&
    typeof event.user_id === "string"
  );
}
