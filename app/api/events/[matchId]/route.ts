// app/api/events/[matchId]/route.ts
// Server-Sent Events endpoint — safe version (no enqueue-after-close bug)

import { NextRequest } from 'next/server';
import { getLatestUpdate } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { matchId: string } }
) {
  const { matchId } = params;

  const encoder = new TextEncoder();
  let closed = false;
  let interval: NodeJS.Timeout;

  const stream = new ReadableStream({
    start(controller) {

      // 🔥 CLEANUP FUNCTION (centralized)
      function cleanup() {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch {}
      }

      // ✅ Initial connection event
      try {
        controller.enqueue(
          encoder.encode('event: connected\ndata: ok\n\n')
        );
      } catch {
        cleanup();
        return;
      }

      let lastTs = Date.now();

      interval = setInterval(async () => {
        if (closed) return;

        try {
          const match = await getLatestUpdate(matchId, lastTs);

          // 🔥 CRITICAL: check again AFTER await
          if (closed) return;

          if (match) {
            lastTs = Date.now();

            try {
              controller.enqueue(
                encoder.encode(
                  `event: update\ndata: ${JSON.stringify(match)}\n\n`
                )
              );
            } catch {
              cleanup();
            }

          } else {
            // heartbeat (keeps connection alive)
            try {
              controller.enqueue(
                encoder.encode(': heartbeat\n\n')
              );
            } catch {
              cleanup();
            }
          }

        } catch {
          // Redis error
          try {
            controller.enqueue(
              encoder.encode('event: error\ndata: redis_error\n\n')
            );
          } catch {
            cleanup();
          }
        }
      }, 2000);

      // 🔥 MOST IMPORTANT: handle disconnect
      req.signal.addEventListener('abort', cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}