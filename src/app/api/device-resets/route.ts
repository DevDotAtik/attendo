import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only teachers can review device reset requests' },
        { status: 401 }
      );
    }

    const requests = await prisma.deviceResetRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            studentProfile: {
              select: { rollNo: true, institution: true },
            },
            device: {
              select: { boundAt: true },
            },
          },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('[Get Device Resets Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve reset requests' },
      { status: 500 }
    );
  }
}
