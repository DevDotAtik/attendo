import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashToken } from '@/lib/auth';
import { signQrToken, QR_JTI_CACHE_TTL_SEC } from '@/lib/qr';
import { cache } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { boardToken: string } }
) {
  const { boardToken } = params;
  const boardTokenHash = hashToken(boardToken);

  const session = await prisma.attendanceSession.findUnique({
    where: { boardTokenHash },
    include: {
      template: { select: { title: true } },
    },
  });

  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  const baseUrl =
    envBase && !envBase.includes('localhost') && !envBase.includes('127.0.0.1')
      ? envBase
      : host
      ? `${proto}://${host}`
      : 'http://localhost:3000';
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let lastCount = -1;

      const sendEvent = (event: string, data: unknown) => {
        if (isClosed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const now = new Date();
        if (session.status === 'CLOSED' || now > session.endsAt) {
          sendEvent('session:closed', {
            message: 'Attendance closed',
            endsAt: session.endsAt,
          });
          controller.close();
          return;
        }

        // Generate stable QR token for the full session
        const { token, jti } = await signQrToken(session.id);
        await cache.setex(`qr:jti:${jti}`, QR_JTI_CACHE_TTL_SEC, session.id);

        const qrUrl = `${baseUrl}/s/${token}`;
        sendEvent('qr:update', {
          url: qrUrl,
          token,
          endsAt: session.endsAt.toISOString(),
          title: session.template.title,
        });

        // Initial student count
        lastCount = await prisma.attendanceRecord.count({
          where: { sessionId: session.id },
        });
        sendEvent('count:update', { count: lastCount });
      } catch (err) {
        console.error('[Board SSE Init Error]:', err);
      }

      // Poll every 3 seconds for session completion or count changes (no QR rotation)
      const interval = setInterval(async () => {
        if (isClosed) {
          clearInterval(interval);
          return;
        }

        try {
          const cachedStatus = await cache.get(`session:${session.id}:status`);
          const now = new Date();

          if (cachedStatus === 'CLOSED' || session.status === 'CLOSED' || now > session.endsAt) {
            if (session.status === 'ACTIVE') {
              await prisma.attendanceSession.update({
                where: { id: session.id },
                data: { status: 'CLOSED', closedAt: now },
              }).catch(() => null);
              await cache.set(`session:${session.id}:status`, 'CLOSED', 'EX', 3600);
            }
            sendEvent('session:closed', {
              message: 'Attendance closed',
              endsAt: session.endsAt,
            });
            isClosed = true;
            clearInterval(interval);
            controller.close();
            return;
          }

          const currentCount = await prisma.attendanceRecord.count({
            where: { sessionId: session.id },
          });

          if (currentCount !== lastCount) {
            lastCount = currentCount;
            sendEvent('count:update', { count: currentCount });
          }
        } catch (err) {
          console.error('[Board SSE Poll Error]:', err);
        }
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
