import { create } from 'zustand';

import { driftMood, nudgeMood } from '../character/mood';
import type { Appearance } from '../content/appearance';
import type { FindId } from '../content/finds';
import {
  bondLevel,
  dailyCheck,
  dayKey,
  starsForGame,
  XP_RULES,
  type DailyCheck,
  type XpReason,
} from '../progression/progression';
import {
  createDefaultSave,
  defaultRoom,
  type ActivityKind,
  type GameId,
  type Personality,
  type RoomConfig,
  type SaveData,
  type Settings,
} from './schema';

export interface GameStore extends SaveData {
  hydrate(data: SaveData): void;
  setSettings(patch: Partial<Settings>): void;
  renameCharacter(name: string): void;
  setLastPosition(x: number, z: number): void;
  applyCustomization(room: RoomConfig, appearance: Appearance): void;
  /** Spend stars to unlock content. Returns false if unaffordable or already owned. */
  purchase(id: string, cost: number): boolean;
  setLamp(on: boolean): void;
  addStars(amount: number): void;
  /** Returns the new level if this award crossed a level boundary. */
  awardXp(reason: XpReason, now?: number): { gained: number; leveledUpTo: number | null };
  recordGame(game: GameId, score: number): { newBest: boolean; previousBest: number; starsEarned: number };
  logActivity(kind: ActivityKind, text: string, now?: number): void;
  nudgeMood(dValence: number, dEnergy: number, now?: number): void;
  settleMood(now?: number): void;
  /** Personality drifts slowly with what you do together. */
  nudgePersonality(trait: keyof Personality, amount: number): void;
  addFind(id: FindId): void;
  /** Returns true if the milestone is new. */
  reachMilestone(id: string): boolean;
  /** Daily bookkeeping on app open/resume. */
  registerVisit(now?: number): DailyCheck;
  bumpStat(key: keyof SaveData['progress']['stats']): void;
  touchLastSeen(now?: number): void;
  resetRoom(): void;
  resetAll(): void;
}

/** Session-only XP cooldown clock (resets on launch, which is fine). */
const lastXpAt: Partial<Record<XpReason, number>> = {};

export const pickSave = (s: GameStore): SaveData => ({
  version: s.version,
  createdAt: s.createdAt,
  character: s.character,
  mood: s.mood,
  room: s.room,
  progress: s.progress,
  settings: s.settings,
});

export const useGame = create<GameStore>()((set, get) => ({
  ...createDefaultSave(),

  hydrate: (data) => set({ ...data }),

  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  renameCharacter: (name) => {
    const clean = name.trim().slice(0, 24);
    if (!clean) return;
    set((s) => ({ character: { ...s.character, name: clean } }));
  },

  setLastPosition: (x, z) => set((s) => ({ character: { ...s.character, lastPosition: { x, z } } })),

  applyCustomization: (room, appearance) =>
    set((s) => ({ room: { ...room }, character: { ...s.character, appearance: { ...appearance } } })),

  purchase: (id, cost) => {
    const { progress } = get();
    if (progress.unlocked.includes(id) || progress.stars < cost) return false;
    set({ progress: { ...progress, stars: progress.stars - cost, unlocked: [...progress.unlocked, id] } });
    return true;
  },

  setLamp: (on) => set((s) => ({ room: { ...s.room, lampOn: on } })),

  addStars: (amount) =>
    set((s) => ({ progress: { ...s.progress, stars: Math.max(0, s.progress.stars + Math.round(amount)) } })),

  awardXp: (reason, now = Date.now()) => {
    const rule = XP_RULES[reason];
    const last = lastXpAt[reason] ?? 0;
    if (rule.cooldownMs > 0 && now - last < rule.cooldownMs) return { gained: 0, leveledUpTo: null };
    lastXpAt[reason] = now;
    const { progress } = get();
    const before = bondLevel(progress.bondXp);
    const bondXp = progress.bondXp + rule.xp;
    const after = bondLevel(bondXp);
    set({ progress: { ...progress, bondXp } });
    return { gained: rule.xp, leveledUpTo: after > before ? after : null };
  },

  recordGame: (game, score) => {
    const { progress } = get();
    const previousBest = progress.bestScores[game] ?? 0;
    const newBest = score > previousBest;
    const starsEarned = starsForGame(game, score, newBest);
    set({
      progress: {
        ...progress,
        stars: progress.stars + starsEarned,
        bestScores: { ...progress.bestScores, [game]: Math.max(previousBest, score) },
        gamesPlayed: { ...progress.gamesPlayed, [game]: (progress.gamesPlayed[game] ?? 0) + 1 },
      },
    });
    return { newBest, previousBest, starsEarned };
  },

  logActivity: (kind, text, now = Date.now()) =>
    set((s) => ({
      progress: { ...s.progress, activities: [...s.progress.activities, { at: now, kind, text }].slice(-20) },
    })),

  nudgeMood: (dValence, dEnergy, now = Date.now()) =>
    set((s) => ({ mood: nudgeMood(s.mood, dValence, dEnergy, now) })),

  settleMood: (now = Date.now()) =>
    set((s) => ({ mood: driftMood(s.mood, now, s.character.personality, new Date(now).getHours()) })),

  nudgePersonality: (trait, amount) =>
    set((s) => {
      const value = Math.min(0.95, Math.max(0.05, s.character.personality[trait] + amount));
      return { character: { ...s.character, personality: { ...s.character.personality, [trait]: value } } };
    }),

  addFind: (id) =>
    set((s) => (s.progress.finds.includes(id) ? s : { progress: { ...s.progress, finds: [...s.progress.finds, id] } })),

  reachMilestone: (id) => {
    const { progress } = get();
    if (progress.milestones.includes(id)) return false;
    set({ progress: { ...progress, milestones: [...progress.milestones, id] } });
    return true;
  },

  registerVisit: (now = Date.now()) => {
    const { progress } = get();
    const check = dailyCheck(progress.lastVisitDay, progress.finds, now);
    if (check.isNewDay) {
      set({
        progress: {
          ...progress,
          lastVisitDay: dayKey(now),
          visitDays: progress.visitDays + 1,
          lastSeenAt: now,
        },
      });
    }
    return check;
  },

  bumpStat: (key) =>
    set((s) => ({ progress: { ...s.progress, stats: { ...s.progress.stats, [key]: s.progress.stats[key] + 1 } } })),

  touchLastSeen: (now = Date.now()) => set((s) => ({ progress: { ...s.progress, lastSeenAt: now } })),

  resetRoom: () => set({ room: defaultRoom() }),

  resetAll: () => {
    const fresh = createDefaultSave();
    // Keep the device-level preferences that aren't about the character.
    const { settings } = get();
    set({
      ...fresh,
      settings: {
        ...fresh.settings,
        motionEnabled: settings.motionEnabled,
        tiltSensitivity: settings.tiltSensitivity,
        calibration: settings.calibration,
        soundEnabled: settings.soundEnabled,
        hapticsEnabled: settings.hapticsEnabled,
        reduceMotion: settings.reduceMotion,
      },
    });
  },
}));

export const selectBondLevel = (s: GameStore) => bondLevel(s.progress.bondXp);
