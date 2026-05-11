'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Race } from '@/types';

interface RaceNodeProps {
  race: Race;
  position: [number, number, number];
  isSelected: boolean;
  isDimmed: boolean;
  onSelect: (race: Race) => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
}

const CYAN = '#00D9FF';
const RED  = '#EF1E24';

export function RaceNode({
  race,
  position,
  isSelected,
  isDimmed,
  onSelect,
  onHoverStart,
  onHoverEnd,
}: RaceNodeProps) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const glowRef  = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const targetColor   = isSelected ? RED : CYAN;
  const targetOpacity = isDimmed ? 0.1 : 1;
  const targetScale   = isSelected ? 1.8 : hovered ? 1.45 : 1;

  useFrame((state) => {
    if (!meshRef.current) return;

    // Smooth scale lerp every frame
    meshRef.current.scale.setScalar(
      THREE.MathUtils.lerp(meshRef.current.scale.x, targetScale, 0.14)
    );

    // Pulse the outer glow on selected nodes
    if (glowRef.current) {
      const pulse = isSelected
        ? 0.9 + Math.sin(state.clock.elapsedTime * 2.8) * 0.1
        : hovered
        ? 0.95 + Math.sin(state.clock.elapsedTime * 4) * 0.05
        : 1;
      glowRef.current.scale.setScalar(
        THREE.MathUtils.lerp(glowRef.current.scale.x, (isSelected || hovered) ? pulse * 2.6 : 0.01, 0.12)
      );
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(
        mat.opacity,
        isSelected ? 0.13 : hovered ? 0.09 : 0,
        0.12
      );
    }
  });

  const showLabel = hovered || isSelected;

  return (
    <group position={position}>
      {/* Outer glow halo — always present, driven by useFrame */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshBasicMaterial color={targetColor} transparent opacity={0} />
      </mesh>

      {/* Core node sphere */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHoverStart();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          onHoverEnd();
          document.body.style.cursor = 'default';
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(race);
        }}
      >
        <sphereGeometry args={[0.075, 16, 16]} />
        <meshBasicMaterial color={targetColor} transparent opacity={targetOpacity} />
      </mesh>

      {/* Tooltip — visible on hover or selection, hidden when behind the globe */}
      {showLabel && (
        <Html center occlude distanceFactor={9} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div
            style={{
              background: 'rgba(5, 8, 18, 0.92)',
              border: `1px solid ${isSelected ? 'rgba(239,30,36,0.55)' : 'rgba(0,217,255,0.4)'}`,
              borderRadius: '3px',
              padding: '5px 10px',
              transform: 'translateY(-34px)',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div style={{
              fontFamily: "'Roboto Mono', monospace",
              fontSize: '9px',
              color: '#EF1E24',
              letterSpacing: '0.18em',
              marginBottom: '3px',
            }}>
              R{String(race.round).padStart(2, '0')} · {race.date.slice(0, 7)}
            </div>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '11px',
              fontWeight: 600,
              color: '#FFFFFF',
              letterSpacing: '0.03em',
            }}>
              {race.name.replace(' Grand Prix', '')}
            </div>
            <div style={{
              fontFamily: "'Roboto Mono', monospace",
              fontSize: '8px',
              color: '#6B7280',
              marginTop: '2px',
              letterSpacing: '0.08em',
            }}>
              {race.circuit.location}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
