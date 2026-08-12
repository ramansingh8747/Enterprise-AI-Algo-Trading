import { describe, it, expect, vi } from 'vitest';
import { authApi } from '../services/api/authApi';
import axiosInstance from '../services/http/axios';

vi.mock('../services/http/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('AuthApi', () => {
  it('login should return token response', async () => {
    const mockResponse = { data: { success: true, message: 'OK', data: { access_token: 'at', refresh_token: 'rt', token_type: 'bearer', user: {} } } };
    (axiosInstance.post as any).mockResolvedValue(mockResponse);
    
    const result = await authApi.login({ email: 'test@example.com', password: 'password' });
    expect(result.access_token).toBe('at');
  });
});
