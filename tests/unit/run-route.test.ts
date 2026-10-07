import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/model', async () => {
  const { scriptedModelFor } = await import('@/lib/agent/scripted-model');
  return { MODEL_ID: 'mock', getModel: vi.fn(() => scriptedModelFor('t3')) };
});

vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  getLiveRunLimiter: vi.fn(),
}));

import { POST } from '@/app/api/run/route';
import { getModel } from '@/lib/model';
import { getLiveRunLimiter, type LimitResult } from '@/lib/rate-limit';
import { parseRunRequest } from '@/lib/run-request';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

describe('parseRunRequest', () => {
  it('accepts a preset ticket id', () => {
    expect(parseRunRequest({ ticketId: 't3' })).toMatchObject({ ok: true, ticket: { id: 't3' } });
  });
  it.each([[null], [{}], [{ ticketId: 3 }], [{ ticketId: 't99' }], [{ ticket: 'Please refund me' }]])('rejects %j', (body) => {
    expect(parseRunRequest(body).ok).toBe(false);
  });
});

describe('POST /api/run', () => {
  const limiter = vi.fn(async (): Promise<LimitResult> => 'ok');
  beforeEach(() => {
    vi.stubEnv('LIVE_RUNS_ENABLED', 'true');
    limiter.mockImplementation(async () => 'ok');
    vi.mocked(getLiveRunLimiter).mockReturnValue(limiter);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(getModel).mockClear();
    limiter.mockClear();
  });

  it('returns 400 for a body that is not JSON, without calling the model', async () => {
    expect((await post('not json')).status).toBe(400);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('returns 400 for an unknown ticket, without calling the model', async () => {
    expect((await post({ ticketId: 't99' })).status).toBe(400);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('does not use up a visitor’s runs on a bad request', async () => {
    await post({ ticketId: 't99' });
    expect(limiter).not.toHaveBeenCalled();
  });

  it('counts runs against the visitor’s IP address', async () => {
    await post({ ticketId: 't3' }, { 'x-real-ip': '9.9.9.9' });
    expect(limiter).toHaveBeenCalledWith('9.9.9.9');
  });

  it('returns 429 once a visitor has used their live runs for the day', async () => {
    limiter.mockImplementation(async () => 'visitor-limit');
    expect((await post({ ticketId: 't3' })).status).toBe(429);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('returns 503 once the site’s daily cap is reached', async () => {
    limiter.mockImplementation(async () => 'site-limit');
    expect((await post({ ticketId: 't3' })).status).toBe(503);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('refuses live runs when the rate limiter is not configured', async () => {
    vi.mocked(getLiveRunLimiter).mockReturnValue(null);
    expect((await post({ ticketId: 't3' })).status).toBe(503);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('refuses live runs when the rate limiter cannot be reached', async () => {
    limiter.mockImplementation(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect((await post({ ticketId: 't3' })).status).toBe(503);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('returns 415 unless the body is declared as JSON, so other sites cannot skip the CORS preflight', async () => {
    expect((await post({ ticketId: 't3' }, { 'content-type': 'text/plain' })).status).toBe(415);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('returns 403 for a request a browser marks as cross-site', async () => {
    expect((await post({ ticketId: 't3' }, { 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('accepts a same-origin browser request', async () => {
    expect((await post({ ticketId: 't3' }, { 'sec-fetch-site': 'same-origin' })).status).toBe(200);
  });

  it('keeps live runs off unless LIVE_RUNS_ENABLED is exactly "true"', async () => {
    vi.stubEnv('LIVE_RUNS_ENABLED', '');
    expect((await post({ ticketId: 't3' })).status).toBe(503);
    vi.stubEnv('LIVE_RUNS_ENABLED', 'false');
    expect((await post({ ticketId: 't3' })).status).toBe(503);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('streams NDJSON events ending in the outcome', async () => {
    const res = await post({ ticketId: 't3' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const lines = (await res.text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'run-start', ticketId: 't3', at: 0 });
    expect(lines.at(-1)).toMatchObject({ type: 'outcome', outcome: { status: 'ready-to-send' } });
  });
});
