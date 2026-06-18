'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import styles from './TimelineScrubber.module.css';

interface TimelineScrubberProps {
  totalFrames: number;
  lapTimeMs: number;
  raceMode?: boolean;
  totalRaceTime?: number;
}

function formatLapTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = (ms / 1000 - m * 60).toFixed(3);
  return `${m}:${parseFloat(rem).toFixed(3).padStart(6, '0')}`;
}

function formatRaceTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const LAP_SPEEDS  = [0.25, 0.5, 1, 2, 4];
const RACE_SPEEDS = [1, 5, 10, 30, 60];

export function TimelineScrubber({ totalFrames, lapTimeMs, raceMode = false, totalRaceTime = 0 }: TimelineScrubberProps) {
  const fillRef  = useRef<HTMLDivElement>(null);
  const timeRef  = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const isPlaying        = useDashboardStore(s => s.isPlaying);
  const playbackSpeed    = useDashboardStore(s => s.playbackSpeed);
  const setIsPlaying     = useDashboardStore(s => s.setIsPlaying);
  const setPlaybackSpeed = useDashboardStore(s => s.setPlaybackSpeed);
  const setFrameIndex    = useDashboardStore(s => s.setFrameIndex);
  const setRaceTime      = useDashboardStore(s => s.setRaceTimeSeconds);

  // Direct DOM update — no re-renders during playback
  useEffect(() => {
    const unsub = useDashboardStore.subscribe(
      s => raceMode ? s.raceTimeSeconds : s.frameIndex,
      (val) => {
        if (raceMode) {
          const pct = totalRaceTime > 0 ? ((val as number) / totalRaceTime) * 100 : 0;
          if (fillRef.current) fillRef.current.style.width = `${pct.toFixed(2)}%`;
          if (timeRef.current) timeRef.current.textContent = formatRaceTime(val as number);
        } else {
          const fi = val as number;
          const pct = totalFrames > 0 ? (fi / (totalFrames - 1)) * 100 : 0;
          if (fillRef.current) fillRef.current.style.width = `${pct.toFixed(2)}%`;
          if (timeRef.current && lapTimeMs > 0) {
            const elapsedMs = (fi / (totalFrames - 1)) * lapTimeMs;
            timeRef.current.textContent = formatLapTime(elapsedMs);
          }
        }
      }
    );
    return unsub;
  }, [raceMode, totalFrames, lapTimeMs, totalRaceTime]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const scrub = (ev: MouseEvent | React.MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      if (raceMode) setRaceTime(ratio * totalRaceTime);
      else          setFrameIndex(ratio * (totalFrames - 1));
    };
    scrub(e);
    const onMove = (ev: MouseEvent) => scrub(ev);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [raceMode, totalFrames, totalRaceTime, setFrameIndex, setRaceTime]);

  const SPEEDS = raceMode ? RACE_SPEEDS : LAP_SPEEDS;

  return (
    <div className={styles.root}>
      {/* Playback controls */}
      <div className={styles.controls}>
        <button
          className={styles.playBtn}
          onClick={() => {
            const store = useDashboardStore.getState();
            if (raceMode) {
              if (store.raceTimeSeconds >= totalRaceTime) setRaceTime(0);
            } else {
              if (store.frameIndex >= totalFrames - 1) setFrameIndex(0);
            }
            setIsPlaying(!isPlaying);
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="2" y="1" width="4" height="12" fill="currentColor" rx="1" />
              <rect x="8" y="1" width="4" height="12" fill="currentColor" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14">
              <polygon points="2,1 12,7 2,13" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* Speed selector */}
        <div className={styles.speedGroup}>
          {SPEEDS.map(s => (
            <button
              key={s}
              className={`${styles.speedBtn} ${s === playbackSpeed ? styles.speedBtnActive : ''}`}
              onClick={() => setPlaybackSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Progress track */}
      <div
        ref={trackRef}
        className={styles.track}
        onMouseDown={handleMouseDown}
      >
        <div className={styles.trackBg} />
        <div ref={fillRef} className={styles.fill} style={{ width: '0%' }} />
        <div className={styles.thumb} style={{ left: '0%' }} />
      </div>

      {/* Time display */}
      <span ref={timeRef} className={styles.time}>
        {raceMode ? '0:00:00' : '0:00.000'}
      </span>
    </div>
  );
}
