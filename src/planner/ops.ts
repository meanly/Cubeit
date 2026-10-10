import { diffDays, formatDayInline, isDayKey, isTimeOfDay, minutesOf, type DayKey, type TimeOfDay, type Weekday } from './dates';
import { canUndoCompletion, nextOccurrence } from './recurrence';
import {
  LIMITS,
  type CalendarEvent,
  type Chore,
  type ChoreCategory,
  type Habit,
  type HabitSchedule,
  type JournalEntry,
  type Mood,
  type PlannerData,
  type Recurrence,
} from './types';

/**
 * Pure planner operations: each takes the current data and returns new data
 * plus a result. The store wraps them; tests call them directly. Inputs are
 * validated here too, so no caller (UI, parser or model) can store a bad shape.
 */

let counter = 0;
export function makeId(prefix: string, now: number = Date.now()): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}_${now.toString(36)}_${counter.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function emptyPlanner(): PlannerData {
  return { events: [], habits: [], habitLogs: [], stepChecks: {}, chores: [], choreHistory: [], journal: [], rewards: [] };
}

export class PlannerError extends Error {}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);
const cleanBlock = (s: string, max: number) => s.replace(/\r\n/g, '\n').trim().slice(0, max);

function requireTitle(title: string): string {
  const t = clean(title, LIMITS.title);
  if (!t) throw new PlannerError('A title is needed.');
  return t;
}

// ───────────────────────── calendar ─────────────────────────

export interface EventDraft {
  title: string;
  day: DayKey;
  allDay: boolean;
  start?: TimeOfDay;
  end?: TimeOfDay;
  notes?: string;
  reminderMin?: number;
}

export function validateEventDraft(draft: EventDraft): EventDraft {
  const title = requireTitle(draft.title);
  if (!isDayKey(draft.day)) throw new PlannerError('That date isn’t valid.');
  if (!draft.allDay && !isTimeOfDay(draft.start)) throw new PlannerError('Pick a start time, or make it all-day.');
  if (draft.end !== undefined && !isTimeOfDay(draft.end)) throw new PlannerError('That end time isn’t valid.');
  if (!draft.allDay && draft.start && draft.end && minutesOf(draft.end) <= minutesOf(draft.start)) {
    throw new PlannerError('The end time has to be after the start time.');
  }
  const reminderMin =
    typeof draft.reminderMin === 'number' && Number.isFinite(draft.reminderMin) && draft.reminderMin >= 0
      ? Math.min(Math.round(draft.reminderMin), 60 * 24 * 7)
      : undefined;
  const notes = draft.notes ? cleanBlock(draft.notes, LIMITS.notes) : '';
  return {
    title,
    day: draft.day,
    allDay: draft.allDay,
    ...(draft.allDay ? {} : { start: draft.start }),
    ...(!draft.allDay && draft.end ? { end: draft.end } : {}),
    ...(notes ? { notes } : {}),
    ...(reminderMin !== undefined ? { reminderMin } : {}),
  };
}

export function addEvent(data: PlannerData, draft: EventDraft, now: number) {
  const valid = validateEventDraft(draft);
  const event: CalendarEvent = { id: makeId('ev', now), ...valid, createdAt: now, updatedAt: now };
  return { data: { ...data, events: [...data.events, event].slice(-LIMITS.events) }, event };
}

export function updateEvent(data: PlannerData, id: string, patch: Partial<EventDraft>, now: number) {
  const current = data.events.find((e) => e.id === id);
  if (!current) throw new PlannerError('That event no longer exists.');
  const merged: EventDraft = {
    title: patch.title ?? current.title,
    day: patch.day ?? current.day,
    allDay: patch.allDay ?? current.allDay,
    start: 'start' in patch ? patch.start : current.start,
    end: 'end' in patch ? patch.end : current.end,
    notes: 'notes' in patch ? patch.notes : current.notes,
    reminderMin: 'reminderMin' in patch ? patch.reminderMin : current.reminderMin,
  };
  // Moving the start past the old end drops the end rather than failing.
  if (!merged.allDay && merged.start && merged.end && minutesOf(merged.end) <= minutesOf(merged.start) && 'start' in patch && !('end' in patch)) {
    merged.end = undefined;
  }
  const valid = validateEventDraft(merged);
  const event: CalendarEvent = { id, ...valid, ...(current.doneAt ? { doneAt: current.doneAt } : {}), createdAt: current.createdAt, updatedAt: now };
  return { data: { ...data, events: data.events.map((e) => (e.id === id ? event : e)) }, event };
}

