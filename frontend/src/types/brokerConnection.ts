export type BrokerType = "zerodha" | "angelone";

export type BrokerConnectionStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error";

export interface BrokerConnection {
  brokerType: BrokerType;
  brokerName: string;
  status: BrokerConnectionStatus;
  accountId?: string;
  clientName?: string;
  connectedAt?: string;
  message?: string;
  isDemo?: boolean;
}

export interface BrokerConnectionRequest {
  brokerType: BrokerType;
  apiKey?: string;
  apiSecret?: string;
  redirectUrl?: string;
  clientId?: string;
}
