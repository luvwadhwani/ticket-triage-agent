import { describe, expect, it } from 'vitest';
import { LiveRunError, hubOrigin, liveFailureNotice, liveFailureReason, noRecordingNotice, readRunStream, renewUrl } from '@/lib/client/run-stream';
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

  it('reports a spent AI budget as status 402', async () => {
    await expect(collect(streamOf([line(startEv), line({ type: 'error', message: 'x', code: 'budget', at: 1 })]))).rejects.toMatchObject({ status: 402 });
  });

  it('throws when the stream ends before an outcome', async () => {
    await expect(collect(streamOf([line(startEv)]))).rejects.toBeInstanceOf(LiveRunError);
  });
});

describe('liveFailureNotice', () => {
  it('explains each reason a live run could not start', () => {
    expect(liveFailureNotice(new LiveRunError(429))).toBe("You've used today's live runs. Showing the recorded run.");
    expect(liveFailureNotice(new LiveRunError(403))).toBe('Your access has ended. Showing the recorded run.');
    expect(liveFailureNotice(new LiveRunError(402))).toBe("This month's live-run budget is used up. Showing the recorded run.");
    expect(liveFailureNotice(new LiveRunError(503))).toBe('Live runs are paused right now. Showing the recorded run.');
    expect(liveFailureNotice(new TypeError('fetch failed'))).toBe('The live run failed. Showing the recorded run.');
  });
});

describe('noRecordingNotice', () => {
  it('points to Run live when a recording is missing', () => {
    expect(noRecordingNotice()).toBe('No recording for this ticket yet. Try “Run live”.');
  });
  it('keeps the live failure reason when there is no recording to fall back to either', () => {
    expect(noRecordingNotice(liveFailureReason(new LiveRunError(429)))).toBe("You've used today's live runs. There is no recording for this ticket yet.");
  });
});

describe('hubOrigin', () => {
  it('reduces the configured hub address to its origin, so a trailing slash never makes //api/sign-out', () => {
    expect(hubOrigin('https://work.luvwadhwani.com/')).toBe('https://work.luvwadhwani.com');
    expect(hubOrigin('http://localhost:3100')).toBe('http://localhost:3100');
    expect(hubOrigin(undefined)).toBe('');
  });
});

describe('renewUrl', () => {
  it('works with a hub address that ends in a slash', () => {
    expect(renewUrl('https://work.luvwadhwani.com/', 'https://triage.luvwadhwani.com/?ticket=t4')).toBe(
      'https://work.luvwadhwani.com/renew?next=https%3A%2F%2Ftriage.luvwadhwani.com%2F%3Fticket%3Dt4',
    );
  });

  it('sends the browser through the hub and back to the same ticket', () => {
    expect(renewUrl('http://localhost:3100', 'http://localhost:3000/?ticket=t4')).toBe(
      'http://localhost:3100/renew?next=http%3A%2F%2Flocalhost%3A3000%2F%3Fticket%3Dt4',
    );
  });
});
