import { describe, expect, it, vi } from 'vitest';
import { clientIp, combineLimits, redisConfigFrom, siteDailyCap } from '@/lib/rate-limit';

const counter = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });
const req = (headers: Record<string, string>) => new Request('http://localhost/api/run', { headers });

describe('clientIp', () => {
  it('uses the address Vercel reports, then the first forwarded hop', () => {
    expect(clientIp(req({ 'x-real-ip': '9.9.9.9', 'x-forwarded-for': '1.1.1.1' }))).toBe('9.9.9.9');
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 10.0.0.1' }))).toBe('1.1.1.1');
    expect(clientIp(req({}))).toBe('unknown');
  });
});

describe('combineLimits', () => {
  it('lets a run through when the visitor and the site both have runs left', async () => {
    const visitor = counter(true);
    const site = counter(true);
    expect(await combineLimits(visitor, site)('1.2.3.4')).toBe('ok');
    expect(visitor.limit).toHaveBeenCalledWith('1.2.3.4');
    expect(site.limit).toHaveBeenCalledWith('site');
  });

  it('stops a visitor who has used their runs for the day, without using up the site’s', async () => {
    const site = counter(true);
    expect(await combineLimits(counter(false), site)('1.2.3.4')).toBe('visitor-limit');
    expect(site.limit).not.toHaveBeenCalled();
  });

  it('stops everyone once the site’s daily cap is reached', async () => {
    expect(await combineLimits(counter(true), counter(false))('1.2.3.4')).toBe('site-limit');
  });
});

describe('redisConfigFrom', () => {
  it('reads the Vercel Marketplace or Upstash variable names, or returns null', () => {
    expect(redisConfigFrom({})).toBeNull();
    expect(redisConfigFrom({ KV_REST_API_URL: 'https://x', KV_REST_API_TOKEN: 't' })).toEqual({ url: 'https://x', token: 't' });
    expect(redisConfigFrom({ UPSTASH_REDIS_REST_URL: 'https://y', UPSTASH_REDIS_REST_TOKEN: 'u' })).toEqual({ url: 'https://y', token: 'u' });
    expect(redisConfigFrom({ KV_REST_API_URL: 'https://x' })).toBeNull();
  });
});

describe('siteDailyCap', () => {
  it('defaults to 10 and accepts a positive whole number from LIVE_RUNS_DAILY_CAP', () => {
    expect(siteDailyCap({})).toBe(10);
    expect(siteDailyCap({ LIVE_RUNS_DAILY_CAP: '25' })).toBe(25);
    expect(siteDailyCap({ LIVE_RUNS_DAILY_CAP: 'lots' })).toBe(10);
    expect(siteDailyCap({ LIVE_RUNS_DAILY_CAP: '0' })).toBe(10);
  });
});
