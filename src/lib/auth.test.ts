import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashToken,
  buildCookieHeaders,
  buildClearCookieHeaders,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from './auth';

describe('Auth Utilities', () => {
  it('hashes and validates passwords correctly', async () => {
    const raw = 'SecurePassword123!';
    const hash = await hashPassword(raw);

    expect(hash).not.toBe(raw);
    expect(await comparePassword(raw, hash)).toBe(true);
    expect(await comparePassword('WrongPassword', hash)).toBe(false);
  });

  it('signs and verifies access JWT tokens with expected claims', async () => {
    const payload = {
      sub: 'user-uuid-123',
      role: 'TEACHER' as const,
      credentialIdHash: 'cred-hash-xyz',
    };

    const token = await signAccessToken(payload);
    expect(typeof token).toBe('string');

    const verified = await verifyAccessToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.role).toBe(payload.role);
    expect(verified?.credentialIdHash).toBe(payload.credentialIdHash);
  });

  it('rejects tampered access tokens', async () => {
    const token = await signAccessToken({
      sub: 'user-uuid-123',
      role: 'STUDENT',
    });

    const tampered = token.slice(0, -5) + 'abcde';
    const verified = await verifyAccessToken(tampered);
    expect(verified).toBeNull();
  });

  it('generates random refresh tokens and produces deterministic SHA-256 hashes', () => {
    const token1 = generateRefreshToken();
    const token2 = generateRefreshToken();

    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(80); // 40 bytes hex

    const hash1a = hashToken(token1);
    const hash1b = hashToken(token1);
    const hash2 = hashToken(token2);

    expect(hash1a).toBe(hash1b);
    expect(hash1a).not.toBe(hash2);
    expect(hash1a.length).toBe(64); // SHA-256 hex
  });

  it('builds secure auth cookies with HttpOnly and SameSite=Lax flags', () => {
    const cookies = buildCookieHeaders('access-jwt-sample', 'refresh-token-sample');
    expect(cookies.length).toBe(2);

    expect(cookies[0]).toContain(`${ACCESS_TOKEN_COOKIE}=access-jwt-sample`);
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Lax');
    expect(cookies[0]).toContain('Max-Age=900'); // 15 mins

    expect(cookies[1]).toContain(`${REFRESH_TOKEN_COOKIE}=refresh-token-sample`);
    expect(cookies[1]).toContain('HttpOnly');
    expect(cookies[1]).toContain('SameSite=Lax');
    expect(cookies[1]).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
  });

  it('builds clear cookie headers with Max-Age=0', () => {
    const cookies = buildClearCookieHeaders();
    expect(cookies.length).toBe(2);
    expect(cookies[0]).toContain('Max-Age=0');
    expect(cookies[1]).toContain('Max-Age=0');
  });
});
