'use client';

import { useRef, useMemo, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { NormalizedPoint, lerpPoint, headingAngle } from '@/lib/three-helpers';
import { useDashboardStore } from '@/store/dashboardStore';
import { CarGeometry } from './CarGeometry';

export const DRIVER_COLORS: Record<number, string> = {
  0: '#00D9FF',
  1: '#EF1E24',
  2: '#06FFA5',
  3: '#FFB800',
  4: '#FF6B35',
};

const TRAIL_MAX      = 100;
const WHEEL_RADIUS   = 0.15 * 0.28;   // tyre radius in Three.js units (matches CarGeometry scale)

interface CarModelProps {
  points: NormalizedPoint[];
  driverIndex?: number;
  primaryFrames?: number;
  carPositionRef?: MutableRefObject<[number, number, number]>;
}

export function CarModel({ points, driverIndex = 0, primaryFrames, carPositionRef }: CarModelProps) {
  const groupRef       = useRef<THREE.Group>(null);
  const wheelRefs      = useRef<(THREE.Group | null)[]>([null, null, null, null]);
  const prevPosRef     = useRef<THREE.Vector3>(new THREE.Vector3());
  const leanRef        = useRef(0);
  const prevHeadingRef = useRef(0);
  const wheelRotRef    = useRef(0);

  const color = DRIVER_COLORS[driverIndex] ?? '#00D9FF';

  // ── Ghost trail ───────────────────────────────────────────────────────────
  const trailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(TRAIL_MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const trailMat = useMemo(() =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }),
    [color]
  );

  const trailLine = useMemo(() => new THREE.Line(trailGeo, trailMat), [trailGeo, trailMat]);

  const trailBuf    = useRef(new Float32Array(TRAIL_MAX * 3));
  const trailTail   = useRef(0);
  const trailFilled = useRef(0);

  useEffect(() => {
    return () => {
      trailGeo.dispose();
      trailMat.dispose();
    };
  }, [trailGeo, trailMat]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useFrame(() => {
    if (!groupRef.current || points.length < 2) return;

    const rawFi   = useDashboardStore.getState().frameIndex;
    const scaledFi = (primaryFrames && primaryFrames > 0)
      ? rawFi * (points.length / primaryFrames)
      : rawFi;

    const idx  = Math.min(Math.floor(scaledFi), points.length - 2);
    const t    = scaledFi - Math.floor(scaledFi);
    const curr = points[idx];
    const next = points[Math.min(idx + 1, points.length - 1)];

    const [px, py, pz] = lerpPoint(curr, next, t);
    const heading      = headingAngle(curr, next);

    // ── Position & heading ──────────────────────────────────────────────────
    groupRef.current.position.set(px, py, pz);
    groupRef.current.rotation.y = heading;

    // ── Corner lean (roll around car's own forward axis) ───────────────────
    let deltaH = heading - prevHeadingRef.current;
    if (deltaH >  Math.PI) deltaH -= 2 * Math.PI;
    if (deltaH < -Math.PI) deltaH += 2 * Math.PI;
    const targetLean = THREE.MathUtils.clamp(-deltaH * 14, -0.28, 0.28);
    leanRef.current  = THREE.MathUtils.lerp(leanRef.current, targetLean, 0.1);
    groupRef.current.rotation.z = leanRef.current;
    prevHeadingRef.current = heading;

    // ── Wheel spin ─────────────────────────────────────────────────────────
    const dx   = px - prevPosRef.current.x;
    const dz   = pz - prevPosRef.current.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    prevPosRef.current.set(px, py, pz);
    wheelRotRef.current -= dist / WHEEL_RADIUS;
    wheelRefs.current.forEach(wRef => {
      if (wRef) wRef.rotation.z = wheelRotRef.current;
    });

    // ── Update carPositionRef for camera / floaters ────────────────────────
    if (carPositionRef) carPositionRef.current = [px, py, pz];

    // ── Ghost trail ────────────────────────────────────────────────────────
    const buf  = trailBuf.current;
    const tail = trailTail.current;
    buf[tail * 3]     = px;
    buf[tail * 3 + 1] = py + 0.04;
    buf[tail * 3 + 2] = pz;
    trailTail.current   = (tail + 1) % TRAIL_MAX;
    trailFilled.current = Math.min(trailFilled.current + 1, TRAIL_MAX);

    const len  = trailFilled.current;
    const attr = trailGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < len; i++) {
      const src = ((trailTail.current - len + i + TRAIL_MAX) % TRAIL_MAX) * 3;
      (attr.array as Float32Array)[i * 3]     = buf[src];
      (attr.array as Float32Array)[i * 3 + 1] = buf[src + 1];
      (attr.array as Float32Array)[i * 3 + 2] = buf[src + 2];
    }
    attr.needsUpdate = true;
    trailGeo.setDrawRange(0, len);
  });

  return (
    <group ref={groupRef}>
      <CarGeometry color={color} wheelRefs={wheelRefs} />

      {/* Glow halo */}
      <mesh>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>

      {/* Ghost trail line */}
      <primitive object={trailLine} />
    </group>
  );
}
