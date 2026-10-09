import { FINDS, type FindId } from '../content/finds';

/** Friendship XP needed to reach each level (index 0 → level 1). */
export const BOND_LEVELS = [0, 25, 70, 140, 240, 380, 560, 800, 1100] as const;

export function bondLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < BOND_LEVELS.length; i++) if (xp >= BOND_LEVELS[i]) level = i + 1;
  return level;
}

export function bondProgress(xp: number): { level: number; fraction: number; toNext: number | null } {
  const level = bondLevel(xp);
  if (level >= BOND_LEVELS.length) return { level, fraction: 1, toNext: null };
  const lo = BOND_LEVELS[level - 1];
  const hi = BOND_LEVELS[level];
  return { level, fraction: (xp - lo) / (hi - lo), toNext: hi - xp };
}

/** Idle behaviors that open up as friendship grows. */
export type IdleUnlockId = 'dance' | 'twirl' | 'stargaze' | 'hum';

export const IDLE_UNLOCKS: readonly { id: IdleUnlockId; level: number; name: string }[] = [
  { id: 'dance', level: 2, name: 'Little dance' },
  { id: 'twirl', level: 3, name: 'Happy twirl' },
  { id: 'stargaze', level: 4, name: 'Stargazing' },
  { id: 'hum', level: 5, name: 'Humming' },
];

export const idleUnlocked = (id: IdleUnlockId, level: number) =>
  level >= (IDLE_UNLOCKS.find((u) => u.id === id)?.level ?? Infinity);

/** XP rewards with cooldowns so rapid tapping doesn't farm friendship. */
export type XpReason = 'tap' | 'pet' | 'chat' | 'game' | 'daily' | 'visit' | 'item' | 'memory';

export const XP_RULES: Record<XpReason, { xp: number; cooldownMs: number }> = {
  tap: { xp: 1, cooldownMs: 15_000 },
  pet: { xp: 2, cooldownMs: 8_000 },
  chat: { xp: 2, cooldownMs: 20_000 },
  game: { xp: 6, cooldownMs: 0 },
  daily: { xp: 5, cooldownMs: 0 },
  visit: { xp: 4, cooldownMs: 0 },
  item: { xp: 1, cooldownMs: 30_000 },
  memory: { xp: 2, cooldownMs: 60_000 },
};

/** Local calendar day, e.g. "2026-10-09". */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function daysBetween(fromDay: string, toDay: string): number {
  const parse = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((parse(toDay) - parse(fromDay)) / 86_400_000);
}

export type DailyGift = { kind: 'find'; id: FindId } | { kind: 'stars'; amount: number };

export interface DailyCheck {
  isNewDay: boolean;
  /** Whole days since the previous visit (0 on the same day, null on the very first visit). */
  daysAway: number | null;
  gift: DailyGift | null;
}

/**
 * The once-a-day welcome: a small discovery and nothing more. Missing days
 * costs nothing — there's no streak to break.
 */
export function dailyCheck(lastVisitDay: string | null, owned: readonly FindId[], now: number, rng = Math.random): DailyCheck {
  const today = dayKey(now);
  if (lastVisitDay === today) return { isNewDay: false, daysAway: 0, gift: null };
  const daysAway = lastVisitDay ? daysBetween(lastVisitDay, today) : null;
  const remaining = FINDS.filter((f) => !owned.includes(f.id));
  const gift: DailyGift =
    remaining.length > 0
      ? { kind: 'find', id: remaining[Math.floor(rng() * remaining.length)].id }
      : { kind: 'stars', amount: 5 };
  return { isNewDay: true, daysAway, gift };
}

/** Stars awarded for a game result. */
export function starsForGame(game: 'starCatch' | 'peekaboo', score: number, newBest: boolean): number {
  const base = game === 'starCatch' ? Math.min(40, Math.round(score * 0.8)) : score * 4;
  return base + (newBest && score > 0 ? 5 : 0);
}
