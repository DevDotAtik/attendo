import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSessionContext(req);
  if (!session || session.role !== 'TEACHER') {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id } = params;

  const attendanceSession = await prisma.attendanceSession.findFirst({
    where: { id, teacherId: session.userId },
  });

  if (!attendanceSession) {
    return new Response('Session not found', { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const emitData = async () => {
        try {
          const currentSession = await prisma.attendanceSession.findUnique({
            where: { id },
          });

          const isExpired = currentSession && currentSession.status === 'ACTIVE' && new Date() > currentSession.endsAt;
          if (isExpired) {
            await prisma.attendanceSession.update({
              where: { id },
              data: { status: 'CLOSED', closedAt: new Date() },
            }).catch(() => null);
          }

          const sessionStatus = (!currentSession || currentSession.status === 'CLOSED' || isExpired) ? 'CLOSED' : 'ACTIVE';

          const records = await prisma.attendanceRecord.findMany({
            where: { sessionId: id },
            orderBy: { submittedAt: 'desc' },
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  studentProfile: {
                    select: { rollNo: true },
                  },
                },
              },
            },
          });

          sendEvent('records:update', {
            records,
            count: records.length,
            flaggedCount: records.filter((r) => r.status === 'FLAGGED').length,
            sessionStatus,
          });
        } catch (err) {
          console.error('[Teacher Live SSE Error]:', err);
        }
      };

      // Send immediately
      await emitData();

      // Poll every 3 seconds for updates in the live view
      const interval = setInterval(async () => {
        if (isClosed) {
          clearInterval(interval);
          return;
        }
        await emitData();
      }, 3000);

      req.signal.addEventListener('abort', () => {
        isClosed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
