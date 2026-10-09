export const MEMORIES_VERSION = 1;
export const MEMORIES_KEY = 'cubeit.memories';

export type MemoryType =
  | 'note' // written by the user in the Memories panel
  | 'fact' // something the user asked the character to remember
  | 'favorite' // a favorite thing (color, food, …)
  | 'event' // a special day or plan
  | 'milestone' // a character milestone (friendship level, first game…)
  | 'experience' // a shared in-app moment (high score, …)
  | 'encounter'; // a visit from another character

export type MemorySource = 'user' | 'conversation' | 'app';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  createdAt: number;
  updatedAt?: number;
  tags: string[];
  /** 1 = small, 2 = notable, 3 = very important. */
  importance: 1 | 2 | 3;
  related?: { kind: 'game' | 'conversation' | 'nearby' | 'milestone'; id?: string };
  source: MemorySource;
  /**
   * Optional structured key for things the character can look up directly,
   * e.g. key "user.name" / value "Sam", or "favorite.color" / "teal".
   */
  key?: string;
  value?: string;
}

export type MemoryDraft = Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>;

export interface MemoryDoc {
  version: typeof MEMORIES_VERSION;
  items: Memory[];
}

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  note: 'Note',
  fact: 'Fact',
  favorite: 'Favorite',
  event: 'Event',
  milestone: 'Milestone',
  experience: 'Moment',
  encounter: 'Visit',
};

/** Types the user can pick when writing a memory by hand. */
export const USER_MEMORY_TYPES: readonly MemoryType[] = ['note', 'fact', 'favorite', 'event'];
