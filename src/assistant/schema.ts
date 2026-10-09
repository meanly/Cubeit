import type { DayKey, TimeOfDay } from '../planner/dates';
import type { ChoreCategory, HabitSchedule, Mood, Recurrence } from '../planner/types';

/**
 * Two layers:
 * - `RawIntent`: what the language model (or the built-in parser) proposes —
 *   an intent plus the user's own words for each slot. Untrusted.
 * - `AssistantAction`: a fully validated, typed operation with resolved ids
 *   and dates. Only these can reach the planner, through a fixed executor —
 *   the model can never run arbitrary database operations.
 */

export const INTENTS = [
  'create_event',
  'update_event',
  'complete_event',
  'list_events',
  'create_habit',
  'create_routine',
  'log_habit',
  'habit_progress',
  'create_chore',
  'update_chore',
  'complete_chore',
  'list_chores',
  'create_journal',
  'search_journal',
  'recall_memory',
  'chat',
] as const;
export type Intent = (typeof INTENTS)[number];

export interface RawIntent {
  intent: Intent;
  /** Name of the thing to create or find. */
  title?: string;
  /** Date/time words exactly as the user said them ("tomorrow at 3pm"). */
  when?: string;
  /** Which days, for habits ("every day", "mon wed fri"). */
  days?: string;
  /** Repeat words for chores ("every week"). */
  repeat?: string;
  /** Routine steps or checklist items. */
  steps?: string[];
  /** Journal text. */
  text?: string;
  /** What to search for. */
  query?: string;
  mood?: string;
}

export type AssistantAction =
  | { type: 'createEvent'; title: string; day: DayKey; allDay: boolean; start?: TimeOfDay; end?: TimeOfDay; reminderMin?: number }
  | { type: 'updateEvent'; id: string; title: string; patch: { day?: DayKey; start?: TimeOfDay; end?: TimeOfDay; allDay?: boolean } }
  | { type: 'completeEvent'; id: string; title: string }
  | { type: 'listEvents'; from: DayKey; to: DayKey; label: string }
  | { type: 'createHabit'; kind: 'habit' | 'routine'; title: string; schedule: HabitSchedule; steps: string[]; reminder?: TimeOfDay }
  | { type: 'logHabit'; id: string; title: string; day: DayKey }
  | { type: 'habitProgress'; id?: string }
  | { type: 'createChore'; title: string; due?: DayKey; dueTime?: TimeOfDay; recurrence?: Recurrence; checklist: string[]; category: ChoreCategory; reminder: boolean }
  | { type: 'updateChore'; id: string; title: string; patch: { due?: DayKey; dueTime?: TimeOfDay; recurrence?: Recurrence } }
  | { type: 'completeChore'; id: string; title: string; due: DayKey | null }
  | { type: 'listChores'; filter: 'pending' | 'overdue' | 'today' | 'done' }
  | { type: 'createJournal'; text: string; mood?: Mood; day: DayKey; images?: string[] }
  | { type: 'searchJournal'; query: string; from?: DayKey; to?: DayKey; label?: string }
  | { type: 'recallMemory'; query: string };

export type ActionType = AssistantAction['type'];

const WRITE_ACTIONS: readonly ActionType[] = [
  'createEvent',
  'updateEvent',
  'completeEvent',
  'createHabit',
  'logHabit',
  'createChore',
  'updateChore',
  'completeChore',
  'createJournal',
];

/** Actions that change saved data need the user's tap before they run. */
export const isWriteAction = (a: AssistantAction) => WRITE_ACTIONS.includes(a.type);

/** Slot the assistant is waiting for after asking a follow-up question. */
export type AskSlot = 'title' | 'when' | 'time' | 'steps' | 'text' | 'target';

export interface PendingAsk {
  raw: RawIntent;
  slot: AskSlot;
  /** For "which one?" questions. */
  options?: { id: string; label: string }[];
  /** The original request text (used for words like "remind"). */
  sourceText: string;
}

export type Resolution =
  | { kind: 'action'; action: AssistantAction }
  | { kind: 'ask'; question: string; pending: PendingAsk }
  | { kind: 'reject'; message: string }
  | { kind: 'chat' };

/** JSON Schema the model's output is constrained to (llama.cpp turns it into a grammar). */
export const ROUTER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: INTENTS },
    title: { type: 'string' },
    when: { type: 'string' },
    days: { type: 'string' },
    repeat: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    text: { type: 'string' },
    query: { type: 'string' },
    mood: { type: 'string' },
  },
  required: ['intent'],
  additionalProperties: false,
} as const;

const MAX_FIELD = 300;

/**
 * Turn anything (parsed JSON from the model, or garbage) into a RawIntent, or
 * null. Unknown intents, wrong types and oversized fields are rejected or
 * trimmed; nothing is passed through unchecked.
 */
export function coerceRawIntent(value: unknown): RawIntent | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const intent = typeof v.intent === 'string' ? v.intent.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  if (!(INTENTS as readonly string[]).includes(intent)) return null;
  const out: RawIntent = { intent: intent as Intent };
  const s = (k: keyof RawIntent) => {
    const x = v[k];
    if (typeof x === 'string' && x.trim()) (out as unknown as Record<string, unknown>)[k] = x.replace(/\s+/g, ' ').trim().slice(0, MAX_FIELD);
  };
  s('title');
  s('when');
  s('days');
  s('repeat');
  s('query');
  s('mood');
  if (typeof v.text === 'string' && v.text.trim()) out.text = v.text.trim().slice(0, 4000);
  if (Array.isArray(v.steps)) {
    const steps = v.steps.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 120)).filter(Boolean).slice(0, 20);
    if (steps.length > 0) out.steps = steps;
  } else if (typeof v.steps === 'string' && v.steps.trim()) {
    out.steps = splitList(v.steps);
  }
  return out;
}

/**
 * Parse a model completion into a RawIntent. Tolerates code fences, chatter
 * around the JSON, and trailing commas; returns null for anything else.
 */
export function parseModelOutput(text: string): RawIntent | null {
  if (!text) return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  // A JSON array wrapping the object isn't the shape we asked for.
  if (/\[\s*$/.test(cleaned.slice(0, start))) return null;
  let depth = 0;
  let inString = false;
  let end = -1;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const json = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
  try {
    return coerceRawIntent(JSON.parse(json));
  } catch {
    return null;
  }
}

/** "a, b and c" / "a; b; then c" / lines → ["a", "b", "c"]. */
export function splitList(text: string): string[] {
  return text
    .split(/\n|,|;|\band then\b|\bthen\b|\band\b/i)
    .map((s) => s.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((s) => s.length > 0)
    .slice(0, 20);
}
