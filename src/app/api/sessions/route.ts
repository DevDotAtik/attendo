import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/auth';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const startSessionSchema = z.object({
  templateId: z.string().uuid(),
  durationMin: z.number().min(1).max(120).default(5),
  radiusM: z.number().min(10).max(1000).default(100),
  anchorLat: z.number().min(-90).max(90),
  anchorLng: z.number().min(-180).max(180),
  anchorAccuracy: z.number().min(0),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const now = new Date();
    // Auto-close expired sessions in DB
    await prisma.attendanceSession.updateMany({
      where: {
        teacherId: session.userId,
        status: 'ACTIVE',
        endsAt: { lte: now },
      },
      data: {
        status: 'CLOSED',
        closedAt: now,
      },
    });

    const sessions = await prisma.attendanceSession.findMany({
      where: { teacherId: session.userId },
      orderBy: { startsAt: 'desc' },
      include: {
        template: { select: { title: true } },
        _count: { select: { records: true } },
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[Get Sessions Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const result = startSessionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { templateId, durationMin, radiusM, anchorLat, anchorLng, anchorAccuracy } = result.data;

    // Security check: GPS anchor accuracy requirement (worse than 50m must be rejected)
    if (anchorAccuracy > 50) {
      return NextResponse.json(
        {
          error: 'LOW_GPS_ACCURACY',
          message: `Teacher location accuracy is ${Math.round(anchorAccuracy)}m. It must be 50m or better to anchor the classroom. Please retry near a window or enable high-accuracy GPS.`,
        },
        { status: 400 }
      );
    }

    const template = await prisma.formTemplate.findFirst({
      where: { id: templateId, teacherId: session.userId },
    });

    if (!template) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Template not found' },
        { status: 404 }
      );
    }

    // Long random unguessable token
    const boardToken = crypto.randomBytes(32).toString('hex');
    const boardTokenHash = hashToken(boardToken);

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationMin * 60 * 1000);

    const newSession = await prisma.attendanceSession.create({
      data: {
        teacherId: session.userId,
        templateId,
        boardTokenHash,
        anchorLat,
        anchorLng,
        anchorAccuracy,
        radiusM,
        startsAt,
        endsAt,
        status: 'ACTIVE',
      },
      include: {
        template: { select: { title: true } },
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const boardUrl = `${baseUrl}/board/${boardToken}`;

    return NextResponse.json(
      {
        session: newSession,
        boardToken,
        boardUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Start Session Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
