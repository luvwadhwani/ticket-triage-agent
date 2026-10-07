import { z } from 'zod';

export const PLANS = ['Free', 'Pro', 'Team', 'Enterprise'] as const;
export const CATEGORIES = ['Billing', 'Access', 'How-to', 'Incident', 'Account', 'Feedback', 'Sales', 'Other'] as const;
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
export const INTENTS = ['refund', 'cancel', 'security', 'incident', 'how-to', 'feedback', 'pricing', 'other'] as const;
export const TEAMS = ['Billing', 'Engineering', 'Security', 'Success'] as const;
export const RULE_IDS = ['refund', 'account-deletion', 'security', 'low-confidence', 'incident', 'couldnt-finish'] as const;
export const TOOL_NAMES = [
  'classify_ticket',
  'lookup_customer',
  'get_invoices',
  'get_service_status',
  'search_docs',
  'draft_reply',
  'escalate',
] as const;

export const ticketSchema = z.object({
  id: z.string(),
  subject: z.string(),
  body: z.string(),
  from: z.string(),
  plan: z.enum(PLANS),
  receivedAt: z.string().optional(),
});

export const customerSchema = z.object({
  email: z.string(),
  name: z.string(),
  plan: z.enum(PLANS),
  status: z.enum(['active', 'past_due', 'cancelled']),
  since: z.string(),
});

export const invoiceSchema = z.object({
  id: z.string(),
  email: z.string(),
  date: z.string(),
  amountUsd: z.number(),
  description: z.string(),
  status: z.enum(['paid', 'refunded']),
});

export const componentStatusSchema = z.object({
  component: z.enum(['API', 'Dashboard', 'Billing']),
  state: z.enum(['operational', 'degraded', 'outage']),
  note: z.string(),
});

export const helpDocSchema = z.object({ id: z.string(), title: z.string(), body: z.string() });

export const classificationSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  confidence: z.number().min(0).max(1).describe('How sure you are, 0 to 1'),
  intents: z.array(z.enum(INTENTS)).max(4),
});

export const draftSchema = z.object({
  text: z.string().min(1).max(1200),
  citations: z.array(z.string()).max(5).describe('Help article ids you used'),
});

export const escalationSchema = z.object({
  team: z.enum(TEAMS),
  reason: z.string().min(1).max(300),
});

export const outcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready-to-send'), draft: draftSchema }),
  z.object({
    status: z.literal('needs-human'),
    rule: z.enum(RULE_IDS),
    reason: z.string(),
    draft: draftSchema.optional(),
  }),
  z.object({
    status: z.literal('escalated'),
    team: z.enum(TEAMS),
    rule: z.enum(RULE_IDS).optional(),
    reason: z.string(),
    draft: draftSchema.optional(),
  }),
]);

export const runEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('run-start'), ticketId: z.string(), at: z.number() }),
  z.object({ type: z.literal('tool-call'), callId: z.string(), tool: z.enum(TOOL_NAMES), input: z.unknown(), at: z.number() }),
  z.object({
    type: z.literal('tool-result'),
    callId: z.string(),
    tool: z.enum(TOOL_NAMES),
    ok: z.boolean(),
    summary: z.string(),
    tone: z.enum(['ok', 'warn', 'danger']).optional(),
    at: z.number(),
  }),
  z.object({ type: z.literal('outcome'), outcome: outcomeSchema, at: z.number() }),
  z.object({ type: z.literal('error'), message: z.string(), code: z.literal('budget').optional(), at: z.number() }),
]);

export const recordedRunSchema = z.object({
  ticketId: z.string(),
  recordedAt: z.string(),
  model: z.string(),
  events: z.array(runEventSchema).min(1),
});
