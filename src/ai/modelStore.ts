import { create } from 'zustand';

/**
 * Where the on-device model is in its life cycle. Shown in Settings → Talking
 * and in the Talk header, so the user always knows whether replies come from
 * the model.
 */
export type ModelStatus =
  | { state: 'checking' }
  /** This build can't run the model (Expo Go, web, or the native runtime is missing). */
  | { state: 'unsupported'; reason: string }
  | { state: 'absent' }
  | { state: 'downloading'; received: number; total: number }
  | { state: 'verifying'; progress: number }
  /** On disk and verified, not loaded into memory right now. */
  | { state: 'installed' }
  | { state: 'loading'; progress: number }
  | { state: 'ready' }
  | { state: 'error'; message: string; canRetry: boolean };

interface ModelStore {
  status: ModelStatus;
  /** Whether the model is currently generating. */
  busy: boolean;
  /** Last measured generation speed, for Settings. */
  tokensPerSecond: number | null;
  setStatus(status: ModelStatus): void;
  setBusy(busy: boolean): void;
  setSpeed(tps: number | null): void;
}

export const useModel = create<ModelStore>()((set) => ({
  status: { state: 'checking' },
  busy: false,
  tokensPerSecond: null,
  setStatus: (status) => set({ status }),
  setBusy: (busy) => set({ busy }),
  setSpeed: (tokensPerSecond) => set({ tokensPerSecond }),
}));

/** True when replies can come from the model (it's on disk; it loads on demand). */
export const modelUsable = (s: ModelStatus) => s.state === 'installed' || s.state === 'ready' || s.state === 'loading';
