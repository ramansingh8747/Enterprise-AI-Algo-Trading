import { describe, it, expect, vi } from 'vitest';
import { brokerDataApi } from '../services/api/brokerDataApi';
import axiosInstance from '../services/http/axios';

vi.mock('../services/http/axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('BrokerDataApi', () => {
  it('getHoldings should return holdings as string decimals', async () => {
    const mockResponse = { data: [{ symbol: 'INFY', quantity: '10', average_price: '1500.00' }] };
    (axiosInstance.get as any).mockResolvedValue(mockResponse);
    
    const result = await brokerDataApi.getHoldings('b1');
    expect(result[0].quantity).toBe('10');
    expect(typeof result[0].quantity).toBe('string');
  });
});
