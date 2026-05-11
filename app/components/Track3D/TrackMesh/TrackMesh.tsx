'use client';

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface TrackMeshProps {
  points: [number, number, number][];
}

export function TrackMesh({ points }: TrackMeshProps) {
  // Build a smooth CatmullRom spline and two concentric tubes:
  //  • road  — wide, dark tarmac surface
  //  • glow  — thin, bright neon centerline (bloom picks this up)
  const { roadGeo, glowGeo, edgeGeoL, edgeGeoR } = useMemo(() => {
    if (points.length < 4) return { roadGeo: null, glowGeo: null, edgeGeoL: null, edgeGeoR: null };

    const vecs   = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve  = new THREE.CatmullRomCurve3(vecs, true, 'catmullrom', 0.1);
    const segs   = Math.min(points.length * 2, 900);

    const roadGeo  = new THREE.TubeGeometry(curve, segs, 0.13, 7, true);
    const glowGeo  = new THREE.TubeGeometry(curve, segs, 0.022, 6, true);
    // Kerb edge lines — offset tubes slightly left/right
    const edgeGeoL = new THREE.TubeGeometry(curve, Math.floor(segs / 2), 0.008, 4, true);
    const edgeGeoR = new THREE.TubeGeometry(curve, Math.floor(segs / 2), 0.008, 4, true);

    return { roadGeo, glowGeo, edgeGeoL, edgeGeoR };
  }, [points]);

  // Dispose on unmount / points change
  useEffect(() => {
    return () => {
      roadGeo?.dispose();
      glowGeo?.dispose();
      edgeGeoL?.dispose();
      edgeGeoR?.dispose();
    };
  }, [roadGeo, glowGeo, edgeGeoL, edgeGeoR]);

  if (!roadGeo || !glowGeo) return null;

  return (
    <group name="track-mesh">
      {/* Tarmac road surface */}
      <mesh geometry={roadGeo}>
        <meshStandardMaterial
          color="#0c1228"
          roughness={0.95}
          metalness={0.05}
          transparent
          opacity={0.97}
        />
      </mesh>

      {/* Neon centerline — bloom makes this glow */}
      <mesh geometry={glowGeo}>
        <meshStandardMaterial
          color="#00D9FF"
          emissive="#00D9FF"
          emissiveIntensity={1.2}
          roughness={0.1}
          metalness={0.0}
        />
      </mesh>

      {/* Left kerb edge */}
      {edgeGeoL && (
        <mesh geometry={edgeGeoL} position={[0, 0.001, 0]}>
          <meshStandardMaterial
            color="#EF1E24"
            emissive="#EF1E24"
            emissiveIntensity={0.5}
            roughness={0.2}
          />
        </mesh>
      )}

      {/* Right kerb edge */}
      {edgeGeoR && (
        <mesh geometry={edgeGeoR} position={[0, -0.001, 0]}>
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.3}
            roughness={0.3}
          />
        </mesh>
      )}
    </group>
  );
}
