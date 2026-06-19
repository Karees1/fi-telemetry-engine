'use client';

import {
  useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback,
} from 'react';
import { Race, SessionType } from '@/types';
import { TrackLayout, LapRow } from '@/hooks/useSessionLoad';
import {
  RacePositionData, DriverPositionSeries, RaceDriverInfo, DriverLapEntry,
} from '@/hooks/useRacePositions';
import { useDashboardStore } from '@/store/dashboardStore';
import styles from './RaceMap.module.css';

// ── Design constants (match spec exactly) ─────────────────────────────────────
const SVG_W = 1200, SVG_H = 1000;
const HALFW = 17;           // half track width in SVG units
const MARGIN = 80;          // padding inside viewBox
const MAPW = 1200;          // left map column (px in 1920×1080 stage)
const MAPH = 1080;
const PANW = 720;           // right panel column width
const HDR_H = 40;           // header bar height
const PLAY_H = 44;          // playback bar height

const FH = "'Archivo', system-ui, sans-serif";
const FM = "'JetBrains Mono', ui-monospace, monospace";

const TYRE_COLORS: Record<string, { c: string; n: string }> = {
  SOFT:         { c: '#FF3B3B', n: 'S' },
  MEDIUM:       { c: '#FFD24A', n: 'M' },
  HARD:         { c: '#EaEaEa', n: 'H' },
  INTERMEDIATE: { c: '#39B54A', n: 'I' },
  WET:          { c: '#0067FF', n: 'W' },
};
const TYRE_DEFAULT = { c: '#888', n: 'M' };

// ── Geometry types ─────────────────────────────────────────────────────────────
interface SVGPt { x: number; y: number }
interface CircuitGeo {
  pathD: string;
  ribbonD: string;
  edgeLD: string;
  edgeRD: string;
  kerbs: { d: string }[];
  drsZones: { d: string; lx: number; ly: number }[];
  S: SVGPt[];
  normals: SVGPt[];
  centroid: SVGPt;
  cumLen: number[];
  totalLen: number;
}

// ── Normalizer: GPS metres → SVG viewBox coords ────────────────────────────────
function makeNorm(bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
  const { minX, maxX, minY, maxY } = bounds;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const sx = (SVG_W - 2 * MARGIN) / rangeX;
  const sy = (SVG_H - 2 * MARGIN) / rangeY;
  const sc = Math.min(sx, sy);
  const ox = (SVG_W - rangeX * sc) / 2;
  const oy = (SVG_H - rangeY * sc) / 2;
  return (gpsX: number, gpsY: number): SVGPt => ({
    x: ox + (gpsX - minX) * sc,
    y: oy + (maxY - gpsY) * sc,   // flip Y — GPS north-up, SVG top-down
  });
}

