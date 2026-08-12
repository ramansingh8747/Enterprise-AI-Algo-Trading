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
  constructor() {
    super();
    this.http.defaults.baseURL += "/alerts";
  }

  public async getAlerts(unreadOnly: boolean = false): Promise<ServerAlert[]> {
    return this.handleRequest<ServerAlert[]>(
      this.http.get("", { params: { unread_only: unreadOnly } })
    );
  }

  public async createAlert(payload: CreateAlertPayload): Promise<ServerAlert> {
    return this.handleRequest<ServerAlert>(this.http.post("", payload));
  }

  public async markAsRead(alertId: string): Promise<ServerAlert> {
    return this.handleRequest<ServerAlert>(this.http.patch(`/${alertId}/read`));
  }

  public async markAllAsRead(): Promise<{ success: boolean; marked_count: number }> {
    return this.handleRequest<{ success: boolean; marked_count: number }>(
      this.http.post("/mark-all-read")
    );
  }

  public async deleteAlert(alertId: string): Promise<void> {
    await this.handleRequest<void>(this.http.delete(`/${alertId}`));
  }

  public async clearAllAlerts(): Promise<void> {
    await this.handleRequest<void>(this.http.delete(""));
  }
}

export const alertsApi = new AlertsApi();
