import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  REFRESH_TOKEN_COOKIE,
  hashToken,
  buildClearCookieHeaders,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    for (const cookie of buildClearCookieHeaders()) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error) {
    console.error('[Logout Error]:', error);
    const response = NextResponse.json({ success: true });
    for (const cookie of buildClearCookieHeaders()) {
      response.headers.append('Set-Cookie', cookie);
    }
    return response;
  }
}
