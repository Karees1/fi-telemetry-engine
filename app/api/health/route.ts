import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:5000';

/**
 * GET /api/health
 *
 * Proxy to the Python service's /health endpoint with a hard 8-second timeout.
 * Returns 200 when Render is awake, 503 when it's still cold-starting.
 *
 * The client calls this in a retry loop (every ~2s) to pre-warm Render before
 * opening the SSE stream. Once this returns 200, the SSE fetch won't timeout.
 */
export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${PYTHON_URL}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timer);

    if (res.ok) {
      const body = await res.json();
      return NextResponse.json({ status: 'ok', ...body });
    }
    return NextResponse.json({ status: 'error' }, { status: 503 });
  } catch {
    clearTimeout(timer);
    return NextResponse.json({ status: 'offline' }, { status: 503 });
  }
}
