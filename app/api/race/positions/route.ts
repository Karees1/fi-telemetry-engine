import { NextRequest } from 'next/server';

export const runtime = 'edge';

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:5000';

/**
 * GET /api/race/positions?year=2024&round=6&session=R
 *
 * Proxies the race-positions SSE stream from the Python FastF1 service.
 * Event sequence: connecting → race_start → driver_pos (×20) → complete
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = new URL(`${PYTHON_URL}/api/race/positions`);
  searchParams.forEach((v, k) => upstream.searchParams.set(k, v));

  let pythonRes: Response;
  try {
    pythonRes = await fetch(upstream.toString(), {
      headers: { Accept: 'text/event-stream' },
    });
  } catch {
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode(
          `event: error\ndata: ${JSON.stringify({ message: 'Python service unavailable' })}\n\n`
        ));
        c.close();
      },
    });
    return new Response(body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  if (!pythonRes.body) {
    return new Response(
      'event: error\ndata: {"message":"Empty response from Python service"}\n\n',
      { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } },
    );
  }

  return new Response(pythonRes.body, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
      'Connection':        'keep-alive',
    },
  });
}