export function setEventDone(data: PlannerData, id: string, done: boolean, now: number) {
  const current = data.events.find((e) => e.id === id);
  if (!current) throw new PlannerError('That event no longer exists.');
  const changed = done !== !!current.doneAt;
  const event: CalendarEvent = done ? { ...current, doneAt: current.doneAt ?? now, updatedAt: now } : { ...current, updatedAt: now };
  if (!done) delete event.doneAt;
  return { data: { ...data, events: data.events.map((e) => (e.id === id ? event : e)) }, event, changed };
}

export function deleteEvent(data: PlannerData, id: string) {
  return { ...data, events: data.events.filter((e) => e.id !== id) };
}

/** Events on a day, all-day first, then by start time. */
export function eventsOn(events: readonly CalendarEvent[], day: DayKey): CalendarEvent[] {
  return sortEvents(events.filter((e) => e.day === day));
}

export function eventsBetween(events: readonly CalendarEvent[], from: DayKey, to: DayKey): CalendarEvent[] {
  return sortEvents(events.filter((e) => diffDays(from, e.day) >= 0 && diffDays(e.day, to) >= 0));
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return (a.start ?? '').localeCompare(b.start ?? '');
  });
}

// ───────────────────────── habits & routines ─────────────────────────

export interface HabitDraft {
  title: string;
  kind: 'habit' | 'routine';
  schedule: HabitSchedule;
  steps?: string[];
  reminder?: TimeOfDay;
}

