import { formatDay, formatDayInline, formatTime, minutesOf, toTimestamp, dayKey, type Weekday } from './dates';
import type { PlannerData } from './types';

export type ReminderTrigger =
  | { kind: 'date'; at: number }
  | { kind: 'daily'; hour: number; minute: number }
  /** weekday: 1 = Sunday … 7 = Saturday (the notification API's convention). */
  | { kind: 'weekly'; weekday: number; hour: number; minute: number };

export interface ReminderSpec {
  /** Stable identifier, so rescheduling replaces instead of duplicating. */
  id: string;
  title: string;
  body: string;
  trigger: ReminderTrigger;
}

export const REMINDER_PREFIX = 'cubeit.';
/** iOS keeps at most 64 pending local notifications per app; leave headroom. */
export const MAX_REMINDERS = 60;

export const reminderSignature = (r: ReminderSpec) => JSON.stringify([r.title, r.body, r.trigger]);

const hm = (time: string) => ({ hour: Math.floor(minutesOf(time) / 60), minute: minutesOf(time) % 60 });

/** Every local notification the planner wants right now, soonest first, capped for iOS. */
export function computeReminders(data: PlannerData, now: number, characterName: string, limit = MAX_REMINDERS): ReminderSpec[] {
  const today = dayKey(now);
  const repeating: ReminderSpec[] = [];
  const dated: ReminderSpec[] = [];

  for (const e of data.events) {
    if (e.reminderMin === undefined || e.doneAt) continue;
    const start = toTimestamp(e.day, e.allDay ? '09:00' : e.start);
    const at = start - e.reminderMin * 60_000;
    if (at <= now) continue;
    const when = e.allDay ? formatDay(e.day, dayKey(at)) : `${formatDay(e.day, dayKey(at))} at ${formatTime(e.start!)}`;
    dated.push({ id: `${REMINDER_PREFIX}event.${e.id}`, title: e.title, body: when, trigger: { kind: 'date', at } });
  }

  for (const c of data.chores) {
    if (!c.reminder || !c.due || (c.completedAt && !c.recurrence)) continue;
    const at = toTimestamp(c.due, c.dueTime ?? '09:00');
    if (at <= now) continue;
    dated.push({
      id: `${REMINDER_PREFIX}chore.${c.id}.${c.due}`,
      title: c.title,
      body: c.dueTime ? `Chore due ${formatDayInline(c.due, today)} at ${formatTime(c.dueTime)}` : `Chore due ${formatDayInline(c.due, today)}`,
      trigger: { kind: 'date', at },
    });
  }

  for (const h of data.habits) {
    if (h.archived || !h.reminder) continue;
    const { hour, minute } = hm(h.reminder);
    const body = h.kind === 'routine' ? `Time for your routine (${h.steps.length} steps).` : `${characterName} is cheering you on!`;
    if (h.schedule.type === 'daily') {
      repeating.push({ id: `${REMINDER_PREFIX}habit.${h.id}`, title: h.title, body, trigger: { kind: 'daily', hour, minute } });
    } else {
      for (const d of h.schedule.days as Weekday[]) {
        repeating.push({ id: `${REMINDER_PREFIX}habit.${h.id}.${d}`, title: h.title, body, trigger: { kind: 'weekly', weekday: d + 1, hour, minute } });
      }
    }
  }

  dated.sort((a, b) => (a.trigger as { at: number }).at - (b.trigger as { at: number }).at);
  return [...repeating, ...dated].slice(0, limit);
}

export interface ReminderPlan {
  cancel: string[];
  schedule: ReminderSpec[];
}

/** What to cancel and (re)schedule, given what's already pending (id → signature). Ours only. */
export function planReminderSync(desired: readonly ReminderSpec[], pending: ReadonlyMap<string, string | undefined>): ReminderPlan {
  const want = new Map(desired.map((r) => [r.id, r]));
  const cancel: string[] = [];
  for (const [id, sig] of pending) {
    if (!id.startsWith(REMINDER_PREFIX)) continue;
    const spec = want.get(id);
    if (!spec || reminderSignature(spec) !== sig) cancel.push(id);
  }
  const schedule = desired.filter((r) => !pending.has(r.id) || cancel.includes(r.id));
  return { cancel, schedule };
}
