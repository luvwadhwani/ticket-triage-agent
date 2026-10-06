import { describe, expect, it } from 'vitest';
import { customers, getCustomer, getInvoicesFor, helpDocs, serviceStatus, tickets } from '@/lib/data';

describe('fake data', () => {
  it('has the 8 preset tickets t1..t8 in order', () => {
    expect(tickets.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
  });

  it('every preset ticket has a received time, newest first', () => {
    const times = tickets.map((t) => Date.parse(t.receivedAt ?? ''));
    expect(times.every((n) => !Number.isNaN(n))).toBe(true);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('every ticket sender is a known customer on the same plan', () => {
    for (const t of tickets) {
      const c = getCustomer(t.from);
      expect(c, t.id).toBeDefined();
      expect(c!.plan, t.id).toBe(t.plan);
    }
  });

  it('has at least 20 help docs with unique ids', () => {
    expect(helpDocs.length).toBeGreaterThanOrEqual(20);
    expect(new Set(helpDocs.map((d) => d.id)).size).toBe(helpDocs.length);
  });

  it("t1's customer was charged twice on 2026-10-03", () => {
    expect(getInvoicesFor('maya@example.com').filter((i) => i.date === '2026-10-03')).toHaveLength(2);
  });

  it('the API is degraded (for the incident ticket)', () => {
    expect(serviceStatus.find((s) => s.component === 'API')?.state).toBe('degraded');
  });

  it('customer lookup ignores case and whitespace; emails are unique', () => {
    expect(getCustomer('  MAYA@example.com ')?.name).toBe('Maya Chen');
    expect(new Set(customers.map((c) => c.email)).size).toBe(customers.length);
  });
});
