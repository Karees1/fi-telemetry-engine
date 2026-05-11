/**
 * SHARED TYPES & SCHEMAS
 * Used across frontend, backend, and API
 */

// ============================================
// RACE & SESSION TYPES
// ============================================
export interface Race {
  id: string;
  year: number;
  round: number;
  name: string;
  date: string;
  circuit: {
    id: string;
    name: string;
    location: string;
  };
  sessions: SessionType[];
}

export type SessionType = 'FP1' | 'FP2' | 'FP3' | 'Q' | 'SQ' | 'S' | 'R'; // R = Race

export interface Session {
  id: string;
  raceId: string;
  type: SessionType;
  date: string;
  status: 'upcoming' | 'live' | 'completed';
  data?: SessionData;
}

// ============================================
// LAP & TELEMETRY TYPES
// ============================================
export interface Lap {
  id: string;
  sessionId: string;
  driver: string;
  driverId: string;
  lapNumber: number;
  lapTime: number; // in milliseconds
  sector1: number;
  sector2: number;
  sector3: number;
  isPersonalBest: boolean;
  isFastest: boolean;
  compound: 'soft' | 'medium' | 'hard' | 'intermediate' | 'wet';
  freshTires: boolean;
  telemetryId: string;
}

export interface Telemetry {
  id: string;
  lapId: string;
  sessionId: string;
  driverId: string;
  timestamps: number[]; // milliseconds from lap start
  distance: number[]; // meters along track
  speed: number[]; // km/h
  throttle: number[]; // percentage 0-100
  brake: number[]; // percentage 0-100
  gear: number[];
  drs: number[]; // 0 or 1
  x: number[]; // GPS X coordinate
  y: number[]; // GPS Y coordinate
  z?: number[]; // GPS Z coordinate (elevation)
  tireTemp?: {
    frontLeft: number[];
    frontRight: number[];
    rearLeft: number[];
    rearRight: number[];
  };
  brakePressure?: number[];
  enginePower?: number[];
  gForce?: {
    x: number[];
    y: number[];
    z: number[];
  };
}

export interface TelemetryPoint {
  timestamp: number;
  distance: number;
  speed: number;
  throttle: number;
  brake: number;
  gear: number;
  drs: number;
  x: number;
  y: number;
  z?: number;
}

// ============================================
// DRIVER TYPES
// ============================================
export interface Driver {
  id: string;
  code: string; // 3-letter code like 'HAM', 'LEC', etc
  firstName: string;
  lastName: string;
  number: number;
  team: string;
  color: string; // Hex color for rendering
}

// ============================================
// API RESPONSE TYPES
// ============================================
export interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  error?: string;
  timestamp: number;
}

export interface RaceListResponse extends ApiResponse<Race[]> {}
export interface SessionDataResponse extends ApiResponse<SessionData> {}
export interface LapDataResponse extends ApiResponse<Lap[]> {}
export interface TelemetryResponse extends ApiResponse<Telemetry> {}

// ============================================
// DASHBOARD STATE TYPES
// ============================================
export interface SessionData {
  sessionId: string;
  type: SessionType;
  status: 'loading' | 'ready' | 'error';
  laps: Lap[];
  drivers: Driver[];
  circuit: {
    name: string;
    length: number;
    turns: number;
  };
}

export interface DashboardState {
  selectedRace: Race | null;
  selectedSession: Session | null;
  selectedDrivers: Driver[];
  telemetryData: Map<string, Telemetry>;
  isLoading: boolean;
  error: string | null;
  viewMode: 'all-metrics' | 'single-metric';
  focusedMetric?: 'speed' | 'throttle' | 'brake' | 'gear' | 'tire-temp' | 'g-force';
  timelinePosition: number; // 0-1, for lap scrubbing
}

export interface ComparisonMode {
  enabled: boolean;
  driver1: Driver | null;
  driver2: Driver | null;
  lap1: Lap | null;
  lap2: Lap | null;
}

// ============================================
// 3D VISUALIZATION TYPES
// ============================================
export interface TrackPoint {
  x: number;
  y: number;
  z: number;
  distance: number;
  speed: number;
}

export interface Track {
  name: string;
  points: TrackPoint[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

export interface Car3DState {
  position: [number, number, number];
  rotation: [number, number, number];
  speed: number;
  gear: number;
}

// ============================================
// CACHE METADATA
// ============================================
export interface CacheMetadata {
  key: string;
  size: number; // bytes
  createdAt: number; // timestamp
  expiresAt: number; // timestamp
  type: 'race' | 'session' | 'telemetry' | 'driver';
}

export interface CacheStats {
  totalSize: number;
  totalItems: number;
  items: CacheMetadata[];
}
