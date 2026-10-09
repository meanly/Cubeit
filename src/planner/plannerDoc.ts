import { bool, int, isObj, num, oneOf, str, strArray, type Obj } from '../state/validate';
import { isDayKey, isTimeOfDay, type Weekday } from './dates';
import { emptyPlanner } from './ops';
import {
  CHORE_CATEGORIES,
  LIMITS,
  MOODS,
  PLANNER_VERSION,
  type CalendarEvent,
  type Chore,
  type ChoreCompletion,
  type Habit,
  type HabitLog,
  type JournalEntry,
  type PlannerDoc,
} from './types';

/**
 * Version-to-version upgrade steps for the planner document, like the save's
 * `MIGRATIONS`: `PLANNER_MIGRATIONS[n]` turns version n into n+1. Version 1 is
 * the first shape, so it's empty — add steps here, never edit old ones.
 */
const PLANNER_MIGRATIONS: Record<number, (doc: Obj) => Obj> = {};

export function emptyPlannerDoc(): PlannerDoc {
  return { version: PLANNER_VERSION, ...emptyPlanner() };
}

const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const text = (v: unknown, max: number) => str(v, '', max).trim();
const optText = (v: unknown, max: number) => {
  const t = text(v, max);
  return t ? t : undefined;
};
const ts = (v: unknown) => num(v, 0, 0);

