import { BaseApi } from './BaseApi';
import {
  BrokerOrderCreateRequest,
  BrokerOrderModifyRequest,
  BrokerOrderCancelRequest,
  BrokerOrderResponse,
  BrokerOrderActionResultResponse,
  BrokerOrderLedgerResponse,
  TradingExecutionResponse,
  TradingPositionResponse,
} from '@/types/brokerOrder';
import { PortfolioValuation } from '@/types/portfolioValuation';

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

  async getExecutions(brokerId: string): Promise<TradingExecutionResponse[]> {
    return this.handleRequest<TradingExecutionResponse[]>(
      this.http.get(`/broker-orders/${brokerId}/executions`),
      false
    );
  }

  async getPortfolioValuation(brokerId: string): Promise<PortfolioValuation> {
    return this.handleRequest<PortfolioValuation>(
      this.http.get(`/broker-orders/${brokerId}/portfolio-valuation`),
      false
    );
  }

  async getPositions(brokerId: string): Promise<TradingPositionResponse[]> {
    return this.handleRequest<TradingPositionResponse[]>(
      this.http.get(`/broker-orders/${brokerId}/positions`),
      false
    );
  }

  async reconcileOrders(brokerId: string): Promise<BrokerOrderResponse[]> {
    return this.handleRequest<BrokerOrderResponse[]>(
      this.http.post(`/broker-orders/${brokerId}/reconcile`),
      false
    );
  }

  async getLedger(brokerId: string): Promise<BrokerOrderLedgerResponse[]> {
    const records = await this.handleRequest<Array<Omit<BrokerOrderLedgerResponse, 'order_id'>>>(
      this.http.get(`/broker-orders/${brokerId}/ledger`),
      false
    );
    return records.map((record) => ({ ...record, order_id: record.broker_order_id }));
  }

  async getOrders(brokerId: string): Promise<BrokerOrderResponse[]> {
    return this.handleRequest<BrokerOrderResponse[]>(
      this.http.get(`/broker-orders/${brokerId}`),
      false
    );
  }
}

export const brokerOrdersApi = new BrokerOrdersApi();

