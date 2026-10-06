import { RULE_TEXT, teamForEscalation } from './policy';
import type { Outcome, RuleId, RunEvent, Team, Ticket, Tone, ToolName } from './types';

/** Plain-language presentation of runs and outcomes, shared by the console components. */

/** A ticket as the inbox shows it: who sent it, when, and how the recorded run ended. */
export interface TicketView extends Ticket {
  name: string;
  received: string;
  status: { kind: TagKind; label: string } | null;
}

export const STEP_TITLE: Record<ToolName, string> = {
  classify_ticket: 'Classified the ticket',
  lookup_customer: 'Looked up the customer',
  get_invoices: 'Checked billing',
  get_service_status: 'Checked service status',
  search_docs: 'Searched the help center',
  draft_reply: 'Drafted a reply',
  escalate: 'Proposed a hand-off',
};

export const RULE_LABEL: Record<RuleId, string> = {
  refund: 'Refund rule',
  'account-deletion': 'Account rule',
  security: 'Security rule',
  'low-confidence': 'Confidence rule',
  incident: 'Incident rule',
  'couldnt-finish': 'Step limit',
};

export interface TimelineStep {
  key: string;
  kind: ToolName | 'policy';
  title: string;
  result?: string;
  tone?: Tone;
  durationMs?: number;
  call?: string;
  confidence?: number;
  pending: boolean;
}

export function safetyText(o: Outcome): string {
  if (o.status !== 'ready-to-send' && o.rule) return `${RULE_LABEL[o.rule]}: ${RULE_TEXT[o.rule]}`;
  if (o.status === 'escalated') return `No rule applies; the agent handed this to ${o.team}`;
  return 'No rule applies';
}

function policyTone(o: Outcome): Tone {
  if (o.status === 'ready-to-send') return 'ok';
  if (o.status === 'escalated' && o.rule === 'incident') return 'danger';
  return o.status === 'escalated' && !o.rule ? 'ok' : 'warn';
}

export function buildTimeline(events: RunEvent[]): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const startedAt = new Map<string, number>();
  let lastAt = 0;
  for (const e of events) {
    if (e.type === 'tool-call') {
      startedAt.set(e.callId, lastAt);
      const conf = e.tool === 'classify_ticket' ? (e.input as { confidence?: unknown } | undefined)?.confidence : undefined;
      steps.push({
        key: e.callId,
        kind: e.tool,
        title: STEP_TITLE[e.tool],
        call: `${e.tool}(${JSON.stringify(e.input ?? {})})`,
        ...(typeof conf === 'number' ? { confidence: Math.round(conf * 100) } : {}),
        pending: true,
      });
    } else if (e.type === 'tool-result') {
      const step = steps.find((s) => s.key === e.callId);
      if (step) {
        step.result = e.summary;
        step.tone = e.tone ?? (e.ok ? undefined : 'warn');
        step.durationMs = e.at - (startedAt.get(e.callId) ?? lastAt);
        step.pending = false;
      }
      lastAt = e.at;
    } else if (e.type === 'outcome') {
      steps.push({
        key: 'policy',
        kind: 'policy',
        title: 'Ran the safety rules',
        result: safetyText(e.outcome),
        tone: policyTone(e.outcome),
        durationMs: e.at - lastAt,
        pending: false,
      });
    }
  }
  return steps;
}

export type TagKind = 'ready' | 'human' | 'escalated';

export interface Tag {
  kind: TagKind;
  label: string;
  sub: string;
  why: string;
  team: Team;
}

export function tagFor(o: Outcome): Tag {
  const team = teamForEscalation(o);
  if (o.status === 'ready-to-send') {
    return { kind: 'ready', label: 'Ready to send', sub: 'No safety rule applies', why: 'No safety rule applies. You can send it as is or edit it first.', team };
  }
  if (o.status === 'needs-human') {
    return { kind: 'human', label: 'Needs your approval', sub: RULE_LABEL[o.rule], why: `${o.reason} The agent stopped and left the decision to you.`, team };
  }
  return { kind: 'escalated', label: `Escalated to ${o.team}`, sub: o.rule ? RULE_LABEL[o.rule] : 'The agent’s call', why: o.reason, team };
}

export function inboxStatus(o: Outcome | null): { kind: TagKind; label: string } | null {
  if (!o) return null;
  if (o.status === 'ready-to-send') return { kind: 'ready', label: 'Ready to send' };
  if (o.status === 'needs-human') return { kind: 'human', label: 'Needs approval' };
  return { kind: 'escalated', label: 'Escalated' };
}

/** Placeholder for the decision panel before there is an outcome. */
export function waitingText(status: 'idle' | 'running' | 'done'): string {
  return status === 'done' ? 'There is no result to show for this ticket.' : 'The agent is working. Its recommendation appears here.';
}

/** Placeholder for the activity timeline before the first step. */
export function emptyActivityText(status: 'idle' | 'running' | 'done'): string {
  return status === 'done' ? 'There is no agent activity to show for this ticket.' : 'Starting…';
}

export function formatDuration(ms: number): string {
  return ms < 100 ? '<0.1s' : `${(ms / 1000).toFixed(1)}s`;
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
}

export function formatRecordedAt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .slice(0, 2)
    .join('');
}
