'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Race } from '@/types';
import styles from './WelcomeScreen.module.css';

interface WelcomeScreenProps {
  onRaceSelect: (race: Race) => void;
}

export function WelcomeScreen({ onRaceSelect }: WelcomeScreenProps) {
  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/races')
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'success') setRaces(data.data);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <motion.div
      className={styles.screen}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.header
        className={styles.header}
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.45 }}
      >
        <div className={styles.redAccent} />
        <div className={styles.headerText}>
          <p className={styles.season}>2024 SEASON</p>
          <h1 className={styles.title}>SELECT RACE</h1>
        </div>
        <div className={styles.cyanRule} />
      </motion.header>

      {/* Race grid */}
      <div className={styles.grid}>
        {isLoading ? (
          <div className={styles.loadingRow}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        ) : (
          races.map((race, i) => (
            <motion.button
              key={race.id}
              className={styles.card}
              onClick={() => onRaceSelect(race)}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.04, duration: 0.38 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className={styles.round}>R{String(race.round).padStart(2, '0')}</span>
              <div className={styles.info}>
                <p className={styles.raceName}>{race.name}</p>
                <p className={styles.circuit}>{race.circuit.name}</p>
                <p className={styles.date}>{race.date}</p>
              </div>
              <span className={styles.arrow}>›</span>
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}
