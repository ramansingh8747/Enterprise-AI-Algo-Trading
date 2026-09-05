import { describe, expect, it } from 'vitest';
import { adminPortfoliosApi } from '@/services/api/adminPortfoliosApi';

describe('admin portfolio API contract', () => {
  it('exposes paginated portfolio listing and account detail methods', () => {
    expect(adminPortfoliosApi).toBeDefined();
    expect(typeof adminPortfoliosApi.list).toBe('function');
    expect(typeof adminPortfoliosApi.get).toBe('function');
  });
});
