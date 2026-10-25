import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  REFRESH_TOKEN_COOKIE,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  buildCookieHeaders,
  buildClearCookieHeaders,
  REFRESH_TOKEN_TTL_MS,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const cookieToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    let rawToken = cookieToken;

    if (!rawToken) {
      try {
        const body = await req.json();
        rawToken = body.refreshToken;
      } catch {
        // Body was empty or not JSON
      }
    }

    if (!rawToken) {
      return NextResponse.json(
        { error: 'MISSING_REFRESH_TOKEN', message: 'No refresh token provided' },
        { status: 401 }
      );
    }

    const tokenHash = hashToken(rawToken);

    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            device: true,
          },
        },
      },
    });

    // Check if token exists
    if (!storedToken) {
      const response = NextResponse.json(
        { error: 'INVALID_REFRESH_TOKEN', message: 'Refresh token not recognized' },
        { status: 401 }
      );
      for (const cookie of buildClearCookieHeaders()) {
        response.headers.append('Set-Cookie', cookie);
      }
      return response;
    }

    // Reuse detection: if a revoked token is used, revoke all tokens for this user
    if (storedToken.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const response = NextResponse.json(
        { error: 'TOKEN_REUSE_DETECTED', message: 'Session revoked due to detected token reuse' },
        { status: 401 }
      );
      for (const cookie of buildClearCookieHeaders()) {
        response.headers.append('Set-Cookie', cookie);
      }
      return response;
    }

    // Check expiration
    if (storedToken.expiresAt < new Date()) {
      const response = NextResponse.json(
        { error: 'REFRESH_TOKEN_EXPIRED', message: 'Refresh token has expired' },
        { status: 401 }
      );
      for (const cookie of buildClearCookieHeaders()) {
        response.headers.append('Set-Cookie', cookie);
      }
      return response;
    }

    // Rotate token: revoke current and generate new
    const newRawRefreshToken = generateRefreshToken();
    const newTokenHash = hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    // Issue new access token
    const newAccessToken = await signAccessToken({
      sub: storedToken.user.id,
      role: storedToken.user.role,
      credentialIdHash: storedToken.user.device?.credentialIdHash ?? null,
    });

    const response = NextResponse.json({ success: true });
    for (const cookie of buildCookieHeaders(newAccessToken, newRawRefreshToken)) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error) {
    console.error('[Refresh Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
