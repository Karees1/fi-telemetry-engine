'use client';

import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

interface TrackRibbonProps {
  points: [number, number, number][];
  halfWidth?: number;
}

/**
 * Flat ribbon track mesh — looks like an actual road surface.
 * Built by computing per-point right-normals along the CatmullRom spline
 * and extruding left/right edges. This means car dots at real GPS positions
 * naturally appear on different lines (inside/outside) relative to the ribbon.
 */
function buildRibbon(
  pts: THREE.Vector3[],
  halfWidth: number,
): { surfaceGeo: THREE.BufferGeometry; edgeGeoL: THREE.BufferGeometry; edgeGeoR: THREE.BufferGeometry; lineGeo: THREE.BufferGeometry } {
  const N = pts.length;

  // Surface: N×2 vertices, (N-1) quads + closing quad
  const surfacePos = new Float32Array(N * 2 * 3);
  const surfaceNrm = new Float32Array(N * 2 * 3);
  const surfaceUV  = new Float32Array(N * 2 * 2);
  const surfaceIdx: number[] = [];

  // Edge strips (thin kerb lines along each side)
  const edgePosL = new Float32Array(N * 3);
  const edgePosR = new Float32Array(N * 3);

  // Centerline
  const linePos = new Float32Array(N * 3);

  for (let i = 0; i < N; i++) {
    const p    = pts[i];
    const prev = pts[(i - 1 + N) % N];
    const next = pts[(i + 1)     % N];

    // Tangent in XZ plane
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const tlen = Math.hypot(tx, tz) || 1;

    // Right-hand normal (perpendicular in XZ)
    const nx =  tz / tlen;
    const nz = -tx / tlen;

    const lx = p.x - nx * halfWidth,  lz = p.z - nz * halfWidth;
    const rx = p.x + nx * halfWidth,  rz = p.z + nz * halfWidth;

    // Surface verts
    const vi = i * 2;
    surfacePos[vi * 3]     = lx;  surfacePos[vi * 3 + 1] = p.y;  surfacePos[vi * 3 + 2] = lz;
    surfacePos[(vi + 1) * 3]     = rx;  surfacePos[(vi + 1) * 3 + 1] = p.y;  surfacePos[(vi + 1) * 3 + 2] = rz;

    // Normals (up)
    surfaceNrm[vi * 3 + 1] = 1;
    surfaceNrm[(vi + 1) * 3 + 1] = 1;

    // UVs
    const u = i / (N - 1);
    surfaceUV[vi * 2] = u;  surfaceUV[vi * 2 + 1] = 0;
    surfaceUV[(vi + 1) * 2] = u;  surfaceUV[(vi + 1) * 2 + 1] = 1;

    // Quads
    if (i < N - 1) {
      const a = vi, b = vi + 1, c = vi + 2, d = vi + 3;
      surfaceIdx.push(a, c, b, b, c, d);
    }

    // Edge strips
    edgePosL[i * 3] = lx;  edgePosL[i * 3 + 1] = p.y + 0.002;  edgePosL[i * 3 + 2] = lz;
    edgePosR[i * 3] = rx;  edgePosR[i * 3 + 1] = p.y + 0.002;  edgePosR[i * 3 + 2] = rz;

    // Centerline
    linePos[i * 3] = p.x;  linePos[i * 3 + 1] = p.y + 0.003;  linePos[i * 3 + 2] = p.z;
  }

  // Close the loop
  const a = (N - 1) * 2, b = (N - 1) * 2 + 1, c = 0, d = 1;
  surfaceIdx.push(a, c, b, b, c, d);

  const surfaceGeo = new THREE.BufferGeometry();
  surfaceGeo.setAttribute('position', new THREE.BufferAttribute(surfacePos, 3));
  surfaceGeo.setAttribute('normal',   new THREE.BufferAttribute(surfaceNrm, 3));
  surfaceGeo.setAttribute('uv',       new THREE.BufferAttribute(surfaceUV,  2));
  surfaceGeo.setIndex(surfaceIdx);

  const edgeGeoL = new THREE.BufferGeometry();
  edgeGeoL.setAttribute('position', new THREE.BufferAttribute(edgePosL, 3));

  const edgeGeoR = new THREE.BufferGeometry();
  edgeGeoR.setAttribute('position', new THREE.BufferAttribute(edgePosR, 3));

  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));

  return { surfaceGeo, edgeGeoL, edgeGeoR, lineGeo };
}

export function TrackRibbon({ points, halfWidth = 0.115 }: TrackRibbonProps) {
  const { surfaceGeo, edgeGeoL, edgeGeoR, lineGeo } = useMemo(() => {
    if (points.length < 4) {
      const empty = new THREE.BufferGeometry();
      return { surfaceGeo: empty, edgeGeoL: empty, edgeGeoR: empty, lineGeo: empty };
    }

    const vecs  = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
    const curve = new THREE.CatmullRomCurve3(vecs, true, 'catmullrom', 0.1);
    const segs  = Math.min(points.length * 2, 900);
    const pts   = curve.getPoints(segs);

    return buildRibbon(pts, halfWidth);
  }, [points, halfWidth]);

  useEffect(() => () => {
    surfaceGeo.dispose();
    edgeGeoL.dispose();
    edgeGeoR.dispose();
    lineGeo.dispose();
  }, [surfaceGeo, edgeGeoL, edgeGeoR, lineGeo]);

  return (
    <group name="track-ribbon">
      {/* Dark tarmac surface */}
      <mesh geometry={surfaceGeo} receiveShadow={false}>
        <meshStandardMaterial
          color="#0a0f1e"
          roughness={0.97}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Left kerb — red */}
      <lineSegments geometry={edgeGeoL}>
        <lineBasicMaterial color="#EF1E24" linewidth={1} />
      </lineSegments>

      {/* Right kerb — white */}
      <lineSegments geometry={edgeGeoR}>
        <lineBasicMaterial color="#cccccc" linewidth={1} />
      </lineSegments>

      {/* Cyan centerline — bloom picks this up */}
      {/* @ts-ignore: R3F <line> conflicts with SVG <line> in TS intrinsics */}
      <line geometry={lineGeo}>
        <lineBasicMaterial color="#00D9FF" transparent opacity={0.35} />
      </line>
    </group>
  );
}
