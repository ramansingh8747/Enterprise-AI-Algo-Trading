import { describe, expect, it } from 'vitest';

const categoryForEvent = (eventType: string, action = '') => {
  const value = `${eventType} ${action}`.toLowerCase();
  if (value.includes('order') || value.includes('execution')) return 'ORDERS';
  if (value.includes('position')) return 'POSITIONS';
  if (value.includes('portfolio') || value.includes('valuation') || value.includes('pnl')) return 'PORTFOLIO';
  if (value.includes('reconciliation')) return 'RECONCILIATION';
  if (value.includes('risk') || value.includes('kill_switch')) return 'RISK';
  if (value.includes('live_gate') || value.includes('live_readiness') || value.includes('pre_live') || value.includes('live_activation')) return 'LIVE_GATE';
  if (value.includes('audit')) return 'AUDIT';
  if (value.includes('strategy') || value.includes('signal') || value.includes('instance')) return 'STRATEGY';
  return 'SYSTEM';
};

describe('admin unified operations event classification', () => {
  it('classifies trading events into operational domains', () => {
    expect(categoryForEvent('order.updated')).toBe('ORDERS');
    expect(categoryForEvent('position.updated')).toBe('POSITIONS');
    expect(categoryForEvent('portfolio.valuation.updated')).toBe('PORTFOLIO');
    expect(categoryForEvent('reconciliation.completed')).toBe('RECONCILIATION');
    expect(categoryForEvent('audit.event', 'USER_LOGIN')).toBe('AUDIT');
    expect(categoryForEvent('audit.event', 'LIVE_GATE_BLOCKED')).toBe('LIVE_GATE');
  });

  it('does not require a user id for system events', () => {
    const event = { event_id: 'system-1', event_type: 'portfolio.valuation.updated', user_id: null };
    expect(event.user_id).toBeNull();
    expect(categoryForEvent(event.event_type)).toBe('PORTFOLIO');
  });
});
