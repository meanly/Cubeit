/**
 * Small, dependency-free validators used to repair loaded documents. Every
 * helper returns a valid value: bad or missing input falls back to a default
 * instead of throwing, so a partly damaged save still loads.
 */

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

export const obj = (v: unknown): Obj => (isObj(v) ? v : {});

export function num(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function int(v: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  return Math.round(num(v, fallback, min, max));
}

export const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

export function str(v: unknown, fallback: string, maxLength = 500): string {
  if (typeof v !== 'string') return fallback;
  return v.slice(0, maxLength);
}

export function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function strArray(v: unknown, maxItems = 500, maxLength = 80): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.slice(0, maxLength))
    .slice(0, maxItems);
}

export function numRecord<K extends string>(v: unknown, keys: readonly K[]): Partial<Record<K, number>> {
  const source = obj(v);
  const out: Partial<Record<K, number>> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = Math.round(value);
  }
  return out;
}

export const unique = <T>(items: T[]): T[] => Array.from(new Set(items));
