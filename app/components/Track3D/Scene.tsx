'use client';

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';

import { TrackLayout, DriverTelemetry } from '@/hooks/useSessionLoad';
import { createNormalizer, NormalizedPoint } from '@/lib/three-helpers';
import { useDashboardStore } from '@/store/dashboardStore';

import { TrackMesh } from './TrackMesh';
import { SpeedHeatmap } from './SpeedHeatmap';
import { CarModel } from './CarModel';
import { CameraRig } from './CameraRig';
import { TelemetryFloaters } from './TelemetryFloaters';

// ── Playback controller ───────────────────────────────────────────────────────

function PlaybackController({ totalFrames, lapTimeMs }: { totalFrames: number; lapTimeMs: number }) {
  const isPlaying     = useDashboardStore(s => s.isPlaying);
  const playbackSpeed = useDashboardStore(s => s.playbackSpeed);
  const setFrameIndex = useDashboardStore(s => s.setFrameIndex);
  const setIsPlaying  = useDashboardStore(s => s.setIsPlaying);

  useFrame((_, delta) => {
    if (!isPlaying || totalFrames === 0) return;
    const lapSec = (lapTimeMs > 0 ? lapTimeMs : 90_000) / 1000;
    const pps    = totalFrames / lapSec;
    const fi     = useDashboardStore.getState().frameIndex;
    const next   = fi + delta * pps * playbackSpeed;
    if (next >= totalFrames - 1) {
      setFrameIndex(totalFrames - 1);
      setIsPlaying(false);
    } else {
      setFrameIndex(next);
    }
  });

  return null;
}

// ── Starfield ─────────────────────────────────────────────────────────────────

function Starfield({ count = 1800 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r     = 20 + Math.random() * 14;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      // Subtle cyan-to-white variation
      const t = Math.random();
      colors[i * 3]     = THREE.MathUtils.lerp(0.7, 1, t);
      colors[i * 3 + 1] = THREE.MathUtils.lerp(0.9, 1, t);
      colors[i * 3 + 2] = 1;
    }
    return { positions, colors };
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.004;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color"    args={[colors,    3]} />
      </bufferGeometry>
      <pointsMaterial size={0.038} vertexColors transparent opacity={0.65} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ── Ground plane ──────────────────────────────────────────────────────────────

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow={false}>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial
        color="#040914"
        roughness={0.95}
        metalness={0.05}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

// ── Scene contents ────────────────────────────────────────────────────────────

interface SceneContentsProps {
  track: TrackLayout;
  telemetry: Map<string, DriverTelemetry>;
}

function SceneContents({ track, telemetry }: SceneContentsProps) {
  const primaryDriver  = useDashboardStore(s => s.primaryDriver);
  const showHeatmap    = useDashboardStore(s => s.showHeatmap);
  const carPositionRef = useRef<[number, number, number]>([0, 0, 0]);

  const normalize = useMemo(() => createNormalizer(track.bounds), [track.bounds]);

  const trackPoints = useMemo((): [number, number, number][] =>
    track.x.map((x, i) => {
      const n = normalize(x, track.y[i], track.z[i] ?? 0);
      return [n.x, n.y, n.z];
    }),
    [track, normalize]
  );

  const driverEntries = useMemo(() =>
    Array.from(telemetry.entries()).map(([code, tel], index) => ({
      code,
      tel,
      index,
      points: tel.points.x.map((x, i) =>
        normalize(x, tel.points.y[i], tel.points.z[i] ?? 0)
      ) as NormalizedPoint[],
    })),
    [telemetry, normalize]
  );

  const primaryEntry = driverEntries.find(d => d.code === primaryDriver) ?? driverEntries[0];
  const primaryTel   = primaryEntry?.tel ?? null;
  const totalFrames  = primaryTel?.points.speed.length ?? 0;
  const lapTimeMs    = primaryTel?.lapTime ?? 90_000;

  const heatmapPoints = useMemo(() => {
    if (!primaryTel) return [];
    return primaryTel.points.x.map((x, i) => ({
      ...normalize(x, primaryTel.points.y[i], primaryTel.points.z[i] ?? 0),
      speed: primaryTel.points.speed[i] ?? 0,
    }));
  }, [primaryTel, normalize]);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <directionalLight position={[10, 16, 8]}  intensity={0.85} />
      <directionalLight position={[-8, 10, -6]} intensity={0.3}  color="#1a2a5e" />
      <pointLight position={[0, 10, 0]}          intensity={0.5}  color="#00D9FF" />
      <pointLight position={[4, 2, 4]}           intensity={0.3}  color="#EF1E24" />
      <pointLight position={[-4, 2, -4]}         intensity={0.3}  color="#06FFA5" />

      <Starfield />
      <GroundPlane />

      {!showHeatmap && trackPoints.length > 1 && <TrackMesh points={trackPoints} />}
      {showHeatmap  && heatmapPoints.length > 1 && <SpeedHeatmap points={heatmapPoints} />}

      {driverEntries.map(({ code, points, index }) => {
        if (points.length < 2) return null;
        const isPrimary = code === (primaryDriver ?? driverEntries[0]?.code);
        return (
          <CarModel
            key={code}
            points={points}
            driverIndex={index}
            primaryFrames={totalFrames}
            carPositionRef={isPrimary ? carPositionRef : undefined}
          />
        );
      })}

      {primaryEntry && primaryTel && primaryEntry.points.length > 1 && (
        <TelemetryFloaters
          carPositionRef={carPositionRef}
          speedArr={primaryTel.points.speed}
          gearArr={primaryTel.points.gear}
          throttleArr={primaryTel.points.throttle}
          brakeArr={primaryTel.points.brake}
        />
      )}

      <CameraRig carPositionRef={carPositionRef} />
      <PlaybackController totalFrames={totalFrames} lapTimeMs={lapTimeMs} />

      <EffectComposer>
        <Bloom intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.85} mipmapBlur />
        <Vignette offset={0.15} darkness={0.6} />
      </EffectComposer>

      <AdaptiveDpr pixelated />
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function Track3DScene({ track, telemetry }: { track: TrackLayout; telemetry: Map<string, DriverTelemetry> }) {
  return (
    <Canvas
      camera={{ position: [0, 9, 11], fov: 52 }}
      dpr={[1, 2]}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <SceneContents track={track} telemetry={telemetry} />
      </Suspense>
    </Canvas>
  );
}
