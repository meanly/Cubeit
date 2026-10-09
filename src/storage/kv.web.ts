import type { KeyValueStore } from './types';

/**
 * Web fallback (used for browser previews during development). Mirrors the
 * native SQLite store's synchronous API on top of localStorage.
 */
export const kv: KeyValueStore = {
  get: (key) => window.localStorage.getItem(key),
  set: (key, value) => window.localStorage.setItem(key, value),
  remove: (key) => window.localStorage.removeItem(key),
  backend: 'localStorage',
};
