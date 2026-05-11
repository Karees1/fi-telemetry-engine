'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DriverMeta, DriverTelemetry, LapRow } from '@/hooks/useSessionLoad';
import { useDashboardStore } from '@/store/dashboardStore';
import { TelemetryChart } from './TelemetryChart';
import styles from './TelemetrySidebar.module.css';

// ── helpers ───────────────────────────────────────────────────────────────────

function msToLapTime(ms: number | null): string {
  if (!ms) return '—';
  const s   = ms / 1000;
  const m   = Math.floor(s / 60);
  const rem = (s - m * 60).toFixed(3);
  return `${m}:${rem.padStart(6, '0')}`;
}

const COMPOUND_COLORS: Record<string, string> = {
  SOFT:    '#EF1E24',
  MEDIUM:  '#FFB703',
  HARD:    '#FFFFFF',
  INTER:   '#06FFA5',
  WET:     '#00D9FF',
};
function compoundColor(c: string) {
  return COMPOUND_COLORS[c?.toUpperCase()] ?? '#6B7280';
}

// ── LapPickerPanel ────────────────────────────────────────────────────────────

interface LapPickerProps {
  laps: LapRow[];
  driver: string;
  activeLapNumber: number;
  onSelect: (lapNumber: number) => void;
  loading: boolean;
}

