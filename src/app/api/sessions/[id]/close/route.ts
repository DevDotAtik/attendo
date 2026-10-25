import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = params;

    const attendanceSession = await prisma.attendanceSession.findFirst({
      where: { id, teacherId: session.userId },
    });

    if (!attendanceSession) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Session not found' }, { status: 404 });
    }

    if (attendanceSession.status === 'CLOSED') {
      return NextResponse.json({ success: true, message: 'Session already closed' });
    }

    const closedAt = new Date();

    await prisma.$transaction([
      prisma.attendanceSession.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closedAt,
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.userId,
          action: 'SESSION_CLOSED',
          targetId: id,
          meta: { closedAt: closedAt.toISOString() },
        },
      }),
    ]);

    // Notify board stream via cache key
    await cache.set(`session:${id}:status`, 'CLOSED', 'EX', 3600);

    return NextResponse.json({ success: true, message: 'Session closed successfully' });
  } catch (error) {
    console.error('[Close Session Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
