import { create } from 'zustand';

export type SensorSource = 'gravity' | 'keyboard-sim';

interface SensorStatus {
  /** null = not checked yet (sensor not mounted). */
  available: boolean | null;
  source: SensorSource | null;
  setStatus(available: boolean, source: SensorSource): void;
}

export const useSensorStatus = create<SensorStatus>()((set) => ({
  available: null,
  source: null,
  setStatus: (available, source) => set({ available, source }),
}));
