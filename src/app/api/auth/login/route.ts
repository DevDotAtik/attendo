import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  comparePassword,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  buildCookieHeaders,
  REFRESH_TOKEN_TTL_MS,
} from '@/lib/auth';
import { loginSchema } from '@/lib/validations/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        device: true,
        studentProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Issue rotating refresh token
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Issue access token with credentialIdHash
    const accessToken = await signAccessToken({
      sub: user.id,
      role: user.role,
      credentialIdHash: user.device?.credentialIdHash ?? null,
    });

    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hasDeviceBound: !!user.device,
        studentProfile: user.studentProfile,
      },
    });

    const cookieHeaders = buildCookieHeaders(accessToken, rawRefreshToken);
    for (const cookie of cookieHeaders) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error: any) {
    console.error('[Login Error]:', error);
    const message =
      !process.env.DATABASE_URL
        ? 'DATABASE_URL environment variable is missing in Vercel settings.'
        : error?.message?.includes('connect') || error?.message?.includes('reach database')
        ? 'Cannot reach database. Please ensure DATABASE_URL uses the Supabase IPv4 pooler.'
        : error?.message || 'Login failed';

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
