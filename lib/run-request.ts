import { getTicket } from './data';
import type { Ticket } from './types';

export type RunRequest = { ok: true; ticket: Ticket } | { ok: false; error: string };

export function parseRunRequest(body: unknown): RunRequest {
  const ticketId = typeof body === 'object' && body !== null ? (body as { ticketId?: unknown }).ticketId : undefined;
  if (typeof ticketId !== 'string') return { ok: false, error: 'Expected {"ticketId": "<preset ticket id>"}.' };
  const ticket = getTicket(ticketId);
  return ticket ? { ok: true, ticket } : { ok: false, error: 'Unknown ticket. Live runs only accept the preset tickets.' };
}

/** Live runs cost money, so they are off unless LIVE_RUNS_ENABLED is exactly "true" (set it in Vercel). */
export const liveRunsEnabled = () => process.env.LIVE_RUNS_ENABLED === 'true';

/**
 * Blocks other websites from starting live runs in their visitors' browsers: a JSON content type forces a
 * CORS preflight (which fails cross-origin), and browsers label cross-site requests with Sec-Fetch-Site.
 */
export function checkOrigin(req: Request): { status: 403 | 415; error: string } | null {
  if (!(req.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return { status: 415, error: 'Send the request body as application/json.' };
  }
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return { status: 403, error: 'Live runs can only be started from the demo page.' };
  return null;
}
