export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  readonly backend: 'sqlite' | 'localStorage' | 'memory';
}

/** In-memory store, used by tests and as a last resort if storage is broken. */
export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => {
      map.set(key, value);
    },
    remove: (key) => {
      map.delete(key);
    },
    backend: 'memory',
  };
}
