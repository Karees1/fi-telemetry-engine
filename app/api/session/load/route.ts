import { NextRequest } from 'next/server';

// Edge runtime: no 10 s timeout, supports streaming SSE responses
export const runtime = 'edge';

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:5000';

/**
 * GET /api/session/load?year=2024&round=5&session=R&drivers=VER,LEC
 *
 * Proxies the SSE stream from the Python FastF1 service straight to the
 * browser. The client receives the exact same event sequence:
 *   connecting → session_meta → lap_times → track_layout → telemetry (×N) → complete
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = new URL(`${PYTHON_URL}/api/session/load`);

  // Forward all query params to the Python service
  searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  let pythonRes: Response;
  try {
    pythonRes = await fetch(upstream.toString(), {
      headers: { Accept: 'text/event-stream' },
      // Node 18+ fetch supports streaming; no body needed for GET
    });
  } catch {
    const errorStream = new ReadableStream({
      start(controller) {
        const msg = `event: error\ndata: ${JSON.stringify({ message: 'Python service unavailable — is fastf1_server.py running?' })}\n\n`;
        controller.enqueue(new TextEncoder().encode(msg));
        controller.close();
      },
    });
    return new Response(errorStream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  if (!pythonRes.body) {
    return new Response('event: error\ndata: {"message":"Empty response from Python service"}\n\n', {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }

  // Pipe the Flask SSE stream directly to the client
  return new Response(pythonRes.body, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
      'Connection':        'keep-alive',
    },
  });
}
