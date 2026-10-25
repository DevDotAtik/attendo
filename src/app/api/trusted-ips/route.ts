import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const addCidrSchema = z.object({
  cidr: z.string().min(1, 'CIDR is required').regex(
    /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/([0-9]|[1-2][0-9]|3[0-2]))?$/,
    'Invalid IPv4 or CIDR format (e.g. 192.168.1.0/24 or 10.0.0.1)'
  ),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const trustedIps = await prisma.trustedIp.findMany({
      where: { teacherId: session.userId },
    });

    return NextResponse.json({ trustedIps });
  } catch (error) {
    console.error('[Get Trusted IPs Error]:', error);
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
    const result = addCidrSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: result.error.flatten() }, { status: 400 });
    }

    const { cidr } = result.data;

    const existing = await prisma.trustedIp.findFirst({
      where: { teacherId: session.userId, cidr },
    });

    if (existing) {
      return NextResponse.json({ error: 'ALREADY_EXISTS', message: 'CIDR already added' }, { status: 409 });
    }

    const trustedIp = await prisma.trustedIp.create({
      data: {
        teacherId: session.userId,
        cidr,
      },
    });

    return NextResponse.json({ trustedIp }, { status: 201 });
  } catch (error) {
    console.error('[Add Trusted IP Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'MISSING_ID', message: 'Trusted IP id required' }, { status: 400 });
    }

    await prisma.trustedIp.deleteMany({
      where: { id, teacherId: session.userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Delete Trusted IP Error]:', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
