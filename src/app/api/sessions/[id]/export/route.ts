import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { id } = params;

    const attendanceSession = await prisma.attendanceSession.findFirst({
      where: { id, teacherId: session.userId },
      include: {
        template: true,
        records: {
          include: {
            student: {
              select: {
                name: true,
                email: true,
                studentProfile: { select: { rollNo: true, institution: true } },
              },
            },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
    });

    if (!attendanceSession) {
      return new NextResponse('Session not found', { status: 404 });
    }

    const rows: string[] = [];
    // CSV Header
    rows.push([
      'Roll No',
      'Student Name',
      'Email',
      'Status',
      'Flags',
      'Distance (m)',
      'IP Address',
      'Submitted At',
      'Form Data',
    ].join(','));

    for (const record of attendanceSession.records) {
      const form = (record.formData || {}) as Record<string, any>;
      const rollNo = record.student?.studentProfile?.rollNo || form.rollNo || form.roll_no || form['Roll Number'] || 'N/A';
      const name = record.student?.name || form.fullName || form.name || 'Guest Student';
      const email = record.student?.email || form.email || 'N/A';

      rows.push([
        escapeCsv(rollNo),
        escapeCsv(name),
        escapeCsv(email),
        escapeCsv(record.status),
        escapeCsv(record.flags.join('; ')),
        escapeCsv(record.distanceM),
        escapeCsv(record.ip),
        escapeCsv(record.submittedAt.toISOString()),
        escapeCsv(JSON.stringify(record.formData)),
      ].join(','));
    }

    const csvContent = rows.join('\r\n');
    const safeTitle = attendanceSession.template.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `attendance_${safeTitle}_${id.slice(0, 8)}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[Session CSV Export Error]:', error);
    return new NextResponse('Internal error exporting session', { status: 500 });
  }
}
