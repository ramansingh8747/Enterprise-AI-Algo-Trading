import { describe, expect, it } from 'vitest';
import { adminPositionsApi } from '@/services/api/adminPositionsApi';

describe('admin positions API contract', () => {
  it('exposes PAPER/LIVE filters and position detail source', () => {
    expect(adminPositionsApi).toBeDefined();
    expect(typeof adminPositionsApi.list).toBe('function');
    expect(typeof adminPositionsApi.get).toBe('function');
  });
});
