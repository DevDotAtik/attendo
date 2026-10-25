import { describe, it, expect } from 'vitest';
import {
  signQrToken,
  verifyQrToken,
  signCheckPassToken,
  verifyCheckPassToken,
} from './qr';

describe('QR & CheckPass Cryptographic Tokens', () => {
  it('signs and verifies rotating QR tokens with unique JTI', async () => {
    const sessionId = 'session-1234';
    const { token, jti } = await signQrToken(sessionId);

    expect(typeof token).toBe('string');
    expect(typeof jti).toBe('string');

    const verified = await verifyQrToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.sessionId).toBe(sessionId);
    expect(verified?.jti).toBe(jti);
  });

  it('rejects tampered QR tokens', async () => {
    const { token } = await signQrToken('session-1234');
    const tampered = token.slice(0, -6) + 'xyz123';
    expect(await verifyQrToken(tampered)).toBeNull();
  });

  it('signs and verifies checkPass tokens binding student, session, and credential hash', async () => {
    const payload = {
      studentId: 'student-999',
      sessionId: 'session-888',
      credentialIdHash: 'cred-hash-777',
    };

    const token = await signCheckPassToken(payload);
    expect(typeof token).toBe('string');

    const verified = await verifyCheckPassToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.studentId).toBe(payload.studentId);
    expect(verified?.sessionId).toBe(payload.sessionId);
    expect(verified?.credentialIdHash).toBe(payload.credentialIdHash);
  });
});
