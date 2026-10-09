import {
  addDays,
  addMonths,
  dayKey,
  diffDays,
  isDayKey,
  makeDay,
  makeTime,
  minutesOf,
  startOfWeek,
  weekdayOf,
  type DayKey,
  type TimeOfDay,
} from '../planner/dates';

/**
 * Deterministic date/time phrase parsing ("tomorrow at 3pm", "next Friday",
 * "Oct 12 9:30-10:15", "every Monday"). The language model never does date
 * arithmetic: it copies the user's own words, and this resolves them against
 * the phone's clock. Returns the spans it used so titles can be cleaned up.
 */

export interface ParsedWhen {
  day?: DayKey;
  start?: TimeOfDay;
  end?: TimeOfDay;
  allDay?: boolean;
  /** A whole range was asked for ("this week", "next week"). */
  range?: { from: DayKey; to: DayKey };
  /** Fuzzy times like "morning" were used. */
  approximate?: boolean;
  /** The text spans that were understood (lowercase), to strip from titles. */
  spans: string[];
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2 };

const WD = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');
/** Weekday words that can't be ordinary English words ("sat", "sun", "wed" need "on"/"next"/… in front). */
const SAFE_WD = Object.keys(WEEKDAYS)
  .filter((w) => !['sun', 'sat', 'wed', 'weds'].includes(w))
  .sort((a, b) => b.length - a.length)
  .join('|');
const MON = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');

/** Day-month order for numeric dates like 10/12, from the device locale (US-style unless the locale puts the day first). */
export function numericDateOrder(): 'mdy' | 'dmy' {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'numeric' }).formatToParts(new Date(2026, 10, 25));
    const first = parts.find((p) => p.type === 'day' || p.type === 'month');
    return first?.type === 'day' ? 'dmy' : 'mdy';
  } catch {
    return 'mdy';
  }
}

/** "3", "3pm", "3:30 p.m.", "15:00", "noon", "midnight" → "HH:MM". Bare hours 1–6 read as afternoon, 7–11 as morning. */
export function parseTime(raw: string): TimeOfDay | null {
  const t = raw.trim().toLowerCase().replace(/\./g, '');
  if (t === 'noon' || t === 'midday') return '12:00';
  if (t === 'midnight') return '00:00';
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const mer = m[3]?.[0];
  if (min > 59) return null;
  if (mer) {
    if (h < 1 || h > 12) return null;
    if (mer === 'a') h = h === 12 ? 0 : h;
    else h = h === 12 ? 12 : h + 12;
  } else if (!m[2] && h >= 1 && h <= 6) {
    h += 12;
  } else if (h > 23) {
    return null;
  }
  return makeTime(h, min);
}

const TIME = String.raw`(?:noon|midday|midnight|\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|am|pm|a|p)?)`;

function take(text: string, re: RegExp, spans: string[]): RegExpMatchArray | null {
  const m = text.match(re);
  if (m) spans.push(m[0].trim());
  return m;
}

/**
 * Parse date and time words in `text`. `prefer` decides which way a bare date
 * leans: events look forward ("Friday" = the coming Friday, "Mar 3" = next
 * March 3 if it's passed), journal searches look back.
 */
