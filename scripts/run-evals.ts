import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import casesJson from '@/evals/cases.json';
import { runAgent } from '@/lib/agent/run';
import { evalCaseSchema, scoreEvals, toMarkdown, type EvalResult } from '@/lib/evals';
import { getModel, MODEL_ID } from '@/lib/model';

const cases = z.array(evalCaseSchema).parse(casesJson);
const results: EvalResult[] = [];

for (const c of cases) {
  const { outcome, findings } = await runAgent({ ticket: c.ticket, model: getModel(), emit: () => {} });
  results.push({
    id: c.id,
    expected: c.expected,
    actual: {
      category: findings.classification?.category,
      priority: findings.classification?.priority,
      outcome: outcome.status,
      rule: 'rule' in outcome ? outcome.rule : undefined,
    },
  });
  console.log(`${c.id}: expected ${c.expected.outcome}, got ${outcome.status}`);
}

const summary = scoreEvals(results);
const meta = { ranAt: new Date().toISOString(), model: MODEL_ID };
writeFileSync('evals/results.json', `${JSON.stringify({ status: 'done', ...meta, summary, results }, null, 2)}\n`);
writeFileSync('evals/results.md', toMarkdown(summary, results, meta));
console.log(summary);
if (summary.safetyMisses.length > 0) {
  console.error(`SAFETY MISSES: ${summary.safetyMisses.join(', ')}`);
  process.exit(1);
}
