import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const QR_JWT_SECRET = new TextEncoder().encode(
  process.env.QR_JWT_SECRET || 'attendsheets-qr-jwt-super-secret-key-32-chars-long'
);

const CHECK_PASS_SECRET = new TextEncoder().encode(
  process.env.CHECK_PASS_SECRET || 'attendsheets-checkpass-super-secret-key-32-chars'
);

export const QR_TOKEN_TTL_SEC = 2 * 3600; // 2 hours (stable for entire session)
export const QR_JTI_CACHE_TTL_SEC = 2 * 3600;

export const CHECK_PASS_TTL_SEC = 3 * 60; // 3 minutes

export interface QrTokenPayload {
  sessionId: string;
  jti: string;
}

export interface CheckPassPayload {
  studentId: string;
  sessionId: string;
  credentialIdHash: string;
}

/**
 * Creates a signed rotating QR token valid for 15s with unique JTI
 */
export async function signQrToken(sessionId: string): Promise<{
  token: string;
  jti: string;
  expiresAt: number;
}> {
  const jti = crypto.randomUUID();
  const token = await new SignJWT({ sessionId, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${QR_TOKEN_TTL_SEC}s`)
    .sign(QR_JWT_SECRET);

  return {
    token,
    jti,
    expiresAt: Date.now() + QR_TOKEN_TTL_SEC * 1000,
  };
}

/**
 * Verifies QR token signature and expiration
 */
export async function verifyQrToken(token: string): Promise<QrTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, QR_JWT_SECRET);
    if (!payload.sessionId || !payload.jti) return null;
    return {
      sessionId: payload.sessionId as string,
      jti: payload.jti as string,
    };
  } catch {
    return null;
  }
}

/**
 * Signs a 3-minute checkPassToken binding student, session, and credential hash
 */
export async function signCheckPassToken(data: CheckPassPayload): Promise<string> {
  return new SignJWT({
    studentId: data.studentId,
    sessionId: data.sessionId,
    credentialIdHash: data.credentialIdHash,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${CHECK_PASS_TTL_SEC}s`)
    .sign(CHECK_PASS_SECRET);
}

/**
 * Verifies checkPassToken signature and returns verified payload
 */
export async function verifyCheckPassToken(token: string): Promise<CheckPassPayload | null> {
  try {
    const { payload } = await jwtVerify(token, CHECK_PASS_SECRET);
    if (!payload.studentId || !payload.sessionId || !payload.credentialIdHash) {
      return null;
    }
    return {
      studentId: payload.studentId as string,
      sessionId: payload.sessionId as string,
      credentialIdHash: payload.credentialIdHash as string,
    };
  } catch {
    return null;
  }
}
