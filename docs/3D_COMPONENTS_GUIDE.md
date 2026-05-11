# 3D Components Guide — F1 Telemetry Dashboard

This document specifies every 3D component in the dashboard:
what it does, how it works, what data it needs, and how to build it.

Read this before touching anything in `app/components/Track3D/`.

---

## Overview: The 3D Scene Graph

```
<Canvas>                          ← R3F root. One per dashboard view
  <Scene>                         ← Sets up lighting, camera, fog
    <TrackMesh />                 ← The circuit outline (static)
    <SpeedHeatmap />              ← Color-coded speed overlay on track
    <CarModel />                  ← Animated 3D F1 car
    <DRSZones />                  ← Highlighted track sections
    <BrakeMarkers />              ← Brake point indicators
    <SectorDividers />            ← S1 / S2 / S3 boundaries
    <TelemetryFloaters />         ← Floating data labels in 3D space
    <CameraRig />                 ← Handles camera follow / orbit / cinematic
  </Scene>
</Canvas>
```

All components live in `app/components/Track3D/`.

---

## Coordinate System

FastF1 telemetry returns X, Y coordinates in meters.
The Z axis (elevation) is available but often flat on most circuits.

**Before rendering, normalize all coordinates:**

```ts
// lib/three-helpers.ts

export function normalizeTrackCoords(
  points: { x: number; y: number; z?: number }[]
) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  const centerX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const centerY = (Math.max(...ys) + Math.min(...ys)) / 2;
  const scale = 1 / Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys)
  ) * 10; // Scale to roughly -5 to 5 world units
  
  return points.map(p => ({
    x: (p.x - centerX) * scale,
    y: (p.z ?? 0) * scale,         // Z becomes Y (Three.js Y is up)
    z: (p.y - centerY) * scale,    // Y becomes Z (Three.js Z is depth)
  }));
}
```

> Three.js coordinate system: Y is up. FastF1 is X-Y (top-down).
> Swap FastF1's Y → Three.js Z, and FastF1's Z (elevation) → Three.js Y.

---

## Component 1: TrackMesh

**What it is:** The circuit outline. The skeleton of the track.
The first thing rendered. Static after data loads.

**Data needed:**
```ts
points: Array<{ x: number; y: number; z: number }>
// Normalized coordinates from normalizeTrackCoords()
```

**How it renders:**
- Uses `drei`'s `<Line>` component (most performant for polylines)
- Two passes: wide grey line (track surface), thinner white line (racing line)
- Subtle glow via `linewidth` + custom shader or post-processing

**Build order:** First. Everything else sits on top of this.

```tsx
// app/components/Track3D/TrackMesh.tsx

import { Line } from '@react-three/drei';

interface TrackMeshProps {
  points: [number, number, number][];
}

export function TrackMesh({ points }: TrackMeshProps) {
  return (
    <group name="track-mesh">
      {/* Track surface — wide, dark grey */}
      <Line
        points={points}
        color="#1a1a2e"
        lineWidth={8}
        opacity={0.9}
        transparent
      />
      {/* Racing line — thin, white */}
      <Line
        points={points}
        color="#ffffff"
        lineWidth={1.5}
        opacity={0.3}
        transparent
      />
    </group>
  );
}
```

---

## Component 2: SpeedHeatmap

**What it is:** The track recolored by speed.
The plasma heatmap from `track_map.py` — but in 3D, interactive, animated.

**Data needed:**
```ts
points: Array<{ x: number; y: number; z: number; speed: number }>
minSpeed: number
maxSpeed: number
```

**How it renders:**
- Splits track into tiny `LineSegments` (same technique as the Python version)
- Each segment gets a color from a gradient based on normalized speed value
- Gradient: blue (slow) → purple → pink → yellow → red (fast)
- On hover: tooltip shows exact speed at that section

