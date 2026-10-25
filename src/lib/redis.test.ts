import { describe, it, expect } from 'vitest';
import { cache } from './redis';

describe('Cache / Nonce Store (In-Memory Fallback & Redis)', () => {
  it('stores and retrieves string values', async () => {
    await cache.set('test:key1', 'hello-world');
    const val = await cache.get('test:key1');
    expect(val).toBe('hello-world');
  });

  it('deletes keys correctly', async () => {
    await cache.set('test:delete', 'to-be-deleted');
    const delCount = await cache.del('test:delete');
    expect(delCount).toBe(1);

    const val = await cache.get('test:delete');
    expect(val).toBeNull();
  });

  it('increments counters atomically', async () => {
    await cache.del('test:counter');
    const c1 = await cache.incr('test:counter');
    const c2 = await cache.incr('test:counter');
    const c3 = await cache.incr('test:counter');

    expect(c1).toBe(1);
    expect(c2).toBe(2);
    expect(c3).toBe(3);
  });

  it('handles TTL expiration with setex', async () => {
    await cache.setex('test:short-lived', 1, 'expires-fast');
    const val1 = await cache.get('test:short-lived');
    expect(val1).toBe('expires-fast');

    // Wait 1.1s for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const val2 = await cache.get('test:short-lived');
    expect(val2).toBeNull();
  });
});
