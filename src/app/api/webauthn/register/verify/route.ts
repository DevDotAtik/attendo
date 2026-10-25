import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';
import { checkRegistrationResponse } from '@/lib/webauthn';
import { hashToken, signAccessToken, buildCookieHeaders, generateRefreshToken, REFRESH_TOKEN_TTL_MS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only students can register passkeys' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const expectedChallenge = await cache.get(`webauthn:reg:${session.userId}`);

    if (!expectedChallenge) {
      return NextResponse.json(
        { error: 'CHALLENGE_EXPIRED', message: 'Passkey registration challenge expired' },
        { status: 400 }
      );
    }

    const verification = await checkRegistrationResponse(body, expectedChallenge);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json(
        { error: 'PASSKEY_FAILED', message: 'Passkey verification failed' },
        { status: 400 }
      );
    }

    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

    // Security check: Reject cross-device hybrid transports (QR/Bluetooth proxy enrollment)
    const transports = (body.response?.transports || []) as string[];
    if (transports.includes('hybrid')) {
      return NextResponse.json(
        {
          error: 'HYBRID_TRANSPORT_NOT_ALLOWED',
          message: 'Cross-device passkeys (Bluetooth/QR) are not permitted. Please use your device platform biometrics.',
        },
        { status: 400 }
      );
    }

    const credentialId = credentialID;
    const credentialIdHash = hashToken(credentialId);

    // Security check: Check if credential is already registered to another account
    const existingCredential = await prisma.device.findFirst({
      where: {
        OR: [{ credentialId }, { credentialIdHash }],
      },
    });

    if (existingCredential) {
      return NextResponse.json(
        { error: 'CREDENTIAL_ALREADY_REGISTERED', message: 'This passkey is already bound to another student account' },
        { status: 409 }
      );
    }

    const publicKeyBase64 = Buffer.from(credentialPublicKey).toString('base64');

    // Save Device in database
    await prisma.device.create({
      data: {
        userId: session.userId,
        credentialId,
        credentialIdHash,
        publicKey: publicKeyBase64,
        counter: BigInt(counter),
        transports,
      },
    });

    // Invalidate the challenge
    await cache.del(`webauthn:reg:${session.userId}`);

    // Re-issue access token with credentialIdHash
    const newAccessToken = await signAccessToken({
      sub: session.userId,
      role: session.role,
      credentialIdHash,
    });

    const rawRefreshToken = generateRefreshToken();
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await prisma.refreshToken.create({
      data: {
        userId: session.userId,
        tokenHash,
        expiresAt,
      },
    });

    const response = NextResponse.json({
      verified: true,
      message: 'Platform passkey registered and bound to your account successfully',
    });

    for (const cookie of buildCookieHeaders(newAccessToken, rawRefreshToken)) {
      response.headers.append('Set-Cookie', cookie);
    }

    return response;
  } catch (error) {
    console.error('[WebAuthn Reg Verify Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to verify passkey registration' },
      { status: 500 }
    );
  }
}
