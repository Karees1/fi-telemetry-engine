'use client';

import { useRef, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, ContactShadows, Environment, MeshReflectorMaterial } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import gsap from 'gsap';
import * as THREE from 'three';

// Both GLBs preloaded at module-import time — by the time the user sees
// the first car finish its sequence, the second is already in GPU memory.
useGLTF.preload('/models/mercedes_-_amg_sl_63.glb');
useGLTF.preload('/models/porsche_911_turbo_s.glb');

const CAR_SEQUENCE = ['mercedes', 'porsche'];

const CAR_CONFIG = {
  mercedes: {
    path: '/models/mercedes_-_amg_sl_63.glb',
    name: 'MERCEDES-AMG SL 63',
    // Front 3/4 — shows the aggressive AMG grille and wide stance
    rotationY: 0.42,
    scale: 1,
  },
  porsche: {
    path: '/models/porsche_911_turbo_s.glb',
    name: 'PORSCHE 911 TURBO S',
    // Rear 3/4 — the iconic wide rump + whale-tail is the money shot
    rotationY: -0.28,
    scale: 1,
  },
};

// Per-car camera shot sequences.
// Mercedes: 3 classic angles — profile, grille, pull-back.
// Porsche:  5 cinematic angles — low attack, rear haunches, bird's-eye,
//           side sweep, intimate front face.
const CAMERA_SHOTS = {
  mercedes: [
    { pos: [-7, 3.5, 13],  target: [0, 1.0, 0], dur: 2.5 },
    { pos: [0,  1.4, 11],  target: [0, 1.3, 0], dur: 2.0 },
    { pos: [4,  2.5, 13],  target: [0, 0.8, 0], dur: 1.5 },
  ],
  porsche: [
    // 1 — Low front attack: camera barely clears the floor, nose aimed at lens
    { pos: [4,   0.3,  8],  target: [0, 0.6, 0], dur: 2.2 },
    // 2 — Rear haunches: behind-left, 911's wide rump + whale-tail in frame
    { pos: [-5,  2.5, -9],  target: [0, 1.0, 0], dur: 2.8 },
    // 3 — Bird's eye: high orbital looking straight down at the roof sculpture
    { pos: [2,  10,   5],   target: [0, 0.2, 0], dur: 2.5 },
    // 4 — Driver's side sweep: low raking angle along the flared rear fender
    { pos: [-10, 1.8,  4],  target: [0, 0.9, 0], dur: 2.2 },
    // 5 — Intimate front face: headlight level, tight — then car launches
    { pos: [0,   1.0,  6],  target: [0, 1.0, 0], dur: 2.0 },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CarModel — always stays mounted; starts far off-screen at x = -50
// ─────────────────────────────────────────────────────────────────────────────
function CarModel({ carKey, meshRef, onLoaded }) {
  const { path, rotationY, scale } = CAR_CONFIG[carKey];
  const { scene } = useGLTF(path);
  const cloned = useRef(scene.clone(true));

  useEffect(() => {
    onLoaded(carKey);
    const obj = cloned.current;
    return () => {
      obj.traverse(child => {
        child.geometry?.dispose();
        [child.material].flat().forEach(m => m?.dispose());
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <primitive
      ref={meshRef}
      object={cloned.current}
      scale={[scale, scale, scale]}
      rotation={[0, rotationY, 0]}
      position={[-50, 0, 0]}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Lights — 4-point cinema rig
// Key:  directional from above-right (warm white, sharp highlights)
// Fill: large area from left (cool, diffuse)
// Rim:  spot from behind-right (pure white edge separation)
// Deck: point under the car (red glow bouncing off the floor)
// ─────────────────────────────────────────────────────────────────────────────
function Lights() {
  return (
    <>
      <Environment preset="studio" />
      <ambientLight intensity={0.18} />

      {/* Key light — warm, directional, defines the car's shape */}
      <directionalLight
        position={[6, 10, 7]}
        intensity={3.2}
        color="#fff5e8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
      />

      {/* Fill light — cyan from the left, signature neon accent */}
      <spotLight
        position={[-12, 5, -4]}
        intensity={5}
        color="#00d9ff"
        angle={0.38}
        penumbra={0.9}
        castShadow={false}
      />

      {/* Rim light — pure white, behind-right, creates edge separation */}
      <spotLight
        position={[9, 4, -10]}
        intensity={2.8}
        color="#ffffff"
        angle={0.28}
        penumbra={1}
        castShadow={false}
      />

      {/* Deck light — red/orange bounce off the reflective floor */}
      <pointLight position={[0, -0.8, 1.5]} intensity={3} color="#ff3300" distance={14} decay={2} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CinematicCamera — reacts to phase + activeCarKey.
// During 'entry': smoothly repositions to the first shot while the car rolls in.
// During 'reveal': fires the full shot sequence, then signals 'driveoff'.
// During 'driveoff': subtle drift that suits each car's exit direction.
// ─────────────────────────────────────────────────────────────────────────────
function CinematicCamera({ activeCarKey, phase, onPhaseComplete }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 0.8, 0));
  const tlRef = useRef(null);

  useFrame(() => camera.lookAt(target.current));

  // During entry: glide camera to the opening angle for this car.
  // Takes 1.8s — completes just before the 2.2s car-entry animation.
  useEffect(() => {
    if (phase !== 'entry') return;
    const first = CAMERA_SHOTS[activeCarKey][0];
    tlRef.current?.kill();
    tlRef.current = gsap.timeline();
    tlRef.current
      .to(camera.position, { x: first.pos[0], y: first.pos[1], z: first.pos[2], duration: 1.8, ease: 'power2.inOut' })
      .to(target.current,  { x: first.target[0], y: first.target[1], z: first.target[2], duration: 1.8, ease: 'power2.inOut' }, '<');
  }, [activeCarKey, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // During reveal: walk through all shots for this car, then signal driveoff.
  useEffect(() => {
    if (phase !== 'reveal') return;
    const shots = CAMERA_SHOTS[activeCarKey];
    tlRef.current?.kill();
    tlRef.current = gsap.timeline({ onComplete: () => onPhaseComplete('driveoff') });
    shots.forEach(shot => {
      tlRef.current
        .to(camera.position, { x: shot.pos[0], y: shot.pos[1], z: shot.pos[2], duration: shot.dur, ease: 'power1.inOut' })
        .to(target.current,  { x: shot.target[0], y: shot.target[1], z: shot.target[2], duration: shot.dur, ease: 'power1.inOut' }, '<');
    });
    return () => tlRef.current?.kill();
  }, [phase, activeCarKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // During driveoff: subtle camera motion that complements each car's exit.
  useEffect(() => {
    if (phase !== 'driveoff') return;
    tlRef.current?.kill();
    if (activeCarKey === 'mercedes') {
      // Drift left as it rockets off right
      gsap.to(camera.position, { x: -3, y: 2, z: 12, duration: 1.5, ease: 'power3.in' });
    } else {
      // Porsche: camera creeps forward as the car launches into the lens
      gsap.to(camera.position, { x: 0, y: 0.6, z: 5.5, duration: 1.1, ease: 'power4.in' });
      gsap.to(target.current,  { y: 0.8, duration: 1.1 });
    }
  }, [phase, activeCarKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scene — single persistent scene containing BOTH cars.
// Only the active car moves; the inactive one stays at x = -50, off-camera.
// No remounting, no re-parsing — zero lag on the transition.
// ─────────────────────────────────────────────────────────────────────────────
function Scene({ activeCarKey, phase, setPhase, onCarComplete, onBothLoaded }) {
  const mercedesRef = useRef();
  const porscheRef  = useRef();
  const loadedRef   = useRef({ mercedes: false, porsche: false });
  const [bothLoaded, setBothLoaded] = useState(false);

  const handleModelLoaded = (carKey) => {
    if (loadedRef.current[carKey]) return;
    loadedRef.current[carKey] = true;
    if (loadedRef.current.mercedes && loadedRef.current.porsche) {
      setBothLoaded(true);
      onBothLoaded();
    }
  };

  const activeRef = activeCarKey === 'mercedes' ? mercedesRef : porscheRef;

  // Entry: drive the active car in from off-screen left → then reveal
  useEffect(() => {
    if (phase !== 'entry' || !bothLoaded || !activeRef.current) return;
    gsap.to(activeRef.current.position, {
      x: 0, duration: 2.2, ease: 'power3.out',
      onComplete: () => setPhase('reveal'),
    });
  }, [phase, bothLoaded, activeCarKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Driveoff: each car exits the stage differently
  useEffect(() => {
    if (phase !== 'driveoff' || !activeRef.current) return;

    if (activeCarKey === 'porsche') {
      const tl = gsap.timeline({ onComplete: onCarComplete });
      tl.to(activeRef.current.position, { x: -0.3, duration: 0.15, ease: 'power2.out' })
        .to(activeRef.current.position, { z: 22,   duration: 1.1,  ease: 'power4.in'  })
        .to(activeRef.current.scale,    { x: 6, y: 6, z: 6, duration: 1.1, ease: 'power4.in' }, '<');
    } else {
      const tl = gsap.timeline({ onComplete: onCarComplete });
      tl.to(activeRef.current.position, { x: -0.3, duration: 0.15, ease: 'power2.out' })
        .to(activeRef.current.position, { x: 40,   duration: 1.1,  ease: 'power4.in'  })
        .to(activeRef.current.rotation, { y: -0.1, duration: 0.8 }, '<');
    }
  }, [phase, activeCarKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Lights />

      {/* Showroom floor — polished black with live reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.02, 0]} receiveShadow>
        <planeGeometry args={[120, 40]} />
        <MeshReflectorMaterial
          mirror={0.55}
          blur={[400, 150]}
          resolution={1024}
          mixBlur={0.75}
          mixStrength={1.8}
          roughness={0.9}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#050505"
          metalness={0.85}
        />
      </mesh>

      <ContactShadows
        position={[0, -1.01, 0]}
        opacity={0.85}
        scale={24}
        blur={2.0}
        far={5}
        color="#cc1100"
      />

      {/* Both models always in scene — inactive one sits at x = -50 */}
      <Suspense fallback={null}>
        <CarModel carKey="mercedes" meshRef={mercedesRef} onLoaded={handleModelLoaded} />
        <CarModel carKey="porsche"  meshRef={porscheRef}  onLoaded={handleModelLoaded} />
      </Suspense>

      <EffectComposer>
        {/* Neon lights actually bloom */}
        <Bloom
          luminanceThreshold={0.72}
          luminanceSmoothing={0.18}
          intensity={1.1}
          blendFunction={BlendFunction.ADD}
        />
        {/* Subtle lens fringing — techy, cinematic */}
        <ChromaticAberration offset={[0.0004, 0.0004]} />
        {/* Darkens edges, draws eye to the car */}
        <Vignette eskil={false} offset={0.12} darkness={1.15} />
      </EffectComposer>

      <CinematicCamera activeCarKey={activeCarKey} phase={phase} onPhaseComplete={setPhase} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CarIntro
// ─────────────────────────────────────────────────────────────────────────────
export default function CarIntro({ onComplete }) {
  const [carIndex, setCarIndex] = useState(0);
  // phase: 'loading' | 'entry' | 'reveal' | 'driveoff'
  const [phase, setPhase] = useState('loading');
  const [fadeOut, setFadeOut] = useState(false);
  const [showName, setShowName] = useState(false);

  const currentCar = CAR_SEQUENCE[carIndex];
  const isLast = carIndex === CAR_SEQUENCE.length - 1;

  // Show car name shortly after reveal begins
  useEffect(() => {
    setShowName(false);
    if (phase !== 'reveal') return;
    const t = setTimeout(() => setShowName(true), 400);
    return () => clearTimeout(t);
  }, [carIndex, phase]);

  // Both models loaded → kick off the sequence
  const handleBothLoaded = () => setPhase('entry');

  // Called when a car finishes its driveoff animation
  const handleCarComplete = () => {
    if (!isLast) {
      // No blackout, no remount — Porsche is already in the scene
      setShowName(false);
      setCarIndex(i => i + 1);
      setPhase('entry');
    } else {
      setFadeOut(true);
      setTimeout(() => onComplete?.(), 900);
    }
  };

  const skipAll = () => {
    setFadeOut(true);
    setTimeout(() => onComplete?.(), 900);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 9999, overflow: 'hidden',
      opacity: fadeOut ? 0 : 1, transition: 'opacity 0.9s ease',
    }}>

      <Canvas
        shadows
        camera={{ position: [10, 3, 8], fov: 42 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.5 }}
        style={{ background: 'radial-gradient(ellipse at center, #080305 0%, #000 65%)' }}
      >
        <Scene
          activeCarKey={currentCar}
          phase={phase}
          setPhase={setPhase}
          onCarComplete={handleCarComplete}
          onBothLoaded={handleBothLoaded}
        />
      </Canvas>

      {/* Single upfront loading screen — vanishes once BOTH models are ready */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: 12,
        opacity: phase === 'loading' ? 1 : 0,
        transition: 'opacity 0.8s ease',
        pointerEvents: 'none', zIndex: 6,
      }}>
        <p style={{
          margin: 0, fontFamily: '"Roboto Mono", monospace', fontSize: 10,
          letterSpacing: '0.35em', color: 'rgba(0,217,255,0.5)', textTransform: 'uppercase',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}>LOADING SHOWROOM</p>
        <div style={{
          width: 48, height: 1, background: 'rgba(0,217,255,0.3)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }} />
      </div>

      {/* Car name tag */}
      <div style={{
        position: 'absolute', bottom: 80, left: 48,
        opacity: showName ? 1 : 0,
        transform: showName ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 1s ease, transform 1s ease',
        pointerEvents: 'none',
      }}>
        <p style={{
          margin: 0, fontFamily: '"Roboto Mono", monospace', fontSize: 11,
          letterSpacing: '0.3em', color: 'rgba(255,100,50,0.6)', textTransform: 'uppercase',
        }}>NOW PRESENTING</p>
        <h1 style={{
          margin: '4px 0 0', fontFamily: '"Roboto Mono", monospace', fontSize: 28,
          fontWeight: 700, letterSpacing: '0.15em', color: '#fff',
          textShadow: '0 0 20px rgba(255,80,20,0.8)',
        }}>{CAR_CONFIG[currentCar].name}</h1>
        <div style={{
          marginTop: 8, width: 120, height: 1,
          background: 'linear-gradient(to right, rgba(255,80,20,0.8), transparent)',
        }} />
      </div>

      {/* Car counter — 01 / 02 */}
      <div style={{
        position: 'absolute', top: 32, right: 48,
        opacity: phase !== 'loading' ? 1 : 0, transition: 'opacity 1s ease',
        pointerEvents: 'none',
      }}>
        <span style={{
          fontFamily: '"Roboto Mono", monospace', fontSize: 11,
          letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)',
        }}>
          {String(carIndex + 1).padStart(2, '0')} / {String(CAR_SEQUENCE.length).padStart(2, '0')}
        </span>
      </div>

      {/* Scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
      }} />

      {/* Skip */}
      <button
        onClick={skipAll}
        style={{
          position: 'absolute', bottom: 32, right: 32,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
          color: 'rgba(255,255,255,0.5)', padding: '8px 24px',
          fontFamily: '"Roboto Mono", monospace', fontSize: 11,
          letterSpacing: '0.25em', cursor: 'pointer',
          transition: 'all 0.2s', textTransform: 'uppercase',
        }}
        onMouseEnter={e => { e.target.style.color = '#fff'; e.target.style.borderColor = 'rgba(255,255,255,0.6)'; }}
        onMouseLeave={e => { e.target.style.color = 'rgba(255,255,255,0.5)'; e.target.style.borderColor = 'rgba(255,255,255,0.2)'; }}
      >
        Skip Intro
      </button>
    </div>
  );
}
