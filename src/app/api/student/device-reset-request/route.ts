import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only students can submit device reset requests' },
        { status: 401 }
      );
    }

    const pendingRequest = await prisma.deviceResetRequest.findFirst({
      where: {
        studentId: session.userId,
        status: 'PENDING',
      },
    });

    if (pendingRequest) {
      return NextResponse.json(
        { error: 'REQUEST_ALREADY_PENDING', message: 'You already have a pending reset request under review' },
        { status: 400 }
      );
    }

    const resetRequest = await prisma.deviceResetRequest.create({
      data: {
        studentId: session.userId,
      },
    });

    return NextResponse.json(
      { success: true, request: resetRequest },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Device Reset Request Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to submit reset request' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const requests = await prisma.deviceResetRequest.findMany({
      where: { studentId: session.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('[Get Reset Requests Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve reset requests' },
      { status: 500 }
    );
  }
}
