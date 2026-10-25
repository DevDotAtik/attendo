import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'attendsheets-jwt-super-secret-key-at-least-32-chars-long'
);

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

export const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 minutes
export const REFRESH_TOKEN_TTL_DAYS = 7;
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface AccessTokenPayload {
  sub: string;
  role: 'TEACHER' | 'STUDENT';
  credentialIdHash?: string | null;
  [key: string]: unknown;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signAccessToken(payload: {
  sub: string;
  role: 'TEACHER' | 'STUDENT';
  credentialIdHash?: string | null;
}): Promise<string> {
  return new SignJWT({
    role: payload.role,
    credentialIdHash: payload.credentialIdHash ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SEC}s`)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || !payload.role) return null;
    return {
      sub: payload.sub,
      role: payload.role as 'TEACHER' | 'STUDENT',
      credentialIdHash: (payload.credentialIdHash as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function buildCookieHeaders(accessToken: string, refreshToken: string) {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieFlags = `Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;

  return [
    `${ACCESS_TOKEN_COOKIE}=${accessToken}; ${cookieFlags}; Max-Age=${ACCESS_TOKEN_TTL_SEC}`,
    `${REFRESH_TOKEN_COOKIE}=${refreshToken}; ${cookieFlags}; Max-Age=${REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60}`,
  ];
}

export function buildClearCookieHeaders() {
  const isProd = process.env.NODE_ENV === 'production';
  const cookieFlags = `Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}; Max-Age=0`;

  return [
    `${ACCESS_TOKEN_COOKIE}=; ${cookieFlags}`,
    `${REFRESH_TOKEN_COOKIE}=; ${cookieFlags}`,
  ];
}
