import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/** Vercel's firewall can only count over 10 minutes, so the daily limits are counted in Redis. */
export const LIVE_RUNS_PER_VISITOR_PER_DAY = 5;
const DEFAULT_SITE_DAILY_CAP = 10;

export type LimitResult = 'ok' | 'visitor-limit' | 'site-limit';
export type LiveRunLimiter = (ip: string) => Promise<LimitResult>;
type Counter = { limit(key: string): Promise<{ success: boolean }> };
type Env = Record<string, string | undefined>;

export function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim();
  if (real) return real;
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/** The visitor is checked first, so a visitor who is over their limit does not use up the site's runs. */
export function combineLimits(visitor: Counter, site: Counter): LiveRunLimiter {
  return async (ip) => {
    if (!(await visitor.limit(ip)).success) return 'visitor-limit';
    if (!(await site.limit('site')).success) return 'site-limit';
    return 'ok';
  };
}

/** Accepts the names the Vercel Marketplace integration sets as well as Upstash's own. */
export function redisConfigFrom(env: Env): { url: string; token: string } | null {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function siteDailyCap(env: Env): number {
  const n = Number(env.LIVE_RUNS_DAILY_CAP);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_SITE_DAILY_CAP;
}

let cached: LiveRunLimiter | null | undefined;

/** Null when Redis is not configured; the route then refuses live runs rather than run them uncounted. */
export function getLiveRunLimiter(): LiveRunLimiter | null {
  if (cached !== undefined) return cached;
  const config = redisConfigFrom(process.env);
  if (!config) return (cached = null);
  const redis = new Redis(config);
  cached = combineLimits(
    new Ratelimit({ redis, prefix: 'live-runs:visitor', limiter: Ratelimit.slidingWindow(LIVE_RUNS_PER_VISITOR_PER_DAY, '1 d') }),
    new Ratelimit({ redis, prefix: 'live-runs:site', limiter: Ratelimit.fixedWindow(siteDailyCap(process.env), '1 d') }),
  );
  return cached;
}
