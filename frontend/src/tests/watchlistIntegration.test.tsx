import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import WatchlistPage from '@/pages/watchlist/WatchlistPage';
import { watchlistApi } from '@/services/api/watchlistApi';

vi.mock('@/services/api/watchlistApi', () => ({
  watchlistApi: {
    getWatchlists: vi.fn(),
    createWatchlist: vi.fn(),
    getWatchlist: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    deleteWatchlist: vi.fn(),
  },
}));

vi.mock('@/hooks/useWebSocketSubscription', () => ({
  useWebSocketSubscription: vi.fn(),
}));

const mockWatchlists = [
  {
    id: 'wl-default-101',
    user_id: 'user-1',
    name: 'Main Watchlist',
    is_default: true,
    items: [
      { id: 'item-1', watchlist_id: 'wl-default-101', symbol: 'RELIANCE', order_index: 0, created_at: '2026-08-11T10:00:00Z' },
      { id: 'item-2', watchlist_id: 'wl-default-101', symbol: 'TCS', order_index: 1, created_at: '2026-08-11T10:00:00Z' },
    ],
    created_at: '2026-08-11T10:00:00Z',
  },
];

describe('STEP 13.21I.34.134 — Watchlist Server Persistence Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Loads server watchlists on mount and displays default watchlist', async () => {
    (watchlistApi.getWatchlists as any).mockResolvedValue(mockWatchlists);

    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Market Workspace')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Main Watchlist/i)).toBeInTheDocument();
      expect(screen.getByText('RELIANCE')).toBeInTheDocument();
      expect(screen.getByText('TCS')).toBeInTheDocument();
    });
  });

  it('2. Allows creating a new custom watchlist', async () => {
    (watchlistApi.getWatchlists as any).mockResolvedValue(mockWatchlists);
    (watchlistApi.createWatchlist as any).mockResolvedValue({
      id: 'wl-tech-202',
      user_id: 'user-1',
      name: 'Tech Equities',
      is_default: false,
      items: [],
      created_at: '2026-08-11T12:00:00Z',
    });

    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Market Workspace')).toBeInTheDocument();
    });

    // Click + Create Watchlist
    const createBtn = screen.getByRole('button', { name: /\+ Create Watchlist/i });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText(/Create New Watchlist/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/e.g. IT Sector, High Volatility/i);
    fireEvent.change(input, { target: { value: 'Tech Equities' } });

    const submitBtn = screen.getByRole('button', { name: /^Create$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(watchlistApi.createWatchlist).toHaveBeenCalledWith({ name: 'Tech Equities' });
    });
  });

  it('3. Toggles symbol addition to server watchlist', async () => {
    (watchlistApi.getWatchlists as any).mockResolvedValue(mockWatchlists);
    (watchlistApi.addItem as any).mockResolvedValue({
      id: 'item-3',
      watchlist_id: 'wl-default-101',
      symbol: 'INFY',
      order_index: 2,
      created_at: '2026-08-11T13:00:00Z',
    });

    render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('INFY')).toBeInTheDocument();
    });

    // Find star button for INFY and click
    const starButtons = screen.getAllByRole('button', { name: /★/i });
    if (starButtons.length > 0) {
      fireEvent.click(starButtons[0]);
    }

    await waitFor(() => {
      expect(watchlistApi.addItem).toHaveBeenCalled();
    });
  });

  it('4. Ensures credential isolation in DOM', async () => {
    (watchlistApi.getWatchlists as any).mockResolvedValue(mockWatchlists);

    const { container } = render(
      <MemoryRouter>
        <WatchlistPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Market Workspace')).toBeInTheDocument();
    });

    const html = container.innerHTML.toLowerCase();
    expect(html).not.toContain('api_key');
    expect(html).not.toContain('api_secret');
    expect(html).not.toContain('access_token');
    expect(html).not.toContain('password');
  });
});
