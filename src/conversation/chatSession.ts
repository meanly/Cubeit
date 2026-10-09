import { create } from 'zustand';

import type { MemoryDraft } from '../memory/types';
import { grantXp } from '../progression/rewards';
import { emit } from '../services/bus';
import { feedback } from '../services/feedback';
import { useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import { buildContext, getEngine } from './engine';
import type { ChatMessage, CompanionReply } from './types';

export interface ChatEntry extends ChatMessage {
  reply?: CompanionReply;
  proposalState?: 'pending' | 'saved' | 'dismissed';
}

interface ChatSession {
  entries: ChatEntry[];
  busy: boolean;
}

/**
 * The current conversation. Lives in memory only: it survives closing the
 * panel but is never written to disk, and is gone when the app restarts.
 */
export const useChatSession = create<ChatSession>()(() => ({ entries: [], busy: false }));

let counter = 0;
const newId = () => `c${Date.now().toString(36)}${counter++}`;

function append(entry: Omit<ChatEntry, 'id' | 'at'>): void {
  useChatSession.setState((s) => ({ entries: [...s.entries, { ...entry, id: newId(), at: Date.now() }].slice(-60) }));
}

export async function sendChatMessage(raw: string): Promise<void> {
  const input = raw.trim();
  if (!input || useChatSession.getState().busy) return;
  useChatSession.setState({ busy: true });
  append({ from: 'user', text: input });
  emit({ type: 'chatThinking' });

  const started = Date.now();
  let reply: CompanionReply;
  try {
    const engine = await getEngine();
    reply = await engine.reply(input, buildContext(), useChatSession.getState().entries);
  } catch {
    reply = { text: 'Hmm, my thoughts got tangled. Try again?', expression: 'thinking', understood: false };
  }
  // A short beat so replies don't feel instantaneous (the character "thinks"); not a fake AI delay.
  await new Promise((r) => setTimeout(r, Math.max(0, 450 - (Date.now() - started))));

  append({ from: 'character', text: reply.text, reply, proposalState: reply.proposal ? 'pending' : undefined });
  useChatSession.setState({ busy: false });
  emit({ type: 'chatReply', text: reply.text, expression: reply.expression, action: reply.action });
  feedback('tap');

  const game = useGame.getState();
  game.bumpStat('chats');
  game.nudgeMood(0.02, 0);
  game.nudgePersonality('curiosity', 0.002);
  grantXp('chat');
}

/** The user's answer to "save this as a memory?" — nothing is stored without it. */
export function resolveProposal(entryId: string, save: boolean): void {
  const entry = useChatSession.getState().entries.find((e) => e.id === entryId);
  const draft = entry?.reply?.proposal?.draft;
  if (!draft || entry.proposalState !== 'pending') return;
  if (save) saveDraft(draft);
  useChatSession.setState((s) => ({
    entries: s.entries.map((e) => (e.id === entryId ? { ...e, proposalState: save ? 'saved' : 'dismissed' } : e)),
  }));
  const answer = save ? 'Got it! I’ll remember that.' : 'Okay, I won’t keep it.';
  append({ from: 'character', text: answer });
  emit({ type: 'chatReply', text: answer, expression: save ? 'love' : 'calm' });
}

/** Structured keys (like your name) replace the old value instead of duplicating it. */
function saveDraft(draft: MemoryDraft): void {
  const store = useMemories.getState();
  const existing = draft.key ? store.items.find((m) => m.key === draft.key) : undefined;
  if (existing) store.update(existing.id, { content: draft.content, value: draft.value });
  else store.add(draft);
  grantXp('memory');
  feedback('unlock');
}

export function clearChat(): void {
  useChatSession.setState({ entries: [], busy: false });
}
