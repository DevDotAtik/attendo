import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const records = await prisma.attendanceRecord.findMany({
      where: { studentId: session.userId },
      orderBy: { submittedAt: 'desc' },
      include: {
        session: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            template: {
              select: { title: true },
            },
            teacher: {
              select: { name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('[Student History Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve attendance history' },
      { status: 500 }
    );
  }
}
