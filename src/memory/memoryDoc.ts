import { int, isObj, num, oneOf, str, strArray } from '../state/validate';
import { MEMORIES_VERSION, type Memory, type MemoryDoc, type MemoryType } from './types';

const TYPES: readonly MemoryType[] = ['note', 'fact', 'favorite', 'event', 'milestone', 'experience', 'encounter'];
const RELATED_KINDS = ['game', 'conversation', 'nearby', 'milestone'] as const;

export const MAX_MEMORY_LENGTH = 400;
export const MAX_MEMORIES = 2000;

export function emptyMemoryDoc(): MemoryDoc {
  return { version: MEMORIES_VERSION, items: [] };
}

/** Repair a stored memories document; invalid entries are dropped, not guessed at. */
export function migrateMemories(raw: unknown): MemoryDoc {
  const source = isObj(raw) ? raw : {};
  const items = Array.isArray(source.items) ? source.items : [];
  const seen = new Set<string>();
  const out: Memory[] = [];
  for (const entry of items) {
    if (!isObj(entry)) continue;
    const id = str(entry.id, '', 64);
    const content = str(entry.content, '', MAX_MEMORY_LENGTH).trim();
    const createdAt = num(entry.createdAt, 0, 0);
    if (!id || !content || !createdAt || seen.has(id)) continue;
    seen.add(id);
    const related = isObj(entry.related)
      ? {
          kind: oneOf(entry.related.kind, RELATED_KINDS, 'conversation'),
          ...(typeof entry.related.id === 'string' ? { id: entry.related.id.slice(0, 64) } : {}),
        }
      : undefined;
    const memory: Memory = {
      id,
      type: oneOf(entry.type, TYPES, 'note'),
      content,
      createdAt,
      tags: strArray(entry.tags, 12, 32),
      importance: int(entry.importance, 1, 1, 3) as 1 | 2 | 3,
      source: oneOf(entry.source, ['user', 'conversation', 'app'] as const, 'user'),
    };
    if (typeof entry.updatedAt === 'number') memory.updatedAt = entry.updatedAt;
    if (related) memory.related = related;
    if (typeof entry.key === 'string') memory.key = entry.key.slice(0, 64);
    if (typeof entry.value === 'string') memory.value = entry.value.slice(0, 120);
    out.push(memory);
  }
  return { version: MEMORIES_VERSION, items: out.slice(-MAX_MEMORIES) };
}

export function makeMemoryId(now: number = Date.now(), rng: () => number = Math.random): string {
  return `m_${now.toString(36)}_${Math.floor(rng() * 1e9).toString(36)}`;
}

/** Turn "cats, Rainy days ,  cats" into ["cats", "rainy days"]. */
export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
        .map((t) => t.slice(0, 32)),
    ),
  ).slice(0, 12);
}
