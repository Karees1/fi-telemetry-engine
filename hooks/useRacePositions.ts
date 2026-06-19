import { useState, useCallback, useRef } from 'react';
import { Race, SessionType } from '@/types';
import { TrackLayout } from '@/hooks/useSessionLoad';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RaceDriverInfo {
  code: string;
  fullName: string;
  team: string;
  number: number;
  color: string;
  position: number | null;
}

export interface DriverLapEntry {
  n: number;
  start: number;    // seconds from session start
  duration: number; // seconds
  compound: string;
  pitIn: number | null;  // seconds from session start (absolute), or null
  pitOut: number | null;
}

export interface DriverPositionSeries {
  t: Float32Array;
  x: Float32Array;
  y: Float32Array;
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
  driverLaps: Record<string, DriverLapEntry[]>;
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

// ── Cache payload ─────────────────────────────────────────────────────────────
// We store only the compact lap data (not the pre-computed position arrays).
// On cache hit the positions are rebuilt client-side from laps + track.

interface RaceLapCachePayload {
  version: 2;
  sessionId: string;
  drivers: RaceDriverInfo[];
  totalTime: number;
  driverLaps: Record<string, DriverLapEntry[]>;
}

// ── Synthetic position builder ────────────────────────────────────────────────
// For each driver, computes t/x/y/status arrays at 2 Hz resolution.
// x and y are FastF1 GPS metres (same coordinate space as track.x / track.y),
// so RaceMap's makeNorm() will convert them correctly to SVG.

const SAMPLE_HZ = 2; // samples per second

export function buildSyntheticPositions(
  driverLaps: Record<string, DriverLapEntry[]>,
  track: TrackLayout,
  totalTime: number,
): Map<string, DriverPositionSeries> {
  const positions = new Map<string, DriverPositionSeries>();
  const N = track.x.length;
  if (N === 0 || totalTime <= 0) return positions;

  const STEP     = 1 / SAMPLE_HZ;
  const nSamples = Math.ceil(totalTime / STEP) + 2;

  for (const [code, laps] of Object.entries(driverLaps)) {
    if (!laps.length) continue;

    const tArr      = new Float32Array(nSamples);
    const xArr      = new Float32Array(nSamples);
    const yArr      = new Float32Array(nSamples);
    const statusArr = new Array<string>(nSamples).fill('OnTrack');

    // Pre-sort laps by start time (should already be in order)
    const sorted = [...laps].sort((a, b) => a.start - b.start);
    const lastLap = sorted[sorted.length - 1];
    const raceEnd = lastLap.start + lastLap.duration;

    let si = 0;
    for (let t = 0; t <= totalTime; t += STEP, si++) {
      tArr[si] = t;

      // Find the lap that contains this time
      let lap: DriverLapEntry | null = null;
      for (const l of sorted) {
        if (t >= l.start && t < l.start + l.duration) {
          lap = l;
          break;
        }
      }

      if (!lap) {
        // Before first lap or after last lap — pin to start/finish position
        if (t < sorted[0].start) {
          // Pre-race: use first lap's start position
          const gridFrac = 0;
          const idx = Math.floor(gridFrac * N) % N;
          xArr[si] = track.x[idx];
          yArr[si] = track.y[idx];
        } else if (t >= raceEnd) {
          // Finished or retired: pin to last known position
          const lastFrac = 1;
          const idx = Math.min(N - 1, Math.floor(lastFrac * (N - 1)));
          xArr[si] = track.x[idx];
          yArr[si] = track.y[idx];
          statusArr[si] = 'OffTrack';
        } else {
          // Gap between laps (shouldn't normally happen)
          xArr[si] = track.x[0];
          yArr[si] = track.y[0];
        }
        continue;
      }

      const elapsed = t - lap.start;

      // Check if in pit stop window
      const inPit =
        lap.pitIn  !== null &&
        lap.pitOut !== null &&
        t >= lap.pitIn &&
        t <= lap.pitOut;

      if (inPit) {
        // Pin to pit-entry position (fraction at which driver entered pits)
        const pitFrac = Math.max(0, Math.min(0.9999, (lap.pitIn! - lap.start) / lap.duration));
        const idx = Math.floor(pitFrac * N) % N;
        xArr[si] = track.x[idx];
        yArr[si] = track.y[idx];
        statusArr[si] = 'Pitlane';
        continue;
      }

      // Normal racing: fraction of this lap completed
      const fraction = Math.max(0, Math.min(0.9999, elapsed / lap.duration));
      const idx = Math.floor(fraction * N) % N;
      xArr[si] = track.x[idx];
      yArr[si] = track.y[idx];
      statusArr[si] = 'OnTrack';
    }

    const actualSamples = si;
    positions.set(code, {
      t:      tArr.slice(0, actualSamples),
      x:      xArr.slice(0, actualSamples),
      y:      yArr.slice(0, actualSamples),
      status: statusArr.slice(0, actualSamples),
    });
  }

  return positions;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRacePositions() {
  const [state, setState] = useState<RacePositionState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  // Accumulated from SSE events before complete fires
  const partialRef = useRef<{
    sessionId: string;
    drivers: RaceDriverInfo[];
    totalTime: number;
    driverLaps: Record<string, DriverLapEntry[]>;
  } | null>(null);

  const load = useCallback(async (
    race: Race,
    sessionType: SessionType,
    track: TrackLayout | null,
  ) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    partialRef.current = null;

    setState({ ...INITIAL, stage: 'connecting' });

    if (!track) {
      setState({ ...INITIAL, stage: 'error', error: 'Track data not available — load a session first.' });
      return;
    }

    // ── 1. Cache-first check ──────────────────────────────────────────────────
    const cacheParams = new URLSearchParams({
      year: String(race.year), round: String(race.round), session: sessionType,
    });
    try {
      const res = await fetch(`/api/cache/race?${cacheParams}`);
      if (!abort.signal.aborted && res.ok) {
        const { cached, data } = await res.json() as { cached: boolean; data: RaceLapCachePayload };
        if (cached && data && data.version === 2 && data.driverLaps) {
          const positions = buildSyntheticPositions(data.driverLaps, track, data.totalTime);
          const bounds = { minX: track.bounds.minX, maxX: track.bounds.maxX, minY: track.bounds.minY, maxY: track.bounds.maxY };
          setState({
            stage:       'complete',
            data:        { ...data, positions, bounds },
            loadedCount: Object.keys(data.driverLaps).length,
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
      const { sessionId, drivers, totalTime } = JSON.parse(e.data) as {
        sessionId: string;
        drivers: RaceDriverInfo[];
        totalTime: number;
      };
      partialRef.current = { sessionId, drivers, totalTime, driverLaps: {} };
      setState(s => ({ ...s, stage: 'loading' }));
    });

    es.addEventListener('driver_laps', (e) => {
      const { code, laps } = JSON.parse(e.data) as { code: string; laps: DriverLapEntry[] };
      if (!partialRef.current) return;
      partialRef.current.driverLaps[code] = laps;
      setState(s => ({ ...s, loadedCount: s.loadedCount + 1 }));
    });

    // Legacy support: old server emitting driver_pos GPS events
    es.addEventListener('driver_pos', (e) => {
      const { code, t, x, y, status } = JSON.parse(e.data) as {
        code: string; t: number[]; x: number[]; y: number[]; status: string[];
      };
      if (!partialRef.current) return;
      // Build synthetic laps from GPS is not possible — mark as loaded
      // so the client doesn't hang on old format
      setState(s => ({ ...s, loadedCount: s.loadedCount + 1 }));
      void code; void t; void x; void y; void status; // legacy, ignored
    });

    es.addEventListener('complete', () => {
      if (!partialRef.current) { es.close(); return; }

      const { sessionId, drivers, totalTime, driverLaps } = partialRef.current;
      const positions = buildSyntheticPositions(driverLaps, track, totalTime);
      const bounds = { minX: track.bounds.minX, maxX: track.bounds.maxX, minY: track.bounds.minY, maxY: track.bounds.maxY };

      const data: RacePositionData = { sessionId, drivers, positions, driverLaps, bounds, totalTime };

      setState({
        stage:       'complete',
        data,
        loadedCount: Object.keys(driverLaps).length,
        error:       null,
      });

      es.close();

      // Store compact lap data to Vercel Blob (fire and forget)
      const payload: RaceLapCachePayload = { version: 2, sessionId, drivers, totalTime, driverLaps };
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
    });

    es.addEventListener('warning', (e) => {
      try { console.warn('[Race]', JSON.parse(e.data).message); } catch { /* */ }
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
