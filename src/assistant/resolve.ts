import { tokenize } from '../memory/recall';
import { addDays, dayKey, diffDays, type DayKey, type Weekday } from '../planner/dates';
import { PlannerError, validateEventDraft } from '../planner/ops';
import { MOODS, type ChoreCategory, type HabitSchedule, type Mood, type PlannerData } from '../planner/types';
import { parseRepeat, parseWeekdays, parseWhen, stripSpans, type ParsedWhen } from './dateParse';
import { splitList, type AssistantAction, type PendingAsk, type RawIntent, type Resolution } from './schema';

/**
 * Validation layer between proposals (model or built-in parser) and the
 * planner: resolves dates against the clock, finds the item a request refers
 * to, fills defaults, and asks a follow-up question when something essential
 * is missing. Anything that can't be made valid is rejected with a reason.
 */

export interface ResolveContext {
  now: number;
  data: PlannerData;
  /** The user's original message (for words like "remind me"). */
  sourceText: string;
}

const MAX_TITLE = 120;

function cleanTitle(s: string | undefined): string {
  return (s ?? '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/^(?:a|an|the|my)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, MAX_TITLE);
}

const ask = (question: string, raw: RawIntent, slot: PendingAsk['slot'], ctx: ResolveContext, options?: PendingAsk['options']): Resolution => ({
  kind: 'ask',
  question,
  pending: { raw, slot, sourceText: ctx.sourceText, ...(options ? { options } : {}) },
});

const reject = (message: string): Resolution => ({ kind: 'reject', message });

interface Named {
  id: string;
  title: string;
}

/** Find items whose title matches `query` (token overlap or substring). Best first. */
export function matchByTitle<T extends Named>(items: readonly T[], query: string): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const qTokens = new Set(tokenize(q));
  const scored = items
    .map((item) => {
      const title = item.title.toLowerCase();
      if (title === q) return { item, score: 100 };
      let score = 0;
      if (title.includes(q) || q.includes(title)) score += 10;
      const tTokens = new Set(tokenize(title));
      qTokens.forEach((t) => {
        if (tTokens.has(t)) score += 3;
      });
      return { item, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return [];
  const top = scored[0].score;
  return scored.filter((s) => s.score === top).map((s) => s.item);
}

function guessMood(text: string): Mood | undefined {
  const t = text.toLowerCase();
  if ((MOODS as readonly string[]).includes(t.trim())) return t.trim() as Mood;
  if (/\b(amazing|fantastic|wonderful|best day|so happy|thrilled|great day)\b/.test(t)) return 'great';
  if (/\b(good|nice|happy|fun|productive|relaxed|calm)\b/.test(t)) return 'good';
  if (/\b(awful|terrible|horrible|worst|miserable|crying)\b/.test(t)) return 'rough';
  if (/\b(sad|down|tired|stressed|anxious|lonely|bad day|exhausted|upset|worried)\b/.test(t)) return 'low';
  if (/\b(okay|ok|fine|alright|meh)\b/.test(t)) return 'okay';
  return undefined;
}

const CATEGORY_WORDS: [ChoreCategory, RegExp][] = [
  ['laundry', /\b(laundry|wash(ing)? clothes|fold|iron|sheets|towels)\b/],
  ['kitchen', /\b(dish(es)?|dishwasher|kitchen|fridge|oven|cook|stove|counter)\b/],
  ['outdoor', /\b(lawn|mow|garden|yard|weeds?|leaves|car wash|wash the car|gutters?|plants?)\b/],
  ['pets', /\b(cat|dog|litter|feed the|walk the dog|fish tank|pet)\b/],
  ['errand', /\b(groceries|shopping|buy|pick up|post office|pharmacy|bank|return)\b/],
  ['home', /\b(clean|vacuum|dust|mop|tidy|bathroom|toilet|trash|garbage|bins?|recycling|bed)\b/],
];

export function guessCategory(title: string): ChoreCategory {
  const t = title.toLowerCase();
  return CATEGORY_WORDS.find(([, re]) => re.test(t))?.[0] ?? 'other';
}

/** Parse the `when` slot, falling back to date words left inside the title. */
function whenOf(raw: RawIntent, prefer: 'future' | 'past', now: number): { parsed: ParsedWhen; title: string } {
  const fromWhen = raw.when ? parseWhen(raw.when, now, prefer) : { spans: [] as string[] };
  const fromTitle = raw.title ? parseWhen(raw.title, now, prefer) : { spans: [] as string[] };
  const parsed: ParsedWhen = { ...fromTitle, ...stripUndefined(fromWhen), spans: [...fromWhen.spans, ...fromTitle.spans] };
  const title = raw.title ? stripSpans(raw.title, fromTitle.spans) : '';
  return { parsed, title };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function pickOne<T extends Named>(
  matches: T[],
  noun: string,
  query: string,
  raw: RawIntent,
  ctx: ResolveContext,
  label: (t: T) => string,
): { item: T } | { res: Resolution } {
  if (!query) return { res: ask(`Which ${noun}?`, raw, 'target', ctx) };
  if (matches.length === 0) return { res: reject(`I couldn’t find a ${noun} called “${query}”.`) };
  if (matches.length > 1) {
    return {
      res: ask(
        `Which one do you mean?`,
        raw,
        'target',
        ctx,
        matches.slice(0, 4).map((m) => ({ id: m.id, label: label(m) })),
      ),
    };
  }
  return { item: matches[0] };
}

export function resolveIntent(raw: RawIntent, ctx: ResolveContext, targetId?: string): Resolution {
  const today = dayKey(ctx.now);
  const { data } = ctx;
  const source = ctx.sourceText.toLowerCase();

  switch (raw.intent) {
    case 'chat':
      return { kind: 'chat' };

    // ── calendar ──
    case 'create_event': {
      const { parsed, title } = whenOf(raw, 'future', ctx.now);
      const name = cleanTitle(title || raw.title);
      if (!name) return ask('What should I call it?', raw, 'title', ctx);
      if (!parsed.day) return ask(`What day is “${name}”?`, raw, 'when', ctx);
      if (diffDays(today, parsed.day) < 0) return reject('That date is in the past. Which day did you mean?');
      const allDay = !!parsed.allDay || (!parsed.start && /\ball[- ]day\b/.test(`${raw.when ?? ''} ${source}`));
      if (!allDay && !parsed.start) return ask(`What time is “${name}”? (Or say “all day”.)`, raw, 'time', ctx);
      const remind = /\bremind\b/.test(source);
      const draft = { title: name, day: parsed.day, allDay, ...(allDay ? {} : { start: parsed.start, ...(parsed.end ? { end: parsed.end } : {}) }), ...(remind ? { reminderMin: 0 } : {}) };
      try {
        const valid = validateEventDraft(draft);
        return { kind: 'action', action: { type: 'createEvent', ...valid } as AssistantAction };
      } catch (e) {
        return reject(e instanceof PlannerError ? e.message : 'That event isn’t valid.');
      }
    }
    case 'update_event':
    case 'complete_event': {
      const upcoming = data.events.filter((e) => (raw.intent === 'complete_event' ? !e.doneAt : diffDays(today, e.day) >= -1));
      const query = cleanTitle(raw.title ?? raw.query ?? '');
      const target = targetId ? upcoming.filter((e) => e.id === targetId) : matchByTitle(upcoming, query);
      const sorted = [...target].sort((a, b) => Math.abs(diffDays(today, a.day)) - Math.abs(diffDays(today, b.day)));
      const picked = pickOne(sorted.length > 1 && sorted[0].title !== sorted[1].title ? sorted : sorted.slice(0, 1), 'event', query, raw, ctx, (e) => `${e.title} (${e.day})`);
      if ('res' in picked) return picked.res;
      const event = picked.item;
      if (raw.intent === 'complete_event') return { kind: 'action', action: { type: 'completeEvent', id: event.id, title: event.title } };
      const parsed = raw.when ? parseWhen(raw.when, ctx.now, 'future') : null;
      if (!parsed || (!parsed.day && !parsed.start && !parsed.allDay)) return ask(`When should “${event.title}” be instead?`, { ...raw, title: event.title }, 'when', ctx);
      const patch: { day?: DayKey; start?: string; end?: string; allDay?: boolean } = {};
      if (parsed.day) patch.day = parsed.day;
      if (parsed.allDay) patch.allDay = true;
      else if (parsed.start) {
        patch.start = parsed.start;
        patch.allDay = false;
        if (parsed.end) patch.end = parsed.end;
      }
      const day = patch.day ?? event.day;
      if (diffDays(today, day) < 0) return reject('That date is in the past.');
      try {
        validateEventDraft({
          title: event.title,
          day,
          allDay: patch.allDay ?? event.allDay,
          start: patch.start ?? event.start,
          end: patch.end ?? (patch.start ? undefined : event.end),
        });
      } catch (e) {
        return reject(e instanceof PlannerError ? e.message : 'That change isn’t valid.');
      }
      return { kind: 'action', action: { type: 'updateEvent', id: event.id, title: event.title, patch } };
    }
    case 'list_events': {
      const text = `${raw.when ?? ''} ${raw.title ?? ''} ${source}`;
      const parsed = parseWhen(text, ctx.now, 'future');
      if (parsed.range) return { kind: 'action', action: { type: 'listEvents', from: parsed.range.from, to: parsed.range.to, label: rangeLabel(text) } };
      if (/\b(upcoming|coming up|next few days|soon|ahead)\b/.test(text)) {
        return { kind: 'action', action: { type: 'listEvents', from: today, to: addDays(today, 6), label: 'in the next 7 days' } };
      }
      const day = parsed.day ?? today;
      return { kind: 'action', action: { type: 'listEvents', from: day, to: day, label: dayLabel(day, today) } };
    }

    // ── habits & routines ──
    case 'create_habit':
    case 'create_routine': {
      const isRoutine = raw.intent === 'create_routine';
      const words = `${raw.days ?? ''} ${raw.when ?? ''} ${raw.title ?? ''}`;
      const days = parseWeekdays(words) ?? parseWeekdays(source);
      const time = parseWhen(`${raw.when ?? ''} ${raw.days ?? ''}`, ctx.now).start ?? parseWhen(raw.title ?? '', ctx.now).start;
      let title = cleanTitle(
        (raw.title ?? '')
          .replace(/\b(every ?day|daily|each day|every (morning|night|evening)|weekdays|weekends|on [a-z ,]+$)\b/gi, '')
          .replace(/\b(at|around)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, ''),
      );
      if (isRoutine && !title) title = /\bmorning\b/.test(source) ? 'Morning routine' : /\b(evening|night|bed)/.test(source) ? 'Evening routine' : '';
      if (!title) return ask(isRoutine ? 'What should the routine be called?' : 'What habit would you like to build?', raw, 'title', ctx);
      const steps = isRoutine ? (raw.steps ?? []).flatMap((s) => (s.includes(',') ? splitList(s) : [s])).map((s) => cleanTitle(s)).filter(Boolean) : [];
      if (isRoutine && steps.length === 0) return ask(`What are the steps for “${title}”? Separate them with commas.`, { ...raw, title }, 'steps', ctx);
      if (data.habits.some((h) => !h.archived && h.title.toLowerCase() === title.toLowerCase())) return reject(`You already have “${title}”.`);
      const schedule: HabitSchedule = days && 'days' in days ? { type: 'days', days: days.days as Weekday[] } : { type: 'daily' };
      return {
        kind: 'action',
        action: { type: 'createHabit', kind: isRoutine ? 'routine' : 'habit', title, schedule, steps, ...(time ? { reminder: time } : {}) },
      };
    }
    case 'log_habit': {
      const query = cleanTitle(raw.title ?? raw.query ?? '');
      const active = data.habits.filter((h) => !h.archived);
      const day = (raw.when ? parseWhen(raw.when, ctx.now, 'past').day : undefined) ?? today;
      if (diffDays(day, today) < 0) return reject('You can’t finish a habit in the future!');
      const habits = targetId ? active.filter((h) => h.id === targetId) : matchByTitle(active, query);
      if (habits.length === 0 && query) {
        // "I did the laundry" may be a chore or an event rather than a habit.
        const chores = matchByTitle(data.chores.filter((c) => !c.completedAt || c.recurrence), query);
        if (chores.length > 0) return resolveIntent({ ...raw, intent: 'complete_chore' }, ctx);
        const events = matchByTitle(data.events.filter((e) => !e.doneAt), query);
        if (events.length > 0) return resolveIntent({ ...raw, intent: 'complete_event' }, ctx);
      }
      const picked = pickOne(habits, 'habit', query, raw, ctx, (h) => h.title);
      if ('res' in picked) return picked.res;
      return { kind: 'action', action: { type: 'logHabit', id: picked.item.id, title: picked.item.title, day } };
    }
    case 'habit_progress': {
      const query = cleanTitle(raw.title ?? raw.query ?? '');
      if (!query) return { kind: 'action', action: { type: 'habitProgress' } };
      const habits = matchByTitle(data.habits, query);
      if (habits.length === 0) return { kind: 'action', action: { type: 'habitProgress' } };
      return { kind: 'action', action: { type: 'habitProgress', id: habits[0].id } };
    }

    // ── chores ──
    case 'create_chore': {
      const { parsed, title } = whenOf(raw, 'future', ctx.now);
      const repeat = parseRepeat(`${raw.repeat ?? ''} ${raw.when ?? ''}`) ?? parseRepeat(source);
      const name = cleanTitle(
        (title || raw.title || '').replace(/\b(every (other |\d+ )?(day|week|month)s?|weekly|daily|monthly|fortnightly|every [a-z]+day)\b/gi, ''),
      );
      if (!name) return ask('What’s the chore?', raw, 'title', ctx);
      if (parsed.day && diffDays(today, parsed.day) < 0) return reject('That due date is in the past.');
      const remind = /\bremind\b/.test(source);
      return {
        kind: 'action',
        action: {
          type: 'createChore',
          title: name,
          ...(parsed.day ? { due: parsed.day } : repeat ? { due: today } : {}),
          ...(parsed.day && parsed.start && !parsed.approximate ? { dueTime: parsed.start } : {}),
          ...(repeat ? { recurrence: repeat } : {}),
          checklist: (raw.steps ?? []).map((s) => cleanTitle(s)).filter(Boolean),
          category: guessCategory(name),
          reminder: remind && !!(parsed.day || repeat),
        },
      };
    }
    case 'update_chore':
    case 'complete_chore': {
      const open = data.chores.filter((c) => !c.completedAt || c.recurrence);
      const query = cleanTitle(raw.title ?? raw.query ?? '');
      const matches = targetId ? open.filter((c) => c.id === targetId) : matchByTitle(open, query);
      const picked = pickOne(matches, 'chore', query, raw, ctx, (c) => c.title);
      if ('res' in picked) return picked.res;
      const chore = picked.item;
      if (raw.intent === 'complete_chore') return { kind: 'action', action: { type: 'completeChore', id: chore.id, title: chore.title, due: chore.due ?? null } };
      const parsed = raw.when ? parseWhen(raw.when, ctx.now, 'future') : null;
      const repeat = parseRepeat(`${raw.repeat ?? ''} ${raw.when ?? ''}`);
      const patch: { due?: DayKey; dueTime?: string; recurrence?: { every: number; unit: 'day' | 'week' | 'month' } } = {};
      if (parsed?.day) {
        if (diffDays(today, parsed.day) < 0) return reject('That due date is in the past.');
        patch.due = parsed.day;
      }
      if (parsed?.start && !parsed.approximate) patch.dueTime = parsed.start;
      if (repeat) patch.recurrence = repeat;
      if (Object.keys(patch).length === 0) return ask(`What should change about “${chore.title}”? (A new day, time or repeat.)`, { ...raw, title: chore.title }, 'when', ctx);
      if (patch.recurrence && !patch.due && !chore.due) patch.due = today;
      return { kind: 'action', action: { type: 'updateChore', id: chore.id, title: chore.title, patch } };
    }
    case 'list_chores': {
      const t = `${raw.query ?? ''} ${source}`;
      const filter = /\boverdue|late|missed\b/.test(t) ? 'overdue' : /\b(done|finished|completed)\b/.test(t) ? 'done' : /\btoday\b/.test(t) ? 'today' : 'pending';
      return { kind: 'action', action: { type: 'listChores', filter } };
    }

    // ── journal & memories ──
    case 'create_journal': {
      const text = (raw.text ?? '').trim();
      if (!text) return ask('What would you like to write in your journal?', raw, 'text', ctx);
      const mood = raw.mood ? guessMood(raw.mood) : guessMood(text);
      return { kind: 'action', action: { type: 'createJournal', text: text.slice(0, 8000), day: today, ...(mood ? { mood } : {}) } };
    }
    case 'search_journal': {
      const text = `${raw.when ?? ''} ${source}`;
      const parsed = parseWhen(text, ctx.now, 'past');
      const range = parsed.range ?? (parsed.day ? { from: parsed.day, to: parsed.day } : undefined);
      const query = (raw.query ?? raw.title ?? '').trim();
      const queryClean = range ? stripSpans(query, parseWhen(query, ctx.now, 'past').spans) : query;
      return {
        kind: 'action',
        action: { type: 'searchJournal', query: queryClean.slice(0, 200), ...(range ? { from: range.from, to: range.to, label: rangeLabel(text) || dayLabel(range.from, today) } : {}) },
      };
    }
    case 'recall_memory': {
      const query = (raw.query ?? raw.title ?? raw.text ?? '').trim();
      return { kind: 'action', action: { type: 'recallMemory', query: query.slice(0, 200) } };
    }
  }
}

/** Fill the slot the assistant asked about with the user's answer, then resolve again. */
export function answerPending(pending: PendingAsk, answer: string, ctx: Omit<ResolveContext, 'sourceText'>): Resolution {
  const raw: RawIntent = { ...pending.raw };
  const text = answer.trim();
  const next = { ...ctx, sourceText: `${pending.sourceText} ${text}` };
  switch (pending.slot) {
    case 'title':
      raw.title = text;
      break;
    case 'when':
      raw.when = text;
      break;
    case 'time':
      raw.when = `${raw.when ?? ''} ${/^\d{1,2}(:\d{2})?$/.test(text) ? `at ${text}` : text}`.trim();
      break;
    case 'steps':
      raw.steps = splitList(text);
      break;
    case 'text':
      raw.text = text;
      break;
    case 'target': {
      const options = pending.options ?? [];
      const n = Number(text.replace(/[^\d]/g, ''));
      const byNumber = Number.isInteger(n) && n >= 1 && n <= options.length ? options[n - 1] : undefined;
      const byName = options.find((o) => o.label.toLowerCase().includes(text.toLowerCase()));
      const chosen = byNumber ?? byName;
      if (chosen) return resolveIntent(raw, next, chosen.id);
      raw.title = text;
      break;
    }
  }
  return resolveIntent(raw, next);
}

function dayLabel(day: DayKey, today: DayKey): string {
  const d = diffDays(today, day);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return `on ${day}`;
}

function rangeLabel(text: string): string {
  const m = text.toLowerCase().match(/\b(this|next|last) (week(?:end)?|month)\b|\b(the )?weekend\b/);
  return m ? m[0].replace(/^the /, 'this ') : '';
}
