import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';
import { createRegistrationOptions } from '@/lib/webauthn';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only students can bind a device passkey' },
        { status: 401 }
      );
    }

    const existingDevice = await prisma.device.findUnique({
      where: { userId: session.userId },
    });

    if (existingDevice) {
      return NextResponse.json(
        { error: 'DEVICE_ALREADY_BOUND', message: 'A device is already registered to your account' },
        { status: 400 }
      );
    }

    const options = await createRegistrationOptions(session.user);

    // Save challenge in cache for 5 minutes
    await cache.setex(`webauthn:reg:${session.userId}`, 300, options.challenge);

    return NextResponse.json(options);
  } catch (error) {
    console.error('[WebAuthn Reg Options Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate registration options' },
      { status: 500 }
    );
  }
}