function uniqueBy<T>(items: T[], key: (t: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = key(i);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function sanitizeEvent(e: Obj): CalendarEvent | null {
  const id = text(e.id, 64);
  const title = text(e.title, LIMITS.title);
  if (!id || !title || !isDayKey(e.day)) return null;
  const allDay = bool(e.allDay, !isTimeOfDay(e.start));
  const start = isTimeOfDay(e.start) ? e.start : undefined;
  if (!allDay && !start) return null;
  const end = !allDay && isTimeOfDay(e.end) && start && e.end > start ? e.end : undefined;
  const event: CalendarEvent = { id, title, day: e.day, allDay, createdAt: ts(e.createdAt), updatedAt: ts(e.updatedAt) };
  if (!allDay) event.start = start;
  if (end) event.end = end;
  const notes = optText(e.notes, LIMITS.notes);
  if (notes) event.notes = notes;
  if (typeof e.reminderMin === 'number' && Number.isFinite(e.reminderMin) && e.reminderMin >= 0) event.reminderMin = Math.round(e.reminderMin);
  if (typeof e.doneAt === 'number' && e.doneAt > 0) event.doneAt = e.doneAt;
  return event;
}

function sanitizeHabit(h: Obj): Habit | null {
  const id = text(h.id, 64);
  const title = text(h.title, LIMITS.title);
  if (!id || !title) return null;
  const schedule = isObj(h.schedule) ? h.schedule : {};
  const days = Array.isArray(schedule.days)
    ? (Array.from(new Set(schedule.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))).sort() as Weekday[])
    : [];
  const kind = oneOf(h.kind, ['habit', 'routine'] as const, 'habit');
  const steps = list(h.steps)
    .map((s) => ({ id: text(s.id, 64), title: text(s.title, LIMITS.title) }))
    .filter((s) => s.id && s.title)
    .slice(0, LIMITS.steps);
  const habit: Habit = {
    id,
    title,
    kind: kind === 'routine' && steps.length > 0 ? 'routine' : 'habit',
    schedule: schedule.type === 'days' && days.length > 0 && days.length < 7 ? { type: 'days', days } : { type: 'daily' },
    steps: kind === 'routine' ? uniqueBy(steps, (s) => s.id) : [],
    archived: bool(h.archived, false),
    startDay: isDayKey(h.startDay) ? h.startDay : '2000-01-01',
    createdAt: ts(h.createdAt),
    updatedAt: ts(h.updatedAt),
  };
  if (isTimeOfDay(h.reminder)) habit.reminder = h.reminder;
  return habit;
}

function sanitizeChore(c: Obj): Chore | null {
  const id = text(c.id, 64);
  const title = text(c.title, LIMITS.title);
  if (!id || !title) return null;
  const chore: Chore = {
    id,
    title,
    category: oneOf(c.category, CHORE_CATEGORIES, 'other'),
    checklist: list(c.checklist)
      .map((i) => ({ id: text(i.id, 64), title: text(i.title, LIMITS.title), done: bool(i.done, false) }))
      .filter((i) => i.id && i.title)
      .slice(0, LIMITS.checklist),
    reminder: false,
    createdAt: ts(c.createdAt),
    updatedAt: ts(c.updatedAt),
  };
  const notes = optText(c.notes, LIMITS.notes);
  if (notes) chore.notes = notes;
  if (isDayKey(c.due)) {
    chore.due = c.due;
    chore.reminder = bool(c.reminder, false);
    if (isTimeOfDay(c.dueTime)) chore.dueTime = c.dueTime;
    const r = isObj(c.recurrence) ? c.recurrence : null;
    if (r) {
      const unit = oneOf(r.unit, ['day', 'week', 'month'] as const, 'week');
      chore.recurrence = { every: int(r.every, 1, 1, 365), unit };
      if (unit === 'month') chore.anchorDay = int(c.anchorDay, Number(c.due.slice(8, 10)), 1, 31);
    }
  }
  if (!chore.recurrence && typeof c.completedAt === 'number' && c.completedAt > 0) chore.completedAt = c.completedAt;
  return chore;
}

function sanitizeJournal(j: Obj): JournalEntry | null {
  const id = text(j.id, 64);
  const body = str(j.text, '', LIMITS.journal).trim();
  if (!id || !body || !isDayKey(j.day)) return null;
  const entry: JournalEntry = {
    id,
    day: j.day,
    text: body,
    images: strArray(j.images, LIMITS.images, 500).filter((u) => u.startsWith('file:')),
    createdAt: ts(j.createdAt),
    updatedAt: ts(j.updatedAt),
  };
  const title = optText(j.title, LIMITS.title);
  if (title) entry.title = title;
  if (typeof j.mood === 'string' && (MOODS as readonly string[]).includes(j.mood)) entry.mood = j.mood as JournalEntry['mood'];
  const prompt = optText(j.prompt, 200);
  if (prompt) entry.prompt = prompt;
  return entry;
}

/** Upgrade and repair a stored planner document. Anything invalid is dropped, never guessed at. */
export function migratePlanner(raw: unknown): PlannerDoc {
  let doc: Obj = isObj(raw) ? raw : {};
  let version = int(doc.version, 1, 0);
  while (version < PLANNER_VERSION) {
    const step = PLANNER_MIGRATIONS[version];
    if (step) doc = step(doc);
    version += 1;
  }

  const habits = uniqueBy(list(doc.habits).map(sanitizeHabit).filter((h): h is Habit => !!h), (h) => h.id);
  const habitIds = new Set(habits.map((h) => h.id));
  const habitLogs = uniqueBy(
    list(doc.habitLogs)
      .map((l) => ({ habitId: text(l.habitId, 64), day: l.day, at: ts(l.at) }))
      .filter((l): l is HabitLog => habitIds.has(l.habitId) && isDayKey(l.day)),
    (l) => `${l.habitId}|${l.day}`,
  ).slice(-LIMITS.habitLogs);

  const stepChecks: Record<string, string[]> = {};
  if (isObj(doc.stepChecks)) {
    for (const [key, value] of Object.entries(doc.stepChecks)) {
      const [habitId, day] = key.split('|');
      if (habitIds.has(habitId) && isDayKey(day)) stepChecks[key] = strArray(value, LIMITS.steps, 64);
    }
  }

  const choreHistory = list(doc.choreHistory)
    .map((c) => ({
      choreId: text(c.choreId, 64),
      title: text(c.title, LIMITS.title),
      due: isDayKey(c.due) ? c.due : null,
      at: ts(c.at),
    }))
    .filter((c): c is ChoreCompletion => !!c.choreId && !!c.title && c.at > 0)
    .slice(-LIMITS.choreHistory);

  return {
    version: PLANNER_VERSION,
    events: uniqueBy(list(doc.events).map(sanitizeEvent).filter((e): e is CalendarEvent => !!e), (e) => e.id).slice(-LIMITS.events),
    habits,
    habitLogs,
    stepChecks,
    chores: uniqueBy(list(doc.chores).map(sanitizeChore).filter((c): c is Chore => !!c), (c) => c.id).slice(-LIMITS.chores),
    choreHistory,
    journal: uniqueBy(list(doc.journal).map(sanitizeJournal).filter((j): j is JournalEntry => !!j), (j) => j.id).slice(-LIMITS.journalEntries),
    rewards: Array.from(new Set(strArray(doc.rewards, LIMITS.rewards, 120))),
  };
}
