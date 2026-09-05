import { BaseApi } from "./BaseApi";

export interface ServerAlert {
  id: string;
  user_id: string;
  type: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "DANGER" | string;
  title: string;
  message: string;
  read: boolean;
  route?: string | null;
  created_at: string;
}

export interface CreateAlertPayload {
  type?: string;
  severity?: string;
  title: string;
  message: string;
  route?: string;
}

export class AlertsApi extends BaseApi {
  public async getAlerts(unreadOnly: boolean = false): Promise<ServerAlert[]> {
    return this.handleRequest<ServerAlert[]>(
      this.http.get("/alerts", { params: { unread_only: unreadOnly } })
    );
  }

  public async createAlert(payload: CreateAlertPayload): Promise<ServerAlert> {
    return this.handleRequest<ServerAlert>(this.http.post("/alerts", payload));
  }

  public async markAsRead(alertId: string): Promise<ServerAlert> {
    return this.handleRequest<ServerAlert>(this.http.patch(`/alerts/${alertId}/read`));
  }

  public async markAllAsRead(): Promise<{ success: boolean; marked_count: number }> {
    return this.handleRequest<{ success: boolean; marked_count: number }>(
      this.http.post("/alerts/mark-all-read")
    );
  }

  public async deleteAlert(alertId: string): Promise<void> {
    await this.handleRequest<void>(this.http.delete(`/alerts/${alertId}`));
  }

  public async clearAllAlerts(): Promise<void> {
    await this.handleRequest<void>(this.http.delete("/alerts"));
  }
}

export const alertsApi = new AlertsApi();
