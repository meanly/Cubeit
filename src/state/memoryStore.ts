import { create } from 'zustand';

import { makeMemoryId, MAX_MEMORIES, MAX_MEMORY_LENGTH } from '../memory/memoryDoc';
import type { Memory, MemoryDraft } from '../memory/types';

interface MemoryStore {
  items: Memory[];
  hydrate(items: Memory[]): void;
  add(draft: MemoryDraft, now?: number): Memory;
  update(id: string, patch: Partial<Omit<Memory, 'id' | 'createdAt'>>, now?: number): void;
  remove(id: string): void;
  clear(): void;
}

export const useMemories = create<MemoryStore>()((set) => ({
  items: [],
  hydrate: (items) => set({ items }),
  add: (draft, now = Date.now()) => {
    const memory: Memory = {
      ...draft,
      content: draft.content.trim().slice(0, MAX_MEMORY_LENGTH),
      id: makeMemoryId(now),
      createdAt: now,
    };
    set((s) => ({ items: [...s.items, memory].slice(-MAX_MEMORIES) }));
    return memory;
  },
  update: (id, patch, now = Date.now()) =>
    set((s) => ({
      items: s.items.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              content: (patch.content ?? m.content).trim().slice(0, MAX_MEMORY_LENGTH),
              updatedAt: now,
            }
          : m,
      ),
    })),
  remove: (id) => set((s) => ({ items: s.items.filter((m) => m.id !== id) })),
  clear: () => set({ items: [] }),
}));
