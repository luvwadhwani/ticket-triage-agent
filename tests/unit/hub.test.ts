import { describe, expect, it, vi } from 'vitest';
import { claimLiveRun, isBudgetError, passFrom, visitorGeo } from '@/lib/hub';

const opts = { hubUrl: 'http://localhost:3100', pass: 'p', project: 'triage', detail: 'Charged twice this month', city: 'Pune', country: 'IN' };
const answer = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('claimLiveRun', () => {
  it('sends the pass and the run details to the hub, and accepts a 200', async () => {
    const fetchImpl = answer(200, { remaining: 19 });
    expect(await claimLiveRun(opts, fetchImpl)).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://localhost:3100/api/live-run');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer p');
    expect(JSON.parse(String(init.body))).toEqual({ project: 'triage', detail: 'Charged twice this month', city: 'Pune', country: 'IN' });
  });

  it.each([401, 403, 429])('passes on the hub’s %i with its message', async (status) => {
    expect(await claimLiveRun(opts, answer(status, { error: 'From the hub.' }))).toEqual({ ok: false, status, error: 'From the hub.' });
  });

  it('treats any other answer, or none, as paused', async () => {
    expect(await claimLiveRun(opts, answer(500))).toEqual({ ok: false, status: 503, error: 'Live runs are paused right now.' });
    expect(await claimLiveRun(opts, vi.fn(async () => Promise.reject(new TypeError('fetch failed'))))).toEqual({
      ok: false,
      status: 503,
      error: 'Live runs are paused right now.',
    });
  });
});

describe('isBudgetError', () => {
  it('recognises an AI Gateway budget rejection however the SDK wraps it', () => {
    expect(isBudgetError(Object.assign(new Error('x'), { statusCode: 402 }))).toBe(true);
    expect(isBudgetError(new Error('Project budget exceeded. Current spend: $10.00, limit: $10.00.'))).toBe(true);
    expect(isBudgetError(Object.assign(new Error('Gateway error'), { responseBody: '{"error":{"type":"quota_for_entity_exceeded"}}' }))).toBe(true);
    expect(isBudgetError(new Error('outer', { cause: Object.assign(new Error('inner'), { statusCode: 402 }) }))).toBe(true);
    expect(isBudgetError(new Error('timeout'))).toBe(false);
    expect(isBudgetError('402')).toBe(false);
  });
});

describe('request helpers', () => {
  it('reads the pass cookie and the visitor’s city and country', () => {
    const req = new Request('http://localhost:3000/api/run', {
      headers: { cookie: 'a=1; lw_pass=abc', 'x-vercel-ip-city': 'S%C3%A3o%20Paulo', 'x-vercel-ip-country': 'BR' },
    });
    expect(passFrom(req)).toBe('abc');
    expect(visitorGeo(req.headers)).toEqual({ city: 'São Paulo', country: 'BR' });
  });
});
