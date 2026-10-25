import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const result = actionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'INVALID_ACTION', details: result.error.flatten() }, { status: 400 });
    }

    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        session: true,
      },
    });

    if (!record || record.session.teacherId !== session.userId) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Record not found' }, { status: 404 });
    }

    const newStatus = result.data.action === 'APPROVE' ? 'APPROVED_BY_TEACHER' : 'REJECTED_BY_TEACHER';

    await prisma.$transaction([
      prisma.attendanceRecord.update({
        where: { id },
        data: { status: newStatus },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.userId,
          action: `ATTENDANCE_OVERRIDE_${result.data.action}`,
          targetId: record.id,
          meta: {
            previousStatus: record.status,
            newStatus,
            studentId: record.studentId,
            sessionId: record.sessionId,
          },
        },
      }),
    ]);

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error('[Override Record Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
