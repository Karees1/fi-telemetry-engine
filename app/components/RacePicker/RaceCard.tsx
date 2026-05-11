'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Race, SessionType } from '@/types';
import styles from './RacePicker.module.css';

const SESSION_LABELS: Record<SessionType, string> = {
  FP1: 'FP 1',
  FP2: 'FP 2',
  FP3: 'FP 3',
  Q:   'QUALI',
  SQ:  'SPRINT QUALI',
  S:   'SPRINT',
  R:   'RACE',
};

interface RaceCardProps {
  race: Race | null;
  onConfirm: (race: Race, session: SessionType) => void;
  onDismiss: () => void;
}

export function RaceCard({ race, onConfirm, onDismiss }: RaceCardProps) {
  const [selectedSession, setSelectedSession] = useState<SessionType>('R');

  return (
    <AnimatePresence>
      {race && (
        <motion.div
          className={styles.raceCard}
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '110%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          <button className={styles.dismissBtn} onClick={onDismiss} aria-label="Close">
            ✕
          </button>

          <div className={styles.cardInner}>
            <div className={styles.cardIdentity}>
              <p className={styles.cardRound}>
                ROUND {String(race.round).padStart(2, '0')} · {race.date.slice(0, 7)}
              </p>
              <h2 className={styles.cardName}>{race.name}</h2>
              <p className={styles.cardCircuit}>{race.circuit.name}</p>
              <p className={styles.cardLocation}>{race.circuit.location}</p>
            </div>

            <div className={styles.cardDivider} />

            <div className={styles.cardActions}>
              <p className={styles.sessionLabel}>SELECT SESSION</p>
              <div className={styles.sessionPills}>
                {race.sessions.map((s) => (
                  <button
                    key={s}
                    className={`${styles.sessionPill} ${s === selectedSession ? styles.sessionPillActive : ''}`}
                    onClick={() => setSelectedSession(s)}
                  >
                    {SESSION_LABELS[s]}
                  </button>
                ))}
              </div>
              <button
                className={styles.confirmBtn}
                onClick={() => onConfirm(race, selectedSession)}
              >
                ENTER RACE DATA →
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
