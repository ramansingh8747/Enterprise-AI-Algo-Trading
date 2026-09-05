import { beforeEach, describe, expect, it, vi } from 'vitest';

const httpMock = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@/services/http/axios', () => ({
  default: httpMock,
}));

import { strategyApi } from '@/services/api/strategyApi';

describe('StrategyApi raw FastAPI contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts an unwrapped empty strategy list', async () => {
    httpMock.get.mockResolvedValue({ data: [] });

    await expect(strategyApi.listDefinitions()).resolves.toEqual([]);
    expect(httpMock.get).toHaveBeenCalledWith('/strategies');
  });

  it('accepts an unwrapped created strategy', async () => {
    const strategy = { id: 'strategy-1', name: 'Momentum' };
    httpMock.post.mockResolvedValue({ data: strategy });

    await expect(
      strategyApi.createDefinition({ name: 'Momentum' })
    ).resolves.toEqual(strategy);
  });

  it('accepts an unwrapped PAPER cycle response', async () => {
    const result = {
      status: 'COMPLETE',
      mode: 'PAPER',
      instance_id: 'instance-1',
      signals_count: 1,
      order_id: 'order-1',
      order_status: 'FILLED',
    };
    httpMock.post.mockResolvedValue({ data: result });

    await expect(
      strategyApi.runPaperCycle('definition-1', 'instance-1')
    ).resolves.toEqual(result);
  });
});
