'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Race, SessionType } from '@/types';
import { SessionLoadState } from '@/hooks/useSessionLoad';
import { useDashboardStore } from '@/store/dashboardStore';
import { TopBar } from './TopBar';
import { TelemetrySidebar } from './TelemetrySidebar';
import { TimelineScrubber } from './TimelineScrubber';
import styles from './Dashboard.module.css';

const Track3DScene = dynamic(
  () => import('@/components/Track3D/Scene').then(m => ({ default: m.Track3DScene })),
  { ssr: false }
);

interface DashboardProps {
  loadState: SessionLoadState;
  race: Race;
  session: SessionType;
  onBack: () => void;
  onLoadLap: (driver: string, lapNumber: number) => Promise<boolean>;
}

export function Dashboard({ loadState, race, session, onBack, onLoadLap }: DashboardProps) {
  const { setPrimaryDriver, reset } = useDashboardStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Auto-select first loaded driver as primary
  useEffect(() => {
    if (loadState.loadedDrivers.length > 0) {
      const current = useDashboardStore.getState().primaryDriver;
      if (!current || !loadState.loadedDrivers.includes(current)) {
        setPrimaryDriver(loadState.loadedDrivers[0]);
      }
    }
  }, [loadState.loadedDrivers, setPrimaryDriver]);

  useEffect(() => () => { reset(); }, [reset]);

  const primaryDriver = useDashboardStore(s => s.primaryDriver);
  const driverTel     = primaryDriver ? loadState.telemetry.get(primaryDriver) : null;
  const totalFrames   = driverTel?.points.speed.length ?? 0;
  const lapTimeMs     = driverTel?.lapTime ?? 90_000;

  return (
    <div className={styles.root}>
      <div className={styles.canvasLayer}>
        {loadState.track ? (
          <Track3DScene
            track={loadState.track}
            telemetry={loadState.telemetry}
          />
        ) : (
          <div className={styles.noTrack}>
            <p className={styles.noTrackText}>AWAITING TRACK DATA</p>
          </div>
        )}
      </div>

      <TopBar
        race={race}
        session={session}
        drivers={loadState.sessionMeta?.drivers ?? []}
        loadedDrivers={loadState.loadedDrivers}
        onBack={onBack}
      />

      <TelemetrySidebar
        telemetry={loadState.telemetry}
        drivers={loadState.sessionMeta?.drivers ?? []}
        laps={loadState.laps}
        onLoadLap={onLoadLap}
        mobileOpen={mobileSidebarOpen}
      />

      {/* Mobile sidebar toggle — only visible on < 768px via CSS */}
      <button
        className={`${styles.sidebarToggle} ${mobileSidebarOpen ? styles.sidebarToggleActive : ''}`}
        onClick={() => setMobileSidebarOpen(v => !v)}
        aria-label="Toggle telemetry panel"
      >
        {mobileSidebarOpen ? '✕' : '⌇'}
      </button>

      <footer className={styles.timelineBar}>
        {totalFrames > 0 && (
          <TimelineScrubber totalFrames={totalFrames} lapTimeMs={lapTimeMs} />
        )}
      </footer>
    </div>
  );
}
