'use client';

import { useRef, useState, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useDashboardStore } from '@/store/dashboardStore';

interface TelemetryFloatersProps {
  carPositionRef: MutableRefObject<[number, number, number]>;
  speedArr: number[];
  gearArr: number[];
  throttleArr: number[];
  brakeArr: number[];
}

interface FloaterDisplay {
  speed: number;
  gear: number;
  throttle: number;
  brake: number;
}

export function TelemetryFloaters({
  carPositionRef,
  speedArr,
  gearArr,
  throttleArr,
  brakeArr,
}: TelemetryFloatersProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lastUpdate = useRef(0);
  const [display, setDisplay] = useState<FloaterDisplay>({ speed: 0, gear: 0, throttle: 0, brake: 0 });

  useFrame(() => {
    const [cx, cy, cz] = carPositionRef.current;

    if (groupRef.current) {
      groupRef.current.position.set(cx, cy + 0.9, cz);
    }

    const now = Date.now();
    if (now - lastUpdate.current > 80) {
      const fi = Math.floor(useDashboardStore.getState().frameIndex);
      setDisplay({
        speed:    Math.round(speedArr[fi]    ?? 0),
        gear:     gearArr[fi]                ?? 0,
        throttle: Math.round(throttleArr[fi] ?? 0),
        brake:    Math.round(brakeArr[fi]    ?? 0),
      });
      lastUpdate.current = now;
    }
  });

  const { speed, gear, throttle, brake } = display;

  return (
    <group ref={groupRef}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Speed line */}
        <Text
          fontSize={0.22}
          color="#00D9FF"
          anchorX="center"
          anchorY="bottom"
          position={[0, 0.28, 0]}
        >
          {`${speed} km/h`}
        </Text>

        {/* Gear */}
        <Text
          fontSize={0.18}
          color="#ffffff"
          anchorX="center"
          anchorY="bottom"
          position={[0, 0.07, 0]}
        >
          {`G${gear}  T${throttle}%  B${brake}%`}
        </Text>
      </Billboard>
    </group>
  );
}
