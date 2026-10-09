import { addDays, diffDays, startOfWeek, weekdayOf, type DayKey } from './dates';
import type { Habit, HabitLog, HabitSchedule } from './types';

export function isScheduled(schedule: HabitSchedule, day: DayKey): boolean {
  return schedule.type === 'daily' || schedule.days.includes(weekdayOf(day));
}

export function logDays(logs: readonly HabitLog[], habitId: string): Set<DayKey> {
  const days = new Set<DayKey>();
  for (const l of logs) if (l.habitId === habitId) days.add(l.day);
  return days;
}

export interface HabitStats {
  /** Consecutive scheduled days completed, ending today (or the last scheduled day if today isn't done yet). */
  streak: number;
  best: number;
  doneToday: boolean;
  dueToday: boolean;
  /** This week (Monday–Sunday): completions on scheduled days so far / scheduled days in the whole week. */
  week: { done: number; scheduled: number };
  /** Completion rate over the last 28 days' scheduled days (0..1), or null if nothing was scheduled yet. */
  rate28: number | null;
  total: number;
}

/**
 * Streaks only count scheduled days, start on the habit's first day, and a
 * day still in progress (today, not done yet) never breaks one. Completions
 * on unscheduled days count toward totals but don't extend or break streaks.
 */
export function habitStats(habit: Habit, logs: readonly HabitLog[], today: DayKey): HabitStats {
  const done = logDays(logs, habit.id);
  const scheduled = (day: DayKey) => diffDays(habit.startDay, day) >= 0 && isScheduled(habit.schedule, day);

  let streak = 0;
  let cursor = today;
  if (scheduled(today) && !done.has(today)) cursor = addDays(today, -1);
  for (let i = 0; i < 3660 && diffDays(habit.startDay, cursor) >= 0; i++) {
    if (scheduled(cursor)) {
      if (!done.has(cursor)) break;
      streak += 1;
    }
    cursor = addDays(cursor, -1);
  }

  let best = 0;
  let run = 0;
  const span = Math.min(3660, Math.max(0, diffDays(habit.startDay, today)));
  for (let i = 0; i <= span; i++) {
    const day = addDays(habit.startDay, i);
    if (!scheduled(day)) continue;
    if (done.has(day)) {
      run += 1;
      best = Math.max(best, run);
    } else if (day !== today) {
      run = 0;
    }
  }

  const weekStart = startOfWeek(today);
  let weekDone = 0;
  let weekScheduled = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    if (!scheduled(day)) continue;
    weekScheduled += 1;
    if (done.has(day) && diffDays(day, today) >= 0) weekDone += 1;
  }

  let windowScheduled = 0;
  let windowDone = 0;
  for (let i = 0; i < 28; i++) {
    const day = addDays(today, -i);
    if (!scheduled(day)) continue;
    // Today only counts once it's done, so an unfinished morning doesn't drag the rate down.
    if (day === today && !done.has(day)) continue;
    windowScheduled += 1;
    if (done.has(day)) windowDone += 1;
  }

  return {
    streak,
    best: Math.max(best, streak),
    doneToday: done.has(today),
    dueToday: scheduled(today),
    week: { done: weekDone, scheduled: weekScheduled },
    rate28: windowScheduled > 0 ? windowDone / windowScheduled : null,
    total: done.size,
  };
}

/** A short, truthful line about real progress (used by the character and the Habits tab). */
export function encouragement(habit: Habit, stats: HabitStats): string {
  const t = habit.title;
  if (stats.doneToday && stats.streak >= 7) return `${stats.streak} in a row for “${t}”. That's a real habit now!`;
  if (stats.doneToday && stats.streak >= 2) return `“${t}” done — ${stats.streak} scheduled days in a row!`;
  if (stats.doneToday) return `“${t}” done for today. Nice!`;
  if (!stats.dueToday) return `“${t}” isn't scheduled today. Rest is part of it.`;
  if (stats.streak >= 3) return `You're on a ${stats.streak}-day streak with “${t}”. Keep it going today?`;
  if (stats.total === 0) return `First time is the hardest. Want to do “${t}” today?`;
  if (stats.week.done > 0) return `${stats.week.done} of ${stats.week.scheduled} this week for “${t}”. Today counts too!`;
  return `A fresh start with “${t}” today?`;
}

export function scheduleLabel(schedule: HabitSchedule): string {
  if (schedule.type === 'daily' || schedule.days.length === 7) return 'Every day';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const sorted = [...schedule.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (sorted.length === 5 && sorted.every((d) => d >= 1 && d <= 5)) return 'Weekdays';
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) return 'Weekends';
  return sorted.map((d) => names[d]).join(' · ');
}
