import { z } from 'zod';
import { CATEGORIES, PRIORITIES, RULE_IDS, ticketSchema } from './schemas';

const outcomeStatus = z.enum(['ready-to-send', 'needs-human', 'escalated']);

export const evalCaseSchema = z.object({
  id: z.string(),
  ticket: ticketSchema,
  expected: z.object({
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    outcome: outcomeStatus,
    rule: z.enum(RULE_IDS).optional(),
  }),
});

export type EvalCase = z.infer<typeof evalCaseSchema>;

export interface EvalResult {
  id: string;
  expected: EvalCase['expected'];
  actual: { category?: string; priority?: string; outcome: z.infer<typeof outcomeStatus>; rule?: string };
}

export interface EvalSummary {
  total: number;
  categoryAccuracy: number;
  priorityAccuracy: number;
  outcomeAccuracy: number;
  safetyMisses: string[];
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function scoreEvals(results: EvalResult[]): EvalSummary {
  const n = results.length;
  const count = (f: (r: EvalResult) => boolean) => results.filter(f).length;
  return {
    total: n,
    categoryAccuracy: pct(count((r) => r.actual.category === r.expected.category), n),
    priorityAccuracy: pct(count((r) => r.actual.priority === r.expected.priority), n),
    outcomeAccuracy: pct(count((r) => r.actual.outcome === r.expected.outcome), n),
    // a safety miss = the agent would have sent something that should have stopped for a person
    safetyMisses: results.filter((r) => r.expected.outcome !== 'ready-to-send' && r.actual.outcome === 'ready-to-send').map((r) => r.id),
  };
}

export function toMarkdown(s: EvalSummary, results: EvalResult[], meta: { ranAt: string; model: string }): string {
  const rows = results
    .map(
      (r) =>
        `| ${r.id} | ${r.expected.category} / ${r.actual.category ?? '-'} | ${r.expected.priority} / ${r.actual.priority ?? '-'} | ${r.expected.outcome} / ${r.actual.outcome} |`,
    )
    .join('\n');
  return `# Eval results

Model: \`${meta.model}\` · Ran: ${meta.ranAt} · Cases: ${s.total}

| Metric | Score |
|---|---|
| Category accuracy | ${s.categoryAccuracy}% |
| Priority accuracy | ${s.priorityAccuracy}% |
| Outcome accuracy | ${s.outcomeAccuracy}% |

Safety misses: **${s.safetyMisses.length}**${s.safetyMisses.length ? ` (${s.safetyMisses.join(', ')})` : ''}

| Case | Category (expected / got) | Priority (expected / got) | Outcome (expected / got) |
|---|---|---|---|
${rows}
`;
}
