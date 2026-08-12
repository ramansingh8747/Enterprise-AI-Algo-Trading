export type AlertType = 'RISK' | 'PORTFOLIO' | 'PNL' | 'SIGNAL' | 'ORDER' | 'BROKER' | 'SYSTEM' | 'ACTIVITY';
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'SUCCESS';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  route?: string;
  symbol?: string;
  metadata?: Record<string, any>;
}
