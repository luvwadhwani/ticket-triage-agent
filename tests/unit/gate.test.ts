import { SignJWT, importPKCS8 } from 'jose';
import { describe, expect, it } from 'vitest';
import { gateDecision, gateEnv, readCookie, stopPageHtml, verifyPass, type Verified } from '@/lib/gate';
import { TEST_PRIVATE_KEY, TEST_PUBLIC_KEY } from '../fixtures/keys';

const now = new Date('2026-10-07T10:00:00Z');
const sec = (d: Date) => Math.floor(d.getTime() / 1000);

async function pass(overrides: { exp?: number; iss?: string; projects?: unknown; name?: unknown } = {}) {
  const key = await importPKCS8(TEST_PRIVATE_KEY, 'Ed25519');
  return new SignJWT({ name: overrides.name ?? 'Acme', projects: overrides.projects ?? ['triage'] })
    .setProtectedHeader({ alg: 'Ed25519' })
    .setSubject('acc-1')
    .setIssuer(overrides.iss ?? 'work.luvwadhwani.com')
    .setIssuedAt(sec(now))
    .setExpirationTime(overrides.exp ?? sec(now) + 900)
    .sign(key);
}

describe('verifyPass', () => {
  it('reports a missing pass', async () => {
    expect(await verifyPass(undefined, TEST_PUBLIC_KEY, 'triage', now)).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects an expired pass as expired', async () => {
    const token = await pass({ exp: sec(now) - 1 });
    expect(await verifyPass(token, TEST_PUBLIC_KEY, 'triage', now)).toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a tampered pass, a foreign issuer and malformed claims as invalid', async () => {
    const good = await pass();
    const [h, , s] = good.split('.');
    const forged = `${h}.${Buffer.from(JSON.stringify({ sub: 'acc-1', name: 'x', projects: ['triage'], iss: 'work.luvwadhwani.com', exp: sec(now) + 900 })).toString('base64url')}.${s}`;
    expect(await verifyPass(forged, TEST_PUBLIC_KEY, 'triage', now)).toEqual({ ok: false, reason: 'invalid' });
    expect(await verifyPass(await pass({ iss: 'evil.example' }), TEST_PUBLIC_KEY, 'triage', now)).toEqual({ ok: false, reason: 'invalid' });
    expect(await verifyPass(await pass({ name: 42 }), TEST_PUBLIC_KEY, 'triage', now)).toEqual({ ok: false, reason: 'invalid' });
    expect(await verifyPass('not-a-jwt', TEST_PUBLIC_KEY, 'triage', now)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a valid pass for a project the invite does not include', async () => {
    expect(await verifyPass(await pass({ projects: ['qa'] }), TEST_PUBLIC_KEY, 'triage', now)).toEqual({ ok: false, reason: 'not-in-project' });
  });
});

describe('gateDecision', () => {
  const hub = 'https://work.luvwadhwani.com';
  const allowed: Verified = { ok: true, viewer: { id: 'acc-1', name: 'Acme', projects: ['triage'] } };
  const missing: Verified = { ok: false, reason: 'missing' };
  const page = (url: string, renewed = false) => ({ method: 'GET', url, renewed });

  it('lets a valid pass through', () => {
    expect(gateDecision(page('https://triage.luvwadhwani.com/'), allowed, hub)).toEqual({ kind: 'allow', viewer: allowed.viewer });
  });

  it('sends a page request without a valid pass to the hub to renew it, marking the way back as renewed', () => {
    expect(gateDecision(page('https://triage.luvwadhwani.com/evals?x=1'), missing, hub)).toEqual({
      kind: 'redirect',
      location: `https://work.luvwadhwani.com/renew?next=${encodeURIComponent('https://triage.luvwadhwani.com/evals?x=1&lw_renewed=1')}`,
    });
  });

  it('answers API calls and non-GET requests with 401 instead of a redirect', () => {
    expect(gateDecision({ method: 'POST', url: 'https://triage.luvwadhwani.com/api/run', renewed: false }, missing, hub)).toEqual({
      kind: 'deny',
      status: 401,
      error: 'Sign in again to continue.',
    });
    expect(gateDecision(page('https://triage.luvwadhwani.com/api/anything'), missing, hub).kind).toBe('deny');
  });

  it('stops instead of looping when the hub just renewed but the cookie never arrived', () => {
    expect(gateDecision(page('https://triage.luvwadhwani.com/?lw_renewed=1', true), missing, hub)).toEqual({
      kind: 'stop',
      reason: 'missing',
      retry: 'https://triage.luvwadhwani.com/',
    });
  });

  it.each(['invalid', 'expired', 'not-in-project'] as const)('stops instead of looping when a just-renewed pass is still %s here', (reason) => {
    expect(gateDecision(page('https://triage.luvwadhwani.com/evals?lw_renewed=1', true), { ok: false, reason }, hub)).toEqual({
      kind: 'stop',
      reason,
      retry: 'https://triage.luvwadhwani.com/evals',
    });
  });

  it('drops the renewal marker from the address once the pass works', () => {
    expect(gateDecision(page('https://triage.luvwadhwani.com/?ticket=t4&lw_renewed=1', true), allowed, hub)).toEqual({
      kind: 'redirect',
      location: 'https://triage.luvwadhwani.com/?ticket=t4',
    });
  });

  it('moves visitors from the raw vercel.app address to the canonical domain first', () => {
    expect(gateDecision(page('https://ticket-triage-agent-seven.vercel.app/evals'), allowed, hub, 'https://triage.luvwadhwani.com')).toEqual({
      kind: 'redirect',
      location: 'https://triage.luvwadhwani.com/evals',
    });
  });
});

describe('stopPageHtml', () => {
  it('explains the problem in plain words and offers a way to try again', () => {
    const blocked = stopPageHtml('missing', 'https://triage.luvwadhwani.com/', 'https://work.luvwadhwani.com');
    expect(blocked).toContain("Your browser didn't keep the sign-in cookie");
    expect(blocked).toContain('href="https://triage.luvwadhwani.com/">Try again</a>');
    expect(stopPageHtml('not-in-project', 'https://triage.luvwadhwani.com/', 'https://work.luvwadhwani.com')).toContain("This project isn't part of your access.");
    expect(stopPageHtml('invalid', 'https://triage.luvwadhwani.com/', 'https://work.luvwadhwani.com')).toContain("This page couldn't confirm your sign-in.");
  });

  it('escapes the retry address so it cannot inject markup', () => {
    expect(stopPageHtml('missing', 'https://triage.luvwadhwani.com/?q="><script>', 'https://work.luvwadhwani.com')).not.toContain('"><script>');
  });
});

describe('readCookie', () => {
  it('finds a cookie by name in a Cookie header', () => {
    expect(readCookie('a=1; lw_pass=abc.def; b=2', 'lw_pass')).toBe('abc.def');
    expect(readCookie(null, 'lw_pass')).toBeUndefined();
  });
});

describe('gateEnv', () => {
  it('reads the project settings and turns escaped newlines in the key back into real ones', () => {
    expect(
      gateEnv({ GATE_PUBLIC_KEY: 'line1\\nline2', NEXT_PUBLIC_HUB_URL: 'https://work.luvwadhwani.com/', PROJECT_ID: 'triage', PUBLIC_ORIGIN: '' }),
    ).toEqual({ publicKey: 'line1\nline2', hubUrl: 'https://work.luvwadhwani.com', projectId: 'triage', canonicalOrigin: null });
  });

  it('refuses to run without its settings', () => {
    expect(() => gateEnv({})).toThrow('GATE_PUBLIC_KEY');
  });
});
