'use client';

import { useState } from 'react';
import type { RunState } from '@/lib/client/run-state';
import { buildTimeline, emptyActivityText, formatDuration, formatRecordedAt, type TicketView, type TimelineStep } from '@/lib/present';
import type { RecordedRun } from '@/lib/types';
import { Icon } from './Icon';

function Step({ step }: { step: TimelineStep }) {
  const [open, setOpen] = useState(false);
  const tone = step.pending ? '' : step.tone ? ` t-${step.tone}` : '';
  return (
    <li className={`step${tone}${step.pending ? ' pending' : ''}`}>
      <span className="icon">
        <Icon name={step.kind} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div className="what">{step.title}</div>
        {step.result && <div className="result">{step.result}</div>}
        {step.confidence !== undefined && !step.pending && (
          <div className="meter">
            <i>
              <b style={{ width: `${step.confidence}%` }} />
            </i>
            {step.confidence}% confident
          </div>
        )}
        {step.call && !step.pending && (
          <>
            <button type="button" className="callbtn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? 'Hide tool call' : 'View tool call'}
            </button>
            {open && <pre className="call">{step.call}</pre>}
          </>
        )}
      </div>
      <span className="dur">{step.durationMs !== undefined && !step.pending ? formatDuration(step.durationMs) : ''}</span>
    </li>
  );
}

export function TicketPanel({
  ticket,
  state,
  recording,
  onRunLive,
}: {
  ticket: TicketView;
  state: RunState;
  recording: RecordedRun | null;
  onRunLive: () => void;
}) {
  const steps = buildTimeline(state.events);
  const outcome = state.events.findLast((e) => e.type === 'outcome');
  const source =
    state.source === 'live'
      ? 'Live run with Claude'
      : recording
        ? `Recorded run, ${formatRecordedAt(recording.recordedAt)}${recording.model === 'mock' ? ' (mock data)' : ''}`
        : 'No recording yet';

  return (
    <section className="ticket" aria-label="Ticket">
      <div className="ticket-head">
        <div>
          <h1>{ticket.subject}</h1>
          <div className="meta">
            <span>
              {ticket.name} · {ticket.from}
            </span>
            <span className="plan">{ticket.plan}</span>
            {ticket.received && <span>Received {ticket.received}</span>}
          </div>
        </div>
        <div className="runctl">
          <span className="source">{source}</span>
          <button type="button" className="btn" onClick={onRunLive} disabled={state.status === 'running'}>
            <span className="live-dot" aria-hidden="true" />
            Run live
          </button>
        </div>
      </div>

      {state.notice && (
        <p className="notice" role="status">
          {state.notice}
        </p>
      )}

      <div className="message">
        <div className="from">{ticket.name} wrote</div>
        <p>{ticket.body}</p>
      </div>

      <div className="activity-head">
        <h2>Agent activity</h2>
        {outcome && (
          <span>
            {steps.length} steps · {formatDuration(outcome.at)}
          </span>
        )}
      </div>
      {steps.length === 0 && <p className="empty">{emptyActivityText(state.status)}</p>}
      <ol className="steps">
        {steps.map((s) => (
          <Step key={s.key} step={s} />
        ))}
      </ol>
    </section>
  );
}
