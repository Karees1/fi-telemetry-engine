'use client';

import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { motion } from 'framer-motion';
import { Race, SessionType } from '@/types';
import { useRaces } from '@/hooks/useRaces';
import { Globe } from './Globe';
import { RaceCard } from './RaceCard';
import styles from './RacePicker.module.css';

// 2023/2024 use static data. Older/newer seasons require the Python FastF1 service.
const AVAILABLE_YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

interface RacePickerProps {
  onRaceSelect: (race: Race, session: SessionType) => void;
}

export function RacePicker({ onRaceSelect }: RacePickerProps) {
  const [year, setYear]               = useState(2024);
  const { races, isLoading }          = useRaces(year);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [filterTerm, setFilterTerm]   = useState('');

  const handleYearChange = (y: number) => {
    setYear(y);
    setSelectedRace(null); // clear selection when season changes
  };

  const handleNodeSelect = (race: Race) => {
    setSelectedRace((prev) => (prev?.id === race.id ? null : race));
  };

  return (
    <div className={styles.root}>
      {/* ── Header ── */}
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.42 }}
      >
        <div className={styles.redBar} />
        <div>
          <p className={styles.seasonLabel}>{year} SEASON</p>
          <h1 className={styles.pageTitle}>SELECT RACE</h1>
        </div>

        {/* Year selector */}
        <div className={styles.yearSelector}>
          {AVAILABLE_YEARS.map((y) => (
            <button
              key={y}
              className={`${styles.yearBtn} ${y === year ? styles.yearBtnActive : ''}`}
              onClick={() => handleYearChange(y)}
            >
              {y}
            </button>
          ))}
        </div>

        <div className={styles.rule} />

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="SEARCH CIRCUIT..."
            value={filterTerm}
            onChange={(e) => setFilterTerm(e.target.value)}
            spellCheck={false}
          />
        </div>
      </motion.header>

      {/* ── 3D Canvas ── */}
      <div className={styles.canvasWrap}>
        {isLoading ? (
          <div className={styles.loader}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        ) : (
          <Canvas
            camera={{ position: [0, 1.2, 8.5], fov: 48 }}
            dpr={[1, 2]}
            style={{ background: 'transparent' }}
          >
            <Suspense fallback={null}>
              <Globe
                races={races}
                selectedRace={selectedRace}
                filterTerm={filterTerm}
                onSelect={handleNodeSelect}
              />
            </Suspense>
          </Canvas>
        )}

        {!isLoading && (
          <motion.p
            className={styles.raceCount}
            key={year}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {races.length} GRANDS PRIX · {year}
          </motion.p>
        )}
      </div>

      {/* ── Race detail card ── */}
      <RaceCard
        race={selectedRace}
        onConfirm={onRaceSelect}
        onDismiss={() => setSelectedRace(null)}
      />
    </div>
  );
}