**The color mapping:**
```ts
import { Color } from 'three';

export function speedToColor(speed: number, min: number, max: number): Color {
  const t = (speed - min) / (max - min); // 0 to 1
  
  // Plasma colormap approximation
  const r = Math.min(1, t * 2);
  const g = Math.max(0, t * 2 - 1);
  const b = Math.max(0, 1 - t * 2);
  
  return new Color(r, g, b);
}
```

**Build order:** Second. Replaces the grey track with colorized version.
Toggle between grey outline and heatmap via a control panel button.

---

## Component 3: CarModel

**What it is:** The hero. An F1 car moving around the track in sync with
timeline position. This is what makes the dashboard feel alive.

**Data needed:**
```ts
position: [number, number, number]    // Current XYZ on track
rotation: [number, number, number]    // Heading direction (Euler angles)
speed: number                         // For exhaust/blur effects
gear: number                          // Optional, for engine sound sim
frameIndex: number                    // Current position in telemetry array
```

**The car geometry (two options — pick one):**

**Option A: Simple geometric car (fast to build)**
```tsx
// Bounding box approximation — F1 car silhouette from primitives
// Chassis: flat box
// Wheels: 4 cylinders
// Halo: curved tube
// Livery: vertex colors or texture
```

**Option B: Load a GLTF model (better visuals)**
```tsx
import { useGLTF } from '@react-three/drei';
// Use a low-poly F1 car GLTF (find on Sketchfab, free license)
// Target: < 50k triangles for smooth 60fps
```

**Recommendation:** Start with Option A (you control the geometry + colors),
add GLTF later when you want to polish. Option A also lets you set team colors
dynamically (Ferrari red vs McLaren papaya etc.)

**Position interpolation (critical for smooth motion):**
```ts
// Don't jump between telemetry points — interpolate!
// Telemetry has ~200-300 points per second
// At 60fps that's plenty, but we still lerp for silky smooth motion

const lerpedPosition = useMemo(() => {
  const alpha = (frameIndex % 1); // fractional part
  const current = points[Math.floor(frameIndex)];
  const next = points[Math.ceil(frameIndex)] ?? current;
  
  return [
    THREE.MathUtils.lerp(current.x, next.x, alpha),
    THREE.MathUtils.lerp(current.y, next.y, alpha),
    THREE.MathUtils.lerp(current.z, next.z, alpha),
  ];
}, [frameIndex, points]);
```

**Orientation (car faces direction of travel):**
```ts
// Calculate heading from current → next point
const direction = new THREE.Vector3()
  .subVectors(nextPoint, currentPoint)
  .normalize();

const angle = Math.atan2(direction.x, direction.z);
// Apply to car's Y rotation
```

**Build order:** Third. The most complex component. Build after TrackMesh is working.

---

## Component 4: DRSZones

**What it is:** Highlighted sections of the track where DRS is available.
Glowing cyan overlay on the track path.

**Data needed:**
```ts
zones: Array<{
  startDistance: number   // meters along track where DRS opens
  endDistance: number     // meters along track where DRS closes
  points: [number, number, number][]  // the 3D coordinates for this section
}>
```

**How it renders:**
- Subset of track points colored in cyan
- Pulsing glow animation (Framer Motion or Three.js shader)
- Label: "DRS ZONE" floating text above the section

**Visual:**
```tsx
<Line
  points={zone.points}
  color="#00D9FF"
  lineWidth={6}
  opacity={0.7}
  transparent
/>
// Plus: animated glow using a custom MeshLine shader or post-processing bloom
```

**Build order:** Fourth. After car is working, add track context.

---

## Component 5: BrakeMarkers

**What it is:** Visual indicators at heavy braking zones.
In real F1, there are physical boards on the track (300m, 200m, 100m boards).
Here we show them as 3D floating markers with brake pressure data.

**Data needed:**
```ts
brakePoints: Array<{
  position: [number, number, number]
  distance: number           // distance from start of lap
  maxBrakePressure: number   // 0-100%
  lapDelta?: number          // vs comparison driver (optional)
}>
```

