import { describe, expect, it } from 'vitest';
import { initialRunState, runReducer, selectOutcome, type RunState } from '@/lib/client/run-state';
import type { RunEvent } from '@/lib/types';

const start = (runId: number): RunState => runReducer(initialRunState, { type: 'start', runId, ticketId: 't1', source: 'live' });
const call: RunEvent = { type: 'tool-call', callId: 'c1', tool: 'lookup_customer', input: { email: 'a' }, at: 1 };
const result: RunEvent = { type: 'tool-result', callId: 'c1', tool: 'lookup_customer', ok: true, summary: 'Found', at: 2 };
const outcome: RunEvent = { type: 'outcome', outcome: { status: 'ready-to-send', draft: { text: 'Hi', citations: [] } }, at: 3 };

describe('runReducer', () => {
  it('ignores events from an older run (the visitor switched tickets)', () => {
    const s = runReducer(start(2), { type: 'event', runId: 1, event: call });
    expect(s.events).toEqual([]);
  });

  it('collects events from the current run and resets everything on start', () => {
    let s = runReducer(start(1), { type: 'event', runId: 1, event: call });
    s = runReducer(s, { type: 'decide', decision: { kind: 'escalated', team: 'Billing' } });
    expect(s.events).toHaveLength(1);
    s = runReducer(s, { type: 'start', runId: 2, ticketId: 't2', source: 'recorded' });
    expect(s).toMatchObject({ runId: 2, ticketId: 't2', events: [], decision: null, status: 'running' });
  });

  it('fallback switches to the recording, clears live events and keeps the notice', () => {
    let s = runReducer(start(1), { type: 'event', runId: 1, event: call });
    s = runReducer(s, { type: 'fallback', runId: 1, notice: 'Rate-limited' });
    expect(s).toMatchObject({ source: 'recorded', events: [], notice: 'Rate-limited' });
  });

  it('shows a notice for the current run only', () => {
    expect(runReducer(start(2), { type: 'notice', runId: 2, notice: 'No recording' }).notice).toBe('No recording');
    expect(runReducer(start(2), { type: 'notice', runId: 1, notice: 'No recording' }).notice).toBeNull();
  });

  it('undo clears the decision so the visitor can choose again', () => {
    let s = runReducer(start(1), { type: 'decide', decision: { kind: 'approved', text: 'Hi' } });
    s = runReducer(s, { type: 'undo' });
    expect(s.decision).toBeNull();
  });

  it('marks the run done only for the current run', () => {
    expect(runReducer(start(2), { type: 'done', runId: 1 }).status).toBe('running');
    expect(runReducer(start(2), { type: 'done', runId: 2 }).status).toBe('done');
  });
});

describe('selectOutcome', () => {
  it('finds the outcome, or null while running', () => {
    expect(selectOutcome([call, result])).toBeNull();
    expect(selectOutcome([call, result, outcome])).toEqual(outcome.type === 'outcome' && outcome.outcome);
  });
});
