import { highlights, searchMemories } from '../memory/recall';
import type { Memory } from '../memory/types';
import { dayKey, diffDays, formatDay, formatDayInline, formatTime, type DayKey } from '../planner/dates';
import { encouragement, habitStats, scheduleLabel } from '../planner/habits';
import { MOOD_LABEL, searchJournal } from '../planner/journal';
import { eventsBetween } from '../planner/ops';
import { choreStatus, recurrenceLabel } from '../planner/recurrence';
import * as service from '../planner/service';
import type { CalendarEvent, PlannerData } from '../planner/types';
import { SaveFailedError } from '../state/plannerStore';
import type { AssistantAction } from './schema';

/** A line in a result list rendered under the character's reply. */
export interface ResultItem {
  id: string;
  title: string;
  detail?: string;
}

export type ActionOutcome =
  | { ok: true; text: string; items?: ResultItem[]; usedIds?: string[] }
  | { ok: false; text: string };

const list = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

export function eventWhen(e: Pick<CalendarEvent, 'day' | 'allDay' | 'start' | 'end'>, today: DayKey): string {
  const day = formatDay(e.day, today);
  if (e.allDay) return `${day} · all day`;
  return `${day} · ${formatTime(e.start!)}${e.end ? `–${formatTime(e.end)}` : ''}`;
}

