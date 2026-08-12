import { BaseApi } from './BaseApi';
import { SearchResult } from '@/types/globalSearch';

export interface GlobalSearchResponseDto {
  query: string;
  total_results: int;
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
      const response = await this.get<{ query: string; total_results: number; results: SearchResult[] }>(
        '/api/v1/search',
        { params }
      );
      return response.results || [];
    } catch (error) {
      console.warn('Server search error, returning empty array:', error);
      return [];
    }
  }
}

export const searchApi = new SearchApi();
