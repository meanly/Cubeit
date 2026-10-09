import { ACCESSORIES, BODY_COLORS, DEFAULT_APPEARANCE } from '../content/appearance';
import { DEVICE_IDS } from '../content/devices';
import { FINDS, type FindId } from '../content/finds';
import { DEFAULT_ITEMS, ITEMS, SLOTS, type ItemId, type RoomItems } from '../content/items';
import { LIGHTS, THEMES } from '../content/themes';
import {
  createDefaultSave,
  SAVE_VERSION,
  type ActivityEntry,
  type ActivityKind,
  type Calibration,
  type SaveData,
} from './schema';
import { bool, int, isObj, num, numRecord, obj, oneOf, str, strArray, unique, type Obj } from './validate';

/**
 * Version-to-version upgrade steps. `MIGRATIONS[n]` turns a version-n document
 * into version n+1. Version 1 is the first shipped shape, so the table is empty;
 * add steps here — never edit old ones.
 */
const MIGRATIONS: Record<number, (doc: Obj) => Obj> = {
  // v2: the round rug is no longer laid out by default. Saves still on the old
  // default lose it (it stays unlocked in Customize); a chosen striped rug stays.
  1: (doc) => {
    const room = obj(doc.room);
    const items = obj(room.items);
    if (items.rug === 'roundRug') return { ...doc, room: { ...room, items: { ...items, rug: null } } };
    return doc;
  },
  // v3: notifications remember when they were last read. Everything already
  // logged counts as read, so an old save doesn't open with a stale unread dot.
  2: (doc) => {
    const progress = obj(doc.progress);
    const activities = Array.isArray(progress.activities) ? progress.activities.filter(isObj) : [];
    const latest = activities.reduce((m, a) => Math.max(m, num(a.at, 0, 0)), 0);
    return { ...doc, progress: { ...progress, notificationsSeenAt: latest } };
  },
  // v4: light / dark appearance, following the phone by default.
  3: (doc) => {
    const settings = obj(doc.settings);
    return { ...doc, settings: { ...settings, appearance: 'system' } };
  },
  // v5: a choice of device color; 'auto' keeps the look it had (light / dark).
  4: (doc) => {
    const room = obj(doc.room);
    return { ...doc, room: { ...room, device: 'auto' } };
  },
};

export interface MigrationResult {
  data: SaveData;
  fromVersion: number;
}

/** Upgrade any stored save (or garbage) into a valid, current SaveData. */
export function migrateSave(raw: unknown, now: number = Date.now()): MigrationResult {
  let doc = obj(raw);
  const fromVersion = int(doc.version, 1, 0);
  let version = fromVersion;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (step) doc = step(doc);
    version += 1;
  }
  // A newer save (e.g. after a downgrade) is read best-effort: known fields are kept.
  return { data: sanitizeSave(doc, now), fromVersion };
}

const ACTIVITY_KINDS: readonly ActivityKind[] = ['nap', 'play', 'game', 'item', 'visit', 'find', 'dance', 'greet'];
const ITEM_IDS = ITEMS.map((i) => i.id);
const FIND_IDS = FINDS.map((f) => f.id);

function sanitizeItems(v: unknown): RoomItems {
  const source = obj(v);
  const items = { ...DEFAULT_ITEMS };
  for (const slot of SLOTS) {
    if (!(slot.id in source)) continue;
    const value = source[slot.id];
    if (value === null && slot.allowEmpty) {
      items[slot.id] = null;
    } else if (typeof value === 'string' && (ITEM_IDS as string[]).includes(value)) {
      // Only accept items that actually belong in this slot.
      const def = ITEMS.find((i) => i.id === value);
      if (def?.slot === slot.id) items[slot.id] = value as ItemId;
    }
  }
  return items;
}

function sanitizeCalibration(v: unknown): Calibration | null {
  if (!isObj(v)) return null;
  const { x, y, z } = v;
  if ([x, y, z].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 20)) {
    return { x: x as number, y: y as number, z: z as number };
  }
  return null;
}

function sanitizeActivities(v: unknown): ActivityEntry[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObj)
    .map((a) => ({
      at: num(a.at, 0, 0),
      kind: oneOf(a.kind, ACTIVITY_KINDS, 'play'),
      text: str(a.text, '', 120),
    }))
    .filter((a) => a.at > 0 && a.text.length > 0)
    .slice(-20);
}

