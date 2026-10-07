import { runEventSchema } from '@/lib/schemas';
import type { RunEvent } from '@/lib/types';

export class LiveRunError extends Error {
  constructor(readonly status: number) {
    super(`Live run unavailable (${status})`);
    this.name = 'LiveRunError';
  }
}

/** Reads the NDJSON stream from POST /api/run. Throws LiveRunError if the run cannot finish cleanly. */
export async function* readRunStream(res: Response): AsyncGenerator<RunEvent> {
  if (!res.ok || !res.body) throw new LiveRunError(res.status);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let sawOutcome = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl = buffer.indexOf('\n');
    while (nl >= 0) {
      const text = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf('\n');
      if (!text) continue;
      const event = runEventSchema.parse(JSON.parse(text));
      if (event.type === 'error') throw new LiveRunError(502);
      if (event.type === 'outcome') sawOutcome = true;
      yield event;
    }
  }
  if (!sawOutcome) throw new LiveRunError(502);
}

/** Why a live run could not be shown, in one sentence. */
export function liveFailureReason(err: unknown): string {
  const status = err instanceof LiveRunError ? err.status : 0;
  if (status === 429) return 'Live runs are rate-limited (5 per day).';
  if (status === 503) return 'Live runs are switched off right now.';
  return 'The live run failed.';
}

export function liveFailureNotice(err: unknown): string {
  return `${liveFailureReason(err)} Showing the recorded run instead.`;
}

/** Shown when there is no recording to play; keeps the live failure reason when a live run fell back to it. */
export function noRecordingNotice(liveFailure?: string): string {
  return liveFailure ? `${liveFailure} There is no recording for this ticket yet.` : 'No recording for this ticket yet. Try “Run live”.';
}
