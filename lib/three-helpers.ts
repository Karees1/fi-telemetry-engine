import * as THREE from 'three';

export interface NormalizedPoint {
  x: number;
  y: number;
  z: number;
}

export type Normalizer = (fx: number, fy: number, fz?: number) => NormalizedPoint;

/**
 * Returns a normalizer function that maps FastF1 GPS coords (meters) into
 * Three.js world space (~-5 to +5 units).
 *
 * FastF1 axes → Three.js axes:
 *   FastF1 X → Three.js X
 *   FastF1 Y → Three.js Z  (track depth / horizontal plane)
 *   FastF1 Z → Three.js Y  (elevation / up)
 */
// Amplify elevation so altitude changes are visible (FastF1 Z is in metres;
// without this the vertical range is tiny compared to the horizontal span).
const ELEVATION_BOOST = 4;

export function createNormalizer(bounds: {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}): Normalizer {
  const range = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const scale = 10 / range;
  const cx = (bounds.maxX + bounds.minX) / 2;
  const cy = (bounds.maxY + bounds.minY) / 2;

  return (fx: number, fy: number, fz = 0) => ({
    x: (fx - cx) * scale,
    y: fz * scale * ELEVATION_BOOST,
    z: (fy - cy) * scale,
  });
}

/** Plasma colormap: 0 (slow/blue) → 1 (fast/yellow-red). Returns RGB 0-1. */
export function speedToColor(speed: number, min: number, max: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, (speed - min) / (max - min || 1)));
  const r = Math.min(1, t * 1.8);
  const g = Math.max(0, t * 2 - 1) * 0.9;
  const b = Math.max(0, 1 - t * 2);
  return [r, g, b];
}

/** Build a BufferGeometry from NormalizedPoints for use as a LineSegments heatmap. */
export function buildHeatmapGeometry(
  points: (NormalizedPoint & { speed: number })[],
  minSpeed: number,
  maxSpeed: number
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];

    positions.push(p.x, p.y, p.z, q.x, q.y, q.z);

    const [r, g, b] = speedToColor(p.speed, minSpeed, maxSpeed);
    colors.push(r, g, b, r, g, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

/** Linear interpolation between two NormalizedPoints. */
export function lerpPoint(
  a: NormalizedPoint,
  b: NormalizedPoint,
  t: number
): [number, number, number] {
  return [
    THREE.MathUtils.lerp(a.x, b.x, t),
    THREE.MathUtils.lerp(a.y, b.y, t),
    THREE.MathUtils.lerp(a.z, b.z, t),
  ];
}

/** Heading angle (Y-rotation) from current point to next point.
 *  Subtracts π/2 to align car geometry (+X nose) with travel direction. */
export function headingAngle(curr: NormalizedPoint, next: NormalizedPoint): number {
  return Math.atan2(next.x - curr.x, next.z - curr.z) - Math.PI / 2;
}
