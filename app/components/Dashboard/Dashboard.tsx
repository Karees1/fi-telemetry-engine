'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Race, SessionType } from '@/types';
import { SessionLoadState } from '@/hooks/useSessionLoad';
import { useDashboardStore } from '@/store/dashboardStore';
import { useRacePositions } from '@/hooks/useRacePositions';
import { TopBar } from './TopBar';
import { TelemetrySidebar } from './TelemetrySidebar';
import { TimelineScrubber } from './TimelineScrubber';
import styles from './Dashboard.module.css';

const Track3DScene = dynamic(
  () => import('@/components/Track3D/Scene').then(m => ({ default: m.Track3DScene })),
  { ssr: false }
);

const RaceMap = dynamic(
  () => import('@/components/RaceMap').then(m => ({ default: m.RaceMap })),
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
  const { setPrimaryDriver, reset, raceMode, setTotalRaceTime, setRaceTimeSeconds } = useDashboardStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { state: racePos, load: loadRace, reset: resetRace } = useRacePositions();

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

  // Start/stop race data loading when race mode toggles
  useEffect(() => {
    if (raceMode) {
      void loadRace(race, session);
    } else {
      resetRace();
      setRaceTimeSeconds(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceMode]);

  // Propagate totalTime into store once data arrives
  useEffect(() => {
    if (racePos.stage === 'complete' && racePos.data) {
      setTotalRaceTime(racePos.data.totalTime);
    }
  }, [racePos.stage, racePos.data, setTotalRaceTime]);

  const primaryDriver = useDashboardStore(s => s.primaryDriver);
  const driverTel     = primaryDriver ? loadState.telemetry.get(primaryDriver) : null;
  const totalFrames   = driverTel?.points.speed.length ?? 0;
  const lapTimeMs     = driverTel?.lapTime ?? 90_000;

  // ── Race replay mode: full-screen RaceMap, no other chrome ─────────────────
  if (raceMode && loadState.track) {
    return (
      <RaceMap
        track={loadState.track}
        racePositions={racePos.data ?? null}
        race={race}
        session={session}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.canvasLayer}>
        {loadState.track ? (
          <Track3DScene
            track={loadState.track}
            telemetry={loadState.telemetry}
            racePositions={racePos.data ?? undefined}
          />
        ) : loadState.stage === 'complete' ? (
          <div className={styles.noTrack}>
            <div className={styles.noTrackError}>
              <p className={styles.noTrackErrorTitle}>NO TELEMETRY DATA</p>
              <p className={styles.noTrackErrorSub}>
                The Python service completed but returned no track geometry.<br />
                Check Render service logs — likely a memory or cache error.
              </p>
              <button className={styles.noTrackRetry} onClick={onBack}>
                ← BACK TO RACE PICKER
              </button>
            </div>
          </div>
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
        {(totalFrames > 0 || raceMode) && (
          <TimelineScrubber
            totalFrames={totalFrames}
            lapTimeMs={lapTimeMs}
            raceMode={raceMode}
            totalRaceTime={racePos.data?.totalTime ?? 0}
          />
        )}
      </footer>

      {/* Race data loading overlay */}
      {raceMode && racePos.stage === 'loading' && (
        <div className={styles.raceLoadOverlay}>
          LOADING RACE DATA — {racePos.loadedCount} / 20 DRIVERS
        </div>
      )}
    </div>
  );
}
