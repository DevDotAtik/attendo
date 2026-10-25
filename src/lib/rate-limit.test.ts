import { describe, it, expect } from 'vitest';
import { checkRateLimit } from './rate-limit';

describe('Rate Limiter', () => {
  it('allows requests within limit and tracks remaining quota', async () => {
    const id = `user-test-${Date.now()}`;
    const r1 = await checkRateLimit(id, 3, 10);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(id, 3, 10);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(id, 3, 10);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = await checkRateLimit(id, 3, 10);
    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
  });
});
