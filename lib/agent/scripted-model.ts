import { MockLanguageModelV4 } from 'ai/test';
import type { ToolName } from '@/lib/types';

export interface ScriptStep {
  tool: ToolName;
  input: unknown;
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** A fake model that makes the scripted tool call(s) for each step, then answers with plain text. */
export function scriptedModel(steps: Array<ScriptStep | ScriptStep[]>, finalText = 'Done.') {
  return new MockLanguageModelV4({
    doGenerate: [
      ...steps.map((step, i) => ({
        content: (Array.isArray(step) ? step : [step]).map((s, j) => ({
          type: 'tool-call' as const,
          toolCallId: `call-${i + 1}${Array.isArray(step) ? `-${j + 1}` : ''}`,
          toolName: s.tool,
          input: JSON.stringify(s.input),
        })),
        finishReason: { unified: 'tool-calls' as const, raw: undefined },
        usage,
        warnings: [],
      })),
      {
        content: [{ type: 'text' as const, text: finalText }],
        finishReason: { unified: 'stop' as const, raw: undefined },
        usage,
        warnings: [],
      },
    ],
  });
}

/** Each call advances fake time, so mock recordings replay at a readable pace. */
export function tickClock(stepMs = 650): () => number {
  let t = 0;
  return () => (t += stepMs);
}

const sign = 'Acme Cloud Support';

export const TICKET_SCRIPTS: Record<string, ScriptStep[]> = {
  t1: [
    { tool: 'classify_ticket', input: { category: 'Billing', priority: 'High', confidence: 0.93, intents: ['refund'] } },
    { tool: 'lookup_customer', input: { email: 'maya@example.com' } },
    { tool: 'get_invoices', input: { email: 'maya@example.com' } },
    { tool: 'search_docs', input: { query: 'duplicate charge refund' } },
    {
      tool: 'draft_reply',
      input: {
        text: `Hi Maya, sorry about that. You were charged $49 twice on October 3. I've asked our billing team to refund the duplicate charge; they'll confirm by email, and the money returns to your card within 5-7 business days.\n\n${sign}`,
        citations: ['doc-refunds'],
      },
    },
  ],
  t2: [
    { tool: 'classify_ticket', input: { category: 'Access', priority: 'High', confidence: 0.9, intents: ['security'] } },
    { tool: 'lookup_customer', input: { email: 'ops@example.org' } },
    { tool: 'search_docs', input: { query: 'SSO sign-in identity provider' } },
    { tool: 'escalate', input: { team: 'Security', reason: 'Whole team locked out after an SSO identity provider change (invalid assertion).' } },
  ],
  t3: [
    { tool: 'classify_ticket', input: { category: 'How-to', priority: 'Low', confidence: 0.95, intents: ['how-to'] } },
    { tool: 'lookup_customer', input: { email: 'li@example.net' } },
    { tool: 'search_docs', input: { query: 'export reports CSV' } },
    {
      tool: 'draft_reply',
      input: {
        text: `Hi Li, yes: open Reports, choose the report, click Export and pick CSV. Exports up to 100,000 rows download straight away; bigger ones arrive by email as a ZIP.\n\n${sign}`,
        citations: ['doc-export-csv'],
      },
    },
  ],
  t4: [
    { tool: 'classify_ticket', input: { category: 'Incident', priority: 'Urgent', confidence: 0.94, intents: ['incident'] } },
    { tool: 'lookup_customer', input: { email: 'dev@example.io' } },
    { tool: 'get_service_status', input: {} },
    { tool: 'escalate', input: { team: 'Engineering', reason: 'Enterprise customer seeing 503s on /v2 while the API is degraded.' } },
  ],
  t5: [
    { tool: 'classify_ticket', input: { category: 'Account', priority: 'Medium', confidence: 0.92, intents: ['cancel'] } },
    { tool: 'lookup_customer', input: { email: 'sam@example.com' } },
    { tool: 'search_docs', input: { query: 'cancel subscription' } },
    {
      tool: 'draft_reply',
      input: {
        text: `Hi Sam, thanks for letting us know. I've passed your cancellation request to our team; they'll confirm it by email, and your Pro plan stays active until the end of the billing period.\n\n${sign}`,
        citations: ['doc-cancel'],
      },
    },
  ],
  t6: [
    { tool: 'classify_ticket', input: { category: 'Feedback', priority: 'Low', confidence: 0.9, intents: ['feedback'] } },
    { tool: 'lookup_customer', input: { email: 'alex@example.co' } },
    { tool: 'search_docs', input: { query: 'feature requests' } },
    {
      tool: 'draft_reply',
      input: {
        text: `Hi Alex, thank you, that's great to hear! I've shared your dark mode request with the product team; they review requests every week and you can follow it on our public roadmap.\n\n${sign}`,
        citations: ['doc-feature-requests'],
      },
    },
  ],
  t7: [
    { tool: 'classify_ticket', input: { category: 'Sales', priority: 'Medium', confidence: 0.88, intents: ['pricing'] } },
    { tool: 'lookup_customer', input: { email: 'priya@example.com' } },
    { tool: 'search_docs', input: { query: 'Team plan pricing upgrade' } },
    {
      tool: 'draft_reply',
      input: {
        text: `Hi Priya, the Team plan is $12 per seat per month with a 5-seat minimum, so 6 people would be $72 a month. You can upgrade any time in Settings, Billing, Change plan, and it's prorated.\n\n${sign}`,
        citations: ['doc-plans-pricing', 'doc-upgrade'],
      },
    },
  ],
  t8: [
    { tool: 'classify_ticket', input: { category: 'Billing', priority: 'Medium', confidence: 0.6, intents: ['refund'] } },
    { tool: 'lookup_customer', input: { email: 'chris@example.net' } },
    { tool: 'get_invoices', input: { email: 'chris@example.net' } },
    {
      tool: 'draft_reply',
      input: {
        text: `Hi Chris, thanks for getting in touch. I can't issue refunds myself, so I've passed your message to our billing team, who will review your account and reply by email.\n\n${sign}`,
        citations: ['doc-refunds'],
      },
    },
  ],
};

export function scriptedModelFor(ticketId: string) {
  const steps = TICKET_SCRIPTS[ticketId];
  if (!steps) throw new Error(`No script for ticket ${ticketId}`);
  return scriptedModel(steps);
}
