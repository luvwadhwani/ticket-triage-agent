'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { TicketView } from '@/lib/present';
import type { RecordedRun } from '@/lib/types';
import { DecisionPanel } from './DecisionPanel';
import { Inbox } from './Inbox';
import { TicketPanel } from './TicketPanel';
import { useRun } from './useRun';

export function Console({
  tickets,
  recordings,
  docTitles,
  repoUrl,
  initialTicketId,
}: {
  tickets: TicketView[];
  recordings: Record<string, RecordedRun | null>;
  docTitles: Record<string, string>;
  repoUrl: string | null;
  initialTicketId: string;
}) {
  const [selectedId, setSelectedId] = useState(initialTicketId);
  const getRecording = useCallback((id: string) => recordings[id] ?? null, [recordings]);
  const { state, start, dispatch } = useRun(getRecording);

  useEffect(() => {
    void start(selectedId, 'recorded');
  }, [selectedId, start]);

  const ticket = tickets.find((t) => t.id === selectedId) ?? tickets[0];

  return (
    <div className="app">
      <div className="intro">
        <p>
          <b>A working AI agent that triages support tickets.</b> Pick a ticket and watch it look things up, draft a reply, and stop for you
          when a safety rule applies. Acme Cloud is fictional and nothing is ever sent.
        </p>
      </div>

      <div className="topbar">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            A
          </span>
          Acme Cloud Support <small>Demo workspace</small>
        </div>
        <nav className="topnav" aria-label="About this demo">
          {repoUrl && <a href={`${repoUrl}#how-its-built`}>How it works</a>}
          <Link href="/evals">Accuracy</Link>
          {repoUrl && <a href={repoUrl}>Code on GitHub</a>}
        </nav>
      </div>

      <div className="workspace">
        <Inbox tickets={tickets} selectedId={selectedId} onSelect={setSelectedId} />
        <TicketPanel ticket={ticket} state={state} recording={recordings[selectedId] ?? null} onRunLive={() => void start(selectedId, 'live')} />
        <DecisionPanel key={state.runId} ticket={ticket} state={state} dispatch={dispatch} docTitles={docTitles} />
      </div>
    </div>
  );
}
