import { modelUsable, useModel } from '../ai/modelStore';
import { groundedAnswerMessages, routerMessages } from '../ai/prompts';
import { complete } from '../ai/runtime';
import { cleanModelText, expressionFor, localModelEngine } from '../conversation/llm/localModelEngine';
import { scriptedReply } from '../conversation/scripted/scriptedEngine';
import type { ChatMessage, CompanionReply, ConversationContext, ExpressionHint } from '../conversation/types';
import type { Memory } from '../memory/types';
import { dayKey, formatTime } from '../planner/dates';
import { habitStats } from '../planner/habits';
import { eventsOn } from '../planner/ops';
import { choreStatus } from '../planner/recurrence';
import type { PlannerData } from '../planner/types';
import { describeAction, executeAction, type ResultItem } from './execute';
import { parseIntent } from './intentParser';
import { answerPending, resolveIntent } from './resolve';
import { isWriteAction, parseModelOutput, ROUTER_JSON_SCHEMA, type AssistantAction, type PendingAsk, type Resolution } from './schema';

/**
 * Where a reply came from — always shown in the chat so nobody mistakes the
 * built-in parser or scripted lines for the language model.
 */
export type ReplySource = 'ai' | 'parser' | 'scripted' | 'command';

export interface AssistantReply {
  text: string;
  source: ReplySource;
  expression: ExpressionHint;
  /** A change waiting for the user's tap. Never executed before that. */
  proposal?: AssistantAction;
  /** Read-only results to list under the reply. */
  items?: ResultItem[];
  /** The assistant asked a question and waits for this slot. */
  ask?: PendingAsk;
  /** Scripted extras (memory proposals, tricks, panel suggestions). */
  companion?: CompanionReply;
  /** Shown small under the reply, e.g. when the model failed and a fallback answered. */
  note?: string;
}

export interface AssistantDeps {
  now: number;
  data: () => PlannerData;
  memories: readonly Memory[];
  context: ConversationContext;
  history: readonly ChatMessage[];
  pending: PendingAsk | null;
  onPartial?: (text: string) => void;
}

