import { create } from 'zustand';

import type { Appearance } from '../content/appearance';
import type { RoomConfig, GameId } from './schema';
import type { CharacterState, EmoteId } from '../character/states';

export type PanelId = 'none' | 'talk' | 'play' | 'customize' | 'planner' | 'nearby' | 'notifications' | 'friend';

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
  /** The sheet that was open before this one, so a Back button can return there. */
  previousPanel: PanelId;
  /** Opens a sheet ('none' closes). Resolves false when an editor's leave guard kept the current one open. */
  openPanel(panel: PanelId): Promise<boolean>;
  closePanel(): Promise<boolean>;
  /**
   * Set by an editor while it holds unsaved work; asked (e.g. "Discard your
   * changes?") before the open sheet is closed or swapped for another.
   */
  leaveGuard: (() => Promise<boolean>) | null;
  setLeaveGuard(guard: (() => Promise<boolean>) | null): void;

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

  /** Which Planner tab is showing (kept while the sheet is closed, so links can open a tab). */
  plannerTab: 'calendar' | 'journal' | 'habits' | 'chores';
  setPlannerTab(tab: UiStore['plannerTab']): void;
}

let toastId = 1;

export const useUi = create<UiStore>()((set, get) => {
  const go = async (panel: PanelId) => {
    const { panel: current, leaveGuard } = get();
    if (panel === current) return true;
    if (leaveGuard && !(await leaveGuard())) return false;
    // Something else may have moved the sheet while the question was open.
    if (get().panel !== current) return false;
    set({ panel, previousPanel: current, leaveGuard: null });
    return true;
  };
  return {
  panel: 'none',
  previousPanel: 'none',
  openPanel: go,
  closePanel: () => go('none'),
  leaveGuard: null,
  setLeaveGuard: (leaveGuard) => set({ leaveGuard }),

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

  plannerTab: 'calendar',
  setPlannerTab: (plannerTab) => set({ plannerTab }),
  };
});

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
