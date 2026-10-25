import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only teachers can review device reset requests' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await req.json();
    const { action } = body; // 'APPROVE' | 'REJECT'

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return NextResponse.json(
        { error: 'INVALID_ACTION', message: 'Action must be APPROVE or REJECT' },
        { status: 400 }
      );
    }

    const resetRequest = await prisma.deviceResetRequest.findUnique({
      where: { id },
    });

    if (!resetRequest) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Reset request not found' },
        { status: 404 }
      );
    }

    if (resetRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'ALREADY_REVIEWED', message: 'This request has already been processed' },
        { status: 400 }
      );
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    await prisma.$transaction(async (tx) => {
      // 1. Update request status
      await tx.deviceResetRequest.update({
        where: { id },
        data: {
          status: newStatus,
          reviewedBy: session.userId,
        },
      });

      // 2. If approved, delete student's existing Device binding
      if (action === 'APPROVE') {
        await tx.device.deleteMany({
          where: { userId: resetRequest.studentId },
        });
      }

      // 3. Log to AuditLog
      await tx.auditLog.create({
        data: {
          actorId: session.userId,
          action: action === 'APPROVE' ? 'DEVICE_RESET_APPROVED' : 'DEVICE_RESET_REJECTED',
          targetId: resetRequest.studentId,
          meta: {
            requestId: id,
            action,
            reviewedAt: new Date().toISOString(),
          },
        },
      });
    });

    return NextResponse.json({
      success: true,
      status: newStatus,
      message: `Device reset request ${newStatus.toLowerCase()} successfully`,
    });
  } catch (error) {
    console.error('[Review Device Reset Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to review reset request' },
      { status: 500 }
    );
  }
}
