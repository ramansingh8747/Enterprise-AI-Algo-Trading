import { BaseApi } from './BaseApi';
import { BrokerProfile, BrokerHolding, BrokerPosition, BrokerOrder, BrokerQuote } from '@/types/brokerData';

export class BrokerDataApi extends BaseApi {
  async getProfile(brokerId: string): Promise<BrokerProfile> {
    return this.handleRequest<BrokerProfile>(
      this.http.get(`/broker-data/${brokerId}/profile`),
      false
    );
  }

  async getHoldings(brokerId: string): Promise<BrokerHolding[]> {
    return this.handleRequest<BrokerHolding[]>(
      this.http.get(`/broker-data/${brokerId}/holdings`),
      false
    );
  }

  async getPositions(brokerId: string): Promise<BrokerPosition[]> {
    return this.handleRequest<BrokerPosition[]>(
      this.http.get(`/broker-data/${brokerId}/positions`),
      false
    );
  }

  async getOrders(brokerId: string): Promise<BrokerOrder[]> {
    return this.handleRequest<BrokerOrder[]>(
      this.http.get(`/broker-data/${brokerId}/orders`),
      false
    );
  }

  async getQuotes(brokerId: string, symbols: string[]): Promise<BrokerQuote[]> {
    const params = new URLSearchParams();
    symbols.forEach((sym) => params.append('symbols', sym));

    return this.handleRequest<BrokerQuote[]>(
      this.http.get(`/broker-data/${brokerId}/quotes?${params.toString()}`),
      false
    );
  }
}

export const brokerDataApi = new BrokerDataApi();
