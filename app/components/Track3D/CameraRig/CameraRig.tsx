'use client';

import { useRef, MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { CameraMode, useDashboardStore } from '@/store/dashboardStore';

interface CameraRigProps {
  carPositionRef: MutableRefObject<[number, number, number]>;
}

export function CameraRig({ carPositionRef }: CameraRigProps) {
  const { camera } = useThree();
  const orbitRef = useRef<any>(null);
  const cameraMode = useDashboardStore(s => s.cameraMode);

  useFrame((_, delta) => {
    const [cx, cy, cz] = carPositionRef.current;
    const carPos = new THREE.Vector3(cx, cy, cz);

    if (cameraMode === 'follow') {
      const { frameIndex } = useDashboardStore.getState();
      const behind = new THREE.Vector3(0, 1.2, 3.5);
      const target = carPos.clone().add(behind);
      camera.position.lerp(target, Math.min(delta * 6, 1));
      camera.lookAt(carPos);
    }

    if (cameraMode === 'top-down') {
      const target = new THREE.Vector3(carPos.x, cy + 12, carPos.z);
      camera.position.lerp(target, Math.min(delta * 4, 1));
      camera.lookAt(carPos);
    }

    if (cameraMode === 'cinematic') {
      const t = Date.now() * 0.00006;
      const dist = 14;
      camera.position.x = Math.sin(t) * dist;
      camera.position.z = Math.cos(t) * dist;
      camera.position.y = 5 + Math.sin(t * 0.7) * 1.5;
      camera.lookAt(0, 0, 0);
    }
  });

  if (cameraMode === 'orbit') {
    return (
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.07}
        minDistance={2}
        maxDistance={30}
        maxPolarAngle={Math.PI / 1.8}
      />
    );
  }

  return null;
}
