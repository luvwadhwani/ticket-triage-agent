import { runAgent } from '@/lib/agent/run';
import { getModel } from '@/lib/model';
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
