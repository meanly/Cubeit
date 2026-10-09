import type { DayKey, TimeOfDay, Weekday } from './dates';

/**
 * Calendar, habits & routines, chores and the journal live in one versioned
 * document (`cubeit.planner`) next to the save and the memories, in the same
 * local SQLite key-value table. Bump PLANNER_VERSION and add a step to
 * `plannerDoc.ts` whenever this shape changes.
 */
export const PLANNER_VERSION = 1;
export const PLANNER_KEY = 'cubeit.planner';

export interface CalendarEvent {
  id: string;
  title: string;
  day: DayKey;
  allDay: boolean;
  /** Start time; absent for all-day events. */
  start?: TimeOfDay;
  /** Optional end time (same day, after `start`). */
  end?: TimeOfDay;
  notes?: string;
  /** Minutes before the start to remind (0 = at the start); absent = no reminder. */
  reminderMin?: number;
  /** When the event was marked done. */
  doneAt?: number;
  createdAt: number;
  updatedAt: number;
}

export type HabitSchedule = { type: 'daily' } | { type: 'days'; days: Weekday[] };

export interface RoutineStep {
  id: string;
  title: string;
}

export interface Habit {
  id: string;
  title: string;
  /** A routine is a habit with ordered steps; finishing every step completes it for the day. */
  kind: 'habit' | 'routine';
  schedule: HabitSchedule;
  steps: RoutineStep[];
  /** Daily reminder time on scheduled days. */
  reminder?: TimeOfDay;
  archived: boolean;
  /** First day it counts toward streaks (the day it was created). */
  startDay: DayKey;
  createdAt: number;
  updatedAt: number;
}

/** One completion of a habit on one day. (habitId, day) is unique. */
export interface HabitLog {
  habitId: string;
  day: DayKey;
  at: number;
}

export const CHORE_CATEGORIES = ['home', 'kitchen', 'laundry', 'outdoor', 'errand', 'pets', 'other'] as const;
export type ChoreCategory = (typeof CHORE_CATEGORIES)[number];

export interface Recurrence {
  every: number;
  unit: 'day' | 'week' | 'month';
}

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
}

/**
 * A chore. A recurring chore is one series with exactly one open occurrence
 * (`due`); completing it logs that occurrence and moves `due` to the next one,
 * so nothing is generated on launch and nothing can be duplicated.
 */
export interface Chore {
  id: string;
  title: string;
  notes?: string;
  category: ChoreCategory;
  due?: DayKey;
  dueTime?: TimeOfDay;
  recurrence?: Recurrence;
  /** Day of month monthly repeats return to (so Jan 31 → Feb 28 → Mar 31). */
  anchorDay?: number;
  checklist: ChecklistItem[];
  reminder: boolean;
  /** Set when a one-off chore is done (recurring chores never set it). */
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** History of finished chore occurrences (one-off and recurring). */
export interface ChoreCompletion {
  choreId: string;
  title: string;
  /** The occurrence that was completed (its due day), or null for an undated chore. */
  due: DayKey | null;
  at: number;
}

export const MOODS = ['great', 'good', 'okay', 'low', 'rough'] as const;
export type Mood = (typeof MOODS)[number];

export interface JournalEntry {
  id: string;
  day: DayKey;
  title?: string;
  text: string;
  mood?: Mood;
  /** The guided prompt it answers, if any. */
  prompt?: string;
  /** Local file URIs of attached photos (copied into the app's documents folder). */
  images: string[];
  createdAt: number;
  updatedAt: number;
}

export interface PlannerData {
  events: CalendarEvent[];
  habits: Habit[];
  habitLogs: HabitLog[];
  /** Routine steps ticked off on a day before the routine is complete: key "habitId|day". */
  stepChecks: Record<string, string[]>;
  chores: Chore[];
  choreHistory: ChoreCompletion[];
  journal: JournalEntry[];
  /** Keys of rewards already given (e.g. "habit:h1:2026-10-12"), so stars are never paid twice. */
  rewards: string[];
}

export interface PlannerDoc extends PlannerData {
  version: typeof PLANNER_VERSION;
}

export const LIMITS = {
  title: 120,
  notes: 1000,
  journal: 8000,
  steps: 20,
  checklist: 30,
  events: 3000,
  habits: 100,
  habitLogs: 20_000,
  chores: 500,
  choreHistory: 2000,
  journalEntries: 3000,
  images: 4,
  rewards: 4000,
} as const;
