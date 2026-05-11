'use client';

import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { NormalizedPoint, buildHeatmapGeometry } from '@/lib/three-helpers';

interface SpeedHeatmapProps {
  points: (NormalizedPoint & { speed: number })[];
}

export function SpeedHeatmap({ points }: SpeedHeatmapProps) {
  const geoRef = useRef<THREE.BufferGeometry | null>(null);

  const { geometry, minSpeed, maxSpeed } = useMemo(() => {
    if (points.length < 2) return { geometry: null, minSpeed: 0, maxSpeed: 1 };
    const speeds = points.map(p => p.speed);
    const min = Math.min(...speeds);
    const max = Math.max(...speeds);
    return { geometry: buildHeatmapGeometry(points, min, max), minSpeed: min, maxSpeed: max };
  }, [points]);

  // Dispose old geometry on unmount / re-compute
  useEffect(() => {
    geoRef.current = geometry;
    return () => { geometry?.dispose(); };
  }, [geometry]);

  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors />
    </lineSegments>
  );
}
