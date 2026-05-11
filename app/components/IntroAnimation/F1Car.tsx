'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function F1Car() {
  const flRef = useRef<THREE.Group>(null);
  const frRef = useRef<THREE.Group>(null);
  const rlRef = useRef<THREE.Group>(null);
  const rrRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const spin = 20 * delta;
    if (flRef.current) flRef.current.rotation.z -= spin;
    if (frRef.current) frRef.current.rotation.z -= spin;
    if (rlRef.current) rlRef.current.rotation.z -= spin;
    if (rrRef.current) rrRef.current.rotation.z -= spin;
  });

  return (
    <group>
      {/* ═══ MONOCOQUE / CHASSIS ═══ */}
      <mesh position={[0.45, 0.14, 0]}>
        <boxGeometry args={[1.52, 0.24, 0.5]} />
        <meshStandardMaterial color="#CC1100" metalness={0.32} roughness={0.38} />
      </mesh>
      <mesh position={[-0.65, 0.12, 0]}>
        <boxGeometry args={[0.86, 0.21, 0.57]} />
        <meshStandardMaterial color="#CC1100" metalness={0.32} roughness={0.38} />
      </mesh>

      {/* ═══ COCKPIT ═══ */}
      <mesh position={[0.36, 0.22, 0]}>
        <boxGeometry args={[0.6, 0.12, 0.42]} />
        <meshStandardMaterial color="#080808" metalness={0.65} roughness={0.22} />
      </mesh>
      <mesh position={[0.39, 0.275, 0]}>
        <boxGeometry args={[0.38, 0.045, 0.26]} />
        <meshStandardMaterial color="#040404" />
      </mesh>

      {/* HALO arch */}
      <mesh position={[0.3, 0.295, 0]}>
        <boxGeometry args={[0.64, 0.046, 0.028]} />
        <meshStandardMaterial color="#C9A000" metalness={0.88} roughness={0.1} />
      </mesh>
      <mesh position={[0.13, 0.24, 0.19]}>
        <boxGeometry args={[0.028, 0.12, 0.038]} />
        <meshStandardMaterial color="#C9A000" metalness={0.88} roughness={0.1} />
      </mesh>
      <mesh position={[0.13, 0.24, -0.19]}>
        <boxGeometry args={[0.028, 0.12, 0.038]} />
        <meshStandardMaterial color="#C9A000" metalness={0.88} roughness={0.1} />
      </mesh>
      <mesh position={[0.57, 0.245, 0]}>
        <boxGeometry args={[0.028, 0.09, 0.028]} />
        <meshStandardMaterial color="#C9A000" metalness={0.88} roughness={0.1} />
      </mesh>

      {/* Driver helmet */}
      <mesh position={[0.25, 0.335, 0]}>
        <sphereGeometry args={[0.092, 14, 12]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.08} roughness={0.32} />
      </mesh>
      {/* Visor strip */}
      <mesh position={[0.32, 0.338, 0]} rotation={[0, 0.28, 0]}>
        <boxGeometry args={[0.038, 0.05, 0.11]} />
        <meshStandardMaterial color="#D4AF37" metalness={0.96} roughness={0.04} transparent opacity={0.88} />
      </mesh>

      {/* ═══ NOSE CONE ═══ */}
      <mesh position={[1.58, 0.1, 0]}>
        <boxGeometry args={[0.73, 0.17, 0.31]} />
        <meshStandardMaterial color="#990000" metalness={0.25} roughness={0.44} />
      </mesh>
      <mesh position={[2.07, 0.07, 0]}>
        <boxGeometry args={[0.26, 0.1, 0.13]} />
        <meshStandardMaterial color="#111111" metalness={0.4} roughness={0.38} />
      </mesh>
      {/* Camera pod */}
      <mesh position={[1.93, 0.185, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.13, 8]} />
        <meshStandardMaterial color="#080808" metalness={0.72} roughness={0.18} />
      </mesh>

      {/* ═══ FRONT WING (4-element) ═══ */}
      {/* Nose mount pillar */}
      <mesh position={[1.85, 0.05, 0]}>
        <boxGeometry args={[0.05, 0.1, 0.05]} />
        <meshStandardMaterial color="#990000" metalness={0.3} roughness={0.42} />
      </mesh>
      {/* Element 1 – main plane */}
      <mesh position={[2.13, 0.01, 0]}>
        <boxGeometry args={[0.3, 0.022, 1.34]} />
        <meshStandardMaterial color="#EEEEEE" metalness={0.12} roughness={0.3} />
      </mesh>
      {/* Element 2 */}
      <mesh position={[2.05, 0.072, 0]}>
        <boxGeometry args={[0.25, 0.02, 1.14]} />
        <meshStandardMaterial color="#EEEEEE" metalness={0.12} roughness={0.3} />
      </mesh>
      {/* Element 3 */}
      <mesh position={[1.97, 0.125, 0]}>
        <boxGeometry args={[0.22, 0.018, 0.97]} />
        <meshStandardMaterial color="#DDDDDD" metalness={0.1} roughness={0.32} />
      </mesh>
      {/* Element 4 – inner short */}
      <mesh position={[1.89, 0.168, 0]}>
        <boxGeometry args={[0.18, 0.016, 0.72]} />
        <meshStandardMaterial color="#CCCCCC" metalness={0.1} roughness={0.34} />
      </mesh>
      {/* Cascade – left */}
      <mesh position={[2.01, 0.1, 0.43]} rotation={[0.09, 0, 0.19]}>
        <boxGeometry args={[0.23, 0.018, 0.29]} />
        <meshStandardMaterial color="#EEEEEE" metalness={0.1} roughness={0.32} />
      </mesh>
      {/* Cascade – right */}
      <mesh position={[2.01, 0.1, -0.43]} rotation={[-0.09, 0, -0.19]}>
        <boxGeometry args={[0.23, 0.018, 0.29]} />
        <meshStandardMaterial color="#EEEEEE" metalness={0.1} roughness={0.32} />
      </mesh>
      {/* Endplate – left */}
      <mesh position={[2.01, 0.075, 0.67]}>
        <boxGeometry args={[0.38, 0.19, 0.025]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.1} roughness={0.36} />
      </mesh>
      {/* Endplate – right */}
      <mesh position={[2.01, 0.075, -0.67]}>
        <boxGeometry args={[0.38, 0.19, 0.025]} />
        <meshStandardMaterial color="#FFFFFF" metalness={0.1} roughness={0.36} />
      </mesh>

      {/* ═══ ENGINE COVER + AIRBOX ═══ */}
      <mesh position={[-0.3, 0.27, 0]}>
        <boxGeometry args={[0.96, 0.18, 0.3]} />
        <meshStandardMaterial color="#080808" metalness={0.68} roughness={0.26} />
      </mesh>
      {/* Airbox intake */}
      <mesh position={[0.22, 0.37, 0]}>
        <boxGeometry args={[0.2, 0.1, 0.22]} />
        <meshStandardMaterial color="#030303" metalness={0.82} roughness={0.14} />
      </mesh>
      {/* Shark fin */}
      <mesh position={[-0.68, 0.43, 0]}>
        <boxGeometry args={[0.72, 0.33, 0.016]} />
        <meshStandardMaterial color="#080808" metalness={0.62} roughness={0.23} />
      </mesh>
      {/* T-wing upper */}
      <mesh position={[-0.99, 0.595, 0]}>
        <boxGeometry args={[0.21, 0.022, 0.62]} />
        <meshStandardMaterial color="#111111" metalness={0.38} roughness={0.36} />
      </mesh>
      {/* T-wing lower */}
      <mesh position={[-0.99, 0.535, 0]}>
        <boxGeometry args={[0.17, 0.018, 0.5]} />
        <meshStandardMaterial color="#111111" metalness={0.38} roughness={0.36} />
      </mesh>

      {/* ═══ SIDEPODS ═══ */}
      {/* Left */}
      <mesh position={[0.1, 0.115, 0.365]}>
        <boxGeometry args={[1.44, 0.24, 0.24]} />
        <meshStandardMaterial color="#CC1100" metalness={0.3} roughness={0.38} />
      </mesh>
      <mesh position={[-0.06, 0.042, 0.395]}>
        <boxGeometry args={[0.84, 0.1, 0.16]} />
        <meshStandardMaterial color="#880000" metalness={0.2} roughness={0.54} />
      </mesh>
      <mesh position={[0.73, 0.15, 0.48]}>
        <boxGeometry args={[0.28, 0.18, 0.04]} />
        <meshStandardMaterial color="#080808" metalness={0.88} roughness={0.12} />
      </mesh>
      <mesh position={[-0.09, 0.245, 0.345]}>
        <boxGeometry args={[0.42, 0.02, 0.18]} />
        <meshStandardMaterial color="#060606" metalness={0.62} roughness={0.28} />
      </mesh>
      {/* Right */}
      <mesh position={[0.1, 0.115, -0.365]}>
        <boxGeometry args={[1.44, 0.24, 0.24]} />
        <meshStandardMaterial color="#CC1100" metalness={0.3} roughness={0.38} />
      </mesh>
      <mesh position={[-0.06, 0.042, -0.395]}>
        <boxGeometry args={[0.84, 0.1, 0.16]} />
        <meshStandardMaterial color="#880000" metalness={0.2} roughness={0.54} />
      </mesh>
      <mesh position={[0.73, 0.15, -0.48]}>
        <boxGeometry args={[0.28, 0.18, 0.04]} />
        <meshStandardMaterial color="#080808" metalness={0.88} roughness={0.12} />
      </mesh>
      <mesh position={[-0.09, 0.245, -0.345]}>
        <boxGeometry args={[0.42, 0.02, 0.18]} />
        <meshStandardMaterial color="#060606" metalness={0.62} roughness={0.28} />
      </mesh>

      {/* ═══ FLOOR ═══ */}
      <mesh position={[-0.15, -0.022, 0]}>
        <boxGeometry args={[2.57, 0.025, 0.75]} />
        <meshStandardMaterial color="#080808" metalness={0.58} roughness={0.46} />
      </mesh>
      {/* Floor edge wings */}
      <mesh position={[-0.2, 0.026, 0.395]}>
        <boxGeometry args={[1.88, 0.052, 0.028]} />
        <meshStandardMaterial color="#111111" metalness={0.46} roughness={0.48} />
      </mesh>
      <mesh position={[-0.2, 0.026, -0.395]}>
        <boxGeometry args={[1.88, 0.052, 0.028]} />
        <meshStandardMaterial color="#111111" metalness={0.46} roughness={0.48} />
      </mesh>

      {/* ═══ DIFFUSER ═══ */}
      <mesh position={[-1.48, 0.04, 0]}>
        <boxGeometry args={[0.59, 0.076, 0.63]} />
        <meshStandardMaterial color="#080808" metalness={0.58} roughness={0.44} />
      </mesh>
      {[-0.2, 0, 0.2].map((z, i) => (
        <mesh key={i} position={[-1.48, 0.04, z]}>
          <boxGeometry args={[0.59, 0.065, 0.012]} />
          <meshStandardMaterial color="#111111" metalness={0.52} roughness={0.4} />
        </mesh>
      ))}

      {/* ═══ REAR WING ═══ */}
      <mesh position={[-1.55, 0.5, 0]}>
        <boxGeometry args={[0.14, 0.046, 0.92]} />
        <meshStandardMaterial color="#EEEEEE" metalness={0.22} roughness={0.27} />
      </mesh>
      <mesh position={[-1.58, 0.415, 0]}>
        <boxGeometry args={[0.11, 0.032, 0.9]} />
        <meshStandardMaterial color="#EEEEEE" metalness={0.22} roughness={0.27} />
      </mesh>
      {/* Endplates */}
      <mesh position={[-1.56, 0.45, 0.47]}>
        <boxGeometry args={[0.25, 0.29, 0.028]} />
        <meshStandardMaterial color="#CC1100" metalness={0.32} roughness={0.36} />
      </mesh>
      <mesh position={[-1.56, 0.45, -0.47]}>
        <boxGeometry args={[0.25, 0.29, 0.028]} />
        <meshStandardMaterial color="#CC1100" metalness={0.32} roughness={0.36} />
      </mesh>
      {/* Endplate slot markings */}
      {[0.47, -0.47].map((z, i) => (
        <group key={i}>
          <mesh position={[-1.56, 0.475, z]}>
            <boxGeometry args={[0.13, 0.014, 0.008]} />
            <meshStandardMaterial color="#080808" />
          </mesh>
          <mesh position={[-1.56, 0.395, z]}>
            <boxGeometry args={[0.13, 0.014, 0.008]} />
            <meshStandardMaterial color="#080808" />
          </mesh>
        </group>
      ))}
      {/* Mount pillars */}
      <mesh position={[-1.51, 0.29, 0.25]}>
        <boxGeometry args={[0.056, 0.25, 0.056]} />
        <meshStandardMaterial color="#080808" metalness={0.58} roughness={0.33} />
      </mesh>
      <mesh position={[-1.51, 0.29, -0.25]}>
        <boxGeometry args={[0.056, 0.25, 0.056]} />
        <meshStandardMaterial color="#080808" metalness={0.58} roughness={0.33} />
      </mesh>
      {/* Beam wing */}
      <mesh position={[-1.53, 0.175, 0]}>
        <boxGeometry args={[0.21, 0.029, 0.63]} />
        <meshStandardMaterial color="#080808" metalness={0.36} roughness={0.47} />
      </mesh>

      {/* ═══ EXHAUST ═══ */}
      <mesh position={[-1.27, 0.235, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.038, 0.044, 0.13, 10]} />
        <meshStandardMaterial color="#888888" metalness={0.94} roughness={0.07} />
      </mesh>
      <mesh position={[-1.37, 0.235, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.065, 10]} />
        <meshStandardMaterial color="#FF6000" emissive="#FF4000" emissiveIntensity={5} />
      </mesh>

      {/* ═══ SUSPENSION WISHBONES ═══ */}
      {/* Front upper L */}
      <mesh position={[0.93, 0.2, 0.31]} rotation={[0, 0.21, -0.07]}>
        <boxGeometry args={[0.71, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>
      {/* Front lower L */}
      <mesh position={[0.93, 0.062, 0.29]} rotation={[0, 0.17, 0.05]}>
        <boxGeometry args={[0.73, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>
      {/* Front upper R */}
      <mesh position={[0.93, 0.2, -0.31]} rotation={[0, -0.21, -0.07]}>
        <boxGeometry args={[0.71, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>
      {/* Front lower R */}
      <mesh position={[0.93, 0.062, -0.29]} rotation={[0, -0.17, 0.05]}>
        <boxGeometry args={[0.73, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>
      {/* Rear upper L */}
      <mesh position={[-0.93, 0.2, 0.35]} rotation={[0, -0.23, -0.07]}>
        <boxGeometry args={[0.69, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>
      {/* Rear lower L */}
      <mesh position={[-0.93, 0.055, 0.33]} rotation={[0, -0.19, 0.06]}>
        <boxGeometry args={[0.71, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>
      {/* Rear upper R */}
      <mesh position={[-0.93, 0.2, -0.35]} rotation={[0, 0.23, -0.07]}>
        <boxGeometry args={[0.69, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>
      {/* Rear lower R */}
      <mesh position={[-0.93, 0.055, -0.33]} rotation={[0, 0.19, 0.06]}>
        <boxGeometry args={[0.71, 0.022, 0.022]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.78} roughness={0.23} />
      </mesh>

      {/* ═══ TURNING VANES ═══ */}
      {[0.31, -0.31].map((z, i) => (
        <group key={i}>
          <mesh position={[0.63, 0.125, z]}>
            <boxGeometry args={[0.29, 0.026, 0.022]} />
            <meshStandardMaterial color="#CC1100" metalness={0.3} roughness={0.4} />
          </mesh>
          <mesh position={[0.59, 0.075, Math.sign(z) * (Math.abs(z) + 0.01)]}>
            <boxGeometry args={[0.25, 0.019, 0.022]} />
            <meshStandardMaterial color="#CC1100" metalness={0.3} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* ═══ WHEELS ═══ */}

      {/* Front Left */}
      <group ref={flRef} position={[1.23, 0.015, 0.57]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.215, 0.215, 0.235, 24]} />
          <meshStandardMaterial color="#111111" roughness={0.93} metalness={0.04} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.147, 0.147, 0.245, 20]} />
          <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.11} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
          <meshStandardMaterial color="#FF5500" emissive="#DD3000" emissiveIntensity={2.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.027, 0.027, 0.25, 6]} />
          <meshStandardMaterial color="#C9A000" metalness={0.94} roughness={0.06} />
        </mesh>
      </group>

      {/* Front Right */}
      <group ref={frRef} position={[1.23, 0.015, -0.57]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.215, 0.215, 0.235, 24]} />
          <meshStandardMaterial color="#111111" roughness={0.93} metalness={0.04} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.147, 0.147, 0.245, 20]} />
          <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.11} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
          <meshStandardMaterial color="#FF5500" emissive="#DD3000" emissiveIntensity={2.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.027, 0.027, 0.25, 6]} />
          <meshStandardMaterial color="#C9A000" metalness={0.94} roughness={0.06} />
        </mesh>
      </group>

      {/* Rear Left (wider) */}
      <group ref={rlRef} position={[-1.08, 0.015, 0.645]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.245, 0.245, 0.325, 24]} />
          <meshStandardMaterial color="#111111" roughness={0.93} metalness={0.04} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.167, 0.167, 0.335, 20]} />
          <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.11} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.275, 16]} />
          <meshStandardMaterial color="#FF5500" emissive="#DD3000" emissiveIntensity={2.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.034, 0.034, 0.345, 6]} />
          <meshStandardMaterial color="#C9A000" metalness={0.94} roughness={0.06} />
        </mesh>
      </group>

      {/* Rear Right */}
      <group ref={rrRef} position={[-1.08, 0.015, -0.645]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.245, 0.245, 0.325, 24]} />
          <meshStandardMaterial color="#111111" roughness={0.93} metalness={0.04} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.167, 0.167, 0.335, 20]} />
          <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.11} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.275, 16]} />
          <meshStandardMaterial color="#FF5500" emissive="#DD3000" emissiveIntensity={2.2} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.034, 0.034, 0.345, 6]} />
          <meshStandardMaterial color="#C9A000" metalness={0.94} roughness={0.06} />
        </mesh>
      </group>
    </group>
  );
}
