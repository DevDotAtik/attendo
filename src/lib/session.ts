import { NextRequest } from 'next/server';
import { prisma } from './prisma';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken, AccessTokenPayload } from './auth';

export interface SessionContext {
  userId: string;
  role: 'TEACHER' | 'STUDENT';
  credentialIdHash?: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'TEACHER' | 'STUDENT';
  };
}

export async function getSessionContext(req: NextRequest): Promise<SessionContext | null> {
  let token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!token) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) return null;

  const payload: AccessTokenPayload | null = await verifyAccessToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) return null;

  return {
    userId: user.id,
    role: user.role,
    credentialIdHash: payload.credentialIdHash ?? null,
    user,
  };
}
