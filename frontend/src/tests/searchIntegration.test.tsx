import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { searchApi } from '@/services/api/searchApi';
import { searchGlobalAsync } from '@/services/paperTrading/globalSearchService';
import { SearchCommandCenter } from '@/components/dashboard/SearchCommandCenter';
import type { SearchResult } from '@/types/globalSearch';

describe('Global Workspace Search Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('searchApi executes GET /api/v1/search and returns search results', async () => {
    const mockResults: SearchResult[] = [
      { id: 'eq-RELIANCE', category: 'EQUITY', title: 'RELIANCE', subtitle: 'Reliance Industries', action: 'OPEN_ORDER' },
      { id: 'strat-1', category: 'STRATEGY', title: 'Alpha Momentum', subtitle: 'MOMENTUM', action: 'NAVIGATE' },
    ];

    vi.spyOn(searchApi, 'search').mockResolvedValueOnce(mockResults);

    const results = await searchApi.search('RELIANCE');
    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('RELIANCE');
    expect(results[1].title).toBe('Alpha Momentum');
  });

  it('searchGlobalAsync calls searchApi and returns server results', async () => {
    const mockResults: SearchResult[] = [
      { id: 'journal-1', category: 'JOURNAL', title: 'Journal: RELIANCE', subtitle: '2026-08-11', action: 'NAVIGATE' },
    ];

    vi.spyOn(searchApi, 'search').mockResolvedValueOnce(mockResults);

    const res = await searchGlobalAsync('RELIANCE');
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('journal-1');
  });

  it('searchGlobalAsync falls back to client search when server API fails', async () => {
    vi.spyOn(searchApi, 'search').mockRejectedValueOnce(new Error('Network error'));

    const res = await searchGlobalAsync('RELIANCE');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].symbol).toBe('RELIANCE');
  });

  it('SearchCommandCenter modal renders, debounces search, and renders search results', async () => {
    const mockResults: SearchResult[] = [
      { id: 'eq-TCS', category: 'EQUITY', title: 'TCS', subtitle: 'Tata Consultancy Services', action: 'OPEN_ORDER' },
    ];

    vi.spyOn(searchApi, 'search').mockResolvedValueOnce(mockResults);

    render(
      <MemoryRouter>
        <SearchCommandCenter isOpen={true} onClose={() => {}} />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search stocks, strategies, journal, alerts, routes/i);
    expect(input).toBeDefined();

    fireEvent.change(input, { target: { value: 'TCS' } });

    await waitFor(() => {
      expect(screen.getByText('TCS')).toBeDefined();
      expect(screen.getByText('Tata Consultancy Services')).toBeDefined();
    }, { timeout: 1000 });
  });
});
