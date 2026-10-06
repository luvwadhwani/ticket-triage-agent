import type { z } from 'zod';
import type * as s from './schemas';

export type Plan = (typeof s.PLANS)[number];
export type Category = (typeof s.CATEGORIES)[number];
export type Priority = (typeof s.PRIORITIES)[number];
export type Intent = (typeof s.INTENTS)[number];
export type Team = (typeof s.TEAMS)[number];
export type RuleId = (typeof s.RULE_IDS)[number];
export type ToolName = (typeof s.TOOL_NAMES)[number];

export type Ticket = z.infer<typeof s.ticketSchema>;
export type Customer = z.infer<typeof s.customerSchema>;
export type Invoice = z.infer<typeof s.invoiceSchema>;
export type ComponentStatus = z.infer<typeof s.componentStatusSchema>;
export type HelpDoc = z.infer<typeof s.helpDocSchema>;
export type Classification = z.infer<typeof s.classificationSchema>;
export type Draft = z.infer<typeof s.draftSchema>;
export type Escalation = z.infer<typeof s.escalationSchema>;
export type Outcome = z.infer<typeof s.outcomeSchema>;
export type OutcomeStatus = Outcome['status'];
export type RunEvent = z.infer<typeof s.runEventSchema>;
export type RecordedRun = z.infer<typeof s.recordedRunSchema>;

/** What the agent proposed as its final action, before the policy has its say. */
export type Proposal = { kind: 'reply'; draft: Draft } | { kind: 'escalate'; escalation: Escalation };

/** Facts collected during a run; the policy decides the outcome from these. */
export interface RunFindings {
  classification?: Classification;
  duplicateCharge: boolean;
  degradedComponents: string[];
  proposal?: Proposal;
}

export type Tone = 'ok' | 'warn' | 'danger';

/** What every tool function returns: output for the model, one plain-language line (and its tone) for the UI. */
export interface ToolOutcome<O> {
  ok: boolean;
  output: O;
  summary: string;
  tone?: Tone;
}