/** Human description of a proposed change, for the confirmation card. */
export function describeAction(a: AssistantAction, today: DayKey): { heading: string; lines: string[]; confirmLabel: string } {
  switch (a.type) {
    case 'createEvent':
      return {
        heading: 'Add to calendar',
        lines: [a.title, eventWhen(a, today), ...(a.reminderMin !== undefined ? ['Reminder at the start time'] : [])],
        confirmLabel: 'Add event',
      };
    case 'updateEvent': {
      const p = a.patch;
      const bits = [p.day ? formatDay(p.day, today) : null, p.allDay ? 'all day' : p.start ? `${formatTime(p.start)}${p.end ? `–${formatTime(p.end)}` : ''}` : null].filter(Boolean);
      return { heading: 'Change event', lines: [a.title, `Move to ${bits.join(' · ')}`], confirmLabel: 'Save change' };
    }
    case 'completeEvent':
      return { heading: 'Mark event done', lines: [a.title], confirmLabel: 'Mark done' };
    case 'createHabit':
      return {
        heading: a.kind === 'routine' ? 'New routine' : 'New habit',
        lines: [
          a.title,
          scheduleLabel(a.schedule) + (a.reminder ? ` · reminder ${formatTime(a.reminder)}` : ''),
          ...(a.steps.length ? [a.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')] : []),
        ],
        confirmLabel: a.kind === 'routine' ? 'Create routine' : 'Create habit',
      };
    case 'logHabit':
      return { heading: 'Complete habit', lines: [a.title, formatDay(a.day, today)], confirmLabel: 'Mark done' };
    case 'createChore':
      return {
        heading: 'New chore',
        lines: [
          a.title,
          [a.due ? `Due ${formatDayInline(a.due, today)}${a.dueTime ? ` at ${formatTime(a.dueTime)}` : ''}` : 'No due date', a.recurrence ? recurrenceLabel(a.recurrence) : null]
            .filter(Boolean)
            .join(' · '),
          ...(a.checklist.length ? [a.checklist.map((s) => `☐ ${s}`).join('\n')] : []),
          ...(a.reminder ? ['Reminder on the due day'] : []),
        ],
        confirmLabel: 'Add chore',
      };
    case 'updateChore': {
      const p = a.patch;
      const bits = [p.due ? `due ${formatDayInline(p.due, today)}` : null, p.dueTime ? formatTime(p.dueTime) : null, p.recurrence ? recurrenceLabel(p.recurrence).toLowerCase() : null].filter(Boolean);
      return { heading: 'Change chore', lines: [a.title, bits.join(' · ')], confirmLabel: 'Save change' };
    }
    case 'completeChore':
      return { heading: 'Finish chore', lines: [a.title, a.due ? `Due ${formatDayInline(a.due, today)}` : ''].filter(Boolean), confirmLabel: 'Mark done' };
    case 'createJournal':
      return {
        heading: 'Journal entry',
        lines: [a.text.length > 280 ? `${a.text.slice(0, 280)}…` : a.text, ...(a.mood ? [`Mood: ${MOOD_LABEL[a.mood]}`] : []), ...(a.images?.length ? ['With the photo attached'] : [])],
        confirmLabel: 'Save entry',
      };
    default:
      return { heading: '', lines: [], confirmLabel: 'OK' };
  }
}

function failure(error: unknown): ActionOutcome {
  if (error instanceof SaveFailedError) return { ok: false, text: error.message };
  if (error instanceof Error && error.message) return { ok: false, text: `I couldn’t do that: ${error.message}` };
  return { ok: false, text: 'Something went wrong, so nothing was changed.' };
}

/**
 * Run a validated action. Writes go through the planner service (validated
 * again, saved synchronously, rolled back on a failed save); the reply is only
 * built from what was actually stored or read.
 */
export function executeAction(a: AssistantAction, ctx: { data: () => PlannerData; memories: readonly Memory[]; now: number }): ActionOutcome {
  const today = dayKey(ctx.now);
  try {
    switch (a.type) {
      case 'createEvent': {
        const ev = service.createEvent({ title: a.title, day: a.day, allDay: a.allDay, start: a.start, end: a.end, reminderMin: a.reminderMin });
        const saved = ctx.data().events.find((e) => e.id === ev.id);
        if (!saved) return { ok: false, text: 'That didn’t save, so nothing was added.' };
        return { ok: true, text: `Added “${saved.title}” — ${eventWhen(saved, today).replace(' · ', ' ')}.` };
      }
      case 'updateEvent': {
        const ev = service.editEvent(a.id, a.patch);
        return { ok: true, text: `Moved “${ev.title}” to ${eventWhen(ev, today).replace(' · ', ' ')}.` };
      }
      case 'completeEvent': {
        service.markEventDone(a.id, true);
        return { ok: true, text: `Marked “${a.title}” as done.` };
      }
      case 'listEvents': {
        const events = eventsBetween(ctx.data().events, a.from, a.to);
        const label = a.label || (a.from === a.to ? formatDayInline(a.from, today) : 'then');
        if (events.length === 0) return { ok: true, text: `Nothing on your calendar ${label}.` };
        const items = events.map((e) => ({ id: e.id, title: e.title + (e.doneAt ? ' ✓' : ''), detail: eventWhen(e, today) }));
        const head =
          events.length === 1
            ? `You have one thing ${label}: ${events[0].title}${events[0].allDay ? '' : ` at ${formatTime(events[0].start!)}`}.`
            : `You have ${events.length} things ${label}.`;
        return { ok: true, text: head, items, usedIds: events.map((e) => e.id) };
      }
      case 'createHabit': {
        const h = service.createHabit({ title: a.title, kind: a.kind, schedule: a.schedule, steps: a.steps, reminder: a.reminder });
        return { ok: true, text: `${h.kind === 'routine' ? 'Routine' : 'Habit'} “${h.title}” is set up — ${scheduleLabel(h.schedule).toLowerCase()}. I’ll cheer you on!` };
      }
      case 'logHabit': {
        const added = service.completeHabit(a.id, a.day);
        const data = ctx.data();
        const habit = data.habits.find((h) => h.id === a.id);
        if (!habit) return { ok: false, text: 'That habit no longer exists.' };
        const stats = habitStats(habit, data.habitLogs, today);
        return { ok: true, text: added ? encouragement(habit, stats) : `“${habit.title}” was already done ${formatDayInline(a.day, today)}.` };
      }
      case 'habitProgress': {
        const data = ctx.data();
        const habits = data.habits.filter((h) => !h.archived && (!a.id || h.id === a.id));
        if (habits.length === 0) return { ok: true, text: 'You don’t have any habits yet. Want to start one?' };
        const items = habits.map((h) => {
          const s = habitStats(h, data.habitLogs, today);
          return { id: h.id, title: h.title, detail: `${s.streak}-day streak · ${s.week.done}/${s.week.scheduled} this week${s.doneToday ? ' · done today' : ''}` };
        });
        if (habits.length === 1) {
          const s = habitStats(habits[0], data.habitLogs, today);
          return { ok: true, text: encouragement(habits[0], s), items };
        }
        const doneToday = habits.filter((h) => habitStats(h, data.habitLogs, today).doneToday).length;
        return { ok: true, text: `${doneToday} of ${habits.length} habits done today. Here’s how each is going:`, items };
      }
      case 'createChore': {
        const c = service.createChore({ title: a.title, due: a.due, dueTime: a.dueTime, recurrence: a.recurrence, checklist: a.checklist, category: a.category, reminder: a.reminder });
        const when = c.due ? ` (due ${formatDayInline(c.due, today)})` : '';
        return { ok: true, text: `Added the chore “${c.title}”${when}${c.recurrence ? `, ${recurrenceLabel(c.recurrence).toLowerCase()}` : ''}.` };
      }
      case 'updateChore': {
        const c = service.editChore(a.id, a.patch);
        return { ok: true, text: `Updated “${c.title}”${c.due ? ` — due ${formatDayInline(c.due, today)}` : ''}${c.recurrence ? `, ${recurrenceLabel(c.recurrence).toLowerCase()}` : ''}.` };
      }
      case 'completeChore': {
        const done = service.finishChore(a.id, a.due);
        if (!done) return { ok: true, text: `“${a.title}” was already finished.` };
        const next = ctx.data().chores.find((c) => c.id === a.id);
        return { ok: true, text: next?.recurrence && next.due ? `Nice work! Next time: ${formatDayInline(next.due, today)}.` : `Nice work — “${a.title}” is done!` };
      }
      case 'listChores': {
        const data = ctx.data();
        if (a.filter === 'done') {
          const recent = [...data.choreHistory].sort((x, y) => y.at - x.at).slice(0, 8);
          if (recent.length === 0) return { ok: true, text: 'No chores finished yet.' };
          return { ok: true, text: `Recently finished:`, items: recent.map((c, i) => ({ id: `${c.choreId}-${i}`, title: c.title, detail: formatDay(dayKey(c.at), today) })) };
        }
        const open = data.chores
          .filter((c) => {
            const s = choreStatus(c, today);
            if (s === 'done') return false;
            if (a.filter === 'overdue') return s === 'overdue';
            if (a.filter === 'today') return s === 'today' || s === 'overdue';
            return true;
          })
          .sort((x, y) => (x.due ?? '9999').localeCompare(y.due ?? '9999'));
        const label = a.filter === 'overdue' ? 'overdue' : a.filter === 'today' ? 'for today' : 'to do';
        if (open.length === 0) return { ok: true, text: `No chores ${label}!` };
        const items = open.slice(0, 10).map((c) => ({
          id: c.id,
          title: c.title,
          detail: c.due ? `${choreStatus(c, today) === 'overdue' ? 'Overdue · ' : ''}due ${formatDayInline(c.due, today)}` : 'No due date',
        }));
        return { ok: true, text: `${open.length} chore${open.length === 1 ? '' : 's'} ${label}:`, items };
      }
      case 'createJournal': {
        const entry = service.createJournalEntry({ day: a.day, text: a.text, mood: a.mood, images: a.images });
        const saved = ctx.data().journal.some((j) => j.id === entry.id);
        if (!saved) return { ok: false, text: 'That didn’t save, so nothing was added.' };
        return { ok: true, text: 'Saved to your journal. Thanks for telling me.' };
      }
      case 'searchJournal': {
        const hits = searchJournal(ctx.data().journal, a.query, { from: a.from, to: a.to, limit: 5 });
        const where = a.label ? ` ${a.label}` : '';
        if (hits.length === 0) {
          return { ok: true, text: a.query ? `I didn’t find any journal entries about “${a.query}”${where}.` : `There are no journal entries${where}.` };
        }
        const items = hits.map((h) => ({
          id: h.entry.id,
          title: formatDay(h.entry.day, today, { relative: diffDays(h.entry.day, today) < 7 }),
          detail: h.entry.text.length > 140 ? `${h.entry.text.slice(0, 140)}…` : h.entry.text,
        }));
        return { ok: true, text: `I found ${hits.length} entr${hits.length === 1 ? 'y' : 'ies'}${a.query ? ` about “${a.query}”` : ''}${where}:`, items, usedIds: hits.map((h) => h.entry.id) };
      }
      case 'recallMemory': {
        const hits = a.query ? searchMemories(a.query, ctx.memories, 3).map((h) => h.memory) : highlights(ctx.memories, 3);
        if (hits.length === 0) return { ok: true, text: a.query ? `I don’t have a saved memory about “${a.query}”.` : 'I don’t have any saved memories yet.' };
        return { ok: true, text: `I remember ${list(hits.map((m) => `“${m.content}”`))}.`, usedIds: hits.map((m) => m.id) };
      }
    }
  } catch (error) {
    return failure(error);
  }
}
