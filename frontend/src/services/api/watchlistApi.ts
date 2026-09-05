import { BaseApi } from './BaseApi';

export interface ServerWatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  order_index: number;
  created_at: string;
}

export interface ServerWatchlist {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  items: ServerWatchlistItem[];
  created_at: string;
  updated_at?: string;
}


export interface WatchlistCreatePayload {
  name: string;
  is_default?: boolean;
}

class WatchlistApi extends BaseApi {
  async getWatchlists(): Promise<ServerWatchlist[]> {
    return this.handleRequest<ServerWatchlist[]>(this.http.get('/watchlists'), false);
  }

  async createWatchlist(payload: WatchlistCreatePayload): Promise<ServerWatchlist> {
    return this.handleRequest<ServerWatchlist>(this.http.post('/watchlists', payload), false);
  }

  async getWatchlist(id: string): Promise<ServerWatchlist> {
    return this.handleRequest<ServerWatchlist>(this.http.get(`/watchlists/${id}`), false);
  }

  async addItem(watchlistId: string, symbol: string): Promise<ServerWatchlistItem> {
    return this.handleRequest<ServerWatchlistItem>(
      this.http.post(`/watchlists/${watchlistId}/items`, { symbol }),
      false
    );
  }

  async removeItem(watchlistId: string, symbol: string): Promise<void> {
    await this.handleRequest<void>(
      this.http.delete(`/watchlists/${watchlistId}/items/${encodeURIComponent(symbol)}`),
      false
    );
  }

  async deleteWatchlist(watchlistId: string): Promise<void> {
    await this.handleRequest<void>(this.http.delete(`/watchlists/${watchlistId}`), false);
  }
}

export const watchlistApi = new WatchlistApi();
