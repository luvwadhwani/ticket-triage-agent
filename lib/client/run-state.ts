import type { Outcome, RunEvent, Team } from '@/lib/types';

export type RunSource = 'recorded' | 'live';
export type Decision = { kind: 'approved'; text: string } | { kind: 'escalated'; team: Team };

export interface RunState {
  runId: number;
  ticketId: string | null;
  source: RunSource | null;
  status: 'idle' | 'running' | 'done';
  events: RunEvent[];
  notice: string | null;
  editedDraft: string | null;
  decision: Decision | null;
}

export const initialRunState: RunState = {
  runId: 0,
  ticketId: null,
  source: null,
  status: 'idle',
  events: [],
  notice: null,
  editedDraft: null,
  decision: null,
};

export type RunAction =
  | { type: 'start'; runId: number; ticketId: string; source: RunSource }
  | { type: 'event'; runId: number; event: RunEvent }
  | { type: 'fallback'; runId: number; notice: string }
  | { type: 'notice'; runId: number; notice: string }
  | { type: 'done'; runId: number }
  | { type: 'edit'; text: string }
  | { type: 'decide'; decision: Decision }
  | { type: 'undo' };

export function runReducer(state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case 'start':
      return { ...initialRunState, runId: action.runId, ticketId: action.ticketId, source: action.source, status: 'running' };
    case 'edit':
      return { ...state, editedDraft: action.text };
    case 'decide':
      return { ...state, decision: action.decision };
    case 'undo':
      return { ...state, decision: null };
  }
  if (action.runId !== state.runId) return state; // stale: from a run the visitor already left
  switch (action.type) {
    case 'event':
      return { ...state, events: [...state.events, action.event] };
    case 'fallback':
      return { ...state, source: 'recorded', events: [], notice: action.notice };
    case 'notice':
      return { ...state, notice: action.notice };
    case 'done':
      return { ...state, status: 'done' };
  }
  return state;
}

export function selectOutcome(events: RunEvent[]): Outcome | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'outcome') return e.outcome;
  }
  return null;
}
