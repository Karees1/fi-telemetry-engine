import { NextRequest, NextResponse } from 'next/server';

const PYTHON_URL = process.env.PYTHON_SERVICE_URL ?? 'http://localhost:5000';

/**
 * GET /api/session/lap?year=2024&round=22&session=R&driver=NOR&lap=50
 *
 * Proxies to the Python FastF1 service and returns telemetry JSON for one
 * driver on one specific lap number (or fastest lap if lap is omitted).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = new URL(`${PYTHON_URL}/api/session/lap`);
  searchParams.forEach((value, key) => upstream.searchParams.set(key, value));

  try {
    const res = await fetch(upstream.toString());
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch {
    return NextResponse.json(
      { status: 'error', error: 'Python service unavailable' },
      { status: 503 }
    );
  }
}
