import { describe, expect, it } from 'vitest';
import { MAX_STEPS, runAgent } from '@/lib/agent/run';
import { scriptedModel, scriptedModelFor } from '@/lib/agent/scripted-model';
import { getTicket } from '@/lib/data';
import { runEventSchema } from '@/lib/schemas';
import type { RunEvent } from '@/lib/types';

async function run(ticketId: string, model = scriptedModelFor(ticketId)) {
  const events: RunEvent[] = [];
  const result = await runAgent({ ticket: getTicket(ticketId)!, model, emit: (e) => events.push(e) });
  return { ...result, events, model };
}

describe('runAgent on the 8 preset tickets (scripted model)', () => {
  it.each([
    ['t1', 'needs-human', 'refund'],
    ['t2', 'needs-human', 'security'],
    ['t3', 'ready-to-send', undefined],
    ['t4', 'escalated', 'incident'],
    ['t5', 'needs-human', 'account-deletion'],
    ['t6', 'ready-to-send', undefined],
    ['t7', 'ready-to-send', undefined],
    ['t8', 'needs-human', 'refund'],
  ])('%s → %s (%s)', async (id, status, rule) => {
    const { outcome, events } = await run(id);
    expect(outcome.status).toBe(status);
    expect('rule' in outcome ? outcome.rule : undefined).toBe(rule);
    expect(events[0]).toEqual({ type: 'run-start', ticketId: id, at: 0 });
    expect(events.at(-1)?.type).toBe('outcome');
    for (const e of events) expect(runEventSchema.safeParse(e).success).toBe(true);
  });

  it('pairs every tool-call with a tool-result, in order', async () => {
    const { events } = await run('t1');
    const calls = events.filter((e) => e.type === 'tool-call');
    const results = events.filter((e) => e.type === 'tool-result');
    expect(calls.map((c) => c.callId)).toEqual(results.map((r) => r.callId));
    expect(calls.map((c) => c.tool)).toEqual(['classify_ticket', 'lookup_customer', 'get_invoices', 'search_docs', 'draft_reply']);
  });

  it('stops right after the terminal tool even if the model would keep going', async () => {
    const model = scriptedModel([
      { tool: 'classify_ticket', input: { category: 'How-to', priority: 'Low', confidence: 0.9, intents: ['how-to'] } },
      { tool: 'draft_reply', input: { text: 'Hi', citations: [] } },
      { tool: 'search_docs', input: { query: 'never reached' } },
    ]);
    const { outcome } = await run('t3', model);
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(outcome.status).toBe('ready-to-send');
  });

  it('keeps the most cautious classification when the model classifies twice', async () => {
    const model = scriptedModel([
      { tool: 'classify_ticket', input: { category: 'Billing', priority: 'High', confidence: 0.9, intents: ['refund'] } },
      { tool: 'classify_ticket', input: { category: 'How-to', priority: 'Low', confidence: 0.95, intents: [] } },
      { tool: 'draft_reply', input: { text: 'Hi', citations: [] } },
    ]);
    const { outcome, findings } = await run('t3', model);
    expect(findings.classification).toMatchObject({ intents: ['refund'], confidence: 0.9 });
    expect(outcome).toMatchObject({ status: 'needs-human', rule: 'refund' });
  });

  it('never lets a reply drafted in the same step drop the agent’s own escalation', async () => {
    const model = scriptedModel([
      { tool: 'classify_ticket', input: { category: 'Billing', priority: 'Medium', confidence: 0.9, intents: [] } },
      [
        { tool: 'escalate', input: { team: 'Billing', reason: 'Needs a manual credit' } },
        { tool: 'draft_reply', input: { text: 'Hi', citations: [] } },
      ],
    ]);
    const { outcome } = await run('t3', model);
    expect(outcome).toMatchObject({ status: 'escalated', team: 'Billing' });
  });

  it("escalates as couldn't-finish when the model never drafts or escalates", async () => {
    const model = scriptedModel(
      [{ tool: 'classify_ticket', input: { category: 'Other', priority: 'Medium', confidence: 0.9, intents: [] } }],
      'I am not sure what to do.',
    );
    const { outcome } = await run('t3', model);
    expect(outcome).toMatchObject({ status: 'escalated', rule: 'couldnt-finish' });
  });

  it(`caps the loop at ${MAX_STEPS} steps`, async () => {
    const model = scriptedModel(Array.from({ length: 12 }, () => ({ tool: 'search_docs' as const, input: { query: 'billing' } })));
    const { outcome } = await run('t3', model);
    expect(model.doGenerateCalls).toHaveLength(MAX_STEPS);
    expect(outcome).toMatchObject({ status: 'escalated', rule: 'couldnt-finish' });
  });
});
