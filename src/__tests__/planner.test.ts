import { addDays, addMonths, diffDays, formatTime, isDayKey, isTimeOfDay, monthGrid, startOfWeek, weekdayOf } from '../planner/dates';
import { encouragement, habitStats } from '../planner/habits';
import { describeSummary, searchJournal, summarizeJournal } from '../planner/journal';
import * as ops from '../planner/ops';
import { emptyPlannerDoc, migratePlanner } from '../planner/plannerDoc';
import { canUndoCompletion, choreStatus, nextOccurrence, upcomingOccurrences } from '../planner/recurrence';
import { computeReminders, planReminderSync, reminderSignature } from '../planner/reminders';
import { HABIT_TEMPLATES, templateDraft, templateTaken } from '../planner/templates';
import type { PlannerData } from '../planner/types';

/** Saturday, October 10 2026, noon (local time). */
const NOW = new Date(2026, 9, 10, 12, 0).getTime();
const TODAY = '2026-10-10';

const fresh = (): PlannerData => ops.emptyPlanner();

describe('planner dates', () => {
  it('validates days and times', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-2-3')).toBe(false);
    expect(isTimeOfDay('23:59')).toBe(true);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(formatTime('15:30')).toBe('3:30 PM');
    expect(formatTime('00:00')).toBe('12 AM');
  });

  it('does calendar math across months, years and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(diffDays('2026-10-10', '2026-11-10')).toBe(31);
    expect(weekdayOf(TODAY)).toBe(6);
    expect(startOfWeek(TODAY)).toBe('2026-10-05');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31');
  });

  it('builds a month grid that covers the whole month in full weeks', () => {
    const grid = monthGrid(TODAY);
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid[0][0]).toBe('2026-09-28');
    expect(grid.flat()).toContain('2026-10-31');
  });
});

describe('calendar events', () => {
  it('adds, edits and completes events with validation', () => {
    let d = fresh();
    const added = ops.addEvent(d, { title: '  Dentist  ', day: '2026-10-11', allDay: false, start: '15:00', end: '16:00' }, NOW);
    d = added.data;
    expect(added.event.title).toBe('Dentist');
    expect(() => ops.addEvent(d, { title: 'x', day: '2026-13-01', allDay: true }, NOW)).toThrow(ops.PlannerError);
    expect(() => ops.addEvent(d, { title: 'x', day: TODAY, allDay: false }, NOW)).toThrow(/start time/);
    expect(() => ops.addEvent(d, { title: 'x', day: TODAY, allDay: false, start: '10:00', end: '09:00' }, NOW)).toThrow(/after the start/);
    expect(() => ops.addEvent(d, { title: '   ', day: TODAY, allDay: true }, NOW)).toThrow(/title/);

    // Moving the start past the old end drops the end instead of failing.
    d = ops.updateEvent(d, added.event.id, { start: '17:00' }, NOW).data;
    expect(d.events[0]).toMatchObject({ start: '17:00' });
    expect(d.events[0].end).toBeUndefined();

    const done = ops.setEventDone(d, added.event.id, true, NOW);
    expect(done.changed).toBe(true);
    expect(ops.setEventDone(done.data, added.event.id, true, NOW).changed).toBe(false);
  });

  it('sorts all-day events first, then by time', () => {
    let d = fresh();
    d = ops.addEvent(d, { title: 'B', day: TODAY, allDay: false, start: '09:00' }, NOW).data;
    d = ops.addEvent(d, { title: 'A', day: TODAY, allDay: true }, NOW).data;
    d = ops.addEvent(d, { title: 'C', day: TODAY, allDay: false, start: '08:00' }, NOW).data;
    expect(ops.eventsOn(d.events, TODAY).map((e) => e.title)).toEqual(['A', 'C', 'B']);
  });
});

