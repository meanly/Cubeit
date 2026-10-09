import type { PlannerData } from '../planner/types';
import { parseWhen, stripSpans } from './dateParse';
import { splitList, type RawIntent } from './schema';

/**
 * The built-in, rule-based request parser. It is NOT a language model: it
 * recognizes common planner phrasings ("add dentist tomorrow at 3pm", "what's
 * on my schedule this week", "I did my workout") and returns null for
 * anything else. It runs when the on-device model isn't installed, and as a
 * fallback when the model's output can't be validated. Replies built from it
 * are labeled "Built-in parser" in the chat.
 */

const norm = (s: string) => s.replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();

export function parseIntent(input: string, data: PlannerData, now: number = Date.now()): RawIntent | null {
  const raw = norm(input);
  const t = raw.toLowerCase();
  let m: RegExpMatchArray | null;

  // ── Questions ──
  if (
    /\b(what'?s|what is|what do i have|anything|what are my|show( me)?|list|check)\b.*\b(schedule|calendar|agenda|plans?|events?|appointments?|on today|on tomorrow|on for|planned)\b/.test(t) ||
    /\bwhat('?s| is| do i have)? (on|happening|going on|planned)\b/.test(t) ||
    /\b(am i (free|busy))\b/.test(t)
  ) {
    return { intent: 'list_events', when: raw };
  }
  if (/\b(chores?|to-?dos?|tasks?)\b/.test(t) && /\b(what|which|show|list|any|do i have|left|pending|overdue|due|my)\b/.test(t) && !/^(add|create|new|make)\b/.test(t)) {
    return { intent: 'list_chores', query: raw };
  }
  if ((m = t.match(/\b(?:how am i doing|how'?s my|my progress|progress on|streak(?: for| on)?|how many times did i)\b(?:\s+(?:with|on|for))?\s*(?:my\s+)?(.*)$/))) {
    const title = m[1].replace(/\b(habit|habits|streak|this week|so far|going)\b/g, '').replace(/[?.!]/g, '').trim();
    return { intent: 'habit_progress', ...(title ? { title } : {}) };
  }
  if (
    (m = t.match(/\b(?:what did i (?:write|journal|say|note)|did i (?:write|journal) about|find (?:in )?(?:my )?journal(?: entries)?(?: about| for)?|search (?:my )?journal(?: for)?|journal entries? (?:about|from|on))\s*(?:about\s+)?(.*)$/))
  ) {
    return { intent: 'search_journal', query: m[1].replace(/[?.!]/g, '').trim(), when: raw };
  }
  if ((m = t.match(/^(?:what do you (?:know|remember) about|do you remember (?:anything )?about)\s+(.+?)[?.!]*$/))) {
    return { intent: 'recall_memory', query: m[1] };
  }

  // ── Journal ──
  if ((m = raw.match(/^(?:dear diary|journal|diary|journal entry|note to self)\s*[:,\-–]\s*(.+)$/is))) {
    return { intent: 'create_journal', text: m[1] };
  }
  if ((m = raw.match(/^(?:write|add|save|log|put)\s+(?:this\s+)?(?:in(?:to)?\s+)?(?:a\s+|my\s+)?(?:journal|diary)(?:\s+entry)?\s*[:,\-–]?\s*(?:that\s+)?(.*)$/is))) {
    return { intent: 'create_journal', ...(m[1].trim() ? { text: m[1] } : {}) };
  }

  // ── Routines & habits ──
  if ((m = raw.match(/^(?:create|make|add|set up|start|build|new)\s+(?:a\s+|my\s+)?((?:morning|evening|night(?:ly)?|bedtime|workout|study|weekend|daily)?\s*routine)\b\s*(?:called\s+"?([^":]+)"?)?\s*(?:with|:|that has|of)?\s*(.*)$/i))) {
    const title = m[2]?.trim() || m[1].trim();
    const steps = m[3] ? splitList(m[3]) : [];
    return { intent: 'create_routine', title, ...(steps.length ? { steps } : {}), days: raw };
  }
  if (
    (m = raw.match(/^(?:create|make|add|set up|start|track|new|build)\s+(?:a\s+)?(?:new\s+)?habit(?:\s+(?:to|of|called|for))?\s*[:\-–]?\s*(.*)$/i)) ||
    (m = raw.match(/^(?:i want to|i'd like to|help me|remind me to)\s+(?:start\s+|begin\s+|build a habit of\s+|get in the habit of\s+)?(.+?)\s+(every ?day|daily|each day|every (?:morning|night|evening)|(?:every|on) week ?days?|(?:every|on) week ?ends?|every (?:mon|tue|wed|thu|fri|sat|sun)[a-z]*(?:.*)?|on (?:mon|tue|wed|thu|fri|sat|sun)[a-z]*days\b(?:.*)?)(?:\s+at\s+.+)?$/i))
  ) {
    const days = m[2] ?? m[1];
    return { intent: 'create_habit', title: m[1], days };
  }

  // ── Completing things ──
  if (
    (m = raw.match(/^(?:i\s+)?(?:just\s+)?(?:did|finished|completed|done(?: with)?|have done|'?ve done|knocked out)\s+(?:my\s+|the\s+)?(.+?)(?:\s+(today|yesterday|this morning|tonight))?[.!]*$/i)) ||
    (m = raw.match(/^(?:mark|check off|tick off|complete)\s+(?:my\s+|the\s+)?(.+?)\s*(?:as\s+)?(?:done|complete|completed|finished)?(?:\s+(today|yesterday))?[.!]*$/i))
  ) {
    const title = m[1].replace(/\b(as )?(done|complete|completed|finished)$/i, '').trim();
    return { intent: 'log_habit', title, ...(m[2] ? { when: m[2] } : {}) };
  }

  // ── Moving things ──
  if ((m = raw.match(/^(?:move|reschedule|change|push|shift|postpone)\s+(?:my\s+|the\s+)?(.+?)\s+(?:to|until|for)\s+(.+?)[.!]*$/i))) {
    const title = m[1];
    if (data.chores.some((c) => c.title.toLowerCase().includes(title.toLowerCase())) && !data.events.some((e) => e.title.toLowerCase().includes(title.toLowerCase()))) {
      return { intent: 'update_chore', title, when: m[2], repeat: m[2] };
    }
    return { intent: 'update_event', title, when: m[2] };
  }

  // ── Chores ──
  if ((m = raw.match(/^(?:add|put)\s+(.+?)\s+(?:to|on)\s+(?:my\s+)?(?:chores?|to-?do(?: list)?|list)\b(.*)$/i))) {
    const body = `${m[1]} ${m[2]}`.trim();
    return { intent: 'create_chore', title: m[1], when: body, repeat: body };
  }
  if ((m = raw.match(/^(?:add|create|new|make|put)\s+(?:a\s+)?(?:new\s+)?(?:chore|to-?do|task)\s*(?:to|:|-|–)?\s*(.+)$/i))) {
    const body = m[1].trim();
    const [head, ...rest] = body.split(/\s*(?:with (?:a )?checklist|:)\s*/i);
    return { intent: 'create_chore', title: head, when: body, repeat: body, ...(rest.length ? { steps: splitList(rest.join(', ')) } : {}) };
  }
  if ((m = raw.match(/^(?:i\s+)?(?:need|have|got) to\s+((?:clean|wash|vacuum|mop|dust|tidy|do the|take out|empty|mow|water|feed|fold|iron|change the|scrub|sweep)\b.+)$/i))) {
    return { intent: 'create_chore', title: m[1], when: m[1], repeat: m[1] };
  }

  // ── Calendar ──
  const when = parseWhen(raw, now);
  const hasWhen = !!(when.day || when.start || when.range);
  if ((m = raw.match(/^(?:please\s+)?remind me (?:to|about)\s+(.+)$/i))) {
    return { intent: 'create_event', title: stripSpans(m[1], when.spans), when: raw };
  }
  if ((m = raw.match(/^(?:please\s+)?(?:add|schedule|book|put|create|set up|plan|make)\s+(?:an?\s+)?(?:new\s+)?(?:event|appointment|meeting)?\s*(?:called|for|:)?\s*(.+?)(?:\s+(?:to|in|on)\s+(?:my\s+|the\s+)?calendar)?[.!]*$/i))) {
    if (hasWhen || /\b(event|appointment|meeting|calendar)\b/i.test(raw)) {
      return { intent: 'create_event', title: stripSpans(m[1].replace(/\s+(?:to|in|on)\s+(?:my\s+|the\s+)?calendar\b/i, ''), when.spans), when: raw };
    }
  }
  if (hasWhen && (m = raw.match(/^(?:i(?:'ve| have)|i've got|there'?s|i got)\s+(?:an?\s+|my\s+)?(.+)$/i)) && when.day) {
    return { intent: 'create_event', title: stripSpans(m[1], when.spans), when: raw };
  }

  return null;
}
