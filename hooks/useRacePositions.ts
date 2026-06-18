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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useRacePositions() {
  const [state, setState] = useState<RacePositionState>(INITIAL);
  const abortRef   = useRef<AbortController | null>(null);
  // Accumulated data before we have everything
  const partialRef = useRef<{
    sessionId: string;
    drivers: RaceDriverInfo[];
    positions: Map<string, DriverPositionSeries>;
    bounds: RaceBounds;
    totalTime: number;
  } | null>(null);

  const load = useCallback((race: Race, sessionType: SessionType) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    partialRef.current = null;

    setState({ ...INITIAL, stage: 'connecting' });

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
        setState({
          stage:       'complete',
          data:        { ...partialRef.current },
          loadedCount: partialRef.current.positions.size,
          error:       null,
        });
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
