import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    let token = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

    if (!token) {
      const authHeader = req.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Not authenticated' },
        { status: 401 }
      );
    }

    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'Access token expired or invalid' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        device: {
          select: {
            id: true,
            boundAt: true,
            credentialIdHash: true,
          },
        },
        studentProfile: {
          select: {
            rollNo: true,
            institution: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'USER_NOT_FOUND', message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        isDeviceBound: !!user.device,
        studentProfile: user.studentProfile,
      },
    });
  } catch (error) {
    console.error('[Auth Me Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}
