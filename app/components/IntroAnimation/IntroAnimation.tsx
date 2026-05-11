'use client';

import { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import { IntroScene } from './IntroScene';
import styles from './IntroAnimation.module.css';

interface IntroAnimationProps {
  onComplete: () => void;
}

type Phase = 'driving' | 'title' | 'fading';

export function IntroAnimation({ onComplete }: IntroAnimationProps) {
  const [phase, setPhase] = useState<Phase>('driving');

  const exit = () => {
    setPhase('fading');
    setTimeout(onComplete, 700);
  };

  const handleCarExited = () => {
    setPhase('title');
    setTimeout(exit, 2400);
  };

  return (
    <motion.div
      className={styles.container}
      animate={{ opacity: phase === 'fading' ? 0 : 1 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
    >
      {/* 3D scene */}
      <Canvas
        className={styles.canvas}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        camera={{ position: [0, 0.9, 5.8], fov: 62, near: 0.01, far: 1000 }}
        gl={{ antialias: true, alpha: false }}
      >
        <Suspense fallback={null}>
          <IntroScene onCarExited={handleCarExited} />
        </Suspense>
      </Canvas>

      {/* Title — slides in after car exits */}
      <AnimatePresence>
        {phase === 'title' && (
          <motion.div
            className={styles.titleOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            {/* Red accent bar */}
            <motion.div
              className={styles.redBar}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />

            {/* F1 label */}
            <motion.p
              className={styles.label}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4, ease: 'easeOut' }}
            >
              F&nbsp;&nbsp;1
            </motion.p>

            {/* Main hero word */}
            <motion.h1
              className={styles.title}
              initial={{ opacity: 0, y: 20, letterSpacing: '0.4em' }}
              animate={{ opacity: 1, y: 0, letterSpacing: '0.14em' }}
              transition={{ delay: 0.28, duration: 0.55, ease: 'easeOut' }}
            >
              TELEMETRY
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className={styles.subtitle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              RACE ANALYSIS ENGINE &nbsp;·&nbsp; 2024
            </motion.p>

            {/* Cyan rule */}
            <motion.div
              className={styles.cyanBar}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.55, delay: 0.35, ease: 'easeOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip — always visible */}
      <button className={styles.skipBtn} onClick={exit}>
        SKIP INTRO
      </button>
    </motion.div>
  );
}
