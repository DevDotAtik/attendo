import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';
import { hashToken } from '@/lib/auth';
import { verifyQrToken, signCheckPassToken } from '@/lib/qr';
import { calculateHaversineDistance, checkSuspiciousLocation, isIpInCidr, GpsReading } from '@/lib/geo';
import { clientSignalProvider } from '@/lib/client-signals';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const checkRequestSchema = z.object({
  qrToken: z.string().min(1, 'QR token is required'),
  deviceToken: z.string().optional(),
  locationDenied: z.boolean().optional(),
  reading1: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0),
      timestamp: z.number(),
    })
    .optional(),
  reading2: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0),
      timestamp: z.number(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    const studentId = session?.role === 'STUDENT' ? session.userId : null;

    const body = await req.json();
    const result = checkRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { qrToken, reading1, reading2, locationDenied, deviceToken } = result.data;

    // Session token / device identifier for unique device verification
    const rawDeviceToken =
      deviceToken ||
      req.cookies.get('device_token')?.value ||
      req.headers.get('x-device-token') ||
      crypto.randomUUID();
    const credentialIdHash = hashToken(rawDeviceToken);

    // 1. Validate QR Token signature & expiration
    const qrPayload = await verifyQrToken(qrToken);
    if (!qrPayload) {
      return NextResponse.json(
        { error: 'QR_EXPIRED', message: 'The scanned QR code has expired. Please scan the live board QR.' },
        { status: 400 }
      );
    }

    // 2. Validate JTI presence in cache/Redis (anti-screenshot protection)
    const validJti = await cache.get(`qr:jti:${qrPayload.jti}`);
    if (!validJti) {
      return NextResponse.json(
        { error: 'QR_EXPIRED', message: 'QR code was already rotated or replayed. Please scan the live board.' },
        { status: 400 }
      );
    }

    // 3. Find Attendance Session & verify active status
    const attendanceSession = await prisma.attendanceSession.findUnique({
      where: { id: qrPayload.sessionId },
      include: {
        template: true,
        teacher: {
          include: {
            trustedIps: true,
          },
        },
      },
    });

    if (!attendanceSession || attendanceSession.status === 'CLOSED' || new Date() > attendanceSession.endsAt) {
      if (attendanceSession && attendanceSession.status === 'ACTIVE') {
        await prisma.attendanceSession.update({
          where: { id: attendanceSession.id },
          data: { status: 'CLOSED', closedAt: new Date() },
        });
      }
      return NextResponse.json(
        { error: 'SESSION_CLOSED', message: 'This attendance session has ended' },
        { status: 400 }
      );
    }

    // 4. Verify unique device submission for this session
    const existingRecord = await prisma.attendanceRecord.findFirst({
      where: {
        sessionId: attendanceSession.id,
        OR: [
          ...(studentId ? [{ studentId }] : []),
          { credentialIdHash },
        ],
      },
    });

    if (existingRecord) {
      return NextResponse.json(
        { error: 'ALREADY_MARKED', message: 'Attendance already recorded on this device for this session' },
        { status: 409 }
      );
    }

    // 5. Location verification & flags
    let distanceM = 0;
    const flags: string[] = [];

    if (locationDenied || !reading1) {
      flags.push('LOCATION_PERMISSION_DENIED');
    } else {
      const now = Date.now();
      const timestampAgeSec = Math.abs(now - reading1.timestamp) / 1000;

      if (timestampAgeSec > 30) {
        return NextResponse.json(
          {
            error: 'LOW_GPS_ACCURACY',
            message: 'GPS reading timestamp is stale (> 30s). Please enable live geolocation.',
          },
          { status: 400 }
        );
      }

      if (reading1.accuracy > 50) {
        return NextResponse.json(
          {
            error: 'LOW_GPS_ACCURACY',
            message: `GPS accuracy is too coarse (${Math.round(reading1.accuracy)}m). Accuracy must be 50m or better. Please move closer to a window or turn on precise location.`,
          },
          { status: 400 }
        );
      }

      distanceM = calculateHaversineDistance(
        attendanceSession.anchorLat,
        attendanceSession.anchorLng,
        reading1.latitude,
        reading1.longitude
      );

      if (distanceM > attendanceSession.radiusM) {
        return NextResponse.json(
          {
            error: 'OUT_OF_RANGE',
            message: `You are ${Math.round(distanceM)}m away from the classroom anchor. Max allowed radius is ${attendanceSession.radiusM}m.`,
          },
          { status: 400 }
        );
      }

      // Suspicious location spoof check (identical decimals or jump)
      const spoofCheck = checkSuspiciousLocation(reading1, reading2);
      if (spoofCheck.suspicious) {
        flags.push('SUSPICIOUS_LOCATION');
      }
    }

    // 6. Collect client signals (mobile user agent)
    const signals = await clientSignalProvider.evaluateSignals(req);
    flags.push(...signals.flags);

    // IP & Device Check: prevent repeat attendance from same device / IP in this session
    const isTrustedIp = attendanceSession.teacher.trustedIps.some((trusted) =>
      isIpInCidr(signals.ip, trusted.cidr)
    );

    const existingAttendance = await prisma.attendanceRecord.findFirst({
      where: {
        sessionId: attendanceSession.id,
        OR: [
          ...(studentId ? [{ studentId }] : []),
          { credentialIdHash },
          ...(!isTrustedIp && signals.ip ? [{ ip: signals.ip }] : []),
        ],
      },
    });

    if (existingAttendance) {
      return NextResponse.json(
        {
          error: 'ALREADY_MARKED',
          message: 'Attendance has already been marked from this device or network connection (IP) for this session.',
        },
        { status: 409 }
      );
    }

    // 7. Generate checkPassToken (TTL 3 min) binding session and unique device
    const checkPassToken = await signCheckPassToken({
      studentId: studentId || 'guest',
      sessionId: attendanceSession.id,
      credentialIdHash,
    });

    // Store checkPass metadata & initial signals in cache for /submit verification
    await cache.setex(
      `checkpass:${checkPassToken}`,
      180,
      JSON.stringify({
        distanceM,
        flags,
        ip: signals.ip,
        userAgent: signals.userAgent,
        studentId,
        credentialIdHash,
        deviceToken: rawDeviceToken,
      })
    );

    const response = NextResponse.json({
      success: true,
      checkPassToken,
      webauthnChallenge: null,
      deviceToken: rawDeviceToken,
      formSchema: attendanceSession.template.fields,
      sessionTitle: attendanceSession.template.title,
      distanceM,
      flags,
      locationDenied: !!(locationDenied || !reading1),
    });

    response.cookies.set('device_token', rawDeviceToken, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 365 * 24 * 3600,
    });

    return response;
  } catch (error) {
    console.error('[Attendance Check Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to complete attendance check' },
      { status: 500 }
    );
  }
}