**How it renders:**
- Small vertical plane/board floating above track surface
- Color coded: red (heavy braking 80%+), orange (medium), yellow (light)
- On hover: shows brake pressure %, gear, speed before braking
- Subtle `scale` animation on the active braking zone (car is currently here)

**Build order:** Fifth. Nice-to-have detail layer.

---

## Component 6: SectorDividers

**What it is:** The S1 / S2 / S3 sector boundaries.
Simple but critical for data context — makes telemetry readable.

**Data needed:**
```ts
sectors: [
  { label: 'S1', position: [x, y, z], color: '#EF1E24' },
  { label: 'S2', position: [x, y, z], color: '#00D9FF' },
  { label: 'S3', position: [x, y, z], color: '#06FFA5' },
]
```

**How it renders:**
- Thin vertical plane crossing the track at sector boundaries
- Floating text label (`<Text>` from drei) with sector number + sector time
- Glows when car crosses that boundary during playback

**Build order:** Sixth. Simple to add, big UX improvement.

---

## Component 7: TelemetryFloaters

**What it is:** Floating data panels in 3D space, anchored to the car's position.
Like a heads-up-display that follows the car around the track.

**Data needed:**
```ts
currentTelemetry: {
  speed: number
  gear: number
  throttle: number
  brake: number
  drs: boolean
  lapTime: string
}
carPosition: [number, number, number]
```

**How it renders:**
```tsx
// Billboard text that always faces camera
import { Billboard, Text } from '@react-three/drei';

<Billboard follow={true} position={[carX, carY + 1, carZ]}>
  <Text color="#00D9FF" fontSize={0.3} font="/fonts/SpaceGrotesk-Bold.woff">
    {`${speed} km/h  G${gear}`}
  </Text>
</Billboard>
```

**Design:**
- Minimal — just speed + gear always visible
- Expanded mode (click car): shows all metrics in a floating panel
- Glassmorphism look via custom `RoundedBox` with transparency

**Build order:** Seventh. Brings the 3D and data layers together.

---

## Component 8: CameraRig

**What it is:** The camera controller. The most underrated component.
Good camera work makes the dashboard feel cinematic vs flat.

**Modes:**
```ts
type CameraMode =
  | 'orbit'         // Free rotation around track (default)
  | 'follow'        // Locked behind car, low angle
  | 'cinematic'     // Auto-rotating orbit, slow and dramatic
  | 'top-down'      // Bird's eye view (like track map)
  | 'onboard'       // First-person from car
```

**How to build:**
```tsx
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

export function CameraRig({ mode, carPosition, carDirection }) {
  const cameraRef = useRef();
  
  useFrame(() => {
    if (mode === 'follow') {
      // Position camera behind the car
      const offset = carDirection.clone().multiplyScalar(-3).add(new THREE.Vector3(0, 1, 0));
      cameraRef.current.position.lerp(carPosition.clone().add(offset), 0.1);
      cameraRef.current.lookAt(carPosition);
    }
    
    if (mode === 'cinematic') {
      // Slow orbit around track center
      const t = Date.now() * 0.0001;
      cameraRef.current.position.x = Math.sin(t) * 8;
      cameraRef.current.position.z = Math.cos(t) * 8;
      cameraRef.current.position.y = 4;
      cameraRef.current.lookAt(0, 0, 0);
    }
  });
  
  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault fov={75} near={0.1} far={100000} />
      {mode === 'orbit' && <OrbitControls enableDamping dampingFactor={0.05} />}
    </>
  );
}
```

**Build order:** Build alongside CarModel. Camera and car are coupled.

---

## Post-Processing (Optional but transformative)

These effects are what take the 3D from "functional" to "cinematic". 

Uses `@react-three/postprocessing`.

