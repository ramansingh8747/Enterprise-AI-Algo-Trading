import { BaseApi } from './BaseApi';
import { SearchResult } from '@/types/globalSearch';

export interface GlobalSearchResponseDto {
  query: string;
  total_results: number;
  results: SearchResult[];
}

export class SearchApi extends BaseApi {
  public async search(query: string, category?: string): Promise<SearchResult[]> {
    if (!query.trim()) {
      return [];
    }
    const params: Record<string, string> = { q: query.trim() };
    if (category) {
      params.category = category;
    }

    try {
      const response = await this.handleRequest<{ query: string; total_results: number; results: SearchResult[] }>(
        this.http.get('/api/v1/search', { params }),
        false
      );
      return response.results || [];
    } catch (error) {
      console.warn('Server search error, returning empty array:', error);
      return [];
    }
  }
}

export const searchApi = new SearchApi();
