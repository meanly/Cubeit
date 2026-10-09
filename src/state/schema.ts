import { DEFAULT_APPEARANCE, type Appearance } from '../content/appearance';
import type { DeviceId } from '../content/devices';
import type { FindId } from '../content/finds';
import { DEFAULT_ITEMS, type RoomItems } from '../content/items';
import type { LightId, ThemeId } from '../content/themes';

/**
 * Everything needed to rebuild the user's world lives in one versioned
 * document (`SaveData`), plus a separate memories document. Bump
 * SAVE_VERSION and add a step to `migrations.ts` whenever the shape changes.
 */
export const SAVE_VERSION = 5;
export const SAVE_KEY = 'cubeit.save';

export interface Personality {
  /** 0..1 — likes investigating objects and spots. */
  curiosity: number;
  /** 0..1 — likes games, the ball, dancing. */
  playfulness: number;
  /** 0..1 — prefers quiet moments and long idles. */
  calm: number;
}

export interface CharacterProfile {
  name: string;
  bornAt: number;
  personality: Personality;
  appearance: Appearance;
  /** Last floor position, so the character resumes where it was. */
  lastPosition: { x: number; z: number };
}

export interface MoodState {
  /** -1 (down) .. 1 (joyful). */
  valence: number;
  /** 0 (sleepy) .. 1 (bouncy). */
  energy: number;
  updatedAt: number;
}

export interface RoomConfig {
  theme: ThemeId;
  light: LightId;
  items: RoomItems;
  lampOn: boolean;
  /** The device's color around the LCD ('auto' follows light / dark). */
  device: DeviceId;
}

export type GameId = 'starCatch' | 'peekaboo';

export type ActivityKind = 'nap' | 'play' | 'game' | 'item' | 'visit' | 'find' | 'dance' | 'greet';

export interface ActivityEntry {
  at: number;
  kind: ActivityKind;
  /** Phrased so it completes "Earlier I …", e.g. "took a nap on my cushion". */
  text: string;
}

export interface Progress {
  stars: number;
  bondXp: number;
  /** Ids of content bought with stars. */
  unlocked: string[];
  finds: FindId[];
  bestScores: Partial<Record<GameId, number>>;
  gamesPlayed: Partial<Record<GameId, number>>;
  /** Local calendar day (YYYY-MM-DD) of the last visit. */
  lastVisitDay: string | null;
  lastSeenAt: number;
  /** Total distinct days visited. Never resets — there are no streaks. */
  visitDays: number;
  milestones: string[];
  activities: ActivityEntry[];
  /** When the notifications sheet was last opened; newer activities show the unread dot. */
  notificationsSeenAt: number;
  stats: { taps: number; pets: number; chats: number; visits: number };
}

export type ReduceMotionPref = 'system' | 'on' | 'off';
/** Light / dark appearance; 'system' follows the phone. */
export type AppearancePref = 'system' | 'light' | 'dark';
export type ActivityLevel = 'calm' | 'normal' | 'lively';

/** Raw gravity vector (m/s²) captured as the neutral holding position. */
export interface Calibration {
  x: number;
  y: number;
  z: number;
}

export interface Settings {
  motionEnabled: boolean;
  /** Multiplier, 0.4 .. 2. */
  tiltSensitivity: number;
  /** null = auto-calibrate to the first reading each session. */
  calibration: Calibration | null;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  reduceMotion: ReduceMotionPref;
  appearance: AppearancePref;
  activityLevel: ActivityLevel;
  nightSleep: boolean;
  recordMilestones: boolean;
  onboarded: boolean;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  createdAt: number;
  character: CharacterProfile;
  mood: MoodState;
  room: RoomConfig;
  progress: Progress;
  settings: Settings;
}

export const DEFAULT_NAME = 'Pip';

export function randomPersonality(rng: () => number = Math.random): Personality {
  const trait = () => Math.round((0.35 + rng() * 0.4) * 100) / 100;
  return { curiosity: trait(), playfulness: trait(), calm: trait() };
}

export const DEFAULT_SETTINGS: Settings = {
  motionEnabled: true,
  tiltSensitivity: 1,
  calibration: null,
  soundEnabled: true,
  hapticsEnabled: true,
  reduceMotion: 'system',
  appearance: 'system',
  activityLevel: 'normal',
  nightSleep: true,
  recordMilestones: true,
  onboarded: false,
};

export function defaultRoom(): RoomConfig {
  return { theme: 'midnight', light: 'moonlight', items: { ...DEFAULT_ITEMS }, lampOn: true, device: 'auto' };
}

export function createDefaultSave(now: number = Date.now(), rng: () => number = Math.random): SaveData {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    character: {
      name: DEFAULT_NAME,
      bornAt: now,
      personality: randomPersonality(rng),
      appearance: { ...DEFAULT_APPEARANCE },
      lastPosition: { x: 0.5, z: 0.3 },
    },
    mood: { valence: 0.4, energy: 0.7, updatedAt: now },
    room: defaultRoom(),
    progress: {
      stars: 10,
      bondXp: 0,
      unlocked: [],
      finds: [],
      bestScores: {},
      gamesPlayed: {},
      lastVisitDay: null,
      lastSeenAt: now,
      notificationsSeenAt: now,
      visitDays: 0,
      milestones: [],
      activities: [],
      stats: { taps: 0, pets: 0, chats: 0, visits: 0 },
    },
    settings: { ...DEFAULT_SETTINGS },
  };
}
