/** How a piece of content becomes available. Kept data-only so new content needs no engine changes. */
export type Unlock =
  | { kind: 'default' }
  | { kind: 'stars'; cost: number }
  | { kind: 'bond'; level: number };

export const DEFAULT_UNLOCK: Unlock = { kind: 'default' };

/** Content ids can repeat across categories (a "peach" theme and a "peach" color), so purchases are namespaced. */
export type ContentKind = 'theme' | 'light' | 'item' | 'color' | 'accessory' | 'device';
export const unlockKey = (kind: ContentKind, id: string) => `${kind}:${id}`;

export function unlockLabel(unlock: Unlock): string {
  switch (unlock.kind) {
    case 'default':
      return 'Free';
    case 'stars':
      return `${unlock.cost} stars`;
    case 'bond':
      return `Friendship ${unlock.level}`;
  }
}

/**
 * Whether a content id is usable. Star-cost content must be bought (it is then
 * listed in `unlocked`); bond content opens automatically at the level.
 */
export function isUnlocked(
  id: string,
  unlock: Unlock,
  unlocked: readonly string[],
  bondLevel: number,
): boolean {
  switch (unlock.kind) {
    case 'default':
      return true;
    case 'stars':
      return unlocked.includes(id);
    case 'bond':
      return bondLevel >= unlock.level;
  }
}
