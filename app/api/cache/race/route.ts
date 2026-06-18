import { NextRequest, NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';

export const runtime = 'nodejs';

const blobKey = (year: string, round: string, session: string) =>
  `f1-cache/race-${year}-${round}-${session}.json`;

// ── GET /api/cache/race?year=&round=&session= ─────────────────────────────────
export async function GET(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ cached: false }, { status: 503 });
  }

  const sp    = req.nextUrl.searchParams;
  const key   = blobKey(sp.get('year') ?? '', sp.get('round') ?? '', sp.get('session') ?? '');

  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (!blobs.length) return NextResponse.json({ cached: false }, { status: 404 });

    const res = await fetch(blobs[0].downloadUrl);
    if (!res.ok) return NextResponse.json({ cached: false }, { status: 404 });

    const data = await res.json();
    return NextResponse.json({ cached: true, data });
  } catch {
    return NextResponse.json({ cached: false }, { status: 500 });
  }
}

// ── POST /api/cache/race ──────────────────────────────────────────────────────
// Body: { year, round, session, data: RaceCachePayload }
// Race positions at 1Hz for 20 drivers ≈ 1.7MB — fits in one blob
export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ stored: false });
  }

  try {
    const { year, round, session, data } = await req.json() as {
      year: string; round: string; session: string; data: unknown;
    };

    const key = blobKey(String(year), String(round), session);

    await put(key, JSON.stringify(data), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json({ stored: true });
  } catch (e) {
    console.error('[cache/race] store error:', e);
    return NextResponse.json({ stored: false });
  }
}
