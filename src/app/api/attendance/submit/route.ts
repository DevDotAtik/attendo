import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';
import { verifyCheckPassToken } from '@/lib/qr';
import { clientSignalProvider } from '@/lib/client-signals';
import { isIpInCidr } from '@/lib/geo';
import { checkAuthenticationResponse } from '@/lib/webauthn';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  checkPassToken: z.string().min(1, 'checkPassToken is required'),
  formData: z.record(z.any()),
  webauthnAssertion: z.any().optional(), // WebAuthn assertion response
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    const studentId = session?.role === 'STUDENT' ? session.userId : null;

    const body = await req.json();
    const result = submitSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { checkPassToken, formData, webauthnAssertion } = result.data;

    // 1. Verify checkPassToken cryptographically
    const passPayload = await verifyCheckPassToken(checkPassToken);
    if (!passPayload) {
      return NextResponse.json(
        { error: 'CHECK_PASS_EXPIRED', message: 'Your check verification expired. Please rescan the QR.' },
        { status: 400 }
      );
    }

    // 2. Retrieve cached check pass metadata
    const cachedDataStr = await cache.get(`checkpass:${checkPassToken}`);
    const cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : null;
    const distanceM = cachedData?.distanceM ?? 0;
    const flags: string[] = cachedData?.flags ? [...cachedData.flags] : [];

    // 3. Verify Session is still active
    const attendanceSession = await prisma.attendanceSession.findUnique({
      where: { id: passPayload.sessionId },
      include: {
        teacher: {
          include: {
            trustedIps: true,
          },
        },
      },
    });

    if (!attendanceSession || attendanceSession.status === 'CLOSED' || new Date() > attendanceSession.endsAt) {
      return NextResponse.json(
        { error: 'SESSION_CLOSED', message: 'This attendance session has already closed' },
        { status: 400 }
      );
    }

    // 4. Verify WebAuthn Biometric Assertion (only if student is authenticated and provided an assertion)
    if (studentId && webauthnAssertion) {
      const device = await prisma.device.findUnique({
        where: { userId: studentId },
      });

      if (device) {
        const expectedChallenge = await cache.get(`webauthn:check:${studentId}`);
        if (expectedChallenge) {
          const verification = await checkAuthenticationResponse(
            webauthnAssertion,
            expectedChallenge,
            {
              credentialID: device.credentialId,
              credentialPublicKey: Buffer.from(device.publicKey, 'base64'),
              counter: Number(device.counter),
            }
          );

          if (verification.verified && verification.authenticationInfo) {
            await prisma.device.update({
              where: { id: device.id },
              data: { counter: BigInt(verification.authenticationInfo.newCounter) },
            });
          }
        }
      }
    }

    // 5. Signal consistency checks (UA / IP mismatch)
    const currentSignals = await clientSignalProvider.evaluateSignals(req, {
      userAgent: cachedData?.userAgent,
      ip: cachedData?.ip,
    });
    flags.push(...currentSignals.flags);

    // Deduplicate flags
    const uniqueFlags = Array.from(new Set(flags));
    const recordStatus = uniqueFlags.length > 0 ? 'FLAGGED' : 'PRESENT';

    // 6. Check for duplicate roll number in this session
    const submittedRollNo =
      formData?.rollNo ||
      formData?.roll_no ||
      formData?.['Roll Number'] ||
      formData?.roll;

    const isTrustedIp = attendanceSession.teacher?.trustedIps?.some((trusted) =>
      isIpInCidr(currentSignals.ip, trusted.cidr)
    );

    // 7. Atomic DB Transaction with Unique Constraints
    try {
      const record = await prisma.$transaction(async (tx) => {
        // Double-check unique attendance in session by device token, studentId, or IP
        const existing = await tx.attendanceRecord.findFirst({
          where: {
            sessionId: attendanceSession.id,
            OR: [
              ...(studentId ? [{ studentId }] : []),
              { credentialIdHash: passPayload.credentialIdHash },
              ...(!isTrustedIp && currentSignals.ip ? [{ ip: currentSignals.ip }] : []),
            ],
          },
        });

        if (existing) {
          throw new Error('ALREADY_MARKED');
        }

        // Prevent duplicate roll number proxy submissions within the same session
        if (submittedRollNo) {
          const sessionRecords = await tx.attendanceRecord.findMany({
            where: { sessionId: attendanceSession.id },
            select: { formData: true },
          });

          const duplicateRoll = sessionRecords.some((rec) => {
            const data = rec.formData as Record<string, any> | null;
            const r = data?.rollNo || data?.roll_no || data?.['Roll Number'] || data?.roll;
            return r && String(r).trim().toLowerCase() === String(submittedRollNo).trim().toLowerCase();
          });

          if (duplicateRoll) {
            throw new Error('ROLL_ALREADY_MARKED');
          }
        }

        return tx.attendanceRecord.create({
          data: {
            sessionId: attendanceSession.id,
            studentId,
            credentialIdHash: passPayload.credentialIdHash,
            formData,
            distanceM,
            status: recordStatus,
            flags: uniqueFlags,
            ip: currentSignals.ip,
            userAgent: currentSignals.userAgent,
          },
        });
      });

      // 8. Clean up challenge caches
      await cache.del(`checkpass:${checkPassToken}`);
      if (studentId) {
        await cache.del(`webauthn:check:${studentId}`);
      }

      return NextResponse.json({
        success: true,
        record: {
          id: record.id,
          status: record.status,
          flags: record.flags,
          submittedAt: record.submittedAt,
        },
      });
    } catch (err: any) {
      if (err.message === 'ALREADY_MARKED' || err.code === 'P2002') {
        return NextResponse.json(
          { error: 'ALREADY_MARKED', message: 'You have already submitted attendance for this session on this device' },
          { status: 409 }
        );
      }
      if (err.message === 'ROLL_ALREADY_MARKED') {
        return NextResponse.json(
          { error: 'ROLL_ALREADY_MARKED', message: `Attendance for Roll No '${submittedRollNo}' has already been marked in this session` },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error('[Attendance Submit Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to record attendance' },
      { status: 500 }
    );
  }
}
