import Storage from 'expo-sqlite/kv-store';

import type { KeyValueStore } from './types';

/**
 * Native key-value store backed by SQLite (expo-sqlite/kv-store). Each write is
 * an atomic SQLite statement, so a crash mid-save can't leave half a document.
 * Synchronous methods let us flush reliably when the app is backgrounded.
 */
export const kv: KeyValueStore = {
  get: (key) => Storage.getItemSync(key),
  set: (key, value) => Storage.setItemSync(key, value),
  remove: (key) => {
    Storage.removeItemSync(key);
  },
  backend: 'sqlite',
};
