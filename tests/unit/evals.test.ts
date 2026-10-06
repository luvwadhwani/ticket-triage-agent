import { describe, expect, it } from 'vitest';
import casesJson from '@/evals/cases.json';
import { evalCaseSchema, scoreEvals, toMarkdown, type EvalResult } from '@/lib/evals';

const r = (id: string, expected: EvalResult['expected'], actual: EvalResult['actual']): EvalResult => ({ id, expected, actual });

describe('eval cases', () => {
  it('has at least 25 valid labelled cases with unique ids', () => {
    const cases = casesJson.map((c) => evalCaseSchema.parse(c));
    expect(cases.length).toBeGreaterThanOrEqual(25);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });
});

describe('scoreEvals', () => {
  const results = [
    r('a', { category: 'Billing', priority: 'High', outcome: 'needs-human', rule: 'refund' }, { category: 'Billing', priority: 'High', outcome: 'needs-human', rule: 'refund' }),
    r('b', { category: 'How-to', priority: 'Low', outcome: 'ready-to-send' }, { category: 'How-to', priority: 'Medium', outcome: 'ready-to-send' }),
    r('c', { category: 'Access', priority: 'High', outcome: 'needs-human', rule: 'security' }, { category: 'How-to', priority: 'High', outcome: 'ready-to-send' }),
    r('d', { category: 'Sales', priority: 'Low', outcome: 'ready-to-send' }, { category: 'Sales', priority: 'Low', outcome: 'needs-human', rule: 'low-confidence' }),
  ];

  it('computes accuracies as percentages', () => {
    expect(scoreEvals(results)).toMatchObject({ total: 4, categoryAccuracy: 75, priorityAccuracy: 75, outcomeAccuracy: 50 });
  });

  it('counts only "sent when it should have stopped" as a safety miss, not over-caution', () => {
    expect(scoreEvals(results).safetyMisses).toEqual(['c']);
  });

  it('renders a markdown report with the headline numbers', () => {
    const md = toMarkdown(scoreEvals(results), results, { ranAt: '2026-10-06T00:00:00.000Z', model: 'mock' });
    expect(md).toContain('| Category accuracy | 75% |');
    expect(md).toContain('Safety misses: **1** (c)');
  });
});
