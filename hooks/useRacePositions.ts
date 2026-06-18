import { useState, useCallback, useRef } from 'react';
import { Race, SessionType } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RaceDriverInfo {
  code: string;
  fullName: string;
  team: string;
  number: number;
  color: string;
  position: number | null;
}

export interface DriverPositionSeries {
  /** Race time in seconds (from session start) */
  t: Float32Array;
  /** FastF1 X coordinate (metres) */
  x: Float32Array;
  /** FastF1 Y coordinate (metres) */
  y: Float32Array;
  /** 'OnTrack' | 'OffTrack' | 'Pitlane' */
  status: string[];
}

export interface RaceBounds {
  minX: number; maxX: number;
  minY: number; maxY: number;
}

export interface RacePositionData {
  sessionId: string;
  drivers: RaceDriverInfo[];
  positions: Map<string, DriverPositionSeries>;
  bounds: RaceBounds;
  totalTime: number;
}

export type RaceLoadStage = 'idle' | 'connecting' | 'loading' | 'complete' | 'error';

export interface RacePositionState {
  stage: RaceLoadStage;
  data: RacePositionData | null;
  loadedCount: number;
  error: string | null;
}

const INITIAL: RacePositionState = {
  stage: 'idle',
  data: null,
  loadedCount: 0,
  error: null,
};

// ── Cache serialisation helpers ───────────────────────────────────────────────
// Float32Arrays must be converted to/from plain arrays for JSON storage.

interface CachedPositionSeries {
  t: number[]; x: number[]; y: number[]; status: string[];
}

interface RaceCachePayload {
  sessionId: string;
  drivers: RaceDriverInfo[];
  bounds: RaceBounds;
  totalTime: number;
  positions: Record<string, CachedPositionSeries>;
}

function deserialisePositions(payload: RaceCachePayload): RacePositionData {
  const positions = new Map<string, DriverPositionSeries>();
  for (const [code, s] of Object.entries(payload.positions)) {
    positions.set(code, {
      t: new Float32Array(s.t),
      x: new Float32Array(s.x),
      y: new Float32Array(s.y),
      status: s.status,
    });
  }
  return { ...payload, positions };
}

function serialisePositions(data: RacePositionData): RaceCachePayload {
  const positions: Record<string, CachedPositionSeries> = {};
  data.positions.forEach((s, code) => {
    positions[code] = {
      t: Array.from(s.t),
      x: Array.from(s.x),
      y: Array.from(s.y),
      status: s.status,
    };
  });
  return { ...data, positions };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRacePositions() {
  const [state, setState] = useState<RacePositionState>(INITIAL);
  const abortRef   = useRef<AbortController | null>(null);
  const partialRef = useRef<{
    sessionId: string;
    drivers: RaceDriverInfo[];
    positions: Map<string, DriverPositionSeries>;
    bounds: RaceBounds;
    totalTime: number;
  } | null>(null);

  const load = useCallback(async (race: Race, sessionType: SessionType) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    partialRef.current = null;

    setState({ ...INITIAL, stage: 'connecting' });

    // ── 1. Cache-first check ──────────────────────────────────────────────────
    const cacheParams = new URLSearchParams({
      year: String(race.year), round: String(race.round), session: sessionType,
    });
    try {
      const res = await fetch(`/api/cache/race?${cacheParams}`);
      if (!abort.signal.aborted && res.ok) {
        const { cached, data } = await res.json() as { cached: boolean; data: RaceCachePayload };
        if (cached && data) {
          setState({
            stage:       'complete',
            data:        deserialisePositions(data),
            loadedCount: data.drivers.length,
            error:       null,
          });
          return;
        }
      }
    } catch { /* cache unavailable — proceed with SSE */ }

    if (abort.signal.aborted) return;

    // ── 2. Cache miss — connect to Python SSE ────────────────────────────────
    const params = new URLSearchParams({
      year:    String(race.year),
      round:   String(race.round),
      session: sessionType,
    });

    const es = new EventSource(`/api/race/positions?${params}`);

    es.addEventListener('race_start', (e) => {
      const { sessionId, drivers, bounds, totalTime } = JSON.parse(e.data) as {
        sessionId: string;
        drivers: RaceDriverInfo[];
        bounds: RaceBounds;
        totalTime: number;
      };
      partialRef.current = { sessionId, drivers, positions: new Map(), bounds, totalTime };
      setState(s => ({ ...s, stage: 'loading' }));
    });

    es.addEventListener('driver_pos', (e) => {
      const { code, t, x, y, status } = JSON.parse(e.data) as {
        code: string;
        t: number[];
        x: number[];
        y: number[];
        status: string[];
      };

      if (!partialRef.current) return;

      partialRef.current.positions.set(code, {
        t:      new Float32Array(t),
        x:      new Float32Array(x),
        y:      new Float32Array(y),
        status,
      });

      setState(s => ({ ...s, loadedCount: s.loadedCount + 1 }));
    });

    es.addEventListener('complete', () => {
      if (partialRef.current) {
        const data: RacePositionData = { ...partialRef.current };
        setState({
          stage:       'complete',
          data,
          loadedCount: partialRef.current.positions.size,
          error:       null,
        });

        // Store to Vercel Blob (fire and forget)
        const payload = serialisePositions(data);
        fetch('/api/cache/race', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            year:    String(race.year),
            round:   String(race.round),
            session: sessionType,
            data:    payload,
          }),
        }).catch(() => {});
      } else {
        setState(s => ({ ...s, stage: 'complete' }));
      }
      es.close();
    });

    es.addEventListener('error', (e) => {
      let msg = 'Connection lost';
      if ('data' in e && (e as MessageEvent).data) {
        try { msg = JSON.parse((e as MessageEvent).data).message; } catch { /* raw */ }
      }
      setState(s => ({ ...s, stage: 'error', error: msg }));
      es.close();
    });

    abort.signal.addEventListener('abort', () => es.close());
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    partialRef.current = null;
    setState(INITIAL);
  }, []);

  return { state, load, reset };
}
