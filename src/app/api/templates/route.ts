import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const fieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'number', 'dropdown', 'checkbox']),
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(), // for dropdown
});

const createTemplateSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  fields: z.array(fieldSchema).min(1, 'Template must have at least one field'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only teachers can access form templates' },
        { status: 401 }
      );
    }

    const templates = await prisma.formTemplate.findMany({
      where: { teacherId: session.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[Get Templates Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to retrieve templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Only teachers can create form templates' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const result = createTemplateSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', details: result.error.flatten() },
        { status: 400 }
      );
    }

    const template = await prisma.formTemplate.create({
      data: {
        teacherId: session.userId,
        title: result.data.title,
        fields: result.data.fields,
      },
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('[Create Template Error]:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create template' },
      { status: 500 }
    );
  }
}
