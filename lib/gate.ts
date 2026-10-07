// gate v2. The canonical copy lives in luvwadhwani/portfolio-hub (lib/gate.ts) with its tests.
// Copy it unchanged into each project, next to proxy.ts (templates/proxy.ts in the hub).
import { errors, importSPKI, jwtVerify } from 'jose';

export const PASS_COOKIE = 'lw_pass';
export const PASS_ISSUER = 'work.luvwadhwani.com';
export const PASS_ALG = 'Ed25519';
export const RENEWED_PARAM = 'lw_renewed';

export interface Viewer {
  id: string;
  name: string;
  projects: string[];
}

export type Verified = { ok: true; viewer: Viewer } | { ok: false; reason: 'missing' | 'invalid' | 'expired' | 'not-in-project' };

export type FailReason = Extract<Verified, { ok: false }>['reason'];

export type GateDecision =
  | { kind: 'allow'; viewer: Viewer }
  | { kind: 'redirect'; location: string }
  | { kind: 'deny'; status: 401; error: string }
  | { kind: 'stop'; reason: FailReason; retry: string };

export interface GateEnv {
  publicKey: string;
  hubUrl: string;
  projectId: string;
  canonicalOrigin: string | null;
}

const keys = new Map<string, ReturnType<typeof importSPKI>>();
function publicKey(pem: string) {
  let key = keys.get(pem);
  if (!key) {
    key = importSPKI(pem, PASS_ALG);
    keys.set(pem, key);
  }
  return key;
}

export async function verifyPass(token: string | undefined, publicKeyPem: string, projectId: string, now: Date): Promise<Verified> {
  if (!token) return { ok: false, reason: 'missing' };
  try {
    const { payload } = await jwtVerify(token, await publicKey(publicKeyPem), {
      issuer: PASS_ISSUER,
      algorithms: [PASS_ALG],
      currentDate: now,
    });
    if (typeof payload.sub !== 'string' || typeof payload.name !== 'string' || !Array.isArray(payload.projects)) {
      return { ok: false, reason: 'invalid' };
    }
    const projects = payload.projects.filter((p): p is string => typeof p === 'string');
    if (!projects.includes(projectId)) return { ok: false, reason: 'not-in-project' };
    return { ok: true, viewer: { id: payload.sub, name: payload.name, projects } };
  } catch (err) {
    return { ok: false, reason: err instanceof errors.JWTExpired ? 'expired' : 'invalid' };
  }
}

/** What the project should do with a request, given its pass. Pure, so it can be tested without a server. */
export function gateDecision(
  req: { method: string; url: string; renewed: boolean },
  verified: Verified,
  hubUrl: string,
  canonicalOrigin?: string | null,
): GateDecision {
  const url = new URL(req.url);
  if (canonicalOrigin && url.origin !== canonicalOrigin) {
    return { kind: 'redirect', location: `${canonicalOrigin}${url.pathname}${url.search}` };
  }
  const isPage = (req.method === 'GET' || req.method === 'HEAD') && !url.pathname.startsWith('/api/');
  if (verified.ok) {
    if (isPage && url.searchParams.has(RENEWED_PARAM)) {
      url.searchParams.delete(RENEWED_PARAM);
      return { kind: 'redirect', location: url.href };
    }
    return { kind: 'allow', viewer: verified.viewer };
  }
  if (!isPage) return { kind: 'deny', status: 401, error: 'Sign in again to continue.' };
  url.searchParams.delete(RENEWED_PARAM);
  // The hub just renewed and sent us back, yet the pass still doesn't work here (blocked cookie, wrong
  // key, project not set up in the hub): stop with plain words instead of redirecting forever.
  if (req.renewed) return { kind: 'stop', reason: verified.reason, retry: url.href };
  // The gate marks the way back itself, so it never depends on the hub recognising this project.
  url.searchParams.set(RENEWED_PARAM, '1');
  return { kind: 'redirect', location: `${hubUrl}/renew?next=${encodeURIComponent(url.href)}` };
}

const STOP_TEXT: Record<FailReason, string> = {
  missing: "Your browser didn't keep the sign-in cookie, so this page can't open. Allow cookies for luvwadhwani.com and try again.",
  'not-in-project': "This project isn't part of your access.",
  invalid: "This page couldn't confirm your sign-in. Try again, or ask Luv to check your access.",
  expired: "This page couldn't confirm your sign-in. Try again, or ask Luv to check your access.",
};

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function stopPageHtml(reason: FailReason, retry: string, hubUrl: string): string {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Can't open this page</title><div style="font:16px/1.5 system-ui,sans-serif;margin:48px auto;max-width:34em;padding:0 16px"><p>${STOP_TEXT[reason]}</p><p><a href="${escapeHtml(retry)}">Try again</a> · <a href="${escapeHtml(hubUrl)}">All projects</a></p></div>`;
}

export function readCookie(cookieHeader: string | null, name: string): string | undefined {
  for (const part of (cookieHeader ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function gateEnv(env: Record<string, string | undefined> = process.env): GateEnv {
  const publicKey = env.GATE_PUBLIC_KEY?.replace(/\\n/g, '\n');
  const hubUrl = env.NEXT_PUBLIC_HUB_URL;
  const projectId = env.PROJECT_ID;
  if (!publicKey || !hubUrl || !projectId) {
    throw new Error('The gate needs GATE_PUBLIC_KEY, NEXT_PUBLIC_HUB_URL and PROJECT_ID.');
  }
  return { publicKey, hubUrl: new URL(hubUrl).origin, projectId, canonicalOrigin: env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN).origin : null };
}

/** Tells the hub a page was opened. Fire-and-forget: a lost log line must never block the visitor. */
export async function sendVisit(env: GateEnv, pass: string, url: URL, headers: Headers): Promise<void> {
  const city = headers.get('x-vercel-ip-city');
  await fetch(`${env.hubUrl}/api/visit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${pass}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      project: env.projectId,
      path: url.pathname + url.search,
      city: city ? decodeURIComponent(city) : null,
      country: headers.get('x-vercel-ip-country'),
    }),
    signal: AbortSignal.timeout(3000),
  });
}
