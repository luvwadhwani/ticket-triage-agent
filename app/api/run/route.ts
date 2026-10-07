import { runAgent } from '@/lib/agent/run';
import { getModel } from '@/lib/model';
import { clientIp, getLiveRunLimiter, type LimitResult } from '@/lib/rate-limit';
import { checkOrigin, liveRunsEnabled, parseRunRequest } from '@/lib/run-request';
import type { RunEvent } from '@/lib/types';

export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  if (!liveRunsEnabled()) return Response.json({ error: 'Live runs are switched off.' }, { status: 503 });
  const blocked = checkOrigin(req);
  if (blocked) return Response.json({ error: blocked.error }, { status: blocked.status });

  const parsed = parseRunRequest(await req.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const ticket = parsed.ticket;

  const limited = await checkLimits(req);
  if (limited) return Response.json({ error: limited.error }, { status: limited.status });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: RunEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          // the visitor navigated away; nothing to send to
        }
      };
      try {
        await runAgent({ ticket, model: getModel(), emit: send, abortSignal: req.signal });
      } catch (err) {
        console.error('live run failed', err);
        send({ type: 'error', message: 'The live run failed.', at: 0 });
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Fails closed: without a working counter, live runs could spend the AI budget unchecked. */
async function checkLimits(req: Request): Promise<{ status: 429 | 503; error: string } | null> {
  const limiter = getLiveRunLimiter();
  if (!limiter) return { status: 503, error: 'Live runs are paused: the rate limiter is not configured.' };
  let result: LimitResult;
  try {
    result = await limiter(clientIp(req));
  } catch (err) {
    console.error('rate limiter unavailable', err);
    return { status: 503, error: 'Live runs are paused: the rate limiter is unavailable.' };
  }
  if (result === 'visitor-limit') return { status: 429, error: 'You have used today’s live runs.' };
  if (result === 'site-limit') return { status: 503, error: 'Live runs are paused for the rest of the day.' };
  return null;
}
