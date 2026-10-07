import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/model', async () => {
  const { scriptedModelFor } = await import('@/lib/agent/scripted-model');
  return { MODEL_ID: 'mock', getModel: vi.fn((ticketId: string) => scriptedModelFor(ticketId)) };
});

vi.mock('@/lib/hub', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/hub')>()),
  claimLiveRun: vi.fn(),
}));

import { POST } from '@/app/api/run/route';
import { claimLiveRun } from '@/lib/hub';
import { getModel } from '@/lib/model';
import { parseRunRequest } from '@/lib/run-request';

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'lw_pass=test-pass', ...headers },
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
  beforeEach(() => {
    vi.stubEnv('LIVE_RUNS_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_HUB_URL', 'http://localhost:3100');
    vi.stubEnv('PROJECT_ID', 'triage');
    vi.mocked(claimLiveRun).mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(getModel).mockClear();
    vi.mocked(claimLiveRun).mockReset();
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
    expect(claimLiveRun).not.toHaveBeenCalled();
  });

  it('refuses a live run without a pass, without calling the model', async () => {
    expect((await post({ ticketId: 't3' }, { cookie: '' })).status).toBe(401);
    expect(getModel).not.toHaveBeenCalled();
  });

  it('asks the hub before every live run, with the pass, the ticket subject and the visitor’s location', async () => {
    await post({ ticketId: 't3' }, { 'x-vercel-ip-city': 'Pune', 'x-vercel-ip-country': 'IN' });
    expect(claimLiveRun).toHaveBeenCalledWith({
      hubUrl: 'http://localhost:3100',
      pass: 'test-pass',
      project: 'triage',
      detail: 'How do I export to CSV?',
      city: 'Pune',
      country: 'IN',
    });
  });

  it.each([401, 403, 429, 503] as const)('passes on the hub’s %i without calling the model', async (status) => {
    vi.mocked(claimLiveRun).mockResolvedValue({ ok: false, status, error: 'From the hub.' });
    const res = await post({ ticketId: 't3' });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: 'From the hub.' });
    expect(getModel).not.toHaveBeenCalled();
  });

  it('reports a spent AI budget as its own error in the stream', async () => {
    const { MockLanguageModelV4 } = await import('ai/test');
    vi.mocked(getModel).mockReturnValueOnce(
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw Object.assign(new Error('Project budget exceeded.'), { statusCode: 402 });
        },
      }),
    );
    const lines = (await (await post({ ticketId: 't3' })).text()).trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.at(-1)).toMatchObject({ type: 'error', code: 'budget' });
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