function validSchedule(s: HabitSchedule): HabitSchedule {
  if (s.type === 'daily') return { type: 'daily' };
  const days = Array.from(new Set(s.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort() as Weekday[];
  if (days.length === 0) throw new PlannerError('Pick at least one day.');
  if (days.length === 7) return { type: 'daily' };
  return { type: 'days', days };
}

export function addHabit(data: PlannerData, draft: HabitDraft, today: DayKey, now: number) {
  const title = requireTitle(draft.title);
  if (data.habits.filter((h) => !h.archived).length >= LIMITS.habits) throw new PlannerError('That’s a lot of habits! Archive one first.');
  if (data.habits.some((h) => !h.archived && h.title.toLowerCase() === title.toLowerCase())) {
    throw new PlannerError(`You already have a habit called “${title}”.`);
  }
  if (draft.reminder !== undefined && !isTimeOfDay(draft.reminder)) throw new PlannerError('That reminder time isn’t valid.');
  const steps = (draft.steps ?? [])
    .map((s) => clean(s, LIMITS.title))
    .filter(Boolean)
    .slice(0, LIMITS.steps)
    .map((t, i) => ({ id: `s${i}_${now.toString(36)}`, title: t }));
  if (draft.kind === 'routine' && steps.length === 0) throw new PlannerError('A routine needs at least one step.');
  const habit: Habit = {
    id: makeId('hb', now),
    title,
    kind: draft.kind,
    schedule: validSchedule(draft.schedule),
    steps: draft.kind === 'routine' ? steps : [],
    ...(draft.reminder ? { reminder: draft.reminder } : {}),
    archived: false,
    startDay: today,
    createdAt: now,
    updatedAt: now,
  };
  return { data: { ...data, habits: [...data.habits, habit] }, habit };
}

export function updateHabit(
  data: PlannerData,
  id: string,
  patch: { title?: string; schedule?: HabitSchedule; steps?: { id?: string; title: string }[]; reminder?: TimeOfDay | null },
  now: number,
) {
  const current = data.habits.find((h) => h.id === id);
  if (!current) throw new PlannerError('That habit no longer exists.');
  const habit: Habit = { ...current, updatedAt: now };
  if (patch.title !== undefined) habit.title = requireTitle(patch.title);
  if (patch.schedule) habit.schedule = validSchedule(patch.schedule);
  if (patch.reminder === null) delete habit.reminder;
  else if (patch.reminder !== undefined) {
    if (!isTimeOfDay(patch.reminder)) throw new PlannerError('That reminder time isn’t valid.');
    habit.reminder = patch.reminder;
  }
  if (patch.steps && current.kind === 'routine') {
    const steps = patch.steps
      .map((s, i) => ({ id: s.id ?? `s${i}_${now.toString(36)}`, title: clean(s.title, LIMITS.title) }))
      .filter((s) => s.title)
      .slice(0, LIMITS.steps);
    if (steps.length === 0) throw new PlannerError('A routine needs at least one step.');
    habit.steps = steps;
  }
  return { data: { ...data, habits: data.habits.map((h) => (h.id === id ? habit : h)) }, habit };
}

export function setHabitArchived(data: PlannerData, id: string, archived: boolean, now: number) {
  return { ...data, habits: data.habits.map((h) => (h.id === id ? { ...h, archived, updatedAt: now } : h)) };
}

export function deleteHabit(data: PlannerData, id: string): PlannerData {
  const stepChecks = Object.fromEntries(Object.entries(data.stepChecks).filter(([k]) => !k.startsWith(`${id}|`)));
  return {
    ...data,
    habits: data.habits.filter((h) => h.id !== id),
    habitLogs: data.habitLogs.filter((l) => l.habitId !== id),
    stepChecks,
  };
}

/** Mark a habit done on a day. Idempotent: a second completion on the same day changes nothing. */
export function logHabit(data: PlannerData, id: string, day: DayKey, today: DayKey, now: number) {
  const habit = data.habits.find((h) => h.id === id);
  if (!habit) throw new PlannerError('That habit no longer exists.');
  if (!isDayKey(day)) throw new PlannerError('That date isn’t valid.');
  if (diffDays(day, today) < 0) throw new PlannerError('You can’t complete a habit in the future.');
  if (data.habitLogs.some((l) => l.habitId === id && l.day === day)) return { data, added: false, habit };
  const habitLogs = [...data.habitLogs, { habitId: id, day, at: now }].slice(-LIMITS.habitLogs);
  return { data: { ...data, habitLogs }, added: true, habit };
}

export function unlogHabit(data: PlannerData, id: string, day: DayKey): PlannerData {
  const stepChecks = { ...data.stepChecks };
  delete stepChecks[`${id}|${day}`];
  return { ...data, habitLogs: data.habitLogs.filter((l) => !(l.habitId === id && l.day === day)), stepChecks };
}

/** Tick a routine step; ticking the last one completes the routine for that day. */
export function setRoutineStep(data: PlannerData, id: string, day: DayKey, stepId: string, checked: boolean, today: DayKey, now: number) {
  const habit = data.habits.find((h) => h.id === id);
  if (!habit) throw new PlannerError('That routine no longer exists.');
  const key = `${id}|${day}`;
  const current = new Set(data.stepChecks[key] ?? []);
  if (checked) current.add(stepId);
  else current.delete(stepId);
  const valid = habit.steps.filter((s) => current.has(s.id)).map((s) => s.id);
  let next: PlannerData = { ...data, stepChecks: { ...data.stepChecks, [key]: valid } };
  let completed = false;
  if (valid.length === habit.steps.length && habit.steps.length > 0) {
    const r = logHabit(next, id, day, today, now);
    next = r.data;
    completed = r.added;
  } else if (!checked) {
    // Unticking a step reopens a completed routine.
    next = { ...next, habitLogs: next.habitLogs.filter((l) => !(l.habitId === id && l.day === day)) };
  }
  return { data: next, completed };
}

// ───────────────────────── chores ─────────────────────────

export interface ChoreDraft {
  title: string;
  notes?: string;
  category?: ChoreCategory;
  due?: DayKey;
  dueTime?: TimeOfDay;
  recurrence?: Recurrence;
  checklist?: string[];
  reminder?: boolean;
}

function validRecurrence(r: Recurrence | undefined): Recurrence | undefined {
  if (!r) return undefined;
  if (!['day', 'week', 'month'].includes(r.unit)) throw new PlannerError('That repeat isn’t valid.');
  const every = Math.round(r.every);
  if (!Number.isFinite(every) || every < 1 || every > 365) throw new PlannerError('Repeat every 1–365.');
  return { every, unit: r.unit };
}

export function addChore(data: PlannerData, draft: ChoreDraft, today: DayKey, now: number) {
  const title = requireTitle(draft.title);
  if (data.chores.length >= LIMITS.chores) throw new PlannerError('Too many chores saved. Delete some first.');
  if (draft.due !== undefined && !isDayKey(draft.due)) throw new PlannerError('That due date isn’t valid.');
  if (draft.dueTime !== undefined && !isTimeOfDay(draft.dueTime)) throw new PlannerError('That time isn’t valid.');
  const recurrence = validRecurrence(draft.recurrence);
  // A repeating chore needs a first occurrence; default to today.
  const due = draft.due ?? (recurrence ? today : undefined);
  const notes = draft.notes ? cleanBlock(draft.notes, LIMITS.notes) : '';
  const chore: Chore = {
    id: makeId('ch', now),
    title,
    category: draft.category ?? 'other',
    ...(notes ? { notes } : {}),
    ...(due ? { due } : {}),
    ...(due && draft.dueTime ? { dueTime: draft.dueTime } : {}),
    ...(recurrence ? { recurrence } : {}),
    ...(recurrence?.unit === 'month' && due ? { anchorDay: Number(due.slice(8, 10)) } : {}),
    checklist: (draft.checklist ?? [])
      .map((t) => clean(t, LIMITS.title))
      .filter(Boolean)
      .slice(0, LIMITS.checklist)
      .map((t, i) => ({ id: `c${i}_${now.toString(36)}`, title: t, done: false })),
    reminder: !!draft.reminder && !!due,
    createdAt: now,
    updatedAt: now,
  };
  return { data: { ...data, chores: [...data.chores, chore] }, chore };
}

export function updateChore(data: PlannerData, id: string, patch: Omit<Partial<ChoreDraft>, 'due' | 'dueTime' | 'recurrence'> & { recurrence?: Recurrence | null; due?: DayKey | null; dueTime?: TimeOfDay | null }, now: number) {
  const current = data.chores.find((c) => c.id === id);
  if (!current) throw new PlannerError('That chore no longer exists.');
  const chore: Chore = { ...current, updatedAt: now };
  if (patch.title !== undefined) chore.title = requireTitle(patch.title);
  if (patch.notes !== undefined) {
    const notes = cleanBlock(patch.notes, LIMITS.notes);
    if (notes) chore.notes = notes;
    else delete chore.notes;
  }
  if (patch.category) chore.category = patch.category;
  if (patch.due === null) {
    delete chore.due;
    delete chore.dueTime;
  } else if (patch.due !== undefined) {
    if (!isDayKey(patch.due)) throw new PlannerError('That due date isn’t valid.');
    chore.due = patch.due;
  }
  if (patch.dueTime === null) delete chore.dueTime;
  else if (patch.dueTime !== undefined) {
    if (!isTimeOfDay(patch.dueTime)) throw new PlannerError('That time isn’t valid.');
    chore.dueTime = patch.dueTime;
  }
  if (patch.recurrence === null) {
    delete chore.recurrence;
    delete chore.anchorDay;
  } else if (patch.recurrence !== undefined) {
    chore.recurrence = validRecurrence(patch.recurrence);
    if (!chore.due) throw new PlannerError('A repeating chore needs a due date.');
  }
  if (chore.recurrence?.unit === 'month' && chore.due) chore.anchorDay = Number(chore.due.slice(8, 10));
  else delete chore.anchorDay;
  if (patch.checklist) {
    const old = new Map(current.checklist.map((c) => [c.title, c]));
    chore.checklist = patch.checklist
      .map((t) => clean(t, LIMITS.title))
      .filter(Boolean)
      .slice(0, LIMITS.checklist)
      .map((t, i) => old.get(t) ?? { id: `c${i}_${now.toString(36)}`, title: t, done: false });
  }
  if (patch.reminder !== undefined) chore.reminder = patch.reminder;
  if (!chore.due) chore.reminder = false;
  return { data: { ...data, chores: data.chores.map((c) => (c.id === id ? chore : c)) }, chore };
}

export function deleteChore(data: PlannerData, id: string): PlannerData {
  return { ...data, chores: data.chores.filter((c) => c.id !== id) };
}

export function toggleChecklistItem(data: PlannerData, id: string, itemId: string, now: number): PlannerData {
  return {
    ...data,
    chores: data.chores.map((c) =>
      c.id === id ? { ...c, updatedAt: now, checklist: c.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) } : c,
    ),
  };
}

/**
 * Complete the chore's current occurrence. `expectedDue` must match the open
 * occurrence (so a double tap or a stale screen can't complete the next one);
 * a recurring chore moves on to its next occurrence with a fresh checklist.
 * A recurring chore's occurrence due after `today` can't be finished yet (so
 * ticking it twice can't skip ahead); a one-off chore can be done early.
 */
export function completeChore(data: PlannerData, id: string, expectedDue: DayKey | null, today: DayKey, now: number) {
  const chore = data.chores.find((c) => c.id === id);
  if (!chore) throw new PlannerError('That chore no longer exists.');
  if ((chore.due ?? null) !== expectedDue || (chore.completedAt && !chore.recurrence)) {
    return { data, completed: false, chore };
  }
  if (chore.recurrence && chore.due && diffDays(today, chore.due) > 0) throw new PlannerError(`“${chore.title}” isn’t due until ${formatDayInline(chore.due, today)}. You can check it off then.`);
  const record = { choreId: id, title: chore.title, due: chore.due ?? null, at: now };
  const choreHistory = [...data.choreHistory, record].slice(-LIMITS.choreHistory);
  let next: Chore;
  if (chore.recurrence && chore.due) {
    next = {
      ...chore,
      due: nextOccurrence(chore.due, chore.recurrence, chore.anchorDay),
      checklist: chore.checklist.map((i) => ({ ...i, done: false })),
      updatedAt: now,
    };
  } else {
    next = { ...chore, completedAt: now, updatedAt: now };
  }
  return { data: { ...data, chores: data.chores.map((c) => (c.id === id ? next : c)), choreHistory }, completed: true, chore: next };
}

/**
 * Undo the finished occurrence logged at `at`: a one-off chore reopens, a
 * recurring one steps back to that occurrence. Only the chore's latest
 * completion can be undone, and only while the series hasn't moved on since.
 */
export function undoChoreCompletion(data: PlannerData, id: string, at: number, now: number): PlannerData {
  const chore = data.chores.find((c) => c.id === id);
  const record = data.choreHistory.find((h) => h.choreId === id && h.at === at);
  if (!chore || !record || !canUndoCompletion(chore, data.choreHistory, record)) throw new PlannerError('That one can’t be undone anymore.');
  const next: Chore = { ...chore, updatedAt: now };
  if (chore.recurrence && record.due) next.due = record.due;
  else delete next.completedAt;
  return {
    ...data,
    chores: data.chores.map((c) => (c.id === id ? next : c)),
    choreHistory: data.choreHistory.filter((h) => h !== record),
  };
}

/** Reopen a finished one-off chore (dropping its completion from history). */
export function reopenChore(data: PlannerData, id: string, now: number): PlannerData {
  const chore = data.chores.find((c) => c.id === id);
  if (!chore?.completedAt) return data;
  const copy = { ...chore, updatedAt: now };
  delete copy.completedAt;
  return {
    ...data,
    chores: data.chores.map((c) => (c.id === id ? copy : c)),
    choreHistory: data.choreHistory.filter((h) => !(h.choreId === id && h.at === chore.completedAt)),
  };
}

// ───────────────────────── journal ─────────────────────────

export interface JournalDraft {
  day: DayKey;
  text: string;
  title?: string;
  mood?: Mood;
  prompt?: string;
  images?: string[];
}

export function addJournal(data: PlannerData, draft: JournalDraft, now: number) {
  const text = cleanBlock(draft.text, LIMITS.journal);
  if (!text) throw new PlannerError('Write a little something first.');
  if (!isDayKey(draft.day)) throw new PlannerError('That date isn’t valid.');
  if (data.journal.length >= LIMITS.journalEntries) throw new PlannerError('The journal is full. Delete some old entries first.');
  const title = draft.title ? clean(draft.title, LIMITS.title) : '';
  const entry: JournalEntry = {
    id: makeId('jr', now),
    day: draft.day,
    text,
    ...(title ? { title } : {}),
    ...(draft.mood ? { mood: draft.mood } : {}),
    ...(draft.prompt ? { prompt: clean(draft.prompt, 200) } : {}),
    images: (draft.images ?? []).slice(0, LIMITS.images),
    createdAt: now,
    updatedAt: now,
  };
  return { data: { ...data, journal: [...data.journal, entry] }, entry };
}

export function updateJournal(data: PlannerData, id: string, patch: Omit<Partial<JournalDraft>, 'mood'> & { mood?: Mood | null }, now: number) {
  const current = data.journal.find((j) => j.id === id);
  if (!current) throw new PlannerError('That entry no longer exists.');
  const entry: JournalEntry = { ...current, updatedAt: now };
  if (patch.text !== undefined) {
    const text = cleanBlock(patch.text, LIMITS.journal);
    if (!text) throw new PlannerError('An entry can’t be empty. Delete it instead?');
    entry.text = text;
  }
  if (patch.title !== undefined) {
    const title = clean(patch.title, LIMITS.title);
    if (title) entry.title = title;
    else delete entry.title;
  }
  if (patch.mood === null) delete entry.mood;
  else if (patch.mood) entry.mood = patch.mood;
  if (patch.day !== undefined) {
    if (!isDayKey(patch.day)) throw new PlannerError('That date isn’t valid.');
    entry.day = patch.day;
  }
  if (patch.images) entry.images = patch.images.slice(0, LIMITS.images);
  return { data: { ...data, journal: data.journal.map((j) => (j.id === id ? entry : j)) }, entry };
}

export function deleteJournal(data: PlannerData, id: string): PlannerData {
  return { ...data, journal: data.journal.filter((j) => j.id !== id) };
}

// ───────────────────────── rewards ─────────────────────────

/** Claim a one-time reward key; returns claimed=false if it was already paid out. */
export function claimReward(data: PlannerData, key: string) {
  if (data.rewards.includes(key)) return { data, claimed: false };
  return { data: { ...data, rewards: [...data.rewards, key].slice(-LIMITS.rewards) }, claimed: true };
}