describe('habits', () => {
  const setup = (schedule: ops.HabitDraft['schedule'], startDay = '2026-09-28') => {
    const d = ops.addHabit(fresh(), { title: 'Read', kind: 'habit', schedule }, startDay, NOW);
    return { data: d.data, id: d.habit.id };
  };

  it('never records the same day twice (no duplicate completions or rewards)', () => {
    let { data, id } = setup({ type: 'daily' });
    const first = ops.logHabit(data, id, TODAY, TODAY, NOW);
    expect(first.added).toBe(true);
    data = first.data;
    const again = ops.logHabit(data, id, TODAY, TODAY, NOW);
    expect(again.added).toBe(false);
    expect(again.data).toBe(data);
    expect(data.habitLogs).toHaveLength(1);

    const r1 = ops.claimReward(data, `habit:${id}:${TODAY}`);
    expect(r1.claimed).toBe(true);
    // Undo and redo the habit: the reward key stays claimed, so no second payout.
    data = ops.unlogHabit(r1.data, id, TODAY);
    data = ops.logHabit(data, id, TODAY, TODAY, NOW).data;
    expect(ops.claimReward(data, `habit:${id}:${TODAY}`).claimed).toBe(false);
  });

  it('refuses completions in the future', () => {
    const { data, id } = setup({ type: 'daily' });
    expect(() => ops.logHabit(data, id, '2026-10-11', TODAY, NOW)).toThrow(/future/);
  });

  it('counts streaks over scheduled days only; today in progress doesn’t break them', () => {
    // Mon/Wed/Fri habit. Today is Saturday (not scheduled).
    let { data, id } = setup({ type: 'days', days: [1, 3, 5] });
    for (const day of ['2026-09-28', '2026-09-30', '2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09']) {
      data = ops.logHabit(data, id, day, TODAY, NOW).data;
    }
    const habit = data.habits[0];
    let stats = habitStats(habit, data.habitLogs, TODAY);
    expect(stats.streak).toBe(6);
    expect(stats.dueToday).toBe(false);
    expect(stats.week).toEqual({ done: 3, scheduled: 3 });

    // Missing Wednesday breaks the streak.
    data = ops.unlogHabit(data, id, '2026-10-07');
    stats = habitStats(habit, data.habitLogs, TODAY);
    expect(stats.streak).toBe(1);
    expect(stats.best).toBe(4);
  });

  it('keeps a daily streak alive until today is over', () => {
    let { data, id } = setup({ type: 'daily' }, '2026-10-07');
    for (const day of ['2026-10-07', '2026-10-08', '2026-10-09']) data = ops.logHabit(data, id, day, TODAY, NOW).data;
    const habit = data.habits[0];
    expect(habitStats(habit, data.habitLogs, TODAY)).toMatchObject({ streak: 3, doneToday: false, dueToday: true });
    data = ops.logHabit(data, id, TODAY, TODAY, NOW).data;
    const stats = habitStats(habit, data.habitLogs, TODAY);
    expect(stats).toMatchObject({ streak: 4, doneToday: true });
    expect(encouragement(habit, stats)).toMatch(/4 scheduled days in a row/);
    // The next morning, yesterday's completion still counts.
    expect(habitStats(habit, data.habitLogs, '2026-10-11').streak).toBe(4);
    // Two days later without logging, it's broken.
    expect(habitStats(habit, data.habitLogs, '2026-10-12').streak).toBe(0);
  });

  it('rejects duplicate habit names and empty routines', () => {
    const { data } = setup({ type: 'daily' });
    expect(() => ops.addHabit(data, { title: 'read', kind: 'habit', schedule: { type: 'daily' } }, TODAY, NOW)).toThrow(/already/);
    expect(() => ops.addHabit(data, { title: 'Morning', kind: 'routine', schedule: { type: 'daily' }, steps: [] }, TODAY, NOW)).toThrow(/step/);
  });

  it('completes a routine when its last step is ticked, and reopens it when one is unticked', () => {
    const r = ops.addHabit(fresh(), { title: 'Morning', kind: 'routine', schedule: { type: 'daily' }, steps: ['Stretch', 'Shower'] }, TODAY, NOW);
    const [a, b] = r.habit.steps;
    let step = ops.setRoutineStep(r.data, r.habit.id, TODAY, a.id, true, TODAY, NOW);
    expect(step.completed).toBe(false);
    step = ops.setRoutineStep(step.data, r.habit.id, TODAY, b.id, true, TODAY, NOW);
    expect(step.completed).toBe(true);
    expect(step.data.habitLogs).toHaveLength(1);
    step = ops.setRoutineStep(step.data, r.habit.id, TODAY, b.id, false, TODAY, NOW);
    expect(step.data.habitLogs).toHaveLength(0);
  });

  it('deleting a habit removes its history', () => {
    let { data, id } = setup({ type: 'daily' });
    data = ops.logHabit(data, id, TODAY, TODAY, NOW).data;
    data = ops.deleteHabit(data, id);
    expect(data.habits).toHaveLength(0);
    expect(data.habitLogs).toHaveLength(0);
  });
});