// ── SVG path builder from centerline S[] ──────────────────────────────────────
function buildCircuit(S: SVGPt[]): CircuitGeo {
  const N = S.length;
  const EMPTY: CircuitGeo = {
    pathD: '', ribbonD: '', edgeLD: '', edgeRD: '',
    kerbs: [], drsZones: [], S, normals: [],
    centroid: { x: 600, y: 500 }, cumLen: [], totalLen: 0,
  };
  if (N < 4) return EMPTY;

  // Per-point heading and outward normal (track-left)
  const headings: number[] = [];
  const normals: SVGPt[] = [];
  for (let i = 0; i < N; i++) {
    const a = S[i], b = S[(i + 1) % N];
    const h = Math.atan2(b.y - a.y, b.x - a.x);
    headings.push(h);
    normals.push({ x: -Math.sin(h), y: Math.cos(h) });
  }

  // Signed turn angle at each point
  const turns: number[] = [];
  for (let i = 0; i < N; i++) {
    let d = headings[(i + 1) % N] - headings[i];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turns.push(d);
  }
  // Smooth over ±7 samples
  const sturn: number[] = [];
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = -7; k <= 7; k++) s += turns[(i + k + N) % N];
    sturn.push(s);
  }

  // Edge point offset from centerline
  const edgePt = (i: number, side: number): SVGPt => ({
    x: S[i].x + normals[i].x * HALFW * side,
    y: S[i].y + normals[i].y * HALFW * side,
  });

  // Build path strings
  const pts = (fn: (i: number) => SVGPt) =>
    Array.from({ length: N }, (_, i) => fn(i))
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ') + ' Z';

  const pathD  = pts(i => S[i]);
  const edgeLD = pts(i => edgePt(i,  1));
  const edgeRD = pts(i => edgePt(i, -1));

  // Ribbon: left edge forward, right edge backward
  let ribbonD = Array.from({ length: N }, (_, i) => {
    const p = edgePt(i, 1);
    return `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ');
  for (let i = N - 1; i >= 0; i--) {
    const p = edgePt(i, -1);
    ribbonD += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  ribbonD += ' Z';

  // Kerb segments: corners where |smoothTurn| > 0.14
  const isCorner = sturn.map(v => Math.abs(v) > 0.14);
  const cRuns: [number, number][] = [];
  let ci = 0;
  while (ci < N) {
    if (isCorner[ci]) {
      let cj = ci;
      while (cj < N && isCorner[cj]) cj++;
      if (cj - ci >= 3) cRuns.push([ci, cj - 1]);
      ci = cj;
    } else ci++;
  }
  const kerbs: { d: string }[] = [];
  cRuns.forEach(([a, b]) => {
    const idxs = Array.from({ length: b - a + 1 }, (_, k) => (a + k) % N);
    const midI = idxs[idxs.length >> 1];
    const sign = sturn[midI] > 0 ? 1 : -1;
    [sign, -sign].forEach(s => {
      const kd = idxs
        .map((idx, k) => {
          const p = edgePt(idx, s);
          return `${k === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
        })
        .join(' ');
      kerbs.push({ d: kd });
    });
  });

  // DRS zones: two longest straights where |smoothTurn| < 0.04
  const isFlat = sturn.map(v => Math.abs(v) < 0.04);
  const fRuns: [number, number][] = [];
  let fi = 0;
  while (fi < N) {
    if (isFlat[fi]) {
      let fj = fi;
      while (fj < N && isFlat[fj]) fj++;
      if (fj - fi > 8) fRuns.push([fi, fj - 1]);
      fi = fj;
    } else fi++;
  }
  fRuns.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
  const drsZones = fRuns.slice(0, 2).map(([a, b]) => {
    const idxs = Array.from({ length: b - a + 1 }, (_, k) => (a + k) % N);
    const mid  = idxs[idxs.length >> 1];
    const d    = idxs.map((idx, k) =>
      `${k === 0 ? 'M' : 'L'} ${S[idx].x.toFixed(1)} ${S[idx].y.toFixed(1)}`
    ).join(' ');
    return {
      d,
      lx: S[mid].x + normals[mid].x * (HALFW + 17),
      ly: S[mid].y + normals[mid].y * (HALFW + 17),
    };
  });

  // Centroid
  const centroid: SVGPt = {
    x: S.reduce((a, p) => a + p.x, 0) / N,
    y: S.reduce((a, p) => a + p.y, 0) / N,
  };

  // Cumulative arc lengths for track-fraction ordering
  const cumLen: number[] = [0];
  for (let i = 1; i <= N; i++) {
    const a = S[i - 1], b = S[i % N];
    cumLen.push(cumLen[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const totalLen = cumLen[N];

  return { pathD, ribbonD, edgeLD, edgeRD, kerbs, drsZones, S, normals, centroid, cumLen, totalLen };
}

// ── Car position interpolation ─────────────────────────────────────────────────
function interpPos(series: DriverPositionSeries, t: number): { gpsX: number; gpsY: number } | null {
  const ta = series.t;
  if (!ta || ta.length === 0) return null;
  if (t <= ta[0])  return { gpsX: series.x[0], gpsY: series.y[0] };
  if (t >= ta[ta.length - 1]) return { gpsX: series.x[ta.length - 1], gpsY: series.y[ta.length - 1] };
  let lo = 0, hi = ta.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (ta[mid] <= t) lo = mid; else hi = mid;
  }
  const alpha = (t - ta[lo]) / ((ta[hi] - ta[lo]) || 1);
  return {
    gpsX: series.x[lo] + (series.x[hi] - series.x[lo]) * alpha,
    gpsY: series.y[lo] + (series.y[hi] - series.y[lo]) * alpha,
  };
}

// Returns status string at time t
function interpStatus(series: DriverPositionSeries, t: number): string {
  const ta = series.t;
  if (!ta || ta.length === 0) return 'OnTrack';
  let lo = 0, hi = ta.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (ta[mid] <= t) lo = mid; else hi = mid;
  }
  return series.status[lo] ?? 'OnTrack';
}

// ── Track fraction (nearest point on S[]) ─────────────────────────────────────
function trackFraction(svgX: number, svgY: number, S: SVGPt[], cumLen: number[], totalLen: number): number {
  if (S.length === 0 || totalLen === 0) return 0;
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < S.length; i++) {
    const d = Math.hypot(S[i].x - svgX, S[i].y - svgY);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }
  return cumLen[bestIdx] / totalLen;
}

