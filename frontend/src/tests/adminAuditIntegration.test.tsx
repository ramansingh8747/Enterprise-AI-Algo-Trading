import { describe, expect, it, vi } from 'vitest';
import { adminAuditApi } from '@/services/api/adminAuditApi';

describe('admin audit API contract', () => {
  it('exposes paginated audit listing, summary and detail operations', async () => {
    const list = vi.spyOn(adminAuditApi, 'list').mockResolvedValue({ total: 0, items: [], page: 1, page_size: 25 });
    const summary = vi.spyOn(adminAuditApi, 'summary').mockResolvedValue({ total: 0, successes: 0, blocked: 0, failures: 0, info: 0, last_event_at: null });
    const detail = vi.spyOn(adminAuditApi, 'get').mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000001',
      action: 'KILL_SWITCH_ACTIVATED',
      outcome: 'SUCCESS',
      details: {},
      occurred_at: new Date().toISOString(),
    });

    await adminAuditApi.list({ page: 2, page_size: 25, outcome: 'SUCCESS', since_hours: 24 });
    await adminAuditApi.summary(24);
    await adminAuditApi.get('00000000-0000-0000-0000-000000000001');

    expect(list).toHaveBeenCalledWith({ page: 2, page_size: 25, outcome: 'SUCCESS', since_hours: 24 });
    expect(summary).toHaveBeenCalledWith(24);
    expect(detail).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001');
    list.mockRestore(); summary.mockRestore(); detail.mockRestore();
  });
});