export function parseWhen(text: string, now: number, prefer: 'future' | 'past' = 'future'): ParsedWhen {
  const t = ` ${text.toLowerCase().replace(/[’']/g, "'").replace(/[,]/g, ' ').replace(/\s+/g, ' ')} `;
  const today = dayKey(now);
  const spans: string[] = [];
  const out: ParsedWhen = { spans };

  // ── Ranges ──
  let m: RegExpMatchArray | null;
  if ((m = take(t, /\b(this|next|last) week(?:end)?\b/, spans))) {
    const weekend = m[0].endsWith('weekend');
    const base = startOfWeek(today);
    const shift = m[1] === 'next' ? 7 : m[1] === 'last' ? -7 : 0;
    if (weekend) {
      const sat = addDays(base, 5 + shift);
      out.range = { from: sat, to: addDays(sat, 1) };
      out.day = sat;
    } else {
      out.range = { from: m[1] === 'this' ? today : addDays(base, shift), to: addDays(base, 6 + shift) };
      if (m[1] === 'last') out.range.from = addDays(base, shift);
    }
  } else if ((m = take(t, /\b(?:the )?(?:weekend)\b/, spans))) {
    const sat = addDays(startOfWeek(today), 5);
    const from = diffDays(today, sat) < -1 ? addDays(sat, 7) : sat;
    out.range = { from, to: addDays(from, 1) };
    out.day = from;
  } else if ((m = take(t, /\b(this|next|last) month\b/, spans))) {
    const shift = m[1] === 'next' ? 1 : m[1] === 'last' ? -1 : 0;
    const first = addMonths(`${today.slice(0, 7)}-01`, shift);
    out.range = { from: m[1] === 'this' ? today : first, to: addDays(addMonths(first, 1), -1) };
  }

  // ── Days ──
  if (!out.day) {
    if ((m = take(t, /\b(\d{4})-(\d{2})-(\d{2})\b/, spans))) {
      const k = `${m[1]}-${m[2]}-${m[3]}`;
      if (isDayKey(k)) out.day = k;
    } else if (
      // Explicit dates win over weekday words ("Saturday Oct 17").
      (m = take(t, new RegExp(String.raw`\b(${MON})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b`), spans)) ||
      (m = take(t, new RegExp(String.raw`\b(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(${MON})\b(?:\s+(\d{4}))?`), spans))
    ) {
      const monthFirst = Number.isNaN(Number(m[1]));
      const month = MONTHS[monthFirst ? m[1] : m[2]];
      const date = Number(monthFirst ? m[2] : m[1]);
      out.day = resolveYear(month, date, m[3] ? Number(m[3]) : null, today, prefer);
    } else if ((m = take(t, /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, spans))) {
      const [a, b] = [Number(m[1]), Number(m[2])];
      const [month, date] = numericDateOrder() === 'dmy' ? [b - 1, a] : [a - 1, b];
      const year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : null;
      out.day = resolveYear(month, date, year, today, prefer);
    } else if ((m = take(t, /\b(?:the )?day after tomorrow\b/, spans))) {
      out.day = addDays(today, 2);
    } else if ((m = take(t, /\b(?:the )?day before yesterday\b/, spans))) {
      out.day = addDays(today, -2);
    } else if ((m = take(t, /\b(today|tonight|this (?:morning|afternoon|evening))\b/, spans))) {
      out.day = today;
      if (m[1] === 'tonight') {
        out.start = '20:00';
        out.approximate = true;
      }
    } else if ((m = take(t, /\b(tomorrow|tmrw|tmr)\b/, spans))) {
      out.day = addDays(today, 1);
    } else if ((m = take(t, /\byesterday\b/, spans))) {
      out.day = addDays(today, -1);
    } else if ((m = take(t, /\bin (a|an|one|two|three|four|five|six|seven|eight|nine|ten|couple of|\d{1,3}) (day|week|month)s?\b/, spans))) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1].replace(' of', '')] ?? 1;
      out.day = m[2] === 'day' ? addDays(today, n) : m[2] === 'week' ? addDays(today, n * 7) : addMonths(today, n);
    } else if ((m = take(t, /\b(\d{1,3}|a|one|two|three|four|five|six|seven) (day|week)s? ago\b/, spans))) {
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]] ?? 1;
      out.day = addDays(today, -(m[2] === 'day' ? n : n * 7));
    } else if (
      (m = take(t, new RegExp(String.raw`\b(?:(next|this|last|on|coming|every)\s+)(${WD})\b`), spans)) ||
      (m = take(t, new RegExp(String.raw`\b()(${SAFE_WD})\b`), spans))
    ) {
      const prefix = m[1] || undefined;
      const target = WEEKDAYS[m[2]];
      const cur = weekdayOf(today);
      if (prefix === 'last' || (prefer === 'past' && prefix !== 'next' && prefix !== 'coming')) {
        let back = (cur - target + 7) % 7;
        if (prefix === 'last' && back === 0) back = 7;
        out.day = addDays(today, -back);
      } else {
        let ahead = (target - cur + 7) % 7;
        if (prefix === 'next' && ahead === 0) ahead = 7;
        out.day = addDays(today, ahead);
      }
    } else if ((m = take(t, /\bon the (\d{1,2})(?:st|nd|rd|th)\b/, spans))) {
      const date = Number(m[1]);
      const d = new Date(now);
      let k = makeDay(d.getFullYear(), d.getMonth(), date);
      if (prefer === 'future' && diffDays(today, k) < 0) k = makeDay(d.getFullYear(), d.getMonth() + 1, date);
      if (Number(k.slice(8)) === date) out.day = k;
    }
  }

  // A weekday next to an explicit date is part of it; consume it so it's stripped from titles.
  if (out.day && spans.length > 0) take(t, new RegExp(String.raw`\b(?:on\s+)?(${WD})\b`), spans);

  // ── Times ──
  if ((m = take(t, /\ball[- ]day\b/, spans))) {
    out.allDay = true;
  }
  const rangeRe = new RegExp(String.raw`\b(?:from\s+)?(${TIME})\s*(?:-|–|to|until|till)\s*(${TIME})(?=\s|$)`);
  if (!out.allDay && (m = t.match(rangeRe)) && /\d|noon|midnight/.test(m[1])) {
    // "3-4pm": the first time borrows the second's am/pm.
    const endRaw = m[2];
    const mer = endRaw.match(/(am|pm|a\.m\.|p\.m\.)$/)?.[0];
    let start = parseTime(/[ap]\.?m?\.?$|noon|midnight/.test(m[1].trim()) || !mer ? m[1] : `${m[1]}${mer}`);
    const end = parseTime(endRaw);
    if (start && end && minutesOf(end) <= minutesOf(start) && !/[ap]/.test(m[1])) {
      // "11-1" → 11am to 1pm
      const alt = parseTime(`${m[1]}am`);
      if (alt && minutesOf(end) > minutesOf(alt)) start = alt;
    }
    if (start && end && minutesOf(end) > minutesOf(start)) {
      spans.push(m[0].trim());
      out.start = start;
      out.end = end;
      out.approximate = false;
    }
  }
  if (!out.allDay && !out.end) {
    const at = t.match(new RegExp(String.raw`\b(?:at|@|by|around|from)\s+(${TIME})(?=\s|$)`)) ?? t.match(new RegExp(String.raw`\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))(?=\s|$)|\b(\d{1,2}:\d{2})\b|\b(noon|midnight)\b`));
    const raw = at ? (at[1] ?? at[2] ?? at[3]) : null;
    const time = raw ? parseTime(raw) : null;
    if (at && time) {
      spans.push(at[0].trim());
      out.start = time;
      out.approximate = false;
    } else if (!out.start && (m = take(t, /\b(?:in the |this )?(morning|afternoon|evening)\b/, spans))) {
      out.start = m[1] === 'morning' ? '09:00' : m[1] === 'afternoon' ? '15:00' : '18:00';
      out.approximate = true;
    }
    const until = t.match(new RegExp(String.raw`\b(?:until|till|to)\s+(${TIME})(?=\s|$)`));
    const endTime = until ? parseTime(until[1]) : null;
    if (out.start && endTime && minutesOf(endTime) > minutesOf(out.start)) {
      spans.push(until![0].trim());
      out.end = endTime;
    }
  }
  return out;
}

