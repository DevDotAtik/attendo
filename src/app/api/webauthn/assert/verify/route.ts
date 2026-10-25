import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';
import { checkAuthenticationResponse } from '@/lib/webauthn';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const expectedChallenge = await cache.get(`webauthn:assert:${session.userId}`);

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'CHALLENGE_EXPIRED', message: 'Passkey verification challenge expired' },
        { status: 400 }
      );
    }

    const device = await prisma.device.findUnique({
      where: { userId: session.userId },
    });

    if (!device) {
      return NextResponse.json(
        { error: 'DEVICE_NOT_FOUND', message: 'No registered device found' },
        { status: 404 }
      );
    }

    const verification = await checkAuthenticationResponse(
      body,
      expectedChallenge,
      {
        credentialID: device.credentialId,
        credentialPublicKey: Buffer.from(device.publicKey, 'base64'),
        counter: Number(device.counter),
      }
    );

    if (!verification.verified || !verification.authenticationInfo) {
      return NextResponse.json(
        { error: 'PASSKEY_FAILED', message: 'Biometric passkey signature invalid' },
        { status: 400 }
      );
    }

    // Update counter in database
    await prisma.device.update({
      where: { id: device.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
      },
    });

    await cache.del(`webauthn:assert:${session.userId}`);

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error('[WebAuthn Assert Verify Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to verify passkey signature' },
      { status: 500 }
    );
  }
}
