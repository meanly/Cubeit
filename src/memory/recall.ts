import type { Memory } from './types';

/**
 * Lightweight on-device recall: keyword overlap + structured keys. It only
 * ever returns memories that exist, so the character can't "remember" things
 * that were never saved.
 */

const STOPWORDS = new Set(
  (
    'a an the and or but if to of in on at for with about from by is are was were be been am i me my mine you your ' +
    'yours we our it its this that these those do does did what whats which who whom how when where why can could ' +
    'would should will shall remember remembered know tell say said told please hey hi pip anything something ' +
    'thing things like really just so very much any some have has had there their they them he she his her'
  ).split(' '),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

/** Very small stemmer so "cats" matches "cat" and "playing" matches "play". */
function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 3 && word.endsWith('es') && /(ch|sh|x|s)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export interface RecallHit {
  memory: Memory;
  score: number;
}

export function searchMemories(query: string, memories: readonly Memory[], limit = 3): RecallHit[] {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];
  const hits: RecallHit[] = [];
  for (const memory of memories) {
    const tokens = new Set([...tokenize(memory.content), ...memory.tags.flatMap(tokenize)]);
    if (memory.key) tokenize(memory.key.replace('.', ' ')).forEach((t) => tokens.add(t));
    let overlap = 0;
    queryTokens.forEach((t) => {
      if (tokens.has(t)) overlap += 1;
    });
    if (overlap === 0) continue;
    const score = overlap / Math.sqrt(queryTokens.size) + memory.importance * 0.05;
    hits.push({ memory, score });
  }
  return hits.sort((a, b) => b.score - a.score || b.memory.createdAt - a.memory.createdAt).slice(0, limit);
}

export function findByKey(memories: readonly Memory[], key: string): Memory | undefined {
  // Newest wins if the user saved the same thing twice.
  return [...memories].filter((m) => m.key === key).sort((a, b) => b.createdAt - a.createdAt)[0];
}

/** The user's name, if (and only if) they asked the character to remember it. */
export function rememberedUserName(memories: readonly Memory[]): string | undefined {
  return findByKey(memories, 'user.name')?.value;
}

/** A few memories worth mentioning when asked "what do you remember?" */
export function highlights(memories: readonly Memory[], limit = 3): Memory[] {
  return [...memories]
    .filter((m) => m.source !== 'app' || m.importance >= 2)
    .sort((a, b) => b.importance - a.importance || b.createdAt - a.createdAt)
    .slice(0, limit);
}