function LapPickerPanel({ laps, driver, activeLapNumber, onSelect, loading }: LapPickerProps) {
  const driverLaps = laps
    .filter(l => l.driver === driver && l.lapTime !== null)
    .sort((a, b) => a.lapNumber - b.lapNumber);

  const fastestTime = Math.min(...driverLaps.map(l => l.lapTime!));

  return (
    <motion.div
      className={styles.lapPanel}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
    >
      <p className={styles.lapPanelHeader}>SELECT LAP</p>
      <div className={styles.lapList}>
        {driverLaps.map(lap => {
          const isFastest = lap.lapTime === fastestTime;
          const isActive  = lap.lapNumber === activeLapNumber;
          return (
            <button
              key={lap.lapNumber}
              className={`${styles.lapRow} ${isActive ? styles.lapRowActive : ''}`}
              onClick={() => !isActive && !loading && onSelect(lap.lapNumber)}
              disabled={loading}
            >
              <span className={styles.lapNum}>{String(lap.lapNumber).padStart(2, '0')}</span>
              <span className={styles.lapTimeCell}>{msToLapTime(lap.lapTime)}</span>
              <span
                className={styles.compound}
                style={{ background: compoundColor(lap.compound) }}
                title={lap.compound}
              />
              {isFastest && <span className={styles.fastestFlag}>◆</span>}
              {lap.isPersonalBest && !isFastest && <span className={styles.pbFlag}>PB</span>}
            </button>
          );
        })}
        {driverLaps.length === 0 && (
          <p className={styles.noLaps}>No valid laps</p>
        )}
      </div>
      {loading && <p className={styles.lapLoading}>LOADING…</p>}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface TelemetrySidebarProps {
  telemetry: Map<string, DriverTelemetry>;
  drivers: DriverMeta[];
  laps: LapRow[];
  onLoadLap: (driver: string, lapNumber: number) => Promise<boolean>;
}

export function TelemetrySidebar({ telemetry, drivers, laps, onLoadLap }: TelemetrySidebarProps) {
  const primaryDriver = useDashboardStore(s => s.primaryDriver);
  const [lapPickerOpen, setLapPickerOpen] = useState(false);
  const [lapLoading,    setLapLoading]    = useState(false);

  const driverTel = primaryDriver ? telemetry.get(primaryDriver) : null;
  const { speed: speedArr = [], gear: gearArr = [], throttle: thrArr = [], brake: brakeArr = [] } =
    driverTel?.points ?? {};

  const speedRef    = useRef<HTMLSpanElement>(null);
  const gearRef     = useRef<HTMLSpanElement>(null);
  const throttleRef = useRef<HTMLDivElement>(null);
  const brakeRef    = useRef<HTMLDivElement>(null);
  const drsRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!driverTel) return;
    const { speed, gear, throttle, brake, drs } = driverTel.points;
    const unsub = useDashboardStore.subscribe(
      s => s.frameIndex,
      (fi) => {
        const i = Math.floor(fi);
        if (speedRef.current)    speedRef.current.textContent    = String(Math.round(speed[i] ?? 0));
        if (gearRef.current)     gearRef.current.textContent     = `G${gear[i] ?? 0}`;
        if (throttleRef.current) throttleRef.current.style.width = `${throttle[i] ?? 0}%`;
        if (brakeRef.current)    brakeRef.current.style.width    = `${(brake[i] ?? 0) * 100}%`;
        if (drsRef.current) {
          drsRef.current.classList.toggle(styles.drsActive, (drs[i] ?? 0) >= 10);
        }
      }
    );
    return unsub;
  }, [driverTel]);

  // Close lap picker when driver switches
  useEffect(() => { setLapPickerOpen(false); }, [primaryDriver]);

  const handleSelectLap = useCallback(async (lapNumber: number) => {
    if (!primaryDriver) return;
    setLapLoading(true);
    await onLoadLap(primaryDriver, lapNumber);
    setLapLoading(false);
    setLapPickerOpen(false);
    // Reset playback to start of new lap
    useDashboardStore.getState().setFrameIndex(0);
    useDashboardStore.getState().setIsPlaying(false);
  }, [primaryDriver, onLoadLap]);

  if (!driverTel) {
    return (
      <motion.aside className={styles.root} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.4 }}>
        <div className={styles.emptyState}><p className={styles.emptyText}>No driver selected</p></div>
      </motion.aside>
    );
  }

  return (
    <motion.aside
      className={styles.root}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
    >
      {/* Driver badge */}
      <div className={styles.driverBadge}>
        <div className={styles.driverDot} />
        <span className={styles.driverCode}>{driverTel.driver}</span>
        <span className={styles.lapTime}>{msToLapTime(driverTel.lapTime)}</span>
        <button
          className={`${styles.lapLabel} ${lapPickerOpen ? styles.lapLabelOpen : ''}`}
          onClick={() => setLapPickerOpen(v => !v)}
          title="Pick a different lap"
        >
          LAP {driverTel.lapNumber} ▾
        </button>
      </div>

      {/* Lap picker */}
      <AnimatePresence>
        {lapPickerOpen && primaryDriver && (
          <LapPickerPanel
            laps={laps}
            driver={primaryDriver}
            activeLapNumber={driverTel.lapNumber}
            onSelect={handleSelectLap}
            loading={lapLoading}
          />
        )}
      </AnimatePresence>

      {/* Large live readout */}
      <div className={styles.liveReadout}>
        <div className={styles.speedBlock}>
          <span ref={speedRef} className={styles.speedValue}>0</span>
          <span className={styles.speedUnit}>km/h</span>
        </div>
        <span ref={gearRef} className={styles.gearValue}>G0</span>
      </div>

      {/* Throttle / Brake bars + DRS */}
      <div className={styles.liveBars}>
        <div className={styles.liveBar}>
          <span className={styles.liveBarLabel}>THR</span>
          <div className={styles.liveBarTrack}>
            <div ref={throttleRef} className={styles.liveBarFillGreen} style={{ width: '0%' }} />
          </div>
        </div>
        <div className={styles.liveBar}>
          <span className={styles.liveBarLabel}>BRK</span>
          <div className={styles.liveBarTrack}>
            <div ref={brakeRef} className={styles.liveBarFillRed} style={{ width: '0%' }} />
          </div>
        </div>
        <div ref={drsRef} className={styles.drsIndicator}>DRS</div>
      </div>

      <div className={styles.separator} />

      {/* Charts */}
      <div className={styles.charts}>
        <TelemetryChart label="SPEED"    values={speedArr}              color="#00D9FF" fillColor="#00D9FF" min={0} max={380} unit="km/h" height={48} />
        <TelemetryChart label="THROTTLE" values={thrArr}                color="#06FFA5" fillColor="#06FFA5" min={0} max={100} unit="%" height={32} />
        <TelemetryChart label="BRAKE"    values={brakeArr.map(v=>v*100)} color="#EF1E24" fillColor="#EF1E24" min={0} max={100} unit="%" height={32} />
        <TelemetryChart label="GEAR"     values={gearArr}               color="#FFB703" min={0} max={8} height={28} stepped />
      </div>
    </motion.aside>
  );
}
