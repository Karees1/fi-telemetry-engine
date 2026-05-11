'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Race, SessionType } from '@/types';
import { DataUplink } from '@/components/DataUplink';
import { Dashboard } from '@/components/Dashboard';
import { useSessionLoad } from '@/hooks/useSessionLoad';

const CarIntro = dynamic(
  () => import('@/components/IntroAnimation/CarIntro'),
  { ssr: false }
);

const RacePicker = dynamic(
  () => import('@/components/RacePicker').then((m) => ({ default: m.RacePicker })),
  { ssr: false }
);

type AppPhase = 'intro' | 'race_picker' | 'uplink' | 'dashboard';

export default function App() {
  const [phase, setPhase] = useState<AppPhase>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('f1_intro_seen') === '1') {
      return 'race_picker';
    }
    return 'intro';
  });

  const [selectedRace,    setSelectedRace]    = useState<Race | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionType>('R');

  const { state: loadState, load, loadLap, reset } = useSessionLoad();

  const handleIntroComplete = () => {
    sessionStorage.setItem('f1_intro_seen', '1');
    setPhase('race_picker');
  };

  const handleRaceSelect = useCallback((race: Race, session: SessionType = 'R') => {
    setSelectedRace(race);
    setSelectedSession(session);
    setPhase('uplink');
    load(race, session);
  }, [load]);

  const handleUplinkComplete = () => setPhase('dashboard');

  const handleBackToRacePicker = () => {
    reset();
    setPhase('race_picker');
  };

  if (phase === 'intro') {
    return <CarIntro onComplete={handleIntroComplete} />;
  }

  if (phase === 'race_picker') {
    return <RacePicker onRaceSelect={handleRaceSelect} />;
  }

  if (phase === 'uplink') {
    return (
      <DataUplink
        loadState={loadState}
        raceName={selectedRace?.name ?? ''}
        onComplete={handleUplinkComplete}
      />
    );
  }

  return (
    <Dashboard
      loadState={loadState}
      race={selectedRace!}
      session={selectedSession}
      onBack={handleBackToRacePicker}
      onLoadLap={(driver, lapNumber) => loadLap(selectedRace!, selectedSession, driver, lapNumber)}
    />
  );
}
