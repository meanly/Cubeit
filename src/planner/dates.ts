import { dayKey } from '../progression/progression';

/**
 * Planner dates are local calendar days ("2026-10-12") and wall-clock times
 * ("15:30"), not timestamps: an event at 3 PM stays at 3 PM, and "today"
 * always means the phone's current local day. All math goes through local
 * `Date` constructors so month lengths and DST are handled by the platform.
 */
export type DayKey = string;
export type TimeOfDay = string;
/** 0 = Sunday … 6 = Saturday (JavaScript's `Date#getDay`). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export { dayKey };

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
export const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function isDayKey(v: unknown): v is DayKey {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isTimeOfDay(v: unknown): v is TimeOfDay {
  if (typeof v !== 'string' || !/^\d{2}:\d{2}$/.test(v)) return false;
  const [h, m] = v.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** Local midnight of a day. */
export function dayDate(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function makeDay(year: number, monthIndex: number, date: number): DayKey {
  return dayKey(new Date(year, monthIndex, date).getTime());
}

export function addDays(day: DayKey, n: number): DayKey {
  const d = dayDate(day);
  return makeDay(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Add months keeping the day of the month (`anchor`, defaulting to the day's
 * own date), clamped to short months: Jan 31 + 1 month = Feb 28/29, and with
 * anchor 31 the month after that is Mar 31 again.
 */
export function addMonths(day: DayKey, n: number, anchor?: number): DayKey {
  const d = dayDate(day);
  const total = d.getMonth() + n;
  const year = d.getFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const date = Math.min(anchor ?? d.getDate(), daysInMonth(year, month));
  return makeDay(year, month, date);
}

export function weekdayOf(day: DayKey): Weekday {
  return dayDate(day).getDay() as Weekday;
}

/** Whole days from `a` to `b` (negative if `b` is earlier). DST-safe. */
export function diffDays(a: DayKey, b: DayKey): number {
  const pa = a.split('-').map(Number);
  const pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86_400_000);
}

/** The Monday (by default) that starts the week containing `day`. */
export function startOfWeek(day: DayKey, weekStartsOn: Weekday = 1): DayKey {
  const offset = (weekdayOf(day) - weekStartsOn + 7) % 7;
  return addDays(day, -offset);
}

export function startOfMonth(day: DayKey): DayKey {
  return `${day.slice(0, 7)}-01`;
}

export function daysInRange(from: DayKey, to: DayKey): DayKey[] {
  const out: DayKey[] = [];
  const n = diffDays(from, to);
  for (let i = 0; i <= n && i < 400; i++) out.push(addDays(from, i));
  return out;
}

export function minutesOf(time: TimeOfDay): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function makeTime(hours: number, minutes: number): TimeOfDay | null {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Local timestamp for a day + optional time (midnight when no time). */
export function toTimestamp(day: DayKey, time?: TimeOfDay | null): number {
  const d = dayDate(day);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  }
  return d.getTime();
}

export function nowTime(now: number): TimeOfDay {
  const d = new Date(now);
  return makeTime(d.getHours(), d.getMinutes()) ?? '00:00';
}

export function formatTime(time: TimeOfDay): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12} ${suffix}` : `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "Today", "Tomorrow", "Yesterday", "Wed, Oct 14" (with the year when it isn't this year). */
export function formatDay(day: DayKey, today: DayKey, opts: { relative?: boolean } = {}): string {
  const relative = opts.relative ?? true;
  if (relative) {
    const delta = diffDays(today, day);
    if (delta === 0) return 'Today';
    if (delta === 1) return 'Tomorrow';
    if (delta === -1) return 'Yesterday';
  }
  const d = dayDate(day);
  const base = `${WEEKDAY_SHORT[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  return d.getFullYear() === dayDate(today).getFullYear() ? base : `${base}, ${d.getFullYear()}`;
}

/**
 * `formatDay` for use mid-sentence ("was due yesterday", "due Thu, Oct 8"):
 * only the relative words are lowercased, never weekday or month names.
 */
export function formatDayInline(day: DayKey, today: DayKey): string {
  const text = formatDay(day, today);
  return text === 'Today' || text === 'Tomorrow' || text === 'Yesterday' ? text.toLowerCase() : text;
}

export function formatMonth(day: DayKey): string {
  const d = dayDate(day);
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** Weeks (Monday first) covering a whole month, padded with neighbouring days. */
export function monthGrid(day: DayKey): DayKey[][] {
  const first = startOfMonth(day);
  const d = dayDate(first);
  const last = makeDay(d.getFullYear(), d.getMonth(), daysInMonth(d.getFullYear(), d.getMonth()));
  const weeks: DayKey[][] = [];
  let cursor = startOfWeek(first);
  while (diffDays(cursor, last) >= 0 || weeks.length === 0) {
    const week: DayKey[] = [];
    for (let i = 0; i < 7; i++) week.push(addDays(cursor, i));
    weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
