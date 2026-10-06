import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  formatClock,
  formatDuration,
  formatRecordedAt,
  emptyActivityText,
  waitingText,
  initials,
  inboxStatus,
  safetyText,
  tagFor,
} from '@/lib/present';
import type { Outcome, RunEvent } from '@/lib/types';

const draft = { text: 'Hi', citations: [] };
const needsRefund: Outcome = { status: 'needs-human', rule: 'refund', reason: 'Refunds always need human approval.', draft };
const ready: Outcome = { status: 'ready-to-send', draft };
const incident: Outcome = { status: 'escalated', team: 'Engineering', rule: 'incident', reason: 'A possible outage goes straight to Engineering.' };

const events: RunEvent[] = [
  { type: 'run-start', ticketId: 't1', at: 0 },
  { type: 'tool-call', callId: 'c1', tool: 'classify_ticket', input: { category: 'Billing', priority: 'High', confidence: 0.93, intents: ['refund'] }, at: 880 },
  { type: 'tool-result', callId: 'c1', tool: 'classify_ticket', ok: true, summary: 'Billing, high priority', at: 900 },
  { type: 'tool-call', callId: 'c2', tool: 'get_invoices', input: { email: 'maya@example.com' }, at: 1400 },
  { type: 'tool-result', callId: 'c2', tool: 'get_invoices', ok: true, summary: 'Found a duplicate charge', tone: 'warn', at: 1410 },
  { type: 'tool-call', callId: 'c3', tool: 'lookup_customer', input: { email: 'x' }, at: 1800 },
];

describe('buildTimeline', () => {
  it('turns tool calls into plain-language steps with durations and confidence', () => {
    const [classify, billing, pending] = buildTimeline(events);
    expect(classify).toMatchObject({ title: 'Classified the ticket', result: 'Billing, high priority', confidence: 93, durationMs: 900, pending: false });
    expect(billing).toMatchObject({ title: 'Checked billing', tone: 'warn', durationMs: 510, call: 'get_invoices({"email":"maya@example.com"})' });
    expect(pending).toMatchObject({ title: 'Looked up the customer', pending: true });
    expect(pending.result).toBeUndefined();
  });

  it('marks a failed tool as a warning even without a tone', () => {
    const [step] = buildTimeline([
      { type: 'tool-call', callId: 'c1', tool: 'lookup_customer', input: {}, at: 10 },
      { type: 'tool-result', callId: 'c1', tool: 'lookup_customer', ok: false, summary: 'No customer found', at: 20 },
    ]);
    expect(step.tone).toBe('warn');
  });

  it('adds the safety check as the last step once the outcome arrives', () => {
    const done = buildTimeline([...events.slice(0, 5), { type: 'outcome', outcome: needsRefund, at: 1411 }]);
    expect(done.at(-1)).toMatchObject({ kind: 'policy', title: 'Ran the safety rules', result: 'Refund rule: Refunds always need human approval.', tone: 'warn', durationMs: 1 });
  });
});

describe('safetyText', () => {
  it('names the rule that fired, or says none applied', () => {
    expect(safetyText(needsRefund)).toBe('Refund rule: Refunds always need human approval.');
    expect(safetyText(ready)).toBe('No rule applies');
    expect(safetyText({ status: 'escalated', team: 'Billing', reason: 'EUR invoice' })).toBe('No rule applies; the agent handed this to Billing');
  });
});

describe('tagFor', () => {
  it('maps each outcome to the triage tag and the team a person would hand it to', () => {
    expect(tagFor(needsRefund)).toMatchObject({ kind: 'human', label: 'Needs your approval', sub: 'Refund rule', team: 'Billing' });
    expect(tagFor(ready)).toMatchObject({ kind: 'ready', label: 'Ready to send', sub: 'No safety rule applies', team: 'Success' });
    expect(tagFor(incident)).toMatchObject({ kind: 'escalated', label: 'Escalated to Engineering', sub: 'Incident rule', team: 'Engineering' });
  });
});

describe('inboxStatus', () => {
  it('summarises an outcome for the inbox, or nothing before a run', () => {
    expect(inboxStatus(ready)).toEqual({ kind: 'ready', label: 'Ready to send' });
    expect(inboxStatus(needsRefund)).toEqual({ kind: 'human', label: 'Needs approval' });
    expect(inboxStatus(incident)).toEqual({ kind: 'escalated', label: 'Escalated' });
    expect(inboxStatus(null)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats durations, clock times, dates and initials', () => {
    expect(formatDuration(1)).toBe('<0.1s');
    expect(formatDuration(1720)).toBe('1.7s');
    expect(formatClock('2026-10-06T09:42:00Z')).toBe('9:42 AM');
    expect(formatRecordedAt('2026-10-06T23:30:00.000Z')).toBe('Oct 6, 2026');
    expect(initials('Maya Chen')).toBe('MC');
  });
});

describe('placeholders', () => {
  it('only says the agent is working while a run is in progress', () => {
    expect(waitingText('running')).toBe('The agent is working. Its recommendation appears here.');
    expect(waitingText('done')).toBe('There is no result to show for this ticket.');
    expect(emptyActivityText('running')).toBe('Starting…');
    expect(emptyActivityText('done')).toBe('There is no agent activity to show for this ticket.');
  });
});