export function sanitizeSave(doc: Obj, now: number = Date.now()): SaveData {
  const d = createDefaultSave(now);
  const character = obj(doc.character);
  const personality = obj(character.personality);
  const appearance = obj(character.appearance);
  const lastPosition = obj(character.lastPosition);
  const mood = obj(doc.mood);
  const room = obj(doc.room);
  const progress = obj(doc.progress);
  const stats = obj(progress.stats);
  const settings = obj(doc.settings);
  const name = str(character.name, d.character.name, 24).trim();

  return {
    version: SAVE_VERSION,
    createdAt: num(doc.createdAt, d.createdAt, 0),
    character: {
      name: name.length > 0 ? name : d.character.name,
      bornAt: num(character.bornAt, d.character.bornAt, 0),
      personality: {
        curiosity: num(personality.curiosity, d.character.personality.curiosity, 0, 1),
        playfulness: num(personality.playfulness, d.character.personality.playfulness, 0, 1),
        calm: num(personality.calm, d.character.personality.calm, 0, 1),
      },
      appearance: {
        bodyColor: oneOf(appearance.bodyColor, BODY_COLORS.map((c) => c.id), DEFAULT_APPEARANCE.bodyColor),
        accessory: oneOf(appearance.accessory, ACCESSORIES.map((a) => a.id), DEFAULT_APPEARANCE.accessory),
      },
      lastPosition: {
        x: num(lastPosition.x, 0.5, 0, 1),
        z: num(lastPosition.z, 0.3, 0, 1),
      },
    },
    mood: {
      valence: num(mood.valence, d.mood.valence, -1, 1),
      energy: num(mood.energy, d.mood.energy, 0, 1),
      updatedAt: num(mood.updatedAt, now, 0),
    },
    room: {
      theme: oneOf(room.theme, THEMES.map((t) => t.id), d.room.theme),
      light: oneOf(room.light, LIGHTS.map((l) => l.id), d.room.light),
      items: sanitizeItems(room.items),
      lampOn: bool(room.lampOn, d.room.lampOn),
      device: oneOf(room.device, DEVICE_IDS, d.room.device),
    },
    progress: {
      stars: int(progress.stars, d.progress.stars, 0, 1_000_000),
      bondXp: int(progress.bondXp, 0, 0, 10_000_000),
      unlocked: unique(strArray(progress.unlocked)),
      finds: unique(strArray(progress.finds).filter((f): f is FindId => (FIND_IDS as string[]).includes(f))),
      bestScores: numRecord(progress.bestScores, ['starCatch', 'peekaboo'] as const),
      gamesPlayed: numRecord(progress.gamesPlayed, ['starCatch', 'peekaboo'] as const),
      lastVisitDay:
        typeof progress.lastVisitDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(progress.lastVisitDay)
          ? progress.lastVisitDay
          : null,
      lastSeenAt: num(progress.lastSeenAt, now, 0),
      visitDays: int(progress.visitDays, 0, 0),
      milestones: unique(strArray(progress.milestones)),
      activities: sanitizeActivities(progress.activities),
      notificationsSeenAt: num(progress.notificationsSeenAt, now, 0),
      stats: {
        taps: int(stats.taps, 0, 0),
        pets: int(stats.pets, 0, 0),
        chats: int(stats.chats, 0, 0),
        visits: int(stats.visits, 0, 0),
      },
    },
    settings: {
      motionEnabled: bool(settings.motionEnabled, d.settings.motionEnabled),
      tiltSensitivity: num(settings.tiltSensitivity, d.settings.tiltSensitivity, 0.4, 2),
      calibration: sanitizeCalibration(settings.calibration),
      soundEnabled: bool(settings.soundEnabled, d.settings.soundEnabled),
      hapticsEnabled: bool(settings.hapticsEnabled, d.settings.hapticsEnabled),
      reduceMotion: oneOf(settings.reduceMotion, ['system', 'on', 'off'] as const, d.settings.reduceMotion),
      appearance: oneOf(settings.appearance, ['system', 'light', 'dark'] as const, d.settings.appearance),
      activityLevel: oneOf(settings.activityLevel, ['calm', 'normal', 'lively'] as const, d.settings.activityLevel),
      nightSleep: bool(settings.nightSleep, d.settings.nightSleep),
      recordMilestones: bool(settings.recordMilestones, d.settings.recordMilestones),
      onboarded: bool(settings.onboarded, d.settings.onboarded),
    },
  };
}
