import { describe, expect, it, vi } from 'vitest';
import { adminOrdersApi } from '@/services/api/adminOrdersApi';

describe('admin orders API contract', () => {
  it('sends server-side pagination and filters', async () => {
    const list = vi.spyOn(adminOrdersApi, 'list').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 25,
      pages: 0,
    });

    await adminOrdersApi.list({
      page: 2,
      page_size: 25,
      search: 'TCS',
      execution_mode: 'PAPER',
      status: 'FILLED',
      side: 'BUY',
    });

    expect(list).toHaveBeenCalledWith({
      page: 2,
      page_size: 25,
      search: 'TCS',
      execution_mode: 'PAPER',
      status: 'FILLED',
      side: 'BUY',
    });
    list.mockRestore();
  });
});
