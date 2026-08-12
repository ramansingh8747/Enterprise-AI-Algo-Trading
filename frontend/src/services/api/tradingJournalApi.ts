import { BaseApi } from './BaseApi';
import { TradingJournalEntry } from '@/types/tradingJournal';

// Define these locally to avoid changing frozen types, they match the backend Schema
export interface TradingJournalEntryCreate {
  symbol: string;
  side: string;
  quantity: number;
  entry_price: number;
  exit_price?: number;
  realized_pnl?: number;
  result?: string;
  notes?: string;
  tags?: string;
  paper_trade_id?: string;
  broker_order_id?: string;
  strategy_instance_id?: string;
  strategy_signal_id?: string;
}

export type TradingJournalEntryUpdate = TradingJournalEntryCreate;

class TradingJournalApi extends BaseApi {
  constructor() {
    super();
    this.http.defaults.baseURL += '/trading-journal';
  }

  async createEntry(entry: TradingJournalEntryCreate): Promise<TradingJournalEntry> {
    return this.handleRequest<TradingJournalEntry>(this.http.post('', entry));
  }

  async listEntries(params?: {
    paper_trade_id?: string;
    broker_order_id?: string;
    strategy_instance_id?: string;
    strategy_signal_id?: string;
    symbol?: string;
    side?: string;
  }): Promise<TradingJournalEntry[]> {
    return this.handleRequest<TradingJournalEntry[]>(this.http.get('', { params }));
  }


  async getEntry(id: string): Promise<TradingJournalEntry> {
    return this.handleRequest<TradingJournalEntry>(this.http.get(`/${id}`));
  }

  async updateEntry(id: string, entry: TradingJournalEntryUpdate): Promise<TradingJournalEntry> {
    return this.handleRequest<TradingJournalEntry>(this.http.patch(`/${id}`, entry));
  }

  async deleteEntry(id: string): Promise<void> {
    await this.handleRequest<void>(this.http.delete(`/${id}`));
  }
}

export const tradingJournalApi = new TradingJournalApi();
