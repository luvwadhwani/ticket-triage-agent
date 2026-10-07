import { PASS_COOKIE, readCookie } from './gate';

export type HubClaim = { ok: true } | { ok: false; status: 401 | 403 | 429 | 503; error: string };

const PAUSED = 'Live runs are paused right now.';

/** Asks the hub before every live run: is this invite still valid, and does it have runs left today? */
export async function claimLiveRun(
  opts: { hubUrl: string; pass: string; project: string; detail: string; city: string | null; country: string | null },
  fetchImpl: typeof fetch = fetch,
): Promise<HubClaim> {
  try {
    const res = await fetchImpl(`${opts.hubUrl}/api/live-run`, {
      method: 'POST',
      headers: { authorization: `Bearer ${opts.pass}`, 'content-type': 'application/json' },
      body: JSON.stringify({ project: opts.project, detail: opts.detail, city: opts.city, country: opts.country }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) return { ok: true };
    const status = res.status;
    if (status === 401 || status === 403 || status === 429) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, status, error: body.error ?? PAUSED };
    }
    return { ok: false, status: 503, error: PAUSED };
  } catch {
    return { ok: false, status: 503, error: PAUSED };
  }
}

export const passFrom = (req: Request) => readCookie(req.headers.get('cookie'), PASS_COOKIE);

export function visitorGeo(headers: Headers): { city: string | null; country: string | null } {
  const raw = headers.get('x-vercel-ip-city');
  let city: string | null = null;
  if (raw) {
    try {
      city = decodeURIComponent(raw);
    } catch {
      city = raw;
    }
  }
  return { city, country: headers.get('x-vercel-ip-country') || null };
}

/** AI Gateway rejects with HTTP 402 / quota_for_entity_exceeded once the monthly budget is spent. */
export function isBudgetError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { message?: unknown; statusCode?: unknown; responseBody?: unknown; cause?: unknown };
  if (e.statusCode === 402) return true;
  const text = [e.message, e.responseBody].filter((x): x is string => typeof x === 'string').join(' ');
  if (/quota_for_entity_exceeded|budget exceeded/i.test(text)) return true;
  return e.cause !== undefined && e.cause !== err ? isBudgetError(e.cause) : false;
}
