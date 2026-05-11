'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Race } from '@/types';
import { RaceNode } from './RaceNode';

const RING_RADIUS      = 4.6;
const RING_TILT_X      = Math.PI / 9;   // 20° tilt — gives planetary orbit feel
const AUTO_ROTATE_SPEED = 0.07;         // rad/s — slow, atmospheric
const PATH_SEGMENTS    = 128;

function buildRingPath(): THREE.Vector3[] {
  return Array.from({ length: PATH_SEGMENTS + 1 }, (_, i) => {
    const a = (i / PATH_SEGMENTS) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * RING_RADIUS, Math.sin(a) * RING_RADIUS, 0);
  });
}

// Outer glow ring — slightly larger, much more transparent
function buildGlowPath(): THREE.Vector3[] {
  return Array.from({ length: PATH_SEGMENTS + 1 }, (_, i) => {
    const a = (i / PATH_SEGMENTS) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * RING_RADIUS * 1.018, Math.sin(a) * RING_RADIUS * 1.018, 0);
  });
}

function getNodePosition(index: number, total: number): [number, number, number] {
  // Start at 12-o'clock (top) and go clockwise
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(angle) * RING_RADIUS, Math.sin(angle) * RING_RADIUS, 0];
}

interface OrbitalRingProps {
  races: Race[];
  selectedRace: Race | null;
  filterTerm: string;
  onSelect: (race: Race) => void;
}

const ringPath = buildRingPath();
const glowPath = buildGlowPath();

export function OrbitalRing({ races, selectedRace, filterTerm, onSelect }: OrbitalRingProps) {
  const spinRef  = useRef<THREE.Group>(null);
  const pauseRef = useRef(false); // mutated by node hover — avoids re-renders

  useFrame((_, delta) => {
    if (spinRef.current && !pauseRef.current) {
      spinRef.current.rotation.z -= delta * AUTO_ROTATE_SPEED;
    }
  });

  return (
    <>
      <OrbitControls
        makeDefault
        enableZoom={false}
        enablePan={false}
        minPolarAngle={Math.PI * 0.22}
        maxPolarAngle={Math.PI * 0.78}
        rotateSpeed={0.45}
      />

      {/* Subtle fill light from the "centre star" */}
      <pointLight position={[0, 0, 0]} intensity={0.6} color="#00D9FF" distance={12} decay={2} />
      <ambientLight intensity={0.15} />

      {/* Tilted orbital plane group — establishes the ring's plane */}
      <group rotation={[RING_TILT_X, 0, 0]}>

        {/* Fixed ring path (doesn't spin — shows the orbital track) */}
        <Line points={ringPath} color="#00D9FF" lineWidth={0.9} transparent opacity={0.2} />
        <Line points={glowPath} color="#00D9FF" lineWidth={3.5} transparent opacity={0.045} />

        {/* Season label at ring centre */}
        <Html center position={[0, 0, 0]} distanceFactor={14} style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: "'Roboto Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.42em',
            color: 'rgba(176, 181, 193, 0.22)',
            userSelect: 'none',
          }}>
            2024
          </div>
        </Html>

        {/* Spinning group — race nodes orbit inside the ring plane */}
        <group ref={spinRef}>
          {races.map((race, i) => {
            const term = filterTerm.trim().toLowerCase();
            const isDimmed =
              term.length > 0 &&
              !race.name.toLowerCase().includes(term) &&
              !race.circuit.location.toLowerCase().includes(term) &&
              !race.circuit.name.toLowerCase().includes(term);

            return (
              <RaceNode
                key={race.id}
                race={race}
                position={getNodePosition(i, races.length)}
                isSelected={selectedRace?.id === race.id}
                isDimmed={isDimmed}
                onSelect={onSelect}
                onHoverStart={() => { pauseRef.current = true; }}
                onHoverEnd={() => { pauseRef.current = false; }}
              />
            );
          })}
        </group>

      </group>
    </>
  );
}
