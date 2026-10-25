import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';
import { createAuthenticationOptions } from '@/lib/webauthn';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only students can request passkey verification' },
        { status: 401 }
      );
    }

    const device = await prisma.device.findUnique({
      where: { userId: session.userId },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'DEVICE_NOT_FOUND', message: 'No registered device found for this account' },
        { status: 404 }
      );
    }

    const options = await createAuthenticationOptions([
      {
        id: device.credentialId,
        transports: device.transports as AuthenticatorTransport[],
      },
    ]);

    await cache.setex(`webauthn:assert:${session.userId}`, 180, options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error('[WebAuthn Assert Options Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate passkey assertion options' },
      { status: 500 }
    );
  }
}
