import { deleteLocalFile } from '../media/files';
import { PLANNER_STARS } from '../progression/progression';
import { grantXp } from '../progression/rewards';
import { emit } from '../services/bus';
import { feedback } from '../services/feedback';
import { useGame } from '../state/gameStore';
import { commitPlanner, usePlanner } from '../state/plannerStore';
import { dayKey, type DayKey, type TimeOfDay } from './dates';
import * as ops from './ops';
import type { HabitSchedule, Mood, Recurrence } from './types';

/**
 * Everything the UI and the assistant use to change the planner. Each call
 * validates, saves to disk (rolling back if that fails), and only then pays
 * rewards and lets the character react. Errors are thrown as PlannerError
 * (bad input) or SaveFailedError (storage), with a user-readable message.
 */

const today = () => dayKey(Date.now());

function reward(kind: keyof typeof PLANNER_STARS, claimed: boolean, text: string, reactKind: 'habit' | 'chore' | 'journal') {
  if (claimed) {
    useGame.getState().addStars(PLANNER_STARS[kind]);
    grantXp('planner');
  }
  feedback(kind === 'journal' ? 'select' : 'success');
  emit({ type: 'plannerDone', kind: reactKind, text });
}

// ───────────────────────── calendar ─────────────────────────

export function createEvent(draft: ops.EventDraft) {
  const now = Date.now();
  return commitPlanner((d) => {
    const r = ops.addEvent(d, draft, now);
    return { data: r.data, result: r.event };
  });
}

export function editEvent(id: string, patch: Partial<ops.EventDraft>) {
  const now = Date.now();
  return commitPlanner((d) => {
    const r = ops.updateEvent(d, id, patch, now);
    return { data: r.data, result: r.event };
  });
}

export function removeEvent(id: string): void {
  commitPlanner((d) => ({ data: ops.deleteEvent(d, id), result: null }));
}

export function markEventDone(id: string, done: boolean) {
  const now = Date.now();
  const r = commitPlanner((d) => {
    const res = ops.setEventDone(d, id, done, now);
    return { data: res.data, result: res };
  });
  if (done && r.changed) {
    feedback('success');
    emit({ type: 'plannerDone', kind: 'event', text: 'Done!' });
  }
  return r.event;
}

// ───────────────────────── habits & routines ─────────────────────────

export function createHabit(draft: ops.HabitDraft) {
  const now = Date.now();
  return commitPlanner((d) => {
    const r = ops.addHabit(d, draft, today(), now);
    return { data: r.data, result: r.habit };
  });
}

export function editHabit(id: string, patch: { title?: string; schedule?: HabitSchedule; steps?: { id?: string; title: string }[]; reminder?: TimeOfDay | null }) {
  const now = Date.now();
  return commitPlanner((d) => {
    const r = ops.updateHabit(d, id, patch, now);
    return { data: r.data, result: r.habit };
  });
}

export function archiveHabit(id: string, archived: boolean): void {
  const now = Date.now();
  commitPlanner((d) => ({ data: ops.setHabitArchived(d, id, archived, now), result: null }));
}

export function removeHabit(id: string): void {
  commitPlanner((d) => ({ data: ops.deleteHabit(d, id), result: null }));
}

/** Complete a habit for a day (today by default). Returns false if it was already done — no second reward. */
export function completeHabit(id: string, day: DayKey = today()): boolean {
  const now = Date.now();
  const { added, claimed, title } = commitPlanner((d) => {
    const r = ops.logHabit(d, id, day, today(), now);
    if (!r.added) return { data: d, result: { added: false, claimed: false, title: r.habit.title } };
    const c = ops.claimReward(r.data, `habit:${id}:${day}`);
    return { data: c.data, result: { added: true, claimed: c.claimed, title: r.habit.title } };
  });
  if (added) reward('habit', claimed, `${title} — done!`, 'habit');
  return added;
}

export function uncompleteHabit(id: string, day: DayKey): void {
  commitPlanner((d) => ({ data: ops.unlogHabit(d, id, day), result: null }));
}

