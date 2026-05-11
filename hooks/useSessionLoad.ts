import { useState, useCallback, useRef } from 'react';
import { Race, SessionType } from '@/types';

// ── Event payload shapes from the SSE stream ──────────────────────────────────

export interface DriverMeta {
  code: string;
  fullName: string;
  team: string;
  number: number;
  position: number | null;
}

export interface SessionMeta {
  sessionId: string;
  name: string;
  date: string;
  type: SessionType;
  circuit: string;
  country: string;
  drivers: DriverMeta[];
}

export interface LapRow {
  driver: string;
  lapNumber: number;
  lapTime: number | null;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  compound: string;
  isPersonalBest: boolean;
}

export interface TrackLayout {
  x: number[];
  y: number[];
  z: number[];
  distance: number[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  length: number;
}

export interface DriverTelemetry {
  driver: string;
  lapNumber: number;
  lapTime: number | null;
  points: {
    distance: number[];
    speed: number[];
    throttle: number[];
    brake: number[];
    gear: number[];
    drs: number[];
    x: number[];
    y: number[];
    z: number[];
  };
}

// ── Stage type — drives the uplink UI ────────────────────────────────────────

export type UplinkStage =
  | 'idle'
  | 'connecting'
  | 'session_meta'
  | 'lap_times'
  | 'track_layout'
  | 'telemetry'
  | 'complete'
  | 'error';

export interface SessionLoadState {
  stage: UplinkStage;
  message: string;
  sessionMeta: SessionMeta | null;
  laps: LapRow[];
  track: TrackLayout | null;
  telemetry: Map<string, DriverTelemetry>;
  loadedDrivers: string[];
  error: string | null;
}

const INITIAL: SessionLoadState = {
  stage: 'idle',
  message: '',
  sessionMeta: null,
  laps: [],
  track: null,
  telemetry: new Map(),
  loadedDrivers: [],
  error: null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSessionLoad() {
  const [state, setState] = useState<SessionLoadState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback((race: Race, sessionType: SessionType, drivers?: string[]) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setState({ ...INITIAL, stage: 'connecting', message: 'ESTABLISHING UPLINK' });

    const params = new URLSearchParams({
      year:    String(race.year),
      round:   String(race.round),
      session: sessionType,
    });
    if (drivers?.length) params.set('drivers', drivers.join(','));

    const url = `/api/session/load?${params}`;
    const es  = new EventSource(url);

    es.addEventListener('connecting', () => {
      setState(s => ({ ...s, stage: 'connecting', message: 'ESTABLISHING UPLINK' }));
    });

    es.addEventListener('session_meta', (e) => {
      const meta: SessionMeta = JSON.parse(e.data);
      setState(s => ({ ...s, stage: 'session_meta', message: 'SESSION AUTHENTICATED', sessionMeta: meta }));
    });

    es.addEventListener('lap_times', (e) => {
      const { laps } = JSON.parse(e.data) as { laps: LapRow[] };
      setState(s => ({ ...s, stage: 'lap_times', message: 'LAP DATA ACQUIRED', laps }));
    });

    es.addEventListener('track_layout', (e) => {
      const track: TrackLayout = JSON.parse(e.data);
      setState(s => ({ ...s, stage: 'track_layout', message: 'TRACK GEOMETRY MAPPED', track }));
    });

    es.addEventListener('telemetry', (e) => {
      const tel: DriverTelemetry = JSON.parse(e.data);
      setState(s => {
        const next = new Map(s.telemetry);
        next.set(tel.driver, tel);
        return {
          ...s,
          stage: 'telemetry',
          message: `TELEMETRY STREAM — ${tel.driver}`,
          telemetry: next,
          loadedDrivers: [...s.loadedDrivers, tel.driver],
        };
      });
    });

    es.addEventListener('complete', () => {
      setState(s => ({ ...s, stage: 'complete', message: 'ALL SYSTEMS GO' }));
      es.close();
    });

    es.addEventListener('warning', (e) => {
      const { message } = JSON.parse(e.data);
      console.warn('[FastF1]', message);
    });

    es.addEventListener('error', (e) => {
      let msg = 'Connection lost';
      if ('data' in e && (e as MessageEvent).data) {
        try { msg = JSON.parse((e as MessageEvent).data).message; } catch { /* raw */ }
      }
      setState(s => ({ ...s, stage: 'error', message: 'UPLINK FAILED', error: msg }));
      es.close();
    });

    abort.signal.addEventListener('abort', () => es.close());
  }, []);

  /**
   * Load telemetry for a specific driver + lap number without re-running the
   * full SSE pipeline. Updates only that driver's entry in the telemetry Map.
   * Returns true on success.
   */
  const loadLap = useCallback(async (
    race: Race,
    sessionType: SessionType,
    driver: string,
    lapNumber: number
  ): Promise<boolean> => {
    const params = new URLSearchParams({
      year:    String(race.year),
      round:   String(race.round),
      session: sessionType,
      driver,
      lap:     String(lapNumber),
    });

    try {
      const res  = await fetch(`/api/session/lap?${params}`);
      const json = await res.json() as { status: string; data?: DriverTelemetry; error?: string };
      if (json.status !== 'success' || !json.data) return false;

      setState(s => {
        const next = new Map(s.telemetry);
        next.set(driver, json.data!);
        return { ...s, telemetry: next };
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL);
  }, []);

  return { state, load, loadLap, reset };
}
