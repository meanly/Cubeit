import { addDays, addMonths, diffDays, type DayKey } from './dates';
import type { Chore, Recurrence } from './types';

/** The occurrence after `due` — computed from the schedule, never from "now", so it's always predictable. */
export function nextOccurrence(due: DayKey, recurrence: Recurrence, anchorDay?: number): DayKey {
  const every = Math.max(1, Math.round(recurrence.every));
  switch (recurrence.unit) {
    case 'day':
      return addDays(due, every);
    case 'week':
      return addDays(due, every * 7);
    case 'month':
      return addMonths(due, every, anchorDay);
  }
}

/** The next `count` occurrences starting at `due` (for previews). */
export function upcomingOccurrences(due: DayKey, recurrence: Recurrence, count: number, anchorDay?: number): DayKey[] {
  const out: DayKey[] = [];
  let cursor = due;
  for (let i = 0; i < count; i++) {
    out.push(cursor);
    cursor = nextOccurrence(cursor, recurrence, anchorDay);
  }
  return out;
}

export function recurrenceLabel(r: Recurrence): string {
  const unit = r.every === 1 ? r.unit : `${r.unit}s`;
  if (r.every === 1) return r.unit === 'day' ? 'Every day' : r.unit === 'week' ? 'Every week' : 'Every month';
  return `Every ${r.every} ${unit}`;
}

export type ChoreStatus = 'done' | 'overdue' | 'today' | 'upcoming' | 'someday';

export function choreStatus(chore: Chore, today: DayKey): ChoreStatus {
  if (chore.completedAt && !chore.recurrence) return 'done';
  if (!chore.due) return 'someday';
  const delta = diffDays(today, chore.due);
  if (delta < 0) return 'overdue';
  if (delta === 0) return 'today';
  return 'upcoming';
}
