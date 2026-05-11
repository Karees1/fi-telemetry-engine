'use client';

import { motion } from 'framer-motion';
import { Race, SessionType } from '@/types';
import { DriverMeta } from '@/hooks/useSessionLoad';
import { useDashboardStore, CameraMode } from '@/store/dashboardStore';
import { DRIVER_COLORS } from '@/components/Track3D/CarModel/CarModel';
import styles from './TopBar.module.css';

const SESSION_LABELS: Record<SessionType, string> = {
  R: 'RACE', Q: 'QUALIFYING', FP1: 'FP1', FP2: 'FP2', FP3: 'FP3', SQ: 'SPRINT QUAL', S: 'SPRINT',
};

const CAMERA_MODES: { mode: CameraMode; label: string }[] = [
  { mode: 'orbit',     label: 'ORBIT'    },
  { mode: 'follow',    label: 'FOLLOW'   },
  { mode: 'top-down',  label: 'TOP DOWN' },
  { mode: 'cinematic', label: 'CINEMATIC' },
];

interface TopBarProps {
  race: Race;
  session: SessionType;
  drivers: DriverMeta[];
  loadedDrivers: string[];
  onBack: () => void;
}

export function TopBar({ race, session, drivers, loadedDrivers, onBack }: TopBarProps) {
  // Show all loaded drivers; preserve insertion order so color index stays stable
  const availableDrivers = loadedDrivers
    .map((code, idx) => ({ meta: drivers.find(d => d.code === code), code, idx }))
    .filter(d => d.meta);

  const primaryDriver    = useDashboardStore(s => s.primaryDriver);
  const setPrimaryDriver = useDashboardStore(s => s.setPrimaryDriver);
  const cameraMode       = useDashboardStore(s => s.cameraMode);
  const setCameraMode    = useDashboardStore(s => s.setCameraMode);
  const showHeatmap      = useDashboardStore(s => s.showHeatmap);
  const setShowHeatmap   = useDashboardStore(s => s.setShowHeatmap);

  return (
    <motion.header
      className={styles.root}
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Back */}
      <button className={styles.backBtn} onClick={onBack}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        BACK
      </button>

      <div className={styles.divider} />

      {/* Race info */}
      <div className={styles.raceInfo}>
        <span className={styles.sessionTag}>{SESSION_LABELS[session] ?? session}</span>
        <span className={styles.raceName}>{race.name}</span>
        <span className={styles.raceYear}>{race.year}</span>
      </div>

      <div className={styles.spacer} />

      {/* Driver pills — clicking sets sidebar focus; all cars are always on track */}
      {availableDrivers.length > 0 && (
        <div className={styles.driverGroup}>
          <span className={styles.groupLabel}>DRIVER</span>
          <div className={styles.driverPills}>
            {availableDrivers.map(({ code, idx }) => {
              const dotColor = DRIVER_COLORS[idx] ?? '#00D9FF';
              const isActive = code === primaryDriver;
              return (
                <button
                  key={code}
                  className={`${styles.driverPill} ${isActive ? styles.driverPillActive : ''}`}
                  style={isActive ? { borderColor: dotColor, color: dotColor, boxShadow: `0 0 10px ${dotColor}44` } : {}}
                  onClick={() => setPrimaryDriver(code)}
                >
                  <span
                    className={styles.driverDot}
                    style={{ background: dotColor }}
                  />
                  {code}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={styles.divider} />

      {/* Camera mode */}
      <div className={styles.cameraGroup}>
        <span className={styles.groupLabel}>CAM</span>
        <div className={styles.camPills}>
          {CAMERA_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              className={`${styles.camPill} ${mode === cameraMode ? styles.camPillActive : ''}`}
              onClick={() => setCameraMode(mode)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.divider} />

      {/* Heatmap toggle */}
      <button
        className={`${styles.toggleBtn} ${showHeatmap ? styles.toggleBtnActive : ''}`}
        onClick={() => setShowHeatmap(!showHeatmap)}
      >
        {showHeatmap ? 'SPEED MAP' : 'TRACK LINE'}
      </button>
    </motion.header>
  );
}
