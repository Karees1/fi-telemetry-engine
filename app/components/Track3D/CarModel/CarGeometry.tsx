'use client';

import { MutableRefObject } from 'react';
import * as THREE from 'three';

interface CarGeometryProps {
  color: string;
  /** Four refs, one per wheel (FL, FR, RL, RR). CarModel animates their rotation. */
  wheelRefs?: MutableRefObject<(THREE.Group | null)[]>;
}

const WHEEL_POSITIONS: [number, number, number][] = [
  [ 0.72, -0.04,  0.34],   // FL
  [ 0.72, -0.04, -0.34],   // FR
  [-0.62, -0.04,  0.34],   // RL
  [-0.62, -0.04, -0.34],   // RR
];

export function CarGeometry({ color, wheelRefs }: CarGeometryProps) {
  return (
    <group scale={[0.28, 0.28, 0.28]}>
      {/* Chassis */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[1.8, 0.15, 0.5]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Engine cover / cockpit hump */}
      <mesh position={[0.1, 0.21, 0]}>
        <boxGeometry args={[0.62, 0.15, 0.36]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Nose cone */}
      <mesh position={[1.15, 0.04, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.06, 0.5, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.4} />
      </mesh>

      {/* Halo */}
      <mesh position={[0.15, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.028, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.95} roughness={0.05} />
      </mesh>

      {/* Front wing */}
      <mesh position={[1.05, -0.03, 0]}>
        <boxGeometry args={[0.28, 0.025, 0.9]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.4} metalness={0.5} />
      </mesh>
      {([-0.47, 0.47] as number[]).map((z, i) => (
        <mesh key={i} position={[1.05, 0.02, z]}>
          <boxGeometry args={[0.28, 0.12, 0.02]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} roughness={0.4} />
        </mesh>
      ))}

      {/* Rear wing */}
      <mesh position={[-0.85, 0.34, 0]}>
        <boxGeometry args={[0.12, 0.07, 0.76]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.3} metalness={0.5} />
      </mesh>
      {([-0.4, 0.4] as number[]).map((z, i) => (
        <mesh key={i} position={[-0.85, 0.28, z]}>
          <boxGeometry args={[0.12, 0.2, 0.02]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} roughness={0.3} />
        </mesh>
      ))}

      {/* Sidepods */}
      {([-0.26, 0.26] as number[]).map((z, i) => (
        <mesh key={i} position={[-0.05, 0.06, z]}>
          <boxGeometry args={[1.1, 0.12, 0.12]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}

      {/* Floor */}
      <mesh position={[-0.1, -0.05, 0]}>
        <boxGeometry args={[1.5, 0.02, 0.6]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Wheels — FL, FR, RL, RR */}
      {WHEEL_POSITIONS.map(([x, y, z], i) => (
        <group
          key={i}
          position={[x, y, z]}
          ref={el => { if (wheelRefs) wheelRefs.current[i] = el; }}
        >
          {/* Tyre */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 0.14, 20]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.9} metalness={0.05} />
          </mesh>
          {/* Rim */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.095, 0.095, 0.145, 14]} />
            <meshStandardMaterial color="#888888" metalness={0.95} roughness={0.05} emissive={color} emissiveIntensity={0.08} />
          </mesh>
          {/* Brake disc glow (subtle) */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.075, 0.075, 0.12, 10]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.12} roughness={0.5} transparent opacity={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
