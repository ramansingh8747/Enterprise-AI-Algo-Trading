import { BaseApi } from './BaseApi';
import { MarketIndex } from '@/types/market';

export interface LiveCandle {
  timestamp: number;
  date: string;
  dateLabel?: string | null;
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LiveMarketResponse {
  symbol: string;
  ticker: string;
  currency: string;
  regularMarketPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
  candles: LiveCandle[];
}

class MarketApi extends BaseApi {
  async getLiveCandles(symbol: string, interval = '5m', range = '2d'): Promise<LiveMarketResponse> {
    return this.handleRequest<LiveMarketResponse>(
      this.http.get(`/market-data/candles?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`),
      false
    );
  }

  async getLiveIndices(): Promise<MarketIndex[]> {
    return this.handleRequest<MarketIndex[]>(
      this.http.get('/market-data/indices'),
      false
    );
  }
}

export const marketApi = new MarketApi();
