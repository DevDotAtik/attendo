import { cache } from './redis';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Sliding/Fixed window rate limiter backed by Redis/in-memory cache
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 60,
  windowSec: number = 60
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const count = await cache.incr(key);

  if (count === 1) {
    await cache.expire(key, windowSec);
  }

  const remaining = Math.max(0, limit - count);
  const success = count <= limit;

  return {
    success,
    limit,
    remaining,
    reset: windowSec,
  };
}
