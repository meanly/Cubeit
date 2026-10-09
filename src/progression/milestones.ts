import type { MemoryDraft } from '../memory/types';

export interface MilestoneDef {
  id: string;
  title: string;
  /** Memory text, written from the character's point of view about shared time. */
  memory: (name: string) => string;
  importance: 1 | 2 | 3;
}

const bond = (level: number): MilestoneDef => ({
  id: `bond-${level}`,
  title: `Friendship level ${level}`,
  memory: (name) => `${name} and you reached friendship level ${level}.`,
  importance: level >= 4 ? 3 : 2,
});

export const MILESTONES: readonly MilestoneDef[] = [
  { id: 'first-wake', title: 'First hello', memory: (n) => `The day ${n} woke up in the cube and met you.`, importance: 3 },
  { id: 'first-game', title: 'First game', memory: (n) => `You played the first game together with ${n}.`, importance: 2 },
  { id: 'starcatch-20', title: 'Star catcher', memory: (n) => `${n} caught 20 stars in one round of Star Catch.`, importance: 2 },
  { id: 'starcatch-40', title: 'Star wrangler', memory: (n) => `${n} caught 40 stars in one round. Wow!`, importance: 3 },
  { id: 'peekaboo-perfect', title: 'Sharp eyes', memory: (n) => `You found ${n} every single time in Peekaboo.`, importance: 2 },
  { id: 'first-visit', title: 'First visitor', memory: (n) => `${n} had a visitor for the first time.`, importance: 2 },
  { id: 'all-finds', title: 'Collector', memory: (n) => `${n} found every little treasure.`, importance: 3 },
  { id: 'seven-days', title: 'Seven days', memory: (n) => `You have visited ${n} on seven different days.`, importance: 2 },
  bond(2),
  bond(3),
  bond(4),
  bond(5),
  bond(6),
];

export const milestoneById = (id: string) => MILESTONES.find((m) => m.id === id);

export function milestoneMemory(def: MilestoneDef, characterName: string): MemoryDraft {
  return {
    type: 'milestone',
    content: def.memory(characterName),
    tags: ['milestone'],
    importance: def.importance,
    related: { kind: 'milestone', id: def.id },
    source: 'app',
  };
}
