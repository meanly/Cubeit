import { parseRepeat, parseTime, parseWeekdays, parseWhen, stripSpans } from '../assistant/dateParse';
import { executeAction } from '../assistant/execute';
import { parseIntent } from '../assistant/intentParser';
import { answerPending, matchByTitle, resolveIntent } from '../assistant/resolve';
import { coerceRawIntent, isWriteAction, parseModelOutput, type AssistantAction, type RawIntent } from '../assistant/schema';
import * as ops from '../planner/ops';
import type { PlannerData } from '../planner/types';
import { commitPlanner, SaveFailedError, setPlannerCommitter, usePlanner } from '../state/plannerStore';

jest.mock('../media/files', () => ({ deleteLocalFile: jest.fn(), keepJournalImage: (u: string) => u, deleteAllJournalImages: jest.fn() }));
jest.mock('../services/feedback', () => ({ feedback: jest.fn() }));

/** Saturday, October 10 2026, noon (local time). */
const NOW = new Date(2026, 9, 10, 12, 0).getTime();
const TODAY = '2026-10-10';
const ctx = (data: PlannerData, sourceText = '') => ({ now: NOW, data, sourceText });

describe('date phrases', () => {
  it('parses times, with sensible defaults for bare hours', () => {
    expect(parseTime('3pm')).toBe('15:00');
    expect(parseTime('3:30 p.m.')).toBe('15:30');
    expect(parseTime('12am')).toBe('00:00');
    expect(parseTime('noon')).toBe('12:00');
    expect(parseTime('15:45')).toBe('15:45');
    expect(parseTime('3')).toBe('15:00');
    expect(parseTime('9')).toBe('09:00');
    expect(parseTime('13pm')).toBeNull();
    expect(parseTime('25:00')).toBeNull();
  });

  it('resolves days relative to today', () => {
    expect(parseWhen('tomorrow at 3pm', NOW)).toMatchObject({ day: '2026-10-11', start: '15:00' });
    expect(parseWhen('day after tomorrow', NOW).day).toBe('2026-10-12');
    expect(parseWhen('on Friday', NOW).day).toBe('2026-10-16');
    expect(parseWhen('next saturday', NOW).day).toBe('2026-10-17');
    expect(parseWhen('saturday', NOW).day).toBe(TODAY);
    expect(parseWhen('in 2 weeks', NOW).day).toBe('2026-10-24');
    expect(parseWhen('Oct 12th 9:30-10:15', NOW)).toMatchObject({ day: '2026-10-12', start: '09:30', end: '10:15' });
    expect(parseWhen('March 3', NOW).day).toBe('2027-03-03');
    expect(parseWhen('March 3', NOW, 'past').day).toBe('2026-03-03');
    expect(parseWhen('2026-12-25 all day', NOW)).toMatchObject({ day: '2026-12-25', allDay: true });
    expect(parseWhen('3-4pm', NOW)).toMatchObject({ start: '15:00', end: '16:00' });
    expect(parseWhen('yesterday', NOW).day).toBe('2026-10-09');
  });

  it('does not mistake ordinary words for weekdays or dates', () => {
    expect(parseWhen('I sat in the sun', NOW).day).toBeUndefined();
    expect(parseWhen('may I ask something', NOW).day).toBeUndefined();
    expect(parseWhen('Feb 30', NOW).day).toBeUndefined();
  });

  it('resolves ranges for questions', () => {
    expect(parseWhen('this week', NOW).range).toEqual({ from: TODAY, to: '2026-10-11' });
    expect(parseWhen('next week', NOW).range).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(parseWhen('last month', NOW, 'past').range).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('parses repeats and weekdays and strips date words from titles', () => {
    expect(parseRepeat('every 2 weeks')).toEqual({ every: 2, unit: 'week' });
    expect(parseRepeat('every Sunday')).toEqual({ every: 1, unit: 'week' });
    expect(parseRepeat('monthly')).toEqual({ every: 1, unit: 'month' });
    expect(parseRepeat('sometime')).toBeNull();
    expect(parseWeekdays('every weekday')).toEqual({ days: [1, 2, 3, 4, 5] });
    expect(parseWeekdays('on mon, wed and fri')).toEqual({ days: [1, 3, 5] });
    expect(parseWeekdays('every day')).toEqual({ daily: true });
    const w = parseWhen('dentist tomorrow at 3pm', NOW);
    expect(stripSpans('dentist tomorrow at 3pm', w.spans)).toBe('dentist');
  });
});

describe('built-in parser', () => {
  const data = ops.emptyPlanner();
  it.each<[string, Partial<RawIntent>]>([
    ['Add dentist tomorrow at 3pm', { intent: 'create_event', title: 'dentist' }],
    ['remind me to call mom on friday at 6pm', { intent: 'create_event', title: 'call mom' }],
    ["What's on my schedule tomorrow?", { intent: 'list_events' }],
    ['what chores do I have', { intent: 'list_chores' }],
    ['I want to read every weekday', { intent: 'create_habit', title: 'read' }],
    ['Create a morning routine: stretch, shower, coffee', { intent: 'create_routine', steps: ['stretch', 'shower', 'coffee'] }],
    ['I finished my workout', { intent: 'log_habit', title: 'workout' }],
    ['add vacuuming to my chores every saturday', { intent: 'create_chore', title: 'vacuuming' }],
    ['Journal: a quiet, good day.', { intent: 'create_journal', text: 'a quiet, good day.' }],
    ['what did I write about my sister?', { intent: 'search_journal', query: 'my sister' }],
    ['move lunch to friday at noon', { intent: 'update_event', title: 'lunch' }],
  ])('%s', (text, expected) => {
    expect(parseIntent(text, data, NOW)).toMatchObject(expected);
  });

  it('returns null for ordinary chat', () => {
    expect(parseIntent('how are you?', data, NOW)).toBeNull();
    expect(parseIntent('tell me a joke', data, NOW)).toBeNull();
  });
});

describe('model output validation', () => {
  it('accepts clean and lightly wrapped JSON', () => {
    expect(parseModelOutput('{"intent":"create_event","title":"Dentist","when":"tomorrow 3pm"}')).toEqual({
      intent: 'create_event',
      title: 'Dentist',
      when: 'tomorrow 3pm',
    });
    expect(parseModelOutput('Sure! ```json\n{"intent": "list_events", "when": "today",}\n``` Hope that helps')).toEqual({ intent: 'list_events', when: 'today' });
    expect(parseModelOutput('{"intent":"Create Event","title":"x"}')).toMatchObject({ intent: 'create_event' });
  });

  it('rejects malformed, unknown or wrongly typed output', () => {
    expect(parseModelOutput('')).toBeNull();
    expect(parseModelOutput('I think you want an event')).toBeNull();
    expect(parseModelOutput('{"intent":"create_event","title":"Dentist"')).toBeNull();
    expect(parseModelOutput('{"intent":"drop_tables"}')).toBeNull();
    expect(parseModelOutput('[{"intent":"chat"}]')).toBeNull();
    expect(coerceRawIntent({ intent: 'create_event', title: 42, steps: [1, 'ok', null], extra: 'x' })).toEqual({ intent: 'create_event', steps: ['ok'] });
    expect(coerceRawIntent({ intent: 'create_journal', text: 'x'.repeat(10_000) })!.text!.length).toBe(4000);
  });
});

describe('resolving and validating actions', () => {
  it('builds a typed event and refuses past dates', () => {
    const r = resolveIntent({ intent: 'create_event', title: 'dentist', when: 'tomorrow at 3pm' }, ctx(ops.emptyPlanner(), 'add dentist tomorrow at 3pm'));
    expect(r).toEqual({ kind: 'action', action: { type: 'createEvent', title: 'Dentist', day: '2026-10-11', allDay: false, start: '15:00' } });
    expect(isWriteAction((r as { action: AssistantAction }).action)).toBe(true);
    expect(resolveIntent({ intent: 'create_event', title: 'x', when: 'yesterday at 3pm' }, ctx(ops.emptyPlanner())).kind).toBe('reject');
  });

  it('asks a follow-up question for missing information, then completes', () => {
    const data = ops.emptyPlanner();
    const first = resolveIntent({ intent: 'create_event', title: 'Team lunch' }, ctx(data, 'add team lunch'));
    expect(first.kind).toBe('ask');
    if (first.kind !== 'ask') return;
    expect(first.question).toMatch(/What day/);
    const second = answerPending(first.pending, 'friday', { now: NOW, data });
    expect(second.kind).toBe('ask');
    if (second.kind !== 'ask') return;
    expect(second.question).toMatch(/What time/);
    const third = answerPending(second.pending, '12:30pm', { now: NOW, data });
    expect(third).toEqual({ kind: 'action', action: expect.objectContaining({ type: 'createEvent', day: '2026-10-16', start: '12:30' }) });
  });

  it('adds a reminder only when the user asked for one', () => {
    const r = resolveIntent({ intent: 'create_event', title: 'call mom', when: 'friday 6pm' }, ctx(ops.emptyPlanner(), 'remind me to call mom friday 6pm'));
    expect(r).toMatchObject({ kind: 'action', action: { reminderMin: 0 } });
  });

  it('finds the item a request refers to, or says it can’t', () => {
    let data = ops.emptyPlanner();
    data = ops.addHabit(data, { title: 'Morning workout', kind: 'habit', schedule: { type: 'daily' } }, TODAY, NOW).data;
    data = ops.addChore(data, { title: 'Laundry', due: TODAY }, TODAY, NOW).data;
    expect(resolveIntent({ intent: 'log_habit', title: 'workout' }, ctx(data))).toMatchObject({ kind: 'action', action: { type: 'logHabit', day: TODAY } });
    // "I did the laundry" is a chore, not a habit.
    expect(resolveIntent({ intent: 'log_habit', title: 'the laundry' }, ctx(data))).toMatchObject({ action: { type: 'completeChore', due: TODAY } });
    expect(resolveIntent({ intent: 'complete_chore', title: 'mow lawn' }, ctx(data))).toEqual({ kind: 'reject', message: expect.stringMatching(/couldn’t find/) });
    expect(matchByTitle(data.habits, 'workout')).toHaveLength(1);
  });

  it('asks which one when several items match', () => {
    let data = ops.emptyPlanner();
    data = ops.addEvent(data, { title: 'Lunch with Sam', day: '2026-10-12', allDay: false, start: '12:00' }, NOW).data;
    data = ops.addEvent(data, { title: 'Lunch with Kim', day: '2026-10-13', allDay: false, start: '12:00' }, NOW).data;
    const r = resolveIntent({ intent: 'update_event', title: 'lunch', when: 'friday' }, ctx(data));
    expect(r.kind).toBe('ask');
    if (r.kind !== 'ask') return;
    expect(r.pending.options).toHaveLength(2);
    const picked = answerPending(r.pending, '2', { now: NOW, data });
    expect(picked).toMatchObject({ kind: 'action', action: { type: 'updateEvent', title: 'Lunch with Kim', patch: { day: '2026-10-16' } } });
  });

  it('turns schedules and repeats into habits and chores', () => {
    const data = ops.emptyPlanner();
    expect(resolveIntent({ intent: 'create_habit', title: 'Read 20 minutes', days: 'every weekday', when: '9pm' }, ctx(data))).toEqual({
      kind: 'action',
      action: { type: 'createHabit', kind: 'habit', title: 'Read 20 minutes', schedule: { type: 'days', days: [1, 2, 3, 4, 5] }, steps: [], reminder: '21:00' },
    });
    expect(resolveIntent({ intent: 'create_routine', title: 'Morning routine' }, ctx(data)).kind).toBe('ask');
    expect(resolveIntent({ intent: 'create_chore', title: 'Vacuum', repeat: 'every saturday', when: 'saturday' }, ctx(data))).toMatchObject({
      action: { type: 'createChore', title: 'Vacuum', due: TODAY, recurrence: { every: 1, unit: 'week' }, category: 'home' },
    });
  });
});

describe('executing actions', () => {
  afterEach(() => {
    setPlannerCommitter(null);
    usePlanner.getState().clear();
  });
  const exec = (a: AssistantAction) => executeAction(a, { data: () => usePlanner.getState(), memories: [], now: NOW });

  it('reports success only after the change is saved', () => {
    const writes: string[] = [];
    setPlannerCommitter(() => writes.push('saved'));
    const out = exec({ type: 'createEvent', title: 'Dentist', day: '2026-10-11', allDay: false, start: '15:00' });
    expect(out).toEqual({ ok: true, text: expect.stringContaining('Dentist') });
    expect(writes).toEqual(['saved']);
    expect(usePlanner.getState().events).toHaveLength(1);
  });

  it('rolls back and reports failure when storage fails', () => {
    setPlannerCommitter(() => {
      throw new Error('disk full');
    });
    const out = exec({ type: 'createEvent', title: 'Dentist', day: '2026-10-11', allDay: true });
    expect(out.ok).toBe(false);
    expect(out.text).toBe(new SaveFailedError().message);
    expect(usePlanner.getState().events).toHaveLength(0);
  });

  it('re-validates actions at execution time', () => {
    const out = exec({ type: 'createEvent', title: 'X', day: '2026-02-30', allDay: true });
    expect(out.ok).toBe(false);
    expect(usePlanner.getState().events).toHaveLength(0);
  });

  it('answers schedule questions from stored events only', () => {
    commitPlanner((d) => ({ data: ops.addEvent(d, { title: 'Gym', day: '2026-10-11', allDay: false, start: '18:00' }, NOW).data, result: null }));
    expect(exec({ type: 'listEvents', from: '2026-10-11', to: '2026-10-11', label: 'tomorrow' }).text).toBe('You have one thing tomorrow: Gym at 6 PM.');
    expect(exec({ type: 'listEvents', from: TODAY, to: TODAY, label: 'today' }).text).toBe('Nothing on your calendar today.');
  });

  it('completing a habit twice reports it was already done', () => {
    const habit = commitPlanner((d) => {
      const r = ops.addHabit(d, { title: 'Stretch', kind: 'habit', schedule: { type: 'daily' } }, TODAY, NOW);
      return { data: r.data, result: r.habit };
    });
    const day = new Date().toISOString().slice(0, 10) === TODAY ? TODAY : TODAY;
    const first = exec({ type: 'logHabit', id: habit.id, title: 'Stretch', day });
    expect(first.ok).toBe(true);
    const second = exec({ type: 'logHabit', id: habit.id, title: 'Stretch', day });
    expect(second.text).toMatch(/already done/);
    expect(usePlanner.getState().habitLogs).toHaveLength(1);
  });

  it('journal search never invents entries', () => {
    expect(exec({ type: 'searchJournal', query: 'holiday' }).text).toMatch(/didn’t find/);
  });
});