function resolveYear(month: number, date: number, year: number | null, today: DayKey, prefer: 'future' | 'past'): DayKey | undefined {
  const y = year ?? Number(today.slice(0, 4));
  let k = makeDay(y, month, date);
  if (Number(k.slice(8)) !== date || Number(k.slice(5, 7)) !== month + 1) return undefined; // e.g. Feb 31
  if (year === null) {
    if (prefer === 'future' && diffDays(today, k) < 0) k = makeDay(y + 1, month, date);
    if (prefer === 'past' && diffDays(today, k) > 0) k = makeDay(y - 1, month, date);
  }
  return k;
}

/** "daily", "every day", "weekdays", "mon wed fri", "every Tuesday and Thursday" → weekdays (0=Sun), or null if none. */
export function parseWeekdays(text: string): { daily: true } | { days: number[] } | null {
  const t = text.toLowerCase();
  if (/\b(daily|every ?day|each day|every morning|every night|every evening|each morning|each night)\b/.test(t)) return { daily: true };
  if (/\bweek ?days?\b/.test(t)) return { days: [1, 2, 3, 4, 5] };
  if (/\bweek ?ends?\b/.test(t)) return { days: [0, 6] };
  const found = new Set<number>();
  for (const m of t.matchAll(new RegExp(String.raw`\b(${WD})s?\b`, 'g'))) found.add(WEEKDAYS[m[1]]);
  if (found.size === 0) return null;
  if (found.size === 7) return { daily: true };
  return { days: [...found].sort() };
}

/** "every week", "weekly", "every 2 weeks", "monthly", "every 3 days" → recurrence, or null. */
export function parseRepeat(text: string): { every: number; unit: 'day' | 'week' | 'month' } | null {
  const t = text.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\bevery (\d{1,3}|other|two|three|four) (day|week|month)s?\b/))) {
    const n = m[1] === 'other' ? 2 : /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1]] ?? 1;
    return { every: Math.max(1, n), unit: m[2] as 'day' | 'week' | 'month' };
  }
  if (/\b(daily|every ?day|each day)\b/.test(t)) return { every: 1, unit: 'day' };
  if (/\b(weekly|every week|each week|once a week)\b/.test(t)) return { every: 1, unit: 'week' };
  if (/\b(fortnightly|biweekly|every two weeks)\b/.test(t)) return { every: 2, unit: 'week' };
  if (/\b(monthly|every month|each month|once a month)\b/.test(t)) return { every: 1, unit: 'month' };
  if (new RegExp(String.raw`\bevery (${WD})\b`).test(t)) return { every: 1, unit: 'week' };
  return null;
}

/** Remove understood date/time words from a phrase to leave a clean title. */
export function stripSpans(text: string, spans: readonly string[]): string {
  let out = ` ${text} `;
  for (const s of [...spans].sort((a, b) => b.length - a.length)) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    out = out.replace(new RegExp(`\\s${escaped}(?=[\\s.,!?]|$)`, 'i'), ' ');
  }
  return out
    .replace(/\s+(on|at|for|from|by|this|next|the|in)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[\s,.;:!-]+$/, '')
    .trim();
}
