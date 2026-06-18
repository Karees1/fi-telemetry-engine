import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type CameraMode = 'orbit' | 'follow' | 'top-down' | 'cinematic';

interface DashboardStore {
  frameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  selectedDrivers: string[];
  primaryDriver: string | null;
  cameraMode: CameraMode;
  showHeatmap: boolean;

  // ── Race replay mode ──────────────────────────────────────────────────────
  raceMode: boolean;
  raceTimeSeconds: number;
  totalRaceTime: number;

  setFrameIndex: (i: number) => void;
  setIsPlaying: (v: boolean) => void;
  setPlaybackSpeed: (v: number) => void;
  setSelectedDrivers: (drivers: string[]) => void;
  setPrimaryDriver: (code: string | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setShowHeatmap: (v: boolean) => void;
  setRaceMode: (v: boolean) => void;
  setRaceTimeSeconds: (v: number) => void;
  setTotalRaceTime: (v: number) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  frameIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  selectedDrivers: [] as string[],
  primaryDriver: null as string | null,
  cameraMode: 'orbit' as CameraMode,
  showHeatmap: false,
  raceMode: false,
  raceTimeSeconds: 0,
  totalRaceTime: 0,
};

export const useDashboardStore = create<DashboardStore>()(
  subscribeWithSelector((set) => ({
    ...INITIAL_STATE,

    setFrameIndex:        (frameIndex)        => set({ frameIndex }),
    setIsPlaying:         (isPlaying)         => set({ isPlaying }),
    setPlaybackSpeed:     (playbackSpeed)      => set({ playbackSpeed }),
    setSelectedDrivers:   (selectedDrivers)   => set({ selectedDrivers }),
    setPrimaryDriver:     (primaryDriver)      => set({ primaryDriver }),
    setCameraMode:        (cameraMode)        => set({ cameraMode }),
    setShowHeatmap:       (showHeatmap)       => set({ showHeatmap }),
    setRaceMode:          (raceMode)          => set({ raceMode }),
    setRaceTimeSeconds:   (raceTimeSeconds)   => set({ raceTimeSeconds }),
    setTotalRaceTime:     (totalRaceTime)     => set({ totalRaceTime }),

    reset: () => set({ ...INITIAL_STATE }),
  }))
);
