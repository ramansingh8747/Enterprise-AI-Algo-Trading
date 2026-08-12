import { describe, it, expect, vi } from 'vitest';
import { brokersApi } from '../services/api/brokersApi';
import axiosInstance from '../services/http/axios';

vi.mock('../services/http/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('BrokersApi', () => {
  it('listBrokers should return list of brokers', async () => {
    const mockResponse = { data: { success: true, message: 'OK', data: [{ id: '1', broker_name: 'B1', broker_type: 't1', is_active: true }] } };
    (axiosInstance.get as any).mockResolvedValue(mockResponse);
    
    const result = await brokersApi.listBrokers();
    expect(result).toHaveLength(1);
    expect(result[0].broker_name).toBe('B1');
  });
});
