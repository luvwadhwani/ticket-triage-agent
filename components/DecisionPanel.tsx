'use client';

import { useState, type Dispatch } from 'react';
import { selectOutcome, type RunAction, type RunState } from '@/lib/client/run-state';
import { tagFor, type TicketView, waitingText } from '@/lib/present';
import { Icon } from './Icon';

export function DecisionPanel({
  ticket,
  state,
  dispatch,
  docTitles,
}: {
  ticket: TicketView;
  state: RunState;
  dispatch: Dispatch<RunAction>;
  docTitles: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const outcome = selectOutcome(state.events);

  if (!outcome) {
    return (
      <section className="decision" aria-label="Your decision">
        <h2>Your decision</h2>
        <p className="waiting">{waitingText(state.status)}</p>
      </section>
    );
  }

  const tag = tagFor(outcome);
  const draft = 'draft' in outcome ? outcome.draft : undefined;
  const text = state.editedDraft ?? draft?.text ?? '';
  const busy = state.status === 'running';

  return (
    <section className="decision" aria-label="Your decision">
      <h2>Your decision</h2>
      <div className={`tag ${tag.kind}`}>
        <div className="label">{tag.label}</div>
        <div className="rule">{tag.sub}</div>
      </div>
      <p className="why">{tag.why}</p>

      {draft && (
        <>
          <div className="draft">
            <div className="draft-head">
              <span>To {ticket.from}</span>
              <span>{editing ? 'Editing' : 'Draft'}</span>
            </div>
            {editing ? (
              <textarea
                id="draft-edit"
                aria-label="Edit the reply"
                value={text}
                onChange={(e) => dispatch({ type: 'edit', text: e.target.value })}
                autoFocus
              />
            ) : (
              <div className="draft-body">{text}</div>
            )}
          </div>
          {draft.citations.length > 0 && (
            <div className="cites">
              <h3>Sources</h3>
              {draft.citations.map((c) => (
                <div className="cite" key={c}>
                  <Icon name="doc" />
                  {docTitles[c] ?? c}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {state.decision ? (
        <div className="confirm" role="status">
          {state.decision.kind === 'approved' ? (
            <>
              <b>Reply approved for {ticket.from}.</b>
              <small>In a real helpdesk this would send now. This demo never sends anything.</small>
            </>
          ) : (
            <>
              <b>Handed to the {state.decision.team} team with the agent&apos;s notes.</b>
              <small>This demo never contacts anyone.</small>
            </>
          )}
          <button type="button" className="undo" onClick={() => dispatch({ type: 'undo' })}>
            Undo
          </button>
        </div>
      ) : (
        <div className="actions">
          {draft && (
            <>
              <button
                type="button"
                className="btn primary"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  dispatch({ type: 'decide', decision: { kind: 'approved', text } });
                }}
              >
                Approve and send
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => setEditing((v) => !v)}>
                {editing ? 'Done editing' : 'Edit reply'}
              </button>
            </>
          )}
          <button
            type="button"
            className={draft ? 'btn' : 'btn primary'}
            disabled={busy}
            onClick={() => dispatch({ type: 'decide', decision: { kind: 'escalated', team: tag.team } })}
          >
            Hand to {tag.team}
          </button>
        </div>
      )}
    </section>
  );
}