const CRISIS = /\b(kill myself|suicid\w*|end my life|self ?harm|hurt myself|want to die|don'?t want to (?:live|be here))\b/i;
const CANCEL = /^(never ?mind|cancel|stop|forget it|no thanks|nope|skip)\b/i;

/** A few facts about today for the chat model, straight from the planner (never invented). */
export function todayFacts(data: PlannerData, now: number): string[] {
  const today = dayKey(now);
  const events = eventsOn(data.events, today);
  const habits = data.habits.filter((h) => !h.archived);
  const due = data.chores.filter((c) => ['today', 'overdue'].includes(choreStatus(c, today)));
  const lines: string[] = [];
  lines.push(
    events.length === 0
      ? 'No calendar events today.'
      : `Events today: ${events.map((e) => `${e.title}${e.allDay ? '' : ` at ${formatTime(e.start!)}`}`).join('; ')}.`,
  );
  if (habits.length > 0) {
    const done = habits.filter((h) => habitStats(h, data.habitLogs, today).doneToday).length;
    lines.push(`Habits done today: ${done} of ${habits.length}.`);
  }
  if (due.length > 0) lines.push(`Chores due: ${due.map((c) => c.title).join('; ')}.`);
  return lines;
}

function fromResolution(res: Resolution, source: ReplySource, deps: AssistantDeps): AssistantReply | null {
  const today = dayKey(deps.now);
  switch (res.kind) {
    case 'chat':
      return null;
    case 'ask':
      return { text: res.question, source, expression: 'curious', ask: res.pending };
    case 'reject':
      return { text: res.message, source, expression: 'thinking' };
    case 'action': {
      if (isWriteAction(res.action)) {
        const d = describeAction(res.action, today);
        return { text: `${d.heading}? Tap to confirm.`, source, expression: 'curious', proposal: res.action };
      }
      const outcome = executeAction(res.action, { data: deps.data, memories: deps.memories, now: deps.now });
      return {
        text: outcome.text,
        source,
        expression: outcome.ok ? 'happy' : 'thinking',
        ...(outcome.ok && outcome.items ? { items: outcome.items } : {}),
      };
    }
  }
}

async function groundedAnswer(question: string, reply: AssistantReply, deps: AssistantDeps): Promise<AssistantReply> {
  // Only for journal searches with hits: the model rephrases what the entries say, citing nothing else.
  if (!reply.items || reply.items.length === 0) return reply;
  try {
    const sources = reply.items.map((i) => ({ label: i.title, text: i.detail ?? '' }));
    const result = await complete(groundedAnswerMessages(question, sources, deps.context.characterName), { maxTokens: 160, temperature: 0.3 });
    const text = cleanModelText(result.text);
    if (!text) return reply;
    return { ...reply, text, source: 'ai', expression: expressionFor(text), note: 'Based only on the entries listed below.' };
  } catch {
    return reply;
  }
}

/**
 * Handle one user message. Order:
 * 1. safety lines, 2. answers to a follow-up question, 3. built-in commands
 * (remember…, tricks), 4. the on-device model (structured routing, then chat),
 * 5. the built-in parser and scripted replies when the model isn't installed
 * or its output can't be validated.
 */
export async function respond(input: string, deps: AssistantDeps): Promise<AssistantReply> {
  const text = input.trim();
  const resolveCtx = { now: deps.now, data: deps.data(), sourceText: text };

  if (CRISIS.test(text)) {
    const r = scriptedReply(text, deps.context);
    return { text: r.text, source: 'scripted', expression: r.expression, companion: r };
  }

  if (deps.pending) {
    if (CANCEL.test(text)) return { text: 'Okay, never mind.', source: 'command', expression: 'calm' };
    const res = answerPending(deps.pending, text, { now: deps.now, data: deps.data() });
    const reply = fromResolution(res, 'parser', deps);
    if (reply) return reply;
  }

  const scripted = scriptedReply(text, deps.context);
  if (scripted.proposal || scripted.action) {
    return { text: scripted.text, source: 'command', expression: scripted.expression, companion: scripted };
  }

  const aiOn = modelUsable(useModel.getState().status);
  if (aiOn) {
    let note: string | undefined;
    try {
      const routed = await complete(routerMessages(text), { maxTokens: 160, temperature: 0.1, jsonSchema: ROUTER_JSON_SCHEMA });
      const raw = parseModelOutput(routed.text);
      if (raw && raw.intent !== 'chat') {
        const reply = fromResolution(resolveIntent(raw, resolveCtx), 'ai', deps);
        if (reply) return raw.intent === 'search_journal' ? groundedAnswer(text, reply, deps) : reply;
      } else if (!raw) {
        // The model's output didn't validate: try the built-in parser before chatting.
        const parsed = parseIntent(text, resolveCtx.data, deps.now);
        if (parsed) {
          const reply = fromResolution(resolveIntent(parsed, resolveCtx), 'parser', deps);
          if (reply) return { ...reply, note: 'The AI’s answer couldn’t be checked, so the built-in parser handled this.' };
        }
      }
      const chat = await localModelEngine.reply(text, deps.context, deps.history, { onPartial: deps.onPartial, today: todayFacts(resolveCtx.data, deps.now) });
      return { text: chat.text, source: 'ai', expression: chat.expression };
    } catch (error) {
      note = `On-device AI error: ${error instanceof Error ? error.message : 'unknown'}. Answered with built-in replies.`;
    }
    const parsed = parseIntent(text, resolveCtx.data, deps.now);
    const reply = parsed ? fromResolution(resolveIntent(parsed, resolveCtx), 'parser', deps) : null;
    if (reply) return { ...reply, note };
    return { text: scripted.text, source: 'scripted', expression: scripted.expression, companion: scripted, note };
  }

  const parsed = parseIntent(text, resolveCtx.data, deps.now);
  if (parsed) {
    const reply = fromResolution(resolveIntent(parsed, resolveCtx), 'parser', deps);
    if (reply) return reply;
  }
  return { text: scripted.text, source: 'scripted', expression: scripted.expression, companion: scripted };
}
