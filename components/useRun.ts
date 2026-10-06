'use client';

import { useCallback, useReducer, useRef } from 'react';
import { initialRunState, runReducer, type RunSource } from '@/lib/client/run-state';
import { liveFailureNotice, liveFailureReason, noRecordingNotice, readRunStream } from '@/lib/client/run-stream';
import { replay } from '@/lib/replay';
import type { RecordedRun } from '@/lib/types';

export function useRun(getRecording: (ticketId: string) => RecordedRun | null) {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (ticketId: string, source: RunSource) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const runId = ++runIdRef.current;
      dispatch({ type: 'start', runId, ticketId, source });

      const playRecording = async (liveFailure?: string) => {
        const rec = getRecording(ticketId);
        if (!rec) {
          dispatch({ type: 'notice', runId, notice: noRecordingNotice(liveFailure) });
          return;
        }
        await replay(rec.events, (event) => dispatch({ type: 'event', runId, event }), { signal: ctrl.signal });
      };

      try {
        if (source === 'live') {
          try {
            const res = await fetch('/api/run', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ticketId }),
              signal: ctrl.signal,
            });
            for await (const event of readRunStream(res)) dispatch({ type: 'event', runId, event });
          } catch (err) {
            if (ctrl.signal.aborted) return;
            dispatch({ type: 'fallback', runId, notice: liveFailureNotice(err) });
            await playRecording(liveFailureReason(err));
          }
        } else {
          await playRecording();
        }
        dispatch({ type: 'done', runId });
      } catch {
        // aborted because the visitor started another run
      }
    },
    [getRecording],
  );

  return { state, start, dispatch };
}
