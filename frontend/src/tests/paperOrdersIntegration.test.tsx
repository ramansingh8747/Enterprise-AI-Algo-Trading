import { describe, expect, it, vi, beforeEach } from 'vitest';
import { paperOrdersApi } from '@/services/api/paperOrdersApi';
import axiosInstance from '@/services/http/axios';

vi.mock('@/services/http/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

describe('PAPER order persistence integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a server-persisted paper order', async () => {
    const response = {
      data: {
        id: 'execution-1',
        order_id: 'PAPER-abc123',
        execution_mode: 'PAPER',
        symbol: 'INFY',
        side: 'BUY',
        quantity: '2',
        price: '1500',
        status: 'FILLED',
        executed_at: '2026-08-15T10:00:00Z',
      },
    };
    (axiosInstance.post as any).mockResolvedValueOnce(response);

    const result = await paperOrdersApi.createOrder({
      symbol: 'INFY',
      side: 'BUY',
      quantity: '2',
      order_type: 'MARKET',
      price: '1500',
    });

    expect(axiosInstance.post).toHaveBeenCalledWith('/paper-orders', {
      symbol: 'INFY',
      side: 'BUY',
      quantity: '2',
      order_type: 'MARKET',
      price: '1500',
    });
    expect(result.execution_mode).toBe('PAPER');
    expect(result.status).toBe('FILLED');
  });

  it('loads persisted paper orders from the backend', async () => {
    (axiosInstance.get as any).mockResolvedValueOnce({ data: [] });
    await paperOrdersApi.listOrders();
    expect(axiosInstance.get).toHaveBeenCalledWith('/paper-orders', { params: { limit: 100 } });
  });
});
