'use client';

import { useRef, useMemo, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

import { DriverPositionSeries } from '@/hooks/useRacePositions';
import { Normalizer } from '@/lib/three-helpers';
import { useDashboardStore } from '@/store/dashboardStore';
import styles from './RaceCarDot.module.css';

// ── Binary search: largest index i where arr[i] <= val ───────────────────────

function searchLe(arr: Float32Array, val: number): number {
  if (val <= arr[0])          return 0;
  if (val >= arr[arr.length - 1]) return arr.length - 2;
  let lo = 0, hi = arr.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= val) lo = mid; else hi = mid;
  }
  return lo;
}

// ── Trail ─────────────────────────────────────────────────────────────────────

const TRAIL_MAX = 80;

// ── Component ─────────────────────────────────────────────────────────────────

interface RaceCarDotProps {
  code: string;
  color: string;
  team: string;
  posData: DriverPositionSeries;
  normalizer: Normalizer;
  isPrimary?: boolean;
  carPositionRef?: MutableRefObject<[number, number, number]>;
}

export function RaceCarDot({
  code,
  color,
  posData,
  normalizer,
  isPrimary,
  carPositionRef,
}: RaceCarDotProps) {
  const dotRef  = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  // Trail
  const trailGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(TRAIL_MAX * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    return geo;
  }, []);

  const trailMat = useMemo(() =>
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false }),
    [color]
  );

  const trailLine  = useMemo(() => new THREE.Line(trailGeo, trailMat), [trailGeo, trailMat]);
  const trailBuf   = useRef(new Float32Array(TRAIL_MAX * 3));
  const trailTail  = useRef(0);
  const trailFill  = useRef(0);
  const lastTime   = useRef(-1);

  useEffect(() => () => { trailGeo.dispose(); trailMat.dispose(); }, [trailGeo, trailMat]);

  useFrame(() => {
    if (!groupRef.current) return;

    const t   = useDashboardStore.getState().raceTimeSeconds;
    const { t: tArr, x: xArr, y: yArr, status } = posData;

    if (tArr.length < 2) return;

    const lo    = searchLe(tArr, t);
    const hi    = Math.min(lo + 1, tArr.length - 1);
    const alpha = tArr[hi] > tArr[lo]
      ? Math.max(0, Math.min(1, (t - tArr[lo]) / (tArr[hi] - tArr[lo])))
      : 0;

    const rawX = THREE.MathUtils.lerp(xArr[lo], xArr[hi], alpha);
    const rawY = THREE.MathUtils.lerp(yArr[lo], yArr[hi], alpha);
    const n    = normalizer(rawX, rawY, 0);

    const px = n.x;
    const py = n.y + 0.06;
    const pz = n.z;

    groupRef.current.position.set(px, py, pz);
    if (carPositionRef) carPositionRef.current = [px, py, pz];

    // Pulsing halo for primary car
    if (haloRef.current && isPrimary) {
      const scale = 1 + 0.12 * Math.sin(Date.now() * 0.006);
      haloRef.current.scale.setScalar(scale);
    }

    // Pitlane — mute opacity
    const inPit = status[lo] === 'Pitlane';
    if (dotRef.current) {
      (dotRef.current.material as THREE.MeshStandardMaterial).opacity = inPit ? 0.35 : 1;
    }

    // Trail — only add point when time advances
    if (t !== lastTime.current) {
      lastTime.current = t;
      const buf  = trailBuf.current;
      const tail = trailTail.current;
      buf[tail * 3]     = px;
      buf[tail * 3 + 1] = py;
      buf[tail * 3 + 2] = pz;
      trailTail.current   = (tail + 1) % TRAIL_MAX;
      trailFill.current   = Math.min(trailFill.current + 1, TRAIL_MAX);

      const len  = trailFill.current;
      const attr = trailGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < len; i++) {
        const src = ((trailTail.current - len + i + TRAIL_MAX) % TRAIL_MAX) * 3;
        (attr.array as Float32Array)[i * 3]     = buf[src];
        (attr.array as Float32Array)[i * 3 + 1] = buf[src + 1];
        (attr.array as Float32Array)[i * 3 + 2] = buf[src + 2];
      }
      attr.needsUpdate = true;
      trailGeo.setDrawRange(0, len);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Tarmac disc — team color */}
      <mesh ref={dotRef}>
        <cylinderGeometry args={[0.048, 0.048, 0.012, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          transparent
          opacity={1}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>

      {/* Outer glow ring */}
      <mesh ref={haloRef}>
        <torusGeometry args={[0.055, 0.008, 8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={isPrimary ? 0.9 : 0.4} />
      </mesh>

      {/* Bloom sphere */}
      <mesh>
        <sphereGeometry args={[0.038, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>

      {/* Driver label */}
      <Html
        position={[0, 0.16, 0]}
        center
        distanceFactor={6}
        zIndexRange={[0, 10]}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className={styles.label}
          style={{ borderColor: color, color }}
        >
          <span className={styles.labelDot} style={{ background: color }} />
          {code}
        </div>
      </Html>

      {/* Ghost trail */}
      <primitive object={trailLine} />
    </group>
  );
}
