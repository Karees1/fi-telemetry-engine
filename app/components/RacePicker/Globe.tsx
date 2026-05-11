'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { mesh } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { Race } from '@/types';
import { RaceNode } from './RaceNode';

const GLOBE_RADIUS = 3.4;
const PIN_RADIUS   = GLOBE_RADIUS + 0.09;

// ── Circuit geographic coordinates (lat, lon) ─────────────────────────────
const CIRCUIT_COORDS: Record<string, [number, number]> = {
  bahrain:       [ 26.03,   50.51],
  jeddah:        [ 21.63,   39.10],
  albert_park:   [-37.85,  144.97],
  suzuka:        [ 34.84,  136.54],
  shanghai:      [ 31.34,  121.22],
  miami:         [ 25.96,  -80.24],
  imola:         [ 44.34,   11.72],
  monaco:        [ 43.73,    7.42],
  montreal:      [ 45.50,  -73.52],
  barcelona:     [ 41.57,    2.26],
  red_bull_ring: [ 47.22,   14.76],
  silverstone:   [ 52.08,   -1.02],
  hungaroring:   [ 47.58,   19.25],
  spa:           [ 50.44,    5.97],
  zandvoort:     [ 52.39,    4.54],
  monza:         [ 45.62,    9.28],
  baku:          [ 40.37,   49.85],
  singapore:     [  1.29,  103.86],
  cota:          [ 30.13,  -97.64],
  mexico:        [ 19.40,  -99.09],
  interlagos:    [-23.70,  -46.70],
  las_vegas:     [ 36.11, -115.17],
  lusail:        [ 25.49,   51.45],
  yas_marina:    [ 24.47,   54.60],
};

// GeoJSON [lon, lat] → Three.js cartesian (Y-up sphere)
function geoToCart(lon: number, lat: number, r: number): THREE.Vector3 {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  return new THREE.Vector3(
    r * Math.cos(φ) * Math.sin(λ),
    r * Math.sin(φ),
    r * Math.cos(φ) * Math.cos(λ)
  );
}

function latLonToCart(lat: number, lon: number, r: number): [number, number, number] {
  const φ = (lat * Math.PI) / 180;
  const λ = (lon * Math.PI) / 180;
  return [
    r * Math.cos(φ) * Math.sin(λ),
    r * Math.sin(φ),
    r * Math.cos(φ) * Math.cos(λ),
  ];
}

// ── Lat/lon grid builders ─────────────────────────────────────────────────
function buildLatCircle(latDeg: number, r: number, segs = 96): THREE.Vector3[] {
  const lat = (latDeg * Math.PI) / 180;
  return Array.from({ length: segs + 1 }, (_, i) => {
    const lon = (i / segs) * Math.PI * 2;
    return new THREE.Vector3(
      r * Math.cos(lat) * Math.sin(lon),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.cos(lon)
    );
  });
}

function buildLonArc(lonDeg: number, r: number, segs = 64): THREE.Vector3[] {
  const lon = (lonDeg * Math.PI) / 180;
  return Array.from({ length: segs + 1 }, (_, i) => {
    const lat = ((i / segs) * 180 - 90) * Math.PI / 180;
    return new THREE.Vector3(
      r * Math.cos(lat) * Math.sin(lon),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.cos(lon)
    );
  });
}

const LAT_DEGREES = [-60, -30, 30, 60];
const LON_DEGREES = Array.from({ length: 12 }, (_, i) => i * 30);

// ── Fetch + parse coastlines (runs once per session) ──────────────────────
let cachedArcs: THREE.Vector3[][] | null = null;

async function loadCoastlines(): Promise<THREE.Vector3[][]> {
  if (cachedArcs) return cachedArcs;
  const res  = await fetch('/world-110m.json');
  const data = await res.json() as Topology;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landMesh = mesh(data, (data as any).objects.land);
  cachedArcs = landMesh.coordinates.map((ring) =>
    ring.map(([lon, lat]) => geoToCart(lon, lat, GLOBE_RADIUS))
  );
  return cachedArcs;
}

// ── Component ─────────────────────────────────────────────────────────────
interface GlobeProps {
  races: Race[];
  selectedRace: Race | null;
  filterTerm: string;
  onSelect: (race: Race) => void;
}

export function Globe({ races, selectedRace, filterTerm, onSelect }: GlobeProps) {
  const orbitRef                      = useRef<OrbitControlsImpl>(null);
  const [coastlines, setCoastlines]   = useState<THREE.Vector3[][]>([]);

  useEffect(() => {
    loadCoastlines().then(setCoastlines).catch(() => { /* no coastlines — globe still works */ });
  }, []);

  const latLines = useMemo(() => LAT_DEGREES.map((d) => ({ d, pts: buildLatCircle(d, GLOBE_RADIUS) })), []);
  const lonLines = useMemo(() => LON_DEGREES.map((d) => ({ d, pts: buildLonArc(d, GLOBE_RADIUS) })), []);
  const equator  = useMemo(() => buildLatCircle(0, GLOBE_RADIUS), []);

  return (
    <>
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableZoom
        enablePan={false}
        minDistance={5.5}
        maxDistance={13}
        autoRotate
        autoRotateSpeed={0.28}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.88}
        rotateSpeed={0.55}
        zoomSpeed={0.6}
      />

      <ambientLight intensity={0.2} />
      <directionalLight position={[6, 4, 6]}  intensity={0.3} color="#FFFFFF" />
      <pointLight       position={[-5, 2, -5]} intensity={0.15} color="#00D9FF" distance={18} decay={2} />

      {/* Core dark sphere — occludes back-face geometry naturally via depth buffer */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 0.997, 64, 64]} />
        <meshBasicMaterial color="#030B1A" />
      </mesh>

      {/* Atmosphere rim glow (BackSide = renders from inside, giving a halo edge) */}
      <mesh>
        <sphereGeometry args={[GLOBE_RADIUS * 1.06, 32, 32]} />
        <meshBasicMaterial color="#00D9FF" side={THREE.BackSide} transparent opacity={0.05} />
      </mesh>

      {/* Continent coastlines — rendered once data is fetched */}
      {coastlines.map((pts, i) => (
        <Line key={i} points={pts} color="#00C4E8" lineWidth={0.9} transparent opacity={0.3} />
      ))}

      {/* Lat/lon grid — behind coastlines visually */}
      {latLines.map(({ d, pts }) => (
        <Line key={`lat-${d}`} points={pts} color="#00D9FF" lineWidth={0.4} transparent opacity={0.055} />
      ))}
      <Line points={equator} color="#00D9FF" lineWidth={0.8} transparent opacity={0.14} />
      {lonLines.map(({ d, pts }) => (
        <Line key={`lon-${d}`} points={pts} color="#00D9FF" lineWidth={0.35} transparent opacity={0.045} />
      ))}

      {/* Circuit pins */}
      {races.map((race) => {
        const coords = CIRCUIT_COORDS[race.circuit.id];
        if (!coords) return null;

        const position = latLonToCart(coords[0], coords[1], PIN_RADIUS);
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
            position={position}
            isSelected={selectedRace?.id === race.id}
            isDimmed={isDimmed}
            onSelect={onSelect}
            onHoverStart={() => { if (orbitRef.current) orbitRef.current.autoRotate = false; }}
            onHoverEnd={() =>   { if (orbitRef.current) orbitRef.current.autoRotate = true;  }}
          />
        );
      })}
    </>
  );
}
