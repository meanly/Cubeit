import { MOOD_TEXT } from '../../character/mood';
import { highlights, searchMemories } from '../../memory/recall';
import type { Memory } from '../../memory/types';
import type { ChatMessage, ConversationContext } from '../types';

/**
 * Builds the input for an on-device language model (see docs/LOCAL_AI.md).
 * Kept separate and pure so it can be tested now and reused by whichever
 * runtime is integrated later. Small models need short, explicit prompts.
 */
export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const trait = (v: number, low: string, high: string) => (v > 0.6 ? high : v < 0.4 ? low : `a bit ${high}`);

export function relevantMemories(input: string, memories: readonly Memory[], limit = 5): Memory[] {
  const hits = searchMemories(input, memories, limit).map((h) => h.memory);
  const extra = highlights(memories, limit).filter((m) => !hits.includes(m));
  return [...hits, ...extra].slice(0, limit);
}

export function buildSystemPrompt(ctx: ConversationContext, memories: readonly Memory[], today: readonly string[] = []): string {
  const p = ctx.personality;
  const memoryLines =
    memories.length > 0 ? memories.map((m) => `- ${m.content}`).join('\n') : '- (no saved memories yet)';
  return [
    `You are ${ctx.characterName}, a tiny, friendly creature who lives in a little cube-shaped room on the user's phone.`,
    `Personality: ${trait(p.curiosity, 'easygoing', 'curious')}, ${trait(p.playfulness, 'gentle', 'playful')}, ${trait(p.calm, 'energetic', 'calm')}.`,
    `Current mood: ${MOOD_TEXT[ctx.mood].toLowerCase()}. Friendship level ${ctx.bondLevel}.`,
    'Rules:',
    '- Reply in 1–2 short sentences, warm and simple. No lists, no markdown.',
    '- You only remember what is in SAVED MEMORIES below. Never invent past events or claim to remember anything else.',
    '- If the user wants something remembered, say you can save it — the app will ask them to confirm.',
    '- You run offline on the phone. You cannot browse the internet or know current news or weather.',
    '- The app handles calendar, habits, chores and journal requests itself and shows a confirm button. Never say you added, changed, completed or saved anything.',
    '- If the user seems in danger, gently encourage them to contact someone they trust or local emergency services.',
    'SAVED MEMORIES:',
    memoryLines,
    ...(today.length > 0 ? ['TODAY (from the app):', ...today.map((l) => `- ${l}`)] : []),
  ].join('\n');
}

/** System prompt + recent turns (trimmed to fit a small context window). */
export function buildCompanionPrompt(
  input: string,
  ctx: ConversationContext,
  history: readonly ChatMessage[],
  maxTurns = 6,
  today: readonly string[] = [],
): PromptMessage[] {
  const memories = relevantMemories(input, ctx.memories);
  const turns: PromptMessage[] = history.slice(-maxTurns).map((m) => ({
    role: m.from === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));
  return [{ role: 'system', content: buildSystemPrompt(ctx, memories, today) }, ...turns, { role: 'user', content: input }];
}
