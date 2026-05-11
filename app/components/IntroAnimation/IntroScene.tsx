'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { F1Car } from './F1Car';

interface IntroSceneProps {
  onCarExited: () => void;
}

const START_X = -15;
const END_X = 15;
const DURATION = 3.2;
const MAX_TRAIL_PTS = 180;

export function IntroScene({ onCarExited }: IntroSceneProps) {
  const carRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const trailMatRef = useRef<THREE.LineBasicMaterial>(null);
  const trailGeoRef = useRef<THREE.BufferGeometry>(null);

  const progressRef = useRef(0);
  const exitedRef = useRef(false);
  const trailHistory = useRef<number[]>([]);

  const trailPositions = useMemo(() => new Float32Array(MAX_TRAIL_PTS * 3), []);

  useFrame((_, delta) => {
    if (exitedRef.current) {
      // Fade out trail after car exits
      if (trailMatRef.current && trailMatRef.current.opacity > 0) {
        trailMatRef.current.opacity = Math.max(0, trailMatRef.current.opacity - delta * 1.5);
      }
      return;
    }

    progressRef.current = Math.min(progressRef.current + delta / DURATION, 1);
    const t = progressRef.current;

    // Ease in the first 15% to simulate launch acceleration
    const eased = t < 0.15 ? (t / 0.15) * 0.15 * 0.5 + t * 0.5 : t;
    const carX = THREE.MathUtils.lerp(START_X, END_X, Math.min(eased, 1));

    if (carRef.current) carRef.current.position.x = carX;
    if (lightRef.current) lightRef.current.position.x = carX;

    // Append to trail history
    const h = trailHistory.current;
    h.push(carX, 0.1, 0);
    if (h.length > MAX_TRAIL_PTS * 3) h.splice(0, 3);

    const count = Math.min(h.length / 3, MAX_TRAIL_PTS);
    for (let i = 0; i < h.length; i++) trailPositions[i] = h[i];

    if (trailGeoRef.current) {
      const attr = trailGeoRef.current.attributes['position'] as THREE.BufferAttribute;
      if (attr) {
        attr.needsUpdate = true;
        trailGeoRef.current.setDrawRange(0, count);
      }
    }

    if (t >= 1 && !exitedRef.current) {
      exitedRef.current = true;
      onCarExited();
    }
  });

  // Faint grid lines on the ground (procedurally generated Z positions)
  const gridLines = useMemo(() => [-0.8, -0.4, 0, 0.4, 0.8], []);

  return (
    <>
      <color attach="background" args={['#0A0E27']} />
      <fog attach="fog" args={['#0A0E27', 8, 24]} />

      {/* Camera baked into Canvas camera prop — no drei import needed */}

      {/* Ambient */}
      <ambientLight intensity={0.1} />

      {/* Key light from above */}
      <directionalLight position={[4, 10, 6]} intensity={0.5} color="#ffffff" />

      {/* Rim / fill from behind */}
      <directionalLight position={[-8, 4, -2]} intensity={0.18} color="#00D9FF" />

      {/* Red exhaust-glow following the car */}
      <pointLight
        ref={lightRef}
        color="#EF1E24"
        intensity={8}
        distance={8}
        decay={2}
        position={[START_X, 0.5, 0]}
      />

      {/* Static cyan "pit-wall" wash */}
      <pointLight color="#00D9FF" intensity={0.5} distance={26} position={[0, 5, -4]} />

      {/* Ground — same colour as bg so no horizon split */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.24, 0]}>
        <planeGeometry args={[60, 16]} />
        <meshStandardMaterial color="#0A0E27" roughness={1} />
      </mesh>

      {/* Faint scan-grid lines on the ground */}
      {gridLines.map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.235, z]}>
          <planeGeometry args={[60, 0.012]} />
          <meshBasicMaterial color="#00D9FF" transparent opacity={0.07} />
        </mesh>
      ))}

      {/* Centre axis glow line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.23, 0]}>
        <planeGeometry args={[60, 0.025]} />
        <meshBasicMaterial color="#EF1E24" transparent opacity={0.1} />
      </mesh>

      {/* F1 Car */}
      <group ref={carRef} position={[START_X, 0, 0]}>
        <F1Car />
      </group>

      {/* Motion trail — declarative buffer geometry, no manual disposal */}
      <line>
        <bufferGeometry ref={trailGeoRef}>
          {/* args=[array, itemSize] → avoids touching read-only .count */}
          <bufferAttribute
            attach="attributes-position"
            args={[trailPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial ref={trailMatRef} color="#EF1E24" transparent opacity={0.82} />
      </line>
    </>
  );
}
