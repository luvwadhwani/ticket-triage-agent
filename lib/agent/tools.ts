import { tool } from 'ai';
import { z } from 'zod';
import { classificationSchema, draftSchema, escalationSchema } from '@/lib/schemas';
import { classifyTicket } from '@/lib/tools/classify';
import { lookupCustomer } from '@/lib/tools/customer';
import { searchDocs } from '@/lib/tools/docs';
import { escalate } from '@/lib/tools/escalate';
import { getInvoices } from '@/lib/tools/invoices';
import { draftReply } from '@/lib/tools/reply';
import { getServiceStatus } from '@/lib/tools/status';
import type { Classification, RunEvent, RunFindings, ToolName, ToolOutcome } from '@/lib/types';

export interface ToolContext {
  findings: RunFindings;
  emit: (e: RunEvent) => void;
  clock: () => number;
}

function runTool<O>(ctx: ToolContext, name: ToolName, callId: string, input: unknown, compute: () => ToolOutcome<O>): O {
  ctx.emit({ type: 'tool-call', callId, tool: name, input, at: ctx.clock() });
  const r = compute();
  ctx.emit({
    type: 'tool-result',
    callId,
    tool: name,
    ok: r.ok,
    summary: r.summary,
    ...(r.tone ? { tone: r.tone } : {}),
    at: ctx.clock(),
  });
  return r.output;
}

/** A later classification may refine the category, but never drops an intent or raises confidence. */
export function mergeClassification(prev: Classification | undefined, next: Classification): Classification {
  if (!prev) return next;
  return {
    ...next,
    intents: [...new Set([...prev.intents, ...next.intents])],
    confidence: Math.min(prev.confidence, next.confidence),
  };
}

const emailInput = z.object({ email: z.string().describe("The customer's email address") });

export function buildTools(ctx: ToolContext) {
  return {
    classify_ticket: tool({
      description: 'Record your classification of the ticket. Call this first.',
      inputSchema: classificationSchema,
      execute: async (input, { toolCallId }) =>
        runTool(ctx, 'classify_ticket', toolCallId, input, () => {
          const r = classifyTicket(input);
          ctx.findings.classification = mergeClassification(ctx.findings.classification, r.output);
          return r;
        }),
    }),
    lookup_customer: tool({
      description: 'Look up a customer account by email.',
      inputSchema: emailInput,
      execute: async (input, { toolCallId }) => runTool(ctx, 'lookup_customer', toolCallId, input, () => lookupCustomer(input)),
    }),
    get_invoices: tool({
      description: "List a customer's recent invoices and flag duplicate charges.",
      inputSchema: emailInput,
      execute: async (input, { toolCallId }) =>
        runTool(ctx, 'get_invoices', toolCallId, input, () => {
          const r = getInvoices(input);
          if (r.output.duplicateCharge) ctx.findings.duplicateCharge = true;
          return r;
        }),
    }),
    get_service_status: tool({
      description: 'Current status of the API, Dashboard and Billing.',
      inputSchema: z.object({}),
      execute: async (input, { toolCallId }) =>
        runTool(ctx, 'get_service_status', toolCallId, input, () => {
          const r = getServiceStatus();
          ctx.findings.degradedComponents = r.output.degraded;
          return r;
        }),
    }),
    search_docs: tool({
      description: 'Search the help center. Returns up to 3 articles with ids you can cite.',
      inputSchema: z.object({ query: z.string().min(2).max(200) }),
      execute: async (input, { toolCallId }) => runTool(ctx, 'search_docs', toolCallId, input, () => searchDocs(input)),
    }),
    draft_reply: tool({
      description: 'Finish by drafting the reply to the customer. Cite the help article ids you used.',
      inputSchema: draftSchema,
      execute: async (input, { toolCallId }) =>
        runTool(ctx, 'draft_reply', toolCallId, input, () => {
          const r = draftReply(input);
          // an escalation the agent already proposed is more cautious than a reply; keep it
          if (ctx.findings.proposal?.kind !== 'escalate') ctx.findings.proposal = { kind: 'reply', draft: r.output };
          return r;
        }),
    }),
    escalate: tool({
      description: 'Finish by handing the ticket to a team, with a short reason.',
      inputSchema: escalationSchema,
      execute: async (input, { toolCallId }) =>
        runTool(ctx, 'escalate', toolCallId, input, () => {
          const r = escalate(input);
          ctx.findings.proposal = { kind: 'escalate', escalation: r.output };
          return r;
        }),
    }),
  };
}
