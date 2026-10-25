import Redis from 'ioredis';

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null>;
  setex(key: string, seconds: number, value: string): Promise<'OK'>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

class InMemoryCache implements CacheClient {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  private purge(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async get(key: string): Promise<string | null> {
    if (!this.purge(key)) return null;
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null> {
    let expiresAt: number | null = null;
    if (mode === 'EX' && duration) {
      expiresAt = Date.now() + duration * 1000;
    } else if (mode === 'PX' && duration) {
      expiresAt = Date.now() + duration;
    }
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    await this.set(key, value, 'EX', seconds);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.store.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.purge(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const next = (current ? parseInt(current, 10) || 0 : 0) + 1;
    const entry = this.store.get(key);
    this.store.set(key, {
      value: next.toString(),
      expiresAt: entry?.expiresAt ?? null,
    });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || !this.purge(key)) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

const inMemoryFallback = new InMemoryCache();

function createCache(): CacheClient {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || process.env.NODE_ENV === 'test') {
    return inMemoryFallback;
  }

  try {
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      retryStrategy() {
        return null; // Don't hang; fall back immediately if Redis server isn't up
      },
    });

    redis.on('error', (err) => {
      // shortcut: log and continue with fallback, upgrade to alert channel under load
      console.warn('[Cache] Redis error, using in-memory cache:', err.message);
    });

    return {
      async get(key: string) {
        try {
          return await redis.get(key);
        } catch {
          return inMemoryFallback.get(key);
        }
      },
      async set(key: string, value: string, mode?: string, duration?: number) {
        try {
          if (mode === 'EX' && duration) {
            return await redis.set(key, value, 'EX', duration);
          }
          return await redis.set(key, value);
        } catch {
          return inMemoryFallback.set(key, value, mode, duration);
        }
      },
      async setex(key: string, seconds: number, value: string) {
        try {
          return await redis.setex(key, seconds, value);
        } catch {
          return inMemoryFallback.setex(key, seconds, value);
        }
      },
      async del(key: string) {
        try {
          return await redis.del(key);
        } catch {
          return inMemoryFallback.del(key);
        }
      },
      async exists(key: string) {
        try {
          return await redis.exists(key);
        } catch {
          return inMemoryFallback.exists(key);
        }
      },
      async incr(key: string) {
        try {
          return await redis.incr(key);
        } catch {
          return inMemoryFallback.incr(key);
        }
      },
      async expire(key: string, seconds: number) {
        try {
          return await redis.expire(key, seconds);
        } catch {
          return inMemoryFallback.expire(key, seconds);
        }
      },
    };
  } catch {
    return inMemoryFallback;
  }
}

const globalForCache = globalThis as unknown as { cache: CacheClient | undefined };
export const cache = globalForCache.cache ?? createCache();
if (process.env.NODE_ENV !== 'production') {
  globalForCache.cache = cache;
}
