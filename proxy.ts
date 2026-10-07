// proxy v2. The canonical copy lives in luvwadhwani/portfolio-hub (templates/proxy.ts).
// Copy it unchanged to a project's root as proxy.ts, next to lib/gate.ts.
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { PASS_COOKIE, RENEWED_PARAM, gateDecision, gateEnv, sendVisit, stopPageHtml, verifyPass } from '@/lib/gate';

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const env = gateEnv();
  const pass = req.cookies.get(PASS_COOKIE)?.value;
  const verified = await verifyPass(pass, env.publicKey, env.projectId, new Date());
  const decision = gateDecision(
    { method: req.method, url: req.nextUrl.href, renewed: req.nextUrl.searchParams.has(RENEWED_PARAM) },
    verified,
    env.hubUrl,
    env.canonicalOrigin,
  );
  if (decision.kind === 'redirect') return NextResponse.redirect(decision.location, 307);
  if (decision.kind === 'deny') return NextResponse.json({ error: decision.error }, { status: decision.status });
  if (decision.kind === 'stop') {
    return new NextResponse(stopPageHtml(decision.reason, decision.retry, env.hubUrl), {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  if (pass && req.headers.get('sec-fetch-dest') === 'document') {
    event.waitUntil(sendVisit(env, pass, req.nextUrl, req.headers).catch(() => undefined));
  }
  // Pages read the viewer's name for the top bar. Set here, so a client can't supply its own.
  const headers = new Headers(req.headers);
  headers.set('x-lw-viewer', encodeURIComponent(decision.viewer.name));
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)'],
};
