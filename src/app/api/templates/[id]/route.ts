import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateTemplateSchema = z.object({
  title: z.string().min(2).optional(),
  fields: z.array(z.any()).min(1).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const template = await prisma.formTemplate.findFirst({
      where: { id: params.id, teacherId: session.userId },
    });

    if (!template) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('[Get Template Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const body = await req.json();
    const result = updateTemplateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: result.error.flatten() }, { status: 400 });
    }

    const template = await prisma.formTemplate.findFirst({
      where: { id: params.id, teacherId: session.userId },
    });

    if (!template) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Template not found' }, { status: 404 });
    }

    const updated = await prisma.formTemplate.update({
      where: { id: params.id },
      data: {
        ...(result.data.title ? { title: result.data.title } : {}),
        ...(result.data.fields ? { fields: result.data.fields } : {}),
      },
    });

    return NextResponse.json({ template: updated });
  } catch (error) {
    console.error('[Update Template Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const activeSession = await prisma.attendanceSession.findFirst({
      where: { templateId: params.id, status: 'ACTIVE' },
    });

    if (activeSession) {
      return NextResponse.json(
        { error: 'TEMPLATE_IN_USE', message: 'Cannot delete template while attached to an active session' },
        { status: 400 }
      );
    }

    await prisma.formTemplate.deleteMany({
      where: { id: params.id, teacherId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Delete Template Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