// ── toScreen: SVG coords → 1920×1080 stage coords ─────────────────────────────
// Within the stage, the SVG occupies left:0, top:HDR_H, width:1200, height:(MAPH-HDR_H-PLAY_H)
// With viewBox 1200×1000 and preserveAspectRatio xMidYMid meet:
//   s = min(1200/1200, (MAPH-HDR_H-PLAY_H)/1000) = min(1, 996/1000) ≈ 0.996
// For simplicity we treat s=1 (negligible difference) so:
//   stageX = svgX
//   stageY = svgY + HDR_H
function toScreen(svgX: number, svgY: number): { x: number; y: number } {
  return { x: svgX, y: svgY + HDR_H };
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function fmtRaceTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function fmtLap(t: number, totalTime: number, laps = 53): number {
  return Math.min(laps, Math.floor((t / totalTime) * laps) + 1);
}

// ── Event types for the feed ───────────────────────────────────────────────────
interface FeedEvent {
  id: string;
  t: number;
  type: 'pass' | 'pit' | 'fastlap';
  code: string;
  passed?: string;
  pos?: number;
  val?: string;
  color: string;
}

// ── Static SVG Circuit (memoized, never re-renders) ───────────────────────────
function RaceCircuit({ geo }: { geo: CircuitGeo }) {
  const { pathD, ribbonD, edgeLD, edgeRD, kerbs, drsZones } = geo;
  if (!pathD) return null;
  return (
    <svg
      width={MAPW}
      height={MAPH - HDR_H - PLAY_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <filter id="rm-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="12" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="rm-bsh" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <radialGradient id="rm-terrain" cx="48%" cy="45%" r="62%">
          <stop offset="0%"   stopColor="#0e1622" />
          <stop offset="58%"  stopColor="#090d15" />
          <stop offset="100%" stopColor="#05070b" />
        </radialGradient>
        <linearGradient id="rm-asph" x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%"   stopColor="#2b313c" />
          <stop offset="100%" stopColor="#191e27" />
        </linearGradient>
      </defs>

      {/* 1. Terrain gradient */}
      <rect x="-300" y="-300" width="1800" height="1600" fill="url(#rm-terrain)" />

      {/* 2. Outer track glow */}
      <path d={pathD} fill="none" stroke="rgba(43,230,207,0.05)"
        strokeWidth={2 * HALFW + 26} strokeLinejoin="round" filter="url(#rm-glow)" />

      {/* 3. Asphalt apron */}
      <path d={ribbonD} fill="#0e131b" stroke="#080b12" strokeWidth="7" />

      {/* 4. Asphalt surface */}
      <path d={ribbonD} fill="url(#rm-asph)" />

      {/* 5. Rubbered-in racing line */}
      <path d={pathD} fill="none" stroke="rgba(0,0,0,0.20)"
        strokeWidth={HALFW * 0.85} strokeLinecap="round" strokeLinejoin="round" />

      {/* 6. DRS zone dashes */}
      {drsZones.map((z, i) => (
        <path key={`drs-${i}`} d={z.d} fill="none"
          stroke="rgba(43,230,207,0.45)" strokeWidth="2.4"
          strokeDasharray="11 7" strokeLinecap="round" />
      ))}

      {/* 7. Faint centreline */}
      <path d={pathD} fill="none" stroke="rgba(255,255,255,0.09)"
        strokeWidth="1.1" strokeDasharray="2 15" />

      {/* 8. White track edges */}
      <path d={edgeLD} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      <path d={edgeRD} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />

      {/* 9. Red/white kerbs */}
      {kerbs.map((k, i) => (
        <g key={`k-${i}`}>
          <path d={k.d} fill="none" stroke="#cb2a2a" strokeWidth="5.2" />
          <path d={k.d} fill="none" stroke="#f1f3f6" strokeWidth="5.2" strokeDasharray="7 7" />
        </g>
      ))}

      {/* 10. DRS badges */}
      {drsZones.map((z, i) => (
        <g key={`dl-${i}`} transform={`translate(${z.lx} ${z.ly})`}>
          <rect x={-16} y={-8.5} width={32} height={17} rx={3.5}
            fill="rgba(8,13,19,0.85)" stroke="rgba(43,230,207,0.45)" strokeWidth="1" />
          <text textAnchor="middle" y={4} fontFamily={FM} fontSize={10}
            fontWeight="700" fill="#2BE6CF" letterSpacing="0.06em">DRS</text>
        </g>
      ))}
    </svg>
  );
}

// ── Leaderboard row ────────────────────────────────────────────────────────────
interface LBRow {
  rank: number;
  driver: RaceDriverInfo;
  interval: string;
  pitting: boolean;
  drs: boolean;
  tyre: { c: string; n: string };
}

function Leaderboard({ rows }: { rows: LBRow[] }) {
  return (
    <div style={{ padding: '18px 22px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 13, letterSpacing: '.18em', color: 'rgba(255,255,255,.85)' }}>
          CLASSIFICATION
        </span>
        <span style={{ fontFamily: FM, fontSize: 11, color: 'rgba(255,255,255,.35)' }}>INT · GAP</span>
      </div>
      <div style={{ position: 'relative', minHeight: rows.length * 33 }}>
        {rows.map((row, i) => (
          <div
            key={row.driver.code}
            style={{
              display: 'flex', alignItems: 'center',
              height: 33, padding: '0 10px',
              borderRadius: 6,
              background: i % 2 ? 'rgba(255,255,255,0.018)' : 'transparent',
              gap: 0,
            }}
          >
            <span style={{ width: 22, fontFamily: FM, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.5)', flexShrink: 0 }}>
              {row.rank}
            </span>
            <span style={{ width: 3, height: 18, background: row.driver.color, borderRadius: 2, marginRight: 9, flexShrink: 0 }} />
            <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 14, color: '#fff', width: 44, flexShrink: 0 }}>
              {row.driver.code}
            </span>
            <span style={{ fontFamily: FH, fontWeight: 500, fontSize: 12, color: 'rgba(255,255,255,.5)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {row.driver.fullName.split(' ').pop()}
            </span>
            {row.drs && (
              <span style={{ fontFamily: FM, fontSize: 9, fontWeight: 700, color: '#2BE6CF', border: '1px solid #2BE6CF66', borderRadius: 3, padding: '1px 3px', marginRight: 7 }}>
                DRS
              </span>
            )}
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              border: `2px solid ${row.tyre.c}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: FM, fontSize: 7, fontWeight: 700, color: row.tyre.c,
              marginRight: 9, flexShrink: 0,
            }}>
              {row.tyre.n}
            </span>
            <span style={{
              fontFamily: FM, fontSize: 12, fontWeight: 600,
              width: 58, textAlign: 'right',
              color: row.pitting ? '#37B6FF' : row.rank === 1 ? '#ffd24a' : 'rgba(255,255,255,.8)',
            }}>
              {row.pitting ? 'IN PIT' : row.rank === 1 ? 'LEADER' : row.interval}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Event feed ─────────────────────────────────────────────────────────────────
function EventFeed({ events, byCode }: { events: FeedEvent[]; byCode: Map<string, RaceDriverInfo> }) {
  const shown = events.slice(-9).reverse();
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 22px', minHeight: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 0',
        borderTop: '1px solid rgba(255,255,255,0.09)',
      }}>
        <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 13, letterSpacing: '.18em', color: 'rgba(255,255,255,.85)' }}>
          RACE FEED
        </span>
        <span style={{ fontFamily: FM, fontSize: 10, color: 'rgba(255,255,255,.3)' }}>· live</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {shown.length === 0
          ? <div style={{ fontFamily: FM, fontSize: 12, color: 'rgba(255,255,255,.3)', padding: '14px 0' }}>Awaiting incidents…</div>
          : shown.map(ev => {
              const drv = byCode.get(ev.code);
              const color = ev.type === 'fastlap' ? '#C77DFF' : ev.type === 'pit' ? '#37B6FF' : ev.color;
              return (
                <div key={ev.id} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  animation: 'rmFeedIn .35s ease',
                }}>
                  <span style={{ width: 3, alignSelf: 'stretch', background: drv?.color ?? color, borderRadius: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontFamily: FH, fontSize: 12.5, lineHeight: 1.35 }}>
                    {ev.type === 'pass' && (
                      <span>
                        <b style={{ color: drv?.color ?? '#fff', fontWeight: 800 }}>{ev.code}</b>
                        {' passes '}
                        <b style={{ color: byCode.get(ev.passed ?? '')?.color ?? '#fff', fontWeight: 800 }}>{ev.passed}</b>
                        {` for P${ev.pos}`}
                        <span style={{ color: 'rgba(255,255,255,.4)', fontFamily: FM, fontSize: 11 }}> · overtake</span>
                      </span>
                    )}
                    {ev.type === 'pit' && (
                      <span style={{ color: '#9fd4ff' }}>
                        PIT STOP · <b style={{ color: drv?.color ?? '#fff' }}>{ev.code}</b>
                        <span style={{ fontFamily: FM, color: 'rgba(255,255,255,.5)' }}> {ev.val}</span>
                      </span>
                    )}
                    {ev.type === 'fastlap' && (
                      <span style={{ color: '#C77DFF', fontWeight: 700 }}>
                        FASTEST LAP · <b style={{ color: drv?.color ?? '#fff' }}>{ev.code}</b>
                        <span style={{ fontFamily: FM }}> {ev.val}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
        }
      </div>
    </div>
  );
}

// ── Right Panel (leaderboard + feed) ─────────────────────────────────────────
function RacePanel({
  rows, events, byCode,
}: {
  rows: LBRow[];
  events: FeedEvent[];
  byCode: Map<string, RaceDriverInfo>;
}) {
  return (
    <div style={{
      position: 'absolute',
      left: MAPW, top: 0,
      width: PANW, height: MAPH - PLAY_H,
      display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg,#0a0e16,#070a10)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      boxSizing: 'border-box',
      overflow: 'hidden',
    }}>
      <Leaderboard rows={rows} />
      <EventFeed events={events} byCode={byCode} />
    </div>
  );
}

// ── Header bar (over the map) ─────────────────────────────────────────────────
function RaceHeader({
  gpName, circuitName, lapNum, totalLaps, onExit,
}: {
  gpName: string; circuitName: string;
  lapNum: number; totalLaps: number;
  onExit: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', left: 0, top: 0,
      width: MAPW, height: HDR_H,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 20px', boxSizing: 'border-box',
      background: 'rgba(8,11,17,0.72)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      zIndex: 6,
    }}>
      {/* Exit button */}
      <button
        onClick={onExit}
        style={{
          background: 'none', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 4, color: 'rgba(255,255,255,.6)',
          fontFamily: FM, fontSize: 10, fontWeight: 700,
          letterSpacing: '.14em', padding: '3px 9px',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        ← EXIT
      </button>

      <span style={{ fontFamily: FH, fontWeight: 900, fontSize: 15, color: '#fff', letterSpacing: '.02em' }}>
        {gpName}
      </span>
      <span style={{ fontFamily: FM, fontSize: 12, color: 'rgba(255,255,255,.4)', letterSpacing: '.1em' }}>
        {circuitName}
      </span>

      <span style={{ flex: 1 }} />

      {/* LIVE dot */}
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: '#FF3B3B', boxShadow: '0 0 8px #FF3B3B',
        animation: 'rmPulse 1.3s infinite',
      }} />
      <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 12, letterSpacing: '.18em', color: '#FF5A5A' }}>
        LIVE
      </span>

      {/* Lap counter */}
      <span style={{
        fontFamily: FH, fontWeight: 800, fontSize: 14,
        color: '#0a0d15', background: '#ffd24a',
        padding: '4px 10px', borderRadius: 4,
      }}>
        LAP {lapNum}<span style={{ opacity: .6 }}> / {totalLaps}</span>
      </span>
    </div>
  );
}

// ── Playback bar (bottom) ─────────────────────────────────────────────────────
const RACE_SPEEDS = [1, 5, 10, 30, 60];

function PlaybackBar({ totalTime }: { totalTime: number }) {
  const isPlaying     = useDashboardStore(s => s.isPlaying);
  const playbackSpeed = useDashboardStore(s => s.playbackSpeed);
  const setIsPlaying  = useDashboardStore(s => s.setIsPlaying);
  const setSpeed      = useDashboardStore(s => s.setPlaybackSpeed);
  const setRaceTime   = useDashboardStore(s => s.setRaceTimeSeconds);

  const fillRef  = useRef<HTMLDivElement>(null);
  const timeRef  = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = useDashboardStore.subscribe(
      s => s.raceTimeSeconds,
      t => {
        const pct = totalTime > 0 ? (t / totalTime) * 100 : 0;
        if (fillRef.current) fillRef.current.style.width = `${pct.toFixed(2)}%`;
        if (timeRef.current) timeRef.current.textContent = fmtRaceTime(t);
      }
    );
    return unsub;
  }, [totalTime]);

  const scrub = useCallback((clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setRaceTime(ratio * totalTime);
  }, [totalTime, setRaceTime]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    scrub(e.clientX);
    const onMove = (ev: MouseEvent) => scrub(ev.clientX);
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      height: PLAY_H,
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 24px', boxSizing: 'border-box',
      background: 'rgba(7,9,14,0.92)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      zIndex: 8,
    }}>
      {/* Rewind */}
      <button
        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer', padding: 4 }}
        onClick={() => { setRaceTime(0); setIsPlaying(false); }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14">
          <polygon points="12,2 6,7 12,12" fill="currentColor" />
          <rect x="2" y="2" width="3" height="10" fill="currentColor" rx="1" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}
        onClick={() => {
          const t = useDashboardStore.getState().raceTimeSeconds;
          if (t >= totalTime) setRaceTime(0);
          setIsPlaying(!isPlaying);
        }}
      >
        {isPlaying
          ? <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="4" height="12" fill="currentColor" rx="1" /><rect x="8" y="1" width="4" height="12" fill="currentColor" rx="1" /></svg>
          : <svg width="14" height="14" viewBox="0 0 14 14"><polygon points="2,1 12,7 2,13" fill="currentColor" /></svg>
        }
      </button>

      {/* Speed buttons */}
      <div style={{ display: 'flex', gap: 4 }}>
        {RACE_SPEEDS.map(sp => (
          <button
            key={sp}
            onClick={() => setSpeed(sp)}
            style={{
              fontFamily: FM, fontSize: 11, fontWeight: 600,
              padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
              border: `1px solid ${sp === playbackSpeed ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.15)'}`,
              background: sp === playbackSpeed ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.04)',
              color: sp === playbackSpeed ? '#fff' : 'rgba(255,255,255,.4)',
            }}
          >
            {sp}×
          </button>
        ))}
      </div>

      {/* Scrub track */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{
          flex: 1, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,.12)',
          cursor: 'pointer', position: 'relative',
        }}
      >
        <div ref={fillRef} style={{
          position: 'absolute', left: 0, top: 0, height: '100%',
          background: '#2BE6CF', borderRadius: 2, width: '0%',
          transition: 'width .1s linear',
        }} />
      </div>

      {/* Time display */}
      <span ref={timeRef} style={{ fontFamily: FM, fontSize: 13, fontWeight: 600, color: '#fff', minWidth: 80, textAlign: 'right' }}>
        0:00:00
      </span>
    </div>
  );
}

// ── Tyre lookup from lap data ──────────────────────────────────────────────────
function getTyreAtTime(
  code: string,
  t: number,
  driverLaps: Record<string, DriverLapEntry[]> | undefined,
): { c: string; n: string } {
  if (!driverLaps) return TYRE_DEFAULT;
  const laps = driverLaps[code];
  if (!laps) return TYRE_DEFAULT;
  for (const lap of laps) {
    if (t >= lap.start && t < lap.start + lap.duration) {
      return TYRE_COLORS[lap.compound?.toUpperCase()] ?? TYRE_DEFAULT;
    }
  }
  return TYRE_DEFAULT;
}

// ── Main RaceMap component ─────────────────────────────────────────────────────
interface RaceMapProps {
  track: TrackLayout;
  racePositions: RacePositionData | null;
  race: Race;
  session: SessionType;
  laps?: LapRow[];
}

export function RaceMap({ track, racePositions, race, session, laps }: RaceMapProps) {
  const setRaceMode  = useDashboardStore(s => s.setRaceMode);
  const totalTime    = racePositions?.totalTime ?? 0;

  // Compute total laps from actual lap data
  const totalLaps = useMemo(() => {
    if (racePositions?.driverLaps) {
      let max = 0;
      for (const drvLaps of Object.values(racePositions.driverLaps)) {
        const last = drvLaps[drvLaps.length - 1];
        if (last && last.n > max) max = last.n;
      }
      if (max > 0) return max;
    }
    if (laps && laps.length > 0) {
      return Math.max(...laps.map(l => l.lapNumber));
    }
    return 53;
  }, [racePositions, laps]);

  // ── Scale the 1920×1080 stage to fit the viewport ─────────────────────────
  const [stageScale, setStageScale] = useState(1);
  useLayoutEffect(() => {
    const update = () => setStageScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // ── Build SVG circuit geometry (once per track data) ──────────────────────
  const { geo, norm } = useMemo(() => {
    const bounds = track.bounds;
    const n = makeNorm(bounds);
    const S: SVGPt[] = track.x.map((x, i) => n(x, track.y[i]));
    return { geo: buildCircuit(S), norm: n };
  }, [track]);

  // ── Leaderboard state (updates at 2Hz) ────────────────────────────────────
  const [lbRows, setLbRows] = useState<LBRow[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const prevOrderRef = useRef<string[]>([]);
  const eventIdRef   = useRef(0);
  const pitTrackerRef = useRef<Map<string, boolean>>(new Map()); // code → was pitting

  const byCode = useMemo(() => {
    const m = new Map<string, RaceDriverInfo>();
    racePositions?.drivers.forEach(d => m.set(d.code, d));
    return m;
  }, [racePositions]);

  // Compute leaderboard rows from current race time
  const computeLeaderboard = useCallback((t: number) => {
    if (!racePositions) return;
    const { positions, drivers } = racePositions;

    const rows: Array<{ driver: RaceDriverInfo; frac: number; pitting: boolean }> = [];

    drivers.forEach(driver => {
      const series = positions.get(driver.code);
      if (!series) return;
      const gps = interpPos(series, t);
      const status = interpStatus(series, t);
      const pitting = status === 'Pitlane';

      if (gps && geo.S.length > 0) {
        const svgPt = norm(gps.gpsX, gps.gpsY);
        const frac  = trackFraction(svgPt.x, svgPt.y, geo.S, geo.cumLen, geo.totalLen);
        rows.push({ driver, frac, pitting });
      } else {
        rows.push({ driver, frac: 0, pitting });
      }
    });

    // Sort by track fraction descending (car furthest along = P1)
    rows.sort((a, b) => b.frac - a.frac);

    const newOrder = rows.map(r => r.driver.code);

    // Detect overtakes vs previous frame
    const prev = prevOrderRef.current;
    if (prev.length > 0) {
      newOrder.forEach((code, rank) => {
        const prevRank = prev.indexOf(code);
        if (prevRank > rank) {
          // This car moved UP — it passed someone
          const passed = newOrder[rank + 1] ?? '';
          if (passed && prev.indexOf(code) > prev.indexOf(passed)) {
            const ev: FeedEvent = {
              id:     `${++eventIdRef.current}`,
              t,
              type:   'pass',
              code,
              passed,
              pos:    rank + 1,
              color:  byCode.get(code)?.color ?? '#fff',
            };
            setFeedEvents(prev => [...prev, ev].slice(-20));
          }
        }
      });
    }
    prevOrderRef.current = newOrder;

    // Detect pit entries/exits
    rows.forEach(({ driver, pitting }) => {
      const wasPitting = pitTrackerRef.current.get(driver.code) ?? false;
      if (!wasPitting && pitting) {
        // Pit entry
        const ev: FeedEvent = {
          id:    `${++eventIdRef.current}`,
          t,
          type:  'pit',
          code:  driver.code,
          val:   'pitting',
          color: driver.color,
        };
        setFeedEvents(prev => [...prev, ev].slice(-20));
      }
      pitTrackerRef.current.set(driver.code, pitting);
    });

    // Estimate average lap time from first few drivers for gap approximation
    const avgLapSec = (() => {
      if (!racePositions?.driverLaps) return 90;
      const samples: number[] = [];
      for (const lapsArr of Object.values(racePositions.driverLaps)) {
        for (const l of lapsArr) {
          if (l.duration > 60 && l.duration < 200) samples.push(l.duration);
          if (samples.length >= 10) break;
        }
        if (samples.length >= 10) break;
      }
      if (!samples.length) return 90;
      return samples.reduce((a, b) => a + b, 0) / samples.length;
    })();

    // Build leaderboard rows with approximate intervals
    const built: LBRow[] = rows.map((r, i) => {
      const fracAhead = i === 0 ? r.frac : rows[i - 1].frac;
      const fracDiff  = fracAhead - r.frac;
      const approxSec = fracDiff * avgLapSec;
      const interval  = i === 0 ? 'LEADER' : `+${approxSec.toFixed(1)}s`;
      const tyre      = getTyreAtTime(r.driver.code, t, racePositions?.driverLaps);
      return {
        rank: i + 1,
        driver: r.driver,
        interval,
        pitting: r.pitting,
        drs: i > 0 && !r.pitting && (fracAhead - r.frac) * avgLapSec < 1.0,
        tyre,
      };
    });

    setLbRows(built);
  }, [racePositions, geo, norm, byCode]);

  // Leaderboard refresh timer (2Hz)
  useEffect(() => {
    if (!racePositions) return;
    const id = setInterval(() => {
      const t = useDashboardStore.getState().raceTimeSeconds;
      computeLeaderboard(t);
    }, 500);
    return () => clearInterval(id);
  }, [racePositions, computeLeaderboard]);

  // ── Car animation refs (RAF, no React re-renders) ─────────────────────────
  // Store refs to each car's container div
  const carContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const carBodyRefs      = useRef<Map<string, HTMLDivElement>>(new Map());
  const carTagRefs       = useRef<Map<string, HTMLDivElement>>(new Map());
  const trailRefs        = useRef<Map<string, HTMLDivElement[]>>(new Map());

  // Playback RAF (advances raceTimeSeconds)
  useEffect(() => {
    let raf: number;
    let lastTs: number | null = null;

    const tick = (ts: number) => {
      const store = useDashboardStore.getState();
      if (store.isPlaying && totalTime > 0) {
        const dt = lastTs !== null ? (ts - lastTs) / 1000 : 0;
        const next = store.raceTimeSeconds + dt * store.playbackSpeed;
        if (next >= totalTime) {
          store.setRaceTimeSeconds(totalTime);
          store.setIsPlaying(false);
        } else {
          store.setRaceTimeSeconds(next);
        }
      }
      lastTs = ts;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [totalTime]);

  // Car position animation RAF
  useEffect(() => {
    if (!racePositions) return;
    const { positions } = racePositions;
    let raf: number;

    const frame = () => {
      const t = useDashboardStore.getState().raceTimeSeconds;

      positions.forEach((series, code) => {
        const container = carContainerRefs.current.get(code);
        const bodyEl    = carBodyRefs.current.get(code);
        const tagEl     = carTagRefs.current.get(code);
        const trails    = trailRefs.current.get(code);
        if (!container) return;

        const gps = interpPos(series, t);
        if (!gps) return;

        const svgPt  = norm(gps.gpsX, gps.gpsY);
        const screen = toScreen(svgPt.x, svgPt.y);

        // Heading: compare position slightly ahead in time
        const gps2   = interpPos(series, t + 0.5);
        let deg = 0;
        if (gps2) {
          const s2 = toScreen(norm(gps2.gpsX, gps2.gpsY).x, norm(gps2.gpsX, gps2.gpsY).y);
          deg = Math.atan2(s2.y - screen.y, s2.x - screen.x) * 180 / Math.PI;
        }

        container.style.left = `${screen.x}px`;
        container.style.top  = `${screen.y}px`;
        if (bodyEl) bodyEl.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;

        // Outboard tag (away from centroid)
        if (tagEl) {
          const cen = geo.centroid;
          const dx  = svgPt.x - cen.x, dy = svgPt.y - cen.y;
          const m   = Math.hypot(dx, dy) || 1;
          const tagSvg = { x: svgPt.x + (dx / m) * 28, y: svgPt.y + (dy / m) * 28 };
          const tagScr = toScreen(tagSvg.x, tagSvg.y);
          tagEl.style.left = `${tagScr.x}px`;
          tagEl.style.top  = `${tagScr.y}px`;
        }

        // Trail circles: 4 ghost positions behind
        if (trails) {
          for (let k = 1; k <= 4; k++) {
            const tg = interpPos(series, t - k * 0.4);
            if (!tg || !trails[k - 1]) continue;
            const ts2 = toScreen(norm(tg.gpsX, tg.gpsY).x, norm(tg.gpsX, tg.gpsY).y);
            const sz = 9.5 - k * 1.3;
            trails[k - 1].style.left    = `${ts2.x}px`;
            trails[k - 1].style.top     = `${ts2.y}px`;
            trails[k - 1].style.width   = `${sz}px`;
            trails[k - 1].style.height  = `${sz}px`;
            trails[k - 1].style.opacity = `${0.22 - k * 0.04}`;
          }
        }
      });

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [racePositions, geo, norm]);

  // ── Lap counter (reactive) ─────────────────────────────────────────────────
  const [lapNum, setLapNum] = useState(1);
  useEffect(() => {
    const unsub = useDashboardStore.subscribe(
      s => s.raceTimeSeconds,
      t => setLapNum(fmtLap(t, totalTime, totalLaps))
    );
    return unsub;
  }, [totalTime, totalLaps]);

  const gpName      = race.name.toUpperCase();
  const circuitName = race.circuit.name.toUpperCase();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.backdrop}>
      <div
        className={styles.stage}
        style={{ transform: `translate(-50%,-50%) scale(${stageScale})` }}
      >
        {/* ── Left 1200px map column ── */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: MAPW, height: MAPH }}>
          {/* Header */}
          <RaceHeader
            gpName={gpName}
            circuitName={circuitName}
            lapNum={lapNum}
            totalLaps={totalLaps}
            onExit={() => setRaceMode(false)}
          />

          {/* SVG circuit (starts below header) */}
          <div style={{ position: 'absolute', left: 0, top: HDR_H, width: MAPW, height: MAPH - HDR_H - PLAY_H }}>
            <RaceCircuit geo={geo} />
          </div>

          {/* Car overlay layer */}
          <div style={{ position: 'absolute', left: 0, top: 0, width: MAPW, height: MAPH - PLAY_H, overflow: 'hidden' }}>
            {racePositions ? (
              racePositions.drivers.map(driver => {
                const color = driver.color;
                return (
                  <div key={driver.code}>
                    {/* 4 trail ghost circles */}
                    {[1, 2, 3, 4].map(k => (
                      <div
                        key={k}
                        ref={el => {
                          if (!el) return;
                          if (!trailRefs.current.has(driver.code)) {
                            trailRefs.current.set(driver.code, []);
                          }
                          const arr = trailRefs.current.get(driver.code)!;
                          arr[k - 1] = el;
                        }}
                        style={{
                          position: 'absolute',
                          borderRadius: '50%',
                          background: color,
                          pointerEvents: 'none',
                          transform: 'translate(-50%,-50%)',
                          willChange: 'left, top, width, height, opacity',
                        }}
                      />
                    ))}

                    {/* Car body (rotates to heading) */}
                    <div
                      ref={el => { if (el) carContainerRefs.current.set(driver.code, el); }}
                      style={{
                        position: 'absolute',
                        pointerEvents: 'none',
                        zIndex: 3,
                        willChange: 'left, top',
                      }}
                    >
                      <div
                        ref={el => { if (el) carBodyRefs.current.set(driver.code, el); }}
                        style={{
                          width: 19, height: 11,
                          borderRadius: 3,
                          background: color,
                          border: '1.5px solid rgba(5,7,12,0.9)',
                          boxShadow: '0 1px 3px rgba(0,0,0,.65)',
                          position: 'relative',
                          willChange: 'transform',
                        }}
                      >
                        {/* White nose on the right (front) */}
                        <div style={{
                          position: 'absolute', right: -1, top: '50%',
                          transform: 'translateY(-50%)',
                          width: 4, height: 7.5,
                          borderRadius: 2,
                          background: 'rgba(255,255,255,.92)',
                        }} />
                      </div>
                    </div>

                    {/* Outboard driver code tag */}
                    <div
                      ref={el => { if (el) carTagRefs.current.set(driver.code, el); }}
                      style={{
                        position: 'absolute',
                        transform: 'translate(-50%,-50%)',
                        display: 'flex', alignItems: 'center',
                        background: 'rgba(10,13,20,0.9)',
                        border: `1px solid ${color}66`,
                        borderRadius: 4,
                        overflow: 'hidden',
                        zIndex: 4,
                        pointerEvents: 'none',
                        willChange: 'left, top',
                      }}
                    >
                      <div style={{ width: 3, alignSelf: 'stretch', background: color }} />
                      <span style={{
                        fontFamily: FH, fontWeight: 800, fontSize: 11,
                        color: '#fff', padding: '2px 5px',
                      }}>
                        {driver.code}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                fontFamily: FM, fontSize: 11, letterSpacing: '.18em',
                color: 'rgba(43,230,207,0.6)',
              }}>
                LOADING RACE DATA…
              </div>
            )}
          </div>
        </div>

        {/* ── Right 720px panel ── */}
        <RacePanel rows={lbRows} events={feedEvents} byCode={byCode} />

        {/* ── Bottom playback bar (full 1920px) ── */}
        <PlaybackBar totalTime={totalTime} />
      </div>
    </div>
  );
}
