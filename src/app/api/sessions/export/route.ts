import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContext(req);
    if (!session || session.role !== 'TEACHER') {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month'); // YYYY-MM format

    let dateFilter = {};
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 1);
      dateFilter = {
        startsAt: {
          gte: start,
          lt: end,
        },
      };
    }

    const sessions = await prisma.attendanceSession.findMany({
      where: {
        teacherId: session.userId,
        ...dateFilter,
      },
      include: {
        template: { select: { title: true } },
        records: {
          include: {
            student: {
              select: {
                name: true,
                email: true,
                studentProfile: { select: { rollNo: true } },
              },
            },
          },
          orderBy: { submittedAt: 'asc' },
        },
      },
      orderBy: { startsAt: 'asc' },
    });

    const rows: string[] = [];
    rows.push([
      'Session Title',
      'Session Date',
      'Roll No',
      'Student Name',
      'Email',
      'Status',
      'Flags',
      'Distance (m)',
      'Submitted At',
    ].join(','));

    for (const s of sessions) {
      for (const r of s.records) {
        const form = (r.formData || {}) as Record<string, any>;
        const rollNo = r.student?.studentProfile?.rollNo || form.rollNo || form.roll_no || form['Roll Number'] || 'N/A';
        const name = r.student?.name || form.fullName || form.name || 'Guest Student';
        const email = r.student?.email || form.email || 'N/A';

        rows.push([
          escapeCsv(s.template.title),
          escapeCsv(s.startsAt.toISOString().slice(0, 10)),
          escapeCsv(rollNo),
          escapeCsv(name),
          escapeCsv(email),
          escapeCsv(r.status),
          escapeCsv(r.flags.join('; ')),
          escapeCsv(r.distanceM),
          escapeCsv(r.submittedAt.toISOString()),
        ].join(','));
      }
    }

    const csvContent = rows.join('\r\n');
    const filename = `attendance_report_${month || 'all'}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[Monthly CSV Export Error]:', error);
    return new NextResponse('Internal error exporting monthly report', { status: 500 });
  }
}
