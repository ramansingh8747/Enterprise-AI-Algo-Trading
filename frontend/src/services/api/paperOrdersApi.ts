import { BaseApi } from './BaseApi';
import { PaperOrder, PaperOrderCreateRequest } from '@/types/paperOrder';

export class PaperOrdersApi extends BaseApi {
  async createOrder(payload: PaperOrderCreateRequest): Promise<PaperOrder> {
    return this.handleRequest<PaperOrder>(this.http.post('/paper-orders', payload), false);
  }

  async listOrders(limit = 100): Promise<PaperOrder[]> {
    return this.handleRequest<PaperOrder[]>(
      this.http.get('/paper-orders', { params: { limit } }),
      false
    );
  }
}

export const paperOrdersApi = new PaperOrdersApi();
