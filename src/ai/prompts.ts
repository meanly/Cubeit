import type { ChatMessage } from './runtime';

/**
 * Prompts for the on-device model. Small models need short, explicit
 * instructions and examples; dates are never computed by the model — it
 * copies the user's words and the app resolves them.
 */

const ROUTER_SYSTEM = `You convert the user's message into JSON for a planner app. Choose exactly one intent:
create_event: add something to the calendar (title, when)
update_event: move or change an event (title, when)
complete_event: an event is done (title)
list_events: asks about their schedule (when)
create_habit: start tracking a habit (title, days, when = reminder time)
create_routine: a routine made of ordered steps (title, steps, days)
log_habit: says they did a habit, chore or event (title, when)
habit_progress: asks how a habit or streak is going (title)
create_chore: add a chore or to-do (title, when, repeat, steps = checklist)
update_chore: change a chore's day or repeat (title, when, repeat)
complete_chore: finished a chore (title)
list_chores: asks about chores or to-dos
create_journal: wants to write a journal or diary entry (text, mood)
search_journal: asks what they wrote in their journal before (query, when)
recall_memory: asks what you remember about them (query)
chat: anything else, including greetings and questions
Rules: copy date and time words exactly as the user wrote them into "when" — never calculate dates. Keep titles short, without date words. Leave out fields that are not mentioned.`;

const EXAMPLES: [string, string][] = [
  ['Add dentist appointment tomorrow at 3pm', '{"intent":"create_event","title":"Dentist appointment","when":"tomorrow at 3pm"}'],
  ["What's on my schedule this week?", '{"intent":"list_events","when":"this week"}'],
  ['I want to read 20 minutes every weekday at 9pm', '{"intent":"create_habit","title":"Read 20 minutes","days":"every weekday","when":"9pm"}'],
  ['Make a morning routine: stretch, shower, make coffee', '{"intent":"create_routine","title":"Morning routine","steps":["Stretch","Shower","Make coffee"]}'],
  ['I finished my workout', '{"intent":"log_habit","title":"workout"}'],
  ['Add vacuuming the living room every Saturday', '{"intent":"create_chore","title":"Vacuum the living room","when":"Saturday","repeat":"every Saturday"}'],
  ['Journal: had a calm day, went for a long walk by the lake', '{"intent":"create_journal","text":"Had a calm day, went for a long walk by the lake","mood":"good"}'],
  ['What did I write about my sister last month?', '{"intent":"search_journal","query":"sister","when":"last month"}'],
  ['Move lunch with Sam to Friday at noon', '{"intent":"update_event","title":"Lunch with Sam","when":"Friday at noon"}'],
  ['How are you today?', '{"intent":"chat"}'],
];

export function routerMessages(userText: string): ChatMessage[] {
  const shots = EXAMPLES.flatMap(([u, a]): ChatMessage[] => [
    { role: 'user', content: u },
    { role: 'assistant', content: a },
  ]);
  return [{ role: 'system', content: ROUTER_SYSTEM }, ...shots, { role: 'user', content: userText.slice(0, 600) }];
}

export interface Source {
  label: string;
  text: string;
}

/** Answer only from the given entries/memories; say so when they don't contain the answer. */
export function groundedAnswerMessages(question: string, sources: readonly Source[], characterName: string): ChatMessage[] {
  const block = sources.map((s, i) => `[${i + 1}] (${s.label}) ${s.text.slice(0, 600)}`).join('\n');
  return [
    {
      role: 'system',
      content: `You are ${characterName}, a small friendly companion. Answer the user's question in 1–3 short sentences using ONLY the notes below, which are the user's own saved journal entries or memories. If the notes don't contain the answer, say you couldn't find it. Never add details that aren't in the notes. No markdown.\nNOTES:\n${block}`,
    },
    { role: 'user', content: question.slice(0, 400) },
  ];
}

export function summaryMessages(entries: readonly Source[], label: string): ChatMessage[] {
  const block = entries.map((s) => `- (${s.label}) ${s.text.slice(0, 400)}`).join('\n');
  return [
    {
      role: 'system',
      content: `Summarize the user's journal entries from ${label} in 2–4 kind, plain sentences: what happened and how they felt. Use only what the entries say. No advice, no markdown.\nENTRIES:\n${block}`,
    },
    { role: 'user', content: 'Please summarize these entries.' },
  ];
}
