import { create } from 'zustand';

import type { Appearance } from '../content/appearance';
import type { RoomConfig, GameId } from './schema';
import type { CharacterState, EmoteId } from '../character/states';

export type PanelId = 'none' | 'talk' | 'play' | 'customize' | 'memories' | 'nearby';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'reward' | 'warning';
  /** Optional single action (e.g. "Save" on a visit memory prompt). */
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}

export interface CustomizeDraft {
  room: RoomConfig;
  appearance: Appearance;
}

export interface VisitorInfo {
  name: string;
  appearance: Appearance;
  simulated: true;
}

interface UiStore {
  panel: PanelId;
  openPanel(panel: PanelId): void;
  closePanel(): void;

  settingsOpen: boolean;
  setSettingsOpen(open: boolean): void;

  toasts: Toast[];
  toast(toast: Omit<Toast, 'id'>): number;
  dismissToast(id: number): void;

  activeGame: GameId | null;
  setActiveGame(game: GameId | null): void;

  visitor: VisitorInfo | null;
  setVisitor(visitor: VisitorInfo | null): void;

  /** Customization preview; while set, the room renders this instead of the saved config. */
  draft: CustomizeDraft | null;
  setDraft(draft: CustomizeDraft | null): void;

  storageProblem: string | null;
  setStorageProblem(problem: string | null): void;
}

let toastId = 1;

export const useUi = create<UiStore>()((set) => ({
  panel: 'none',
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: 'none' }),

  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  toasts: [],
  toast: (toast) => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id }] }));
    return id;
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  activeGame: null,
  setActiveGame: (activeGame) => set({ activeGame }),

  visitor: null,
  setVisitor: (visitor) => set({ visitor }),

  draft: null,
  setDraft: (draft) => set({ draft }),

  storageProblem: null,
  setStorageProblem: (storageProblem) => set({ storageProblem }),
}));

/** What the character is doing right now — drives the face and overlays. */
interface CharacterViewStore {
  state: CharacterState;
  emote: { id: EmoteId; key: number } | null;
  speech: { text: string; key: number } | null;
  setState(state: CharacterState): void;
  setEmote(id: EmoteId | null): void;
  setSpeech(text: string | null): void;
}

let viewKey = 1;

export const useCharacterView = create<CharacterViewStore>()((set) => ({
  state: 'idle',
  emote: null,
  speech: null,
  setState: (state) => set((s) => (s.state === state ? s : { state })),
  setEmote: (id) => set({ emote: id ? { id, key: viewKey++ } : null }),
  setSpeech: (text) => set({ speech: text ? { text, key: viewKey++ } : null }),
}));
