import type { KeyValueStore } from './types';

export type LoadStatus = 'fresh' | 'loaded' | 'recovered';

export interface LoadResult<T> {
  data: T;
  status: LoadStatus;
  /** Set when stored data couldn't be read; the original is kept under a backup key. */
  problem?: string;
}

/**
 * Read a JSON document. Missing → defaults ('fresh'). Unreadable → defaults
 * ('recovered') with the raw text preserved under a backup key, so nothing is
 * silently destroyed.
 */
export function loadDocument<T>(
  store: KeyValueStore,
  key: string,
  migrate: (raw: unknown) => T,
  createDefault: () => T,
): LoadResult<T> {
  let raw: string | null;
  try {
    raw = store.get(key);
  } catch (error) {
    return { data: createDefault(), status: 'recovered', problem: `read failed: ${String(error)}` };
  }
  if (raw == null) return { data: createDefault(), status: 'fresh' };

  try {
    return { data: migrate(JSON.parse(raw)), status: 'loaded' };
  } catch (error) {
    try {
      store.set(`${key}.backup`, raw);
    } catch {
      // Backup is best-effort.
    }
    return { data: createDefault(), status: 'recovered', problem: `parse failed: ${String(error)}` };
  }
}

/**
 * Debounced writer: coalesces bursts of changes into one write, and can be
 * flushed synchronously when the app goes to the background.
 */
export class DocumentWriter<T> {
  private pending: T | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string,
    private readonly delayMs: number,
    private readonly onError: (error: unknown) => void,
  ) {}

  schedule(data: T): void {
    this.pending = data;
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.pending === null) return;
    const data = this.pending;
    this.pending = null;
    try {
      this.store.set(this.key, JSON.stringify(data));
    } catch (error) {
      this.onError(error);
    }
  }
}