describe('chores and recurrence', () => {
  it('computes predictable next occurrences, keeping the day of month', () => {
    expect(nextOccurrence('2026-10-10', { every: 1, unit: 'week' })).toBe('2026-10-17');
    expect(nextOccurrence('2026-10-10', { every: 3, unit: 'day' })).toBe('2026-10-13');
    expect(upcomingOccurrences('2026-01-31', { every: 1, unit: 'month' }, 4, 31)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('completing a recurring chore logs that occurrence and opens only the next one', () => {
    const add = ops.addChore(fresh(), { title: 'Vacuum', recurrence: { every: 1, unit: 'week' }, due: '2026-10-03', checklist: ['Rugs', 'Stairs'] }, TODAY, NOW);
    let data = ops.toggleChecklistItem(add.data, add.chore.id, add.chore.checklist[0].id, NOW);
    expect(choreStatus(data.chores[0], TODAY)).toBe('overdue');

    const done = ops.completeChore(data, add.chore.id, '2026-10-03', TODAY, NOW);
    expect(done.completed).toBe(true);
    data = done.data;
    expect(data.chores).toHaveLength(1);
    expect(data.chores[0].due).toBe('2026-10-10');
    expect(data.chores[0].completedAt).toBeUndefined();
    expect(data.chores[0].checklist.every((i) => !i.done)).toBe(true);
    expect(data.choreHistory).toEqual([expect.objectContaining({ choreId: add.chore.id, due: '2026-10-03' })]);

    // A stale second tap for the old occurrence does nothing — it can't complete the next one.
    const stale = ops.completeChore(data, add.chore.id, '2026-10-03', TODAY, NOW);
    expect(stale.completed).toBe(false);
    expect(stale.data.chores[0].due).toBe('2026-10-10');
  });

  it('nothing is generated just by loading: the document round-trips unchanged', () => {
    const add = ops.addChore(fresh(), { title: 'Bins', recurrence: { every: 1, unit: 'week' } }, TODAY, NOW);
    const doc = { version: 1 as const, ...add.data };
    const once = migratePlanner(JSON.parse(JSON.stringify(doc)));
    const twice = migratePlanner(JSON.parse(JSON.stringify(once)));
    expect(twice.chores).toEqual(once.chores);
    expect(twice.chores).toHaveLength(1);
    expect(twice.chores[0].due).toBe(TODAY);
  });

  it('one-off chores complete once and can be reopened', () => {
    const add = ops.addChore(fresh(), { title: 'Return parcel' }, TODAY, NOW);
    const done = ops.completeChore(add.data, add.chore.id, null, TODAY, NOW);
    expect(done.completed).toBe(true);
    expect(choreStatus(done.data.chores[0], TODAY)).toBe('done');
    expect(ops.completeChore(done.data, add.chore.id, null, TODAY, NOW).completed).toBe(false);
    const reopened = ops.reopenChore(done.data, add.chore.id, NOW);
    expect(choreStatus(reopened.chores[0], TODAY)).toBe('someday');
    expect(reopened.choreHistory).toEqual([]);
  });

  it('a one-off chore due later can be finished early', () => {
    const add = ops.addChore(fresh(), { title: 'Return library books', due: '2026-10-13' }, TODAY, NOW);
    const done = ops.completeChore(add.data, add.chore.id, '2026-10-13', TODAY, NOW);
    expect(done.completed).toBe(true);
    expect(choreStatus(done.data.chores[0], TODAY)).toBe('done');
  });

  it('a recurring chore’s next occurrence can’t be finished early', () => {
    const add = ops.addChore(fresh(), { title: 'Water plants', recurrence: { every: 1, unit: 'day' } }, TODAY, NOW);
    const done = ops.completeChore(add.data, add.chore.id, TODAY, TODAY, NOW);
    expect(done.chore.due).toBe('2026-10-11');
    expect(() => ops.completeChore(done.data, add.chore.id, '2026-10-11', TODAY, NOW)).toThrow(ops.PlannerError);
    expect(ops.completeChore(done.data, add.chore.id, '2026-10-11', '2026-10-11', NOW).completed).toBe(true);
  });

  it('undoing the latest completion steps a recurring chore back to that occurrence', () => {
    const add = ops.addChore(fresh(), { title: 'Dishes', recurrence: { every: 1, unit: 'day' } }, TODAY, NOW);
    const done = ops.completeChore(add.data, add.chore.id, TODAY, TODAY, NOW);
    const record = done.data.choreHistory[0];
    expect(canUndoCompletion(done.data.chores[0], done.data.choreHistory, record)).toBe(true);
    const undone = ops.undoChoreCompletion(done.data, add.chore.id, record.at, NOW);
    expect(undone.chores[0].due).toBe(TODAY);
    expect(undone.choreHistory).toEqual([]);
    expect(() => ops.undoChoreCompletion(undone, add.chore.id, record.at, NOW)).toThrow(ops.PlannerError);
  });
});

describe('journal', () => {
  const withEntries = () => {
    let d = fresh();
    d = ops.addJournal(d, { day: '2026-10-08', text: 'Long walk with my sister by the lake.', mood: 'good' }, NOW - 2e8).data;
    d = ops.addJournal(d, { day: '2026-10-09', text: 'Work was stressful, deadline moved.', mood: 'low' }, NOW - 1e8).data;
    d = ops.addJournal(d, { day: '2026-09-01', text: 'Visited my sister again.', mood: 'great' }, NOW - 3e9).data;
    return d;
  };

  it('finds entries by keyword and date range, and never invents results', () => {
    const d = withEntries();
    expect(searchJournal(d.journal, 'sister').map((h) => h.entry.day)).toEqual(['2026-10-08', '2026-09-01']);
    expect(searchJournal(d.journal, 'sister', { from: '2026-10-01', to: TODAY }).map((h) => h.entry.day)).toEqual(['2026-10-08']);
    expect(searchJournal(d.journal, 'volcano')).toEqual([]);
    expect(searchJournal(d.journal, '', { from: '2026-10-09', to: '2026-10-09' })).toHaveLength(1);
  });

  it('summarizes counts and moods from real entries only', () => {
    const s = summarizeJournal(withEntries().journal, '2026-10-04', TODAY);
    expect(s).toMatchObject({ count: 2, days: 2 });
    expect(s.moods).toEqual({ good: 1, low: 1 });
    // One of each isn't "mostly" anything.
    expect(s.topMood).toBeNull();
    expect(describeSummary(s, 'this week')).toBe('2 entries this week · a mix of moods.');
  });

  it('calls a mood "mostly" only when it is on most entries', () => {
    let d = withEntries();
    d = ops.addJournal(d, { day: '2026-10-09', text: 'Better evening.', mood: 'good' }, NOW).data;
    const s = summarizeJournal(d.journal, '2026-10-04', TODAY);
    expect(s.topMood).toBe('good');
    expect(describeSummary(s, 'this week')).toBe('3 entries on 2 days this week · mostly feeling good.');
  });

  it('rejects empty entries and deletes cleanly', () => {
    const d = withEntries();
    expect(() => ops.addJournal(d, { day: TODAY, text: '   ' }, NOW)).toThrow();
    const id = d.journal[0].id;
    expect(ops.deleteJournal(d, id).journal.find((j) => j.id === id)).toBeUndefined();
  });
});

describe('planner document', () => {
  it('starts empty and repairs garbage', () => {
    expect(migratePlanner(undefined)).toEqual(emptyPlannerDoc());
    expect(migratePlanner('nonsense')).toEqual(emptyPlannerDoc());
  });

  it('drops invalid items, keeps valid ones, removes orphaned logs and duplicates', () => {
    const doc = migratePlanner({
      version: 1,
      events: [
        { id: 'e1', title: 'OK', day: TODAY, allDay: false, start: '09:00', createdAt: 1, updatedAt: 1 },
        { id: 'e2', title: 'Bad day', day: '2026-02-31', allDay: true },
        { id: 'e3', title: 'No time', day: TODAY, allDay: false },
        { id: 'e1', title: 'Dup', day: TODAY, allDay: true },
      ],
      habits: [{ id: 'h1', title: 'Read', kind: 'habit', schedule: { type: 'days', days: [1, 1, 9, 3] }, startDay: TODAY }],
      habitLogs: [
        { habitId: 'h1', day: TODAY, at: 1 },
        { habitId: 'h1', day: TODAY, at: 2 },
        { habitId: 'ghost', day: TODAY, at: 1 },
      ],
      chores: [{ id: 'c1', title: 'Bins', due: TODAY, recurrence: { every: 0, unit: 'fortnight' }, reminder: true }],
      journal: [{ id: 'j1', day: TODAY, text: 'hi', images: ['file:///a.jpg', 'https://evil.example/x.jpg'] }],
      rewards: ['a', 'a', 'b'],
    });
    expect(doc.events.map((e) => e.id)).toEqual(['e1']);
    expect(doc.habits[0].schedule).toEqual({ type: 'days', days: [1, 3] });
    expect(doc.habitLogs).toHaveLength(1);
    expect(doc.chores[0].recurrence).toEqual({ every: 1, unit: 'week' });
    expect(doc.journal[0].images).toEqual(['file:///a.jpg']);
    expect(doc.rewards).toEqual(['a', 'b']);
  });
});

describe('reminders', () => {
  it('schedules future reminders only, with stable ids, and repeats habits weekly', () => {
    let d = fresh();
    d = ops.addEvent(d, { title: 'Dentist', day: '2026-10-11', allDay: false, start: '15:00', reminderMin: 60 }, NOW).data;
    d = ops.addEvent(d, { title: 'Past', day: '2026-10-09', allDay: false, start: '15:00', reminderMin: 0 }, NOW).data;
    d = ops.addHabit(d, { title: 'Yoga', kind: 'habit', schedule: { type: 'days', days: [1, 3] }, reminder: '07:30' }, TODAY, NOW).data;
    d = ops.addChore(d, { title: 'Bins', due: '2026-10-12', reminder: true }, TODAY, NOW).data;
    const specs = computeReminders(d, NOW, 'Pip');
    expect(specs.map((s) => s.title).sort()).toEqual(['Bins', 'Dentist', 'Yoga', 'Yoga']);
    const dentist = specs.find((s) => s.title === 'Dentist')!;
    expect(dentist.trigger).toEqual({ kind: 'date', at: new Date(2026, 9, 11, 14, 0).getTime() });
    expect(specs.filter((s) => s.title === 'Yoga').map((s) => s.trigger)).toEqual([
      { kind: 'weekly', weekday: 2, hour: 7, minute: 30 },
      { kind: 'weekly', weekday: 4, hour: 7, minute: 30 },
    ]);
    // Same input → same ids: re-running never duplicates.
    expect(computeReminders(d, NOW, 'Pip').map((s) => s.id)).toEqual(specs.map((s) => s.id));
  });

  it('plans only the changes needed against what is already scheduled', () => {
    const a = { id: 'cubeit.event.a', title: 'A', body: 'x', trigger: { kind: 'date' as const, at: 10 } };
    const b = { id: 'cubeit.event.b', title: 'B', body: 'x', trigger: { kind: 'date' as const, at: 20 } };
    const pending = new Map<string, string | undefined>([
      [a.id, reminderSignature(a)],
      ['cubeit.event.gone', 'old'],
      ['other.app.thing', 'x'],
    ]);
    const plan = planReminderSync([a, { ...b }], pending);
    expect(plan.cancel).toEqual(['cubeit.event.gone']);
    expect(plan.schedule.map((s) => s.id)).toEqual([b.id]);
    const changed = planReminderSync([{ ...a, title: 'A2' }], new Map([[a.id, reminderSignature(a)]]));
    expect(changed).toEqual({ cancel: [a.id], schedule: [{ ...a, title: 'A2' }] });
  });
});

describe('habit templates', () => {
  it('every template saves as a valid habit, all at once', () => {
    let d = fresh();
    for (const t of HABIT_TEMPLATES) d = ops.addHabit(d, templateDraft(t), TODAY, NOW).data;
    expect(d.habits).toHaveLength(HABIT_TEMPLATES.length);
    expect(new Set(HABIT_TEMPLATES.map((t) => t.id)).size).toBe(HABIT_TEMPLATES.length);
    for (const t of HABIT_TEMPLATES.filter((x) => x.kind === 'routine')) expect(t.steps?.length).toBeGreaterThan(0);
  });

  it('marks a template taken only while an active habit has its name', () => {
    const water = HABIT_TEMPLATES.find((t) => t.id === 'water')!;
    const r = ops.addHabit(fresh(), { title: 'drink water', kind: 'habit', schedule: { type: 'daily' } }, TODAY, NOW);
    expect(templateTaken(water, r.data.habits)).toBe(true);
    const archived = ops.setHabitArchived(r.data, r.habit.id, true, NOW);
    expect(templateTaken(water, archived.habits)).toBe(false);
  });
});