```tsx
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';

<EffectComposer>
  {/* Makes neon lines actually glow */}
  <Bloom
    intensity={0.5}
    luminanceThreshold={0.8}
    luminanceSmoothing={0.9}
  />
  
  {/* Slight color fringing — subtle, techy feel */}
  <ChromaticAberration offset={[0.0005, 0.0005]} />
  
  {/* Darkens edges — focuses attention on center */}
  <Vignette eskil={false} offset={0.1} darkness={0.6} />
</EffectComposer>
```

> ⚠️ Add post-processing LAST. It's expensive — profile first.

---

## Build Order Summary

| # | Component          | Depends On       | Priority   |
|---|--------------------|------------------|------------|
| 1 | TrackMesh          | Track coords     | 🔴 First   |
| 2 | SpeedHeatmap       | TrackMesh        | 🔴 Second  |
| 3 | CarModel           | Track + telemetry| 🔴 Third   |
| 8 | CameraRig          | CarModel         | 🔴 Third   |
| 4 | DRSZones           | TrackMesh        | 🟡 Fourth  |
| 6 | SectorDividers     | TrackMesh        | 🟡 Fifth   |
| 5 | BrakeMarkers       | CarModel         | 🟡 Sixth   |
| 7 | TelemetryFloaters  | CarModel         | 🟢 Seventh |
| - | PostProcessing     | Everything       | 🟢 Last    |

---

## File Structure

```
app/components/Track3D/
├── index.ts                    ← Barrel export
├── Scene.tsx                   ← Root R3F Canvas + scene setup
├── TrackMesh/
│   ├── TrackMesh.tsx
│   ├── TrackMesh.module.css
│   └── index.ts
├── SpeedHeatmap/
│   ├── SpeedHeatmap.tsx
│   └── index.ts
├── CarModel/
│   ├── CarModel.tsx
│   ├── CarGeometry.tsx         ← The actual 3D geometry
│   └── index.ts
├── DRSZones/
│   └── DRSZones.tsx
├── SectorDividers/
│   └── SectorDividers.tsx
├── BrakeMarkers/
│   └── BrakeMarkers.tsx
├── TelemetryFloaters/
│   └── TelemetryFloaters.tsx
├── CameraRig/
│   └── CameraRig.tsx
└── PostProcessing/
    └── PostProcessing.tsx
```

---

## Performance Checklist

Before shipping any 3D component:

- [ ] Geometry is created outside of `useFrame` (no `new THREE.Vector3()` every frame)
- [ ] Heavy objects use `useMemo` for creation
- [ ] `dispose()` called on unmount for geometries and materials
- [ ] Telemetry arrays not recalculated every render (memoized by lap ID)
- [ ] `blit=True` equivalent: use `invalidate` from R3F to only re-render on state change
- [ ] Post-processing only enabled if `window.devicePixelRatio < 2` (optional for performance)
- [ ] `instancedMesh` used for any repeating 3D objects (sector markers, brake boards)

---

## Useful Drei Components (Don't reinvent)

| Need                    | Drei Component           |
|-------------------------|--------------------------|
| Polyline on track       | `<Line>`                 |
| Text in 3D space        | `<Text>` (uses troika)   |
| Always-face-camera text | `<Billboard>`            |
| Smooth orbit            | `<OrbitControls>`        |
| Load GLTF models        | `<useGLTF>`              |
| Environment lighting    | `<Environment>`          |
| Performance stats       | `<Stats>`                |
| Rounded boxes           | `<RoundedBox>`           |
| Tube along path         | `<Tube>`                 |
| Adaptive pixel ratio    | `<AdaptiveDpr>`          |

---

## References

- [React Three Fiber docs](https://docs.pmnd.rs/react-three-fiber)
- [Drei docs](https://drei.pmnd.rs/)
- [Three.js fundamentals](https://threejsfundamentals.org/)
- [FastF1 telemetry fields](https://docs.fastf1.dev/core.html#fastf1.core.Telemetry)
- [Track coordinate system](https://docs.fastf1.dev/circuit_info.html)
