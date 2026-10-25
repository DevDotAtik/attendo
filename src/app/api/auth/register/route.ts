import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  hashPassword,
  signAccessToken,
  generateRefreshToken,
  hashToken,
  buildCookieHeaders,
  REFRESH_TOKEN_TTL_MS,
} from '@/lib/auth';
import { registerSchema } from '@/lib/validations/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password, role, rollNo, institution } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'EMAIL_ALREADY_EXISTS', message: 'Email is already registered' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Create user and optional student profile in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name,
          email: email.toLowerCase(),
          passwordHash,
          role,
        },
      });

      if (role === 'STUDENT' && rollNo) {
        await tx.studentProfile.create({
          data: {
            userId: newUser.id,
            rollNo,
            institution: institution ?? null,
          },
        });
      }

      return newUser;
    });

    // Create refresh token
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

    // Sign access token (students will have null credentialIdHash until device registration)
    const accessToken = await signAccessToken({
      sub: user.id,
      role: user.role,
      credentialIdHash: null,
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          requiresDeviceBinding: user.role === 'STUDENT',
        },
      },
      { status: 201 }
    );

    // Set secure httpOnly cookies
    const cookieHeaders = buildCookieHeaders(accessToken, rawRefreshToken);
    for (const cookie of cookieHeaders) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error: any) {
    console.error('[Register Error]:', error);
    const message =
      !process.env.DATABASE_URL
        ? 'DATABASE_URL environment variable is missing in Vercel settings.'
        : error?.message?.includes('connect') || error?.message?.includes('reach database')
        ? 'Cannot reach database. Please ensure DATABASE_URL uses the Supabase IPv4 pooler.'
        : error?.message || 'Registration failed';

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