export function tickRoutineStep(id: string, day: DayKey, stepId: string, checked: boolean): boolean {
  const now = Date.now();
  const { completed, claimed, title } = commitPlanner((d) => {
    const r = ops.setRoutineStep(d, id, day, stepId, checked, today(), now);
    const habit = r.data.habits.find((h) => h.id === id);
    if (!r.completed) return { data: r.data, result: { completed: false, claimed: false, title: habit?.title ?? '' } };
    const c = ops.claimReward(r.data, `habit:${id}:${day}`);
    return { data: c.data, result: { completed: true, claimed: c.claimed, title: habit?.title ?? '' } };
  });
  if (completed) reward('habit', claimed, `${title} complete!`, 'habit');
  return completed;
}

// ───────────────────────── chores ─────────────────────────

export function createChore(draft: ops.ChoreDraft) {
  const now = Date.now();
  return commitPlanner((d) => {
    const r = ops.addChore(d, draft, today(), now);
    return { data: r.data, result: r.chore };
  });
}

export function editChore(
  id: string,
  patch: Omit<Partial<ops.ChoreDraft>, 'due' | 'dueTime' | 'recurrence'> & { recurrence?: Recurrence | null; due?: DayKey | null; dueTime?: TimeOfDay | null },
) {
  const now = Date.now();
  return commitPlanner((d) => {
    const r = ops.updateChore(d, id, patch, now);
    return { data: r.data, result: r.chore };
  });
}

export function removeChore(id: string): void {
  commitPlanner((d) => ({ data: ops.deleteChore(d, id), result: null }));
}

export function toggleChoreItem(id: string, itemId: string): void {
  const now = Date.now();
  commitPlanner((d) => ({ data: ops.toggleChecklistItem(d, id, itemId, now), result: null }));
}

/** Finish the chore's open occurrence (`due` must match it). Returns false if it was already finished. */
export function finishChore(id: string, due: DayKey | null): boolean {
  const now = Date.now();
  const { completed, claimed, title } = commitPlanner((d) => {
    const r = ops.completeChore(d, id, due, now);
    if (!r.completed) return { data: d, result: { completed: false, claimed: false, title: r.chore.title } };
    const c = ops.claimReward(r.data, `chore:${id}:${due ?? 'once'}`);
    return { data: c.data, result: { completed: true, claimed: c.claimed, title: r.chore.title } };
  });
  if (completed) reward('chore', claimed, `${title}: done!`, 'chore');
  return completed;
}

export function reopenChore(id: string): void {
  const now = Date.now();
  commitPlanner((d) => ({ data: ops.reopenChore(d, id, now), result: null }));
}

// ───────────────────────── journal ─────────────────────────

export function createJournalEntry(draft: ops.JournalDraft) {
  const now = Date.now();
  const { entry, claimed } = commitPlanner((d) => {
    const r = ops.addJournal(d, draft, now);
    const c = ops.claimReward(r.data, `journal:${draft.day}`);
    return { data: c.data, result: { entry: r.entry, claimed: c.claimed } };
  });
  reward('journal', claimed, 'Thanks for sharing.', 'journal');
  return entry;
}

export function editJournalEntry(id: string, patch: Omit<Partial<ops.JournalDraft>, 'mood'> & { mood?: Mood | null }) {
  const now = Date.now();
  const before = usePlanner.getState().journal.find((j) => j.id === id);
  const entry = commitPlanner((d) => {
    const r = ops.updateJournal(d, id, patch, now);
    return { data: r.data, result: r.entry };
  });
  // Photos removed from the entry are deleted from the device.
  before?.images.filter((u) => !entry.images.includes(u)).forEach(deleteLocalFile);
  return entry;
}

export function removeJournalEntry(id: string): void {
  const entry = usePlanner.getState().journal.find((j) => j.id === id);
  commitPlanner((d) => ({ data: ops.deleteJournal(d, id), result: null }));
  entry?.images.forEach(deleteLocalFile);
}
