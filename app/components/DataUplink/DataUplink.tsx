'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SessionLoadState, UplinkStage } from '@/hooks/useSessionLoad';
import styles from './DataUplink.module.css';

// ── Stage config — order matters ──────────────────────────────────────────────

interface StageConfig {
  id: UplinkStage;
  label: string;
  sublabel: string;
}

const STAGES: StageConfig[] = [
  { id: 'connecting',   label: 'ESTABLISHING UPLINK',   sublabel: 'Connecting to F1 data service'       },
  { id: 'session_meta', label: 'SESSION AUTHENTICATED', sublabel: 'Driver roster + session metadata'     },
  { id: 'lap_times',    label: 'LAP DATA ACQUIRED',     sublabel: 'All lap times + sector splits'        },
  { id: 'track_layout', label: 'TRACK GEOMETRY MAPPED', sublabel: '3D circuit coordinates loaded'        },
  { id: 'telemetry',    label: 'TELEMETRY STREAM LIVE', sublabel: 'Car data — speed, throttle, brake…'  },
  { id: 'complete',     label: 'ALL SYSTEMS GO',        sublabel: 'Dashboard ready'                      },
];

const STAGE_ORDER: UplinkStage[] = STAGES.map(s => s.id);

function stageIndex(stage: UplinkStage): number {
  const i = STAGE_ORDER.indexOf(stage);
  return i === -1 ? 0 : i;
}

// ── Glitchy ticker text ───────────────────────────────────────────────────────

function GlitchText({ text }: { text: string }) {
  const [display, setDisplay] = useState(text);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_—·';

  useEffect(() => {
    let iterations = 0;
    const total = text.length * 2;

    frameRef.current = setInterval(() => {
      setDisplay(
        text
          .split('')
          .map((char, i) => {
            if (char === ' ') return ' ';
            if (i < iterations / 2) return char;
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join(''),
      );
      iterations++;
      if (iterations > total) {
        setDisplay(text);
        if (frameRef.current) clearInterval(frameRef.current);
      }
    }, 28);

    return () => { if (frameRef.current) clearInterval(frameRef.current); };
  }, [text]);

  return <span>{display}</span>;
}

// ── Animated bar — one per driver as telemetry arrives ───────────────────────

function DriverBar({ code, delay }: { code: string; delay: number }) {
  return (
    <motion.div
      className={styles.driverBar}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <span className={styles.driverCode}>{code}</span>
      <motion.div
        className={styles.driverBarFill}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: delay + 0.15, duration: 0.6, ease: 'easeOut' }}
      />
      <span className={styles.driverOk}>✓</span>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DataUplinkProps {
  loadState: SessionLoadState;
  raceName: string;
  onComplete: () => void;
}

export function DataUplink({ loadState, raceName, onComplete }: DataUplinkProps) {
  const { stage, sessionMeta, loadedDrivers, error } = loadState;
  const warnings: string[] = (loadState as unknown as { warnings?: string[] }).warnings ?? [];
  const currentIdx = stageIndex(stage);
  const completeWithNoData = stage === 'complete' && !loadState.track && loadedDrivers.length === 0;

  // Auto-advance to dashboard once complete
  useEffect(() => {
    if (stage !== 'complete') return;
    const t = setTimeout(onComplete, 1200);
    return () => clearTimeout(t);
  }, [stage, onComplete]);

  return (
    <div className={styles.root}>
      {/* Background grid */}
      <div className={styles.grid} />

      {/* Top bar */}
      <div className={styles.topBar}>
        <span className={styles.topBarLabel}>F1 TELEMETRY — DATA UPLINK</span>
        <span className={styles.topBarRace}>{raceName.toUpperCase()}</span>
      </div>

      {/* Centre panel */}
      <div className={styles.panel}>

        {/* Stage list */}
        <div className={styles.stageList}>
          {STAGES.map((s, i) => {
            const done    = i < currentIdx;
            const active  = i === currentIdx;
            const pending = i > currentIdx;

            return (
              <motion.div
                key={s.id}
                className={[
                  styles.stageRow,
                  done    ? styles.stageDone    : '',
                  active  ? styles.stageActive  : '',
                  pending ? styles.stagePending : '',
                ].join(' ')}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: pending ? 0.25 : 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.35 }}
              >
                <span className={styles.stageTick}>
                  {done ? '✓' : active ? '▶' : '○'}
                </span>
                <div className={styles.stageText}>
                  <span className={styles.stageLabel}>
                    {active ? <GlitchText text={s.label} /> : s.label}
                  </span>
                  {(done || active) && (
                    <span className={styles.stageSub}>{s.sublabel}</span>
                  )}
                </div>
                {active && stage !== 'complete' && stage !== 'error' && (
                  <span className={styles.spinner} />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Driver telemetry sub-list */}
        <AnimatePresence>
          {loadedDrivers.length > 0 && (
            <motion.div
              className={styles.driverList}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className={styles.driverListLabel}>TELEMETRY RECEIVED</p>
              {loadedDrivers.map((code, i) => (
                <DriverBar key={code} code={code} delay={i * 0.15} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session info strip — appears once meta loads */}
        <AnimatePresence>
          {sessionMeta && (
            <motion.div
              className={styles.metaStrip}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span>{sessionMeta.circuit}</span>
              <span className={styles.metaDot}>·</span>
              <span>{sessionMeta.type}</span>
              <span className={styles.metaDot}>·</span>
              <span>{sessionMeta.drivers.length} DRIVERS</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Warning log — shows when Python service emits warnings */}
        <AnimatePresence>
          {warnings.length > 0 && (
            <motion.div
              className={styles.warningList}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {warnings.map((w: string, i: number) => (
                <p key={i} className={styles.warningMsg}>⚠ {w}</p>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.p
              className={styles.errorMsg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              ⚠ {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Complete but no data — show retry hint */}
        <AnimatePresence>
          {completeWithNoData && (
            <motion.div
              className={styles.noDataHint}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className={styles.noDataTitle}>TELEMETRY UNAVAILABLE</p>
              <p className={styles.noDataSub}>
                The Python service returned no track or telemetry data.<br />
                Check Render service logs for memory or cache errors.
              </p>
              <button className={styles.noDataBtn} onClick={onComplete}>
                ENTER DASHBOARD ANYWAY
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress bar at bottom */}
      <div className={styles.progressTrack}>
        <motion.div
          className={styles.progressFill}
          animate={{ scaleX: (currentIdx + 1) / STAGES.length }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ transformOrigin: 'left' }}
        />
      </div>

      {/* Scanlines */}
      <div className={styles.scanlines} />
    </div>
  );
}
