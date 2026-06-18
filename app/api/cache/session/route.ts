import { NextRequest, NextResponse } from 'next/server';
import { list, put } from '@vercel/blob';

// Node.js runtime — Vercel Blob's list() requires it
export const runtime = 'nodejs';

// Cache blobs live under this prefix in the store
const blobKey = (year: string, round: string, session: string, suffix: string) =>
  `f1-cache/session-${year}-${round}-${session}-${suffix}.json`;

// ── GET /api/cache/session?year=&round=&session=&type=meta|driver&driver=CODE ──
export async function GET(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ cached: false }, { status: 503 });
  }

  const sp    = req.nextUrl.searchParams;
  const year  = sp.get('year')  ?? '';
  const round = sp.get('round') ?? '';
  const sess  = sp.get('session') ?? '';
  const type  = sp.get('type');   // 'meta' | 'driver'
  const driver = sp.get('driver') ?? '';

  const key = type === 'driver'
    ? blobKey(year, round, sess, `driver-${driver}`)
    : blobKey(year, round, sess, 'meta');

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

// ── POST /api/cache/session ────────────────────────────────────────────────────
// Body: { year, round, session, type: 'meta'|'driver', driver?: string, data: object }
export async function POST(req: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    // Blob not configured — silently skip caching
    return NextResponse.json({ stored: false });
  }

  try {
    const { year, round, session, type, driver, data } = await req.json() as {
      year: string; round: string; session: string;
      type: 'meta' | 'driver'; driver?: string; data: unknown;
    };

    const key = type === 'driver'
      ? blobKey(String(year), String(round), session, `driver-${driver}`)
      : blobKey(String(year), String(round), session, 'meta');

    await put(key, JSON.stringify(data), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });

    return NextResponse.json({ stored: true });
  } catch (e) {
    // Never fail the client — caching is best-effort
    console.error('[cache/session] store error:', e);
    return NextResponse.json({ stored: false });
  }
}
