import { describe, expect, it } from 'vitest';
import { LiveRunError, liveFailureNotice, liveFailureReason, noRecordingNotice, readRunStream } from '@/lib/client/run-stream';
import type { RunEvent } from '@/lib/types';

const streamOf = (chunks: string[], status = 200) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
        c.close();
      },
    }),
    { status },
  );

const line = (e: RunEvent) => `${JSON.stringify(e)}\n`;
const startEv: RunEvent = { type: 'run-start', ticketId: 't1', at: 0 };
const outcomeEv: RunEvent = { type: 'outcome', outcome: { status: 'ready-to-send', draft: { text: 'Hi', citations: [] } }, at: 5 };

async function collect(res: Response) {
  const out: RunEvent[] = [];
  for await (const e of readRunStream(res)) out.push(e);
  return out;
}

describe('readRunStream', () => {
  it('parses events even when a line is split across chunks', async () => {
    const text = line(startEv) + line(outcomeEv);
    expect(await collect(streamOf([text.slice(0, 10), text.slice(10, 40), text.slice(40)]))).toEqual([startEv, outcomeEv]);
  });

  it('throws LiveRunError with the HTTP status when the request was refused', async () => {
    await expect(collect(new Response('', { status: 429 }))).rejects.toMatchObject({ status: 429 });
  });

  it('throws when the server reports an error event', async () => {
    await expect(collect(streamOf([line(startEv), line({ type: 'error', message: 'x', at: 1 })]))).rejects.toBeInstanceOf(LiveRunError);
  });

  it('throws when the stream ends before an outcome', async () => {
    await expect(collect(streamOf([line(startEv)]))).rejects.toBeInstanceOf(LiveRunError);
  });
});

describe('liveFailureNotice', () => {
  it('explains rate limits, the kill switch and other failures', () => {
    expect(liveFailureNotice(new LiveRunError(429))).toBe('Live runs are rate-limited (5 per hour). Showing the recorded run instead.');
    expect(liveFailureNotice(new LiveRunError(503))).toBe('Live runs are switched off right now. Showing the recorded run instead.');
    expect(liveFailureNotice(new TypeError('fetch failed'))).toBe('The live run failed. Showing the recorded run instead.');
  });
});

describe('noRecordingNotice', () => {
  it('points to Run live when a recording is missing', () => {
    expect(noRecordingNotice()).toBe('No recording for this ticket yet. Try “Run live”.');
  });
  it('keeps the live failure reason when there is no recording to fall back to either', () => {
    expect(noRecordingNotice(liveFailureReason(new LiveRunError(429)))).toBe(
      'Live runs are rate-limited (5 per hour). There is no recording for this ticket yet.',
    );
  });
});
