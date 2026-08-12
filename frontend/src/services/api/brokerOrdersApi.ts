import { BaseApi } from './BaseApi';
import {
  BrokerOrderCreateRequest,
  BrokerOrderModifyRequest,
  BrokerOrderCancelRequest,
  BrokerOrderResponse,
  BrokerOrderActionResultResponse,
} from '@/types/brokerOrder';

export class BrokerOrdersApi extends BaseApi {
  async createOrder(
    brokerId: string,
    payload: BrokerOrderCreateRequest
  ): Promise<BrokerOrderResponse> {
    return this.handleRequest<BrokerOrderResponse>(
      this.http.post(`/broker-orders/${brokerId}`, payload),
      false
    );
  }

  async updateOrder(
    brokerId: string,
    orderId: string,
    payload: BrokerOrderModifyRequest
  ): Promise<BrokerOrderActionResultResponse> {
    return this.handleRequest<BrokerOrderActionResultResponse>(
      this.http.put(`/broker-orders/${brokerId}/${orderId}`, payload),
      false
    );
  }

  async cancelOrder(
    brokerId: string,
    orderId: string,
    payload?: BrokerOrderCancelRequest
  ): Promise<BrokerOrderActionResultResponse> {
    return this.handleRequest<BrokerOrderActionResultResponse>(
      this.http.post(`/broker-orders/${brokerId}/${orderId}/cancel`, payload || { variety: 'regular' }),
      false
    );
  }

  async getOrders(brokerId: string): Promise<BrokerOrderResponse[]> {
    return this.handleRequest<BrokerOrderResponse[]>(
      this.http.get(`/broker-orders/${brokerId}`),
      false
    );
  }
}

export const brokerOrdersApi = new BrokerOrdersApi();
