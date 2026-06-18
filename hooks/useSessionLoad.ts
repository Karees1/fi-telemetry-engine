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

// ── Cache helpers ─────────────────────────────────────────────────────────────

interface SessionMetaCache {
  sessionMeta: SessionMeta;
  laps: LapRow[];
  track: TrackLayout | null;
  driverCodes: string[];  // which drivers have cached telemetry
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function loadFromCache(
  race: Race,
  sessionType: SessionType,
  setState: React.Dispatch<React.SetStateAction<SessionLoadState>>,
): Promise<boolean> {
  const params = new URLSearchParams({
    year: String(race.year), round: String(race.round), session: sessionType, type: 'meta',
  });

  let metaCache: SessionMetaCache;
  try {
    const res = await fetch(`/api/cache/session?${params}`);
    if (!res.ok) return false;
    const { cached, data } = await res.json() as { cached: boolean; data: SessionMetaCache };
    if (!cached) return false;
    metaCache = data;
  } catch {
    return false;
  }

  // Replay stages with short delays so the uplink UI animates
  setState(s => ({ ...s, stage: 'session_meta', message: 'SESSION AUTHENTICATED', sessionMeta: metaCache.sessionMeta }));
  await delay(80);
  setState(s => ({ ...s, stage: 'lap_times', message: 'LAP DATA ACQUIRED', laps: metaCache.laps }));
  await delay(80);
  setState(s => ({ ...s, stage: 'track_layout', message: 'TRACK GEOMETRY MAPPED', track: metaCache.track }));
  await delay(80);

  // Fetch all driver telemetry blobs in parallel
  const driverParams = metaCache.driverCodes.map(code => {
    const p = new URLSearchParams({
      year: String(race.year), round: String(race.round), session: sessionType,
      type: 'driver', driver: code,
    });
    return fetch(`/api/cache/session?${p}`)
      .then(r => r.json() as Promise<{ cached: boolean; data: DriverTelemetry }>)
      .then(({ cached, data }) => (cached ? data : null))
      .catch(() => null);
  });

  const results = await Promise.all(driverParams);

  for (const tel of results) {
    if (!tel) continue;
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
    await delay(25);
  }

  setState(s => ({ ...s, stage: 'complete', message: 'ALL SYSTEMS GO' }));
  return true;
}

function storeToCache(
  race: Race,
  sessionType: SessionType,
  state: SessionLoadState,
): void {
  // Fire-and-forget — never block or throw
  const base = { year: String(race.year), round: String(race.round), session: sessionType };
  const driverCodes = [...state.telemetry.keys()];

  // 1. Meta blob (sessionMeta + laps + track + driver code list)
  const metaPayload: SessionMetaCache = {
    sessionMeta: state.sessionMeta!,
    laps: state.laps,
    track: state.track,
    driverCodes,
  };
  fetch('/api/cache/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...base, type: 'meta', data: metaPayload }),
  }).catch(() => {});

  // 2. Per-driver telemetry blobs (sequential to avoid hammering the API)
  void (async () => {
    for (const code of driverCodes) {
      const tel = state.telemetry.get(code);
      if (!tel) continue;
      try {
        await fetch('/api/cache/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, type: 'driver', driver: code, data: tel }),
        });
      } catch { /* ignore */ }
    }
  })();
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSessionLoad() {
  const [state, setState] = useState<SessionLoadState>(INITIAL);
  const abortRef  = useRef<AbortController | null>(null);
  const stateRef  = useRef<SessionLoadState>(INITIAL);

  // Keep a ref in sync so the SSE complete handler can read the latest state
  const setStateAndRef = useCallback((updater: React.SetStateAction<SessionLoadState>) => {
    setState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      stateRef.current = next;
      return next;
    });
  }, []);

  const load = useCallback(async (race: Race, sessionType: SessionType, drivers?: string[]) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setStateAndRef({ ...INITIAL, stage: 'connecting', message: 'CHECKING CACHE' });

    // ── 1. Cache-first check ──────────────────────────────────────────────────
    const cacheHit = await loadFromCache(race, sessionType, setStateAndRef);
    if (abort.signal.aborted) return;
    if (cacheHit) return;

    // ── 2. Cache miss — connect to Python SSE ────────────────────────────────
    setStateAndRef({ ...INITIAL, stage: 'connecting', message: 'ESTABLISHING UPLINK' });

    const params = new URLSearchParams({
      year:    String(race.year),
      round:   String(race.round),
      session: sessionType,
    });
    if (drivers?.length) params.set('drivers', drivers.join(','));

    const es = new EventSource(`/api/session/load?${params}`);

    es.addEventListener('connecting', () => {
      setStateAndRef(s => ({ ...s, stage: 'connecting', message: 'ESTABLISHING UPLINK' }));
    });

    es.addEventListener('session_meta', (e) => {
      const meta: SessionMeta = JSON.parse(e.data);
      setStateAndRef(s => ({ ...s, stage: 'session_meta', message: 'SESSION AUTHENTICATED', sessionMeta: meta }));
    });

    es.addEventListener('lap_times', (e) => {
      const { laps } = JSON.parse(e.data) as { laps: LapRow[] };
      setStateAndRef(s => ({ ...s, stage: 'lap_times', message: 'LAP DATA ACQUIRED', laps }));
    });

    es.addEventListener('track_layout', (e) => {
      const track: TrackLayout = JSON.parse(e.data);
      setStateAndRef(s => ({ ...s, stage: 'track_layout', message: 'TRACK GEOMETRY MAPPED', track }));
    });

    es.addEventListener('telemetry', (e) => {
      const tel: DriverTelemetry = JSON.parse(e.data);
      setStateAndRef(s => {
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
      setStateAndRef(s => ({ ...s, stage: 'complete', message: 'ALL SYSTEMS GO' }));
      es.close();
      // Store assembled state to Vercel Blob (fire and forget)
      storeToCache(race, sessionType, stateRef.current);
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
      setStateAndRef(s => ({ ...s, stage: 'error', message: 'UPLINK FAILED', error: msg }));
      es.close();
    });

    abort.signal.addEventListener('abort', () => es.close());
  }, [setStateAndRef]);

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

      setStateAndRef(s => {
        const next = new Map(s.telemetry);
        next.set(driver, json.data!);
        return { ...s, telemetry: next };
      });
      return true;
    } catch {
      return false;
    }
  }, [setStateAndRef]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStateAndRef(INITIAL);
  }, [setStateAndRef]);

  return { state, load, loadLap, reset };
}
