import { tokenize } from '../memory/recall';
import { addDays, diffDays, type DayKey } from './dates';
import type { JournalEntry, Mood } from './types';

export const MOOD_LABEL: Record<Mood, string> = {
  great: 'Great',
  good: 'Good',
  okay: 'Okay',
  low: 'Low',
  rough: 'Rough',
};

export const MOOD_EMOJI: Record<Mood, string> = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  low: '😕',
  rough: '😣',
};

/** Guided prompts for the journal; one is suggested per day. */
export const JOURNAL_PROMPTS = [
  'What made you smile today?',
  'What’s one thing you’re grateful for?',
  'What was hard today, and how did you handle it?',
  'What did you learn today?',
  'What are you looking forward to?',
  'Who made a difference to your day?',
  'What would make tomorrow a little better?',
  'What did you do today just for you?',
  'What’s on your mind right now?',
  'What’s something small that went well?',
] as const;

export function promptOfTheDay(day: DayKey): string {
  const n = diffDays('2026-01-01', day);
  return JOURNAL_PROMPTS[((n % JOURNAL_PROMPTS.length) + JOURNAL_PROMPTS.length) % JOURNAL_PROMPTS.length];
}

export interface JournalHit {
  entry: JournalEntry;
  score: number;
}

/**
 * Local keyword search over entries (same tokenizer as memory recall), with an
 * optional date range. It only returns entries that exist — answers about
 * the past are grounded in these hits and nothing else.
 */
export function searchJournal(
  entries: readonly JournalEntry[],
  query: string,
  opts: { from?: DayKey; to?: DayKey; limit?: number } = {},
): JournalHit[] {
  const limit = opts.limit ?? 5;
  const inRange = (e: JournalEntry) => (!opts.from || diffDays(opts.from, e.day) >= 0) && (!opts.to || diffDays(e.day, opts.to) >= 0);
  const pool = entries.filter(inRange);
  const terms = new Set(tokenize(query));
  if (terms.size === 0) {
    // No keywords (e.g. "what did I write yesterday?"): newest entries in the range.
    return [...pool]
      .sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt)
      .slice(0, limit)
      .map((entry) => ({ entry, score: 0 }));
  }
  const hits: JournalHit[] = [];
  for (const entry of pool) {
    const words = new Set(tokenize(`${entry.title ?? ''} ${entry.text} ${entry.mood ?? ''}`));
    let overlap = 0;
    terms.forEach((t) => {
      if (words.has(t)) overlap += 1;
    });
    if (overlap > 0) hits.push({ entry, score: overlap / Math.sqrt(terms.size) });
  }
  return hits.sort((a, b) => b.score - a.score || b.entry.createdAt - a.entry.createdAt).slice(0, limit);
}

export interface JournalSummary {
  count: number;
  days: number;
  moods: Partial<Record<Mood, number>>;
  topMood: Mood | null;
  themes: string[];
}

/** A plain, computed summary of entries in a range — no model involved. */
export function summarizeJournal(entries: readonly JournalEntry[], from: DayKey, to: DayKey): JournalSummary {
  const inRange = entries.filter((e) => diffDays(from, e.day) >= 0 && diffDays(e.day, to) >= 0);
  const moods: Partial<Record<Mood, number>> = {};
  const words = new Map<string, number>();
  for (const e of inRange) {
    if (e.mood) moods[e.mood] = (moods[e.mood] ?? 0) + 1;
    for (const w of new Set(tokenize(e.text))) if (w.length > 3) words.set(w, (words.get(w) ?? 0) + 1);
  }
  // Only a mood on more than half of the mood-tagged entries counts as "mostly"; a tie is mixed.
  const moodTotal = Object.values(moods).reduce((sum, n) => sum + n, 0);
  const [best, bestCount] = Object.entries(moods).sort((a, b) => b[1] - a[1])[0] ?? [];
  const topMood = best && bestCount! * 2 > moodTotal ? (best as Mood) : null;
  const themes = [...words.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w);
  return { count: inRange.length, days: new Set(inRange.map((e) => e.day)).size, moods, topMood, themes };
}

export function describeSummary(s: JournalSummary, label: string): string {
  if (s.count === 0) return `No journal entries ${label}.`;
  const entries = `${s.count} entr${s.count === 1 ? 'y' : 'ies'}`;
  const parts = [s.days === s.count ? `${entries} ${label}` : `${entries} on ${s.days} day${s.days === 1 ? '' : 's'} ${label}`];
  const moodTotal = Object.values(s.moods).reduce((sum, n) => sum + n, 0);
  if (s.topMood) parts.push(`${moodTotal === 1 ? 'feeling' : 'mostly feeling'} ${MOOD_LABEL[s.topMood].toLowerCase()}`);
  else if (moodTotal > 1) parts.push('a mix of moods');
  if (s.themes.length > 0) parts.push(`words that came up: ${s.themes.join(', ')}`);
  return `${parts.join(' · ')}.`;
}

export const lastNDays = (today: DayKey, n: number) => ({ from: addDays(today, -(n - 1)), to: today });
