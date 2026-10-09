import { create } from 'zustand';

import { respond, type AssistantReply, type ReplySource } from '../assistant/assistant';
import { resolveIntent } from '../assistant/resolve';
import { describeAction, executeAction, type ResultItem } from '../assistant/execute';
import { isWriteAction, type AssistantAction, type PendingAsk, type RawIntent } from '../assistant/schema';
import { deleteLocalFile } from '../media/files';
import type { MemoryDraft } from '../memory/types';
import { dayKey } from '../planner/dates';
import { grantXp } from '../progression/rewards';
import { emit } from '../services/bus';
import { feedback } from '../services/feedback';
import { useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import { usePlanner } from '../state/plannerStore';
import { buildContext } from './engine';
import type { ChatMessage, CompanionReply } from './types';

export interface ChatEntry extends ChatMessage {
  reply?: CompanionReply;
  proposalState?: 'pending' | 'saved' | 'dismissed';
  /** Where a character message came from (shown under the bubble). */
  source?: ReplySource;
  note?: string;
  items?: ResultItem[];
  /** A planner change waiting for the user's tap. */
  action?: { action: AssistantAction; state: 'pending' | 'done' | 'cancelled' | 'failed' };
  /** The model is still writing this message. */
  streaming?: boolean;
}

interface ChatSession {
  entries: ChatEntry[];
  busy: boolean;
  /** The question the assistant is waiting on, if any. */
  pending: PendingAsk | null;
}

/**
 * The current conversation. Lives in memory only: it survives closing the
 * panel but is never written to disk, and is gone when the app restarts.
 */
export const useChatSession = create<ChatSession>()(() => ({ entries: [], busy: false, pending: null }));

let counter = 0;
const newId = () => `c${Date.now().toString(36)}${counter++}`;

function append(entry: Omit<ChatEntry, 'id' | 'at'>): string {
  const id = newId();
  useChatSession.setState((s) => ({ entries: [...s.entries, { ...entry, id, at: Date.now() }].slice(-60) }));
  return id;
}

function patch(id: string, p: Partial<ChatEntry>): void {
  useChatSession.setState((s) => ({ entries: s.entries.map((e) => (e.id === id ? { ...e, ...p } : e)) }));
}

export async function sendChatMessage(raw: string): Promise<void> {
  const input = raw.trim();
  if (!input || useChatSession.getState().busy) return;
  const pending = useChatSession.getState().pending;
  useChatSession.setState({ busy: true, pending: null });
  append({ from: 'user', text: input });
  emit({ type: 'chatThinking' });

  const started = Date.now();
  let streamId: string | null = null;
  let lastPatch = 0;
  let reply: AssistantReply;
  try {
    reply = await respond(input, {
      now: Date.now(),
      data: () => usePlanner.getState(),
      memories: useMemories.getState().items,
      context: buildContext(),
      history: useChatSession.getState().entries.filter((e) => !e.streaming).slice(0, -1),
      pending,
      onPartial: (text) => {
        if (!text) return;
        if (!streamId) streamId = append({ from: 'character', text, source: 'ai', streaming: true });
        const now = Date.now();
        if (now - lastPatch > 80) {
          lastPatch = now;
          patch(streamId, { text });
        }
      },
    });
  } catch {
    reply = { text: 'Hmm, my thoughts got tangled. Try again?', source: 'scripted', expression: 'thinking' };
  }
  // A short beat so instant replies don't feel abrupt (the character "thinks"); not a fake AI delay.
  await new Promise((r) => setTimeout(r, Math.max(0, 350 - (Date.now() - started))));

  const entry: Omit<ChatEntry, 'id' | 'at'> = {
    from: 'character',
    text: reply.text,
    source: reply.source,
    streaming: false,
    ...(reply.note ? { note: reply.note } : {}),
    ...(reply.items ? { items: reply.items } : {}),
    ...(reply.proposal ? { action: { action: reply.proposal, state: 'pending' } } : {}),
    ...(reply.companion ? { reply: reply.companion, proposalState: reply.companion.proposal ? 'pending' : undefined } : {}),
  };
  if (streamId) patch(streamId, entry);
  else append(entry);
  useChatSession.setState({ busy: false, pending: reply.ask ?? null });
  emit({ type: 'chatReply', text: reply.text, expression: reply.expression, action: reply.companion?.action });
  feedback('tap');

  const game = useGame.getState();
  game.bumpStat('chats');
  game.nudgeMood(0.02, 0);
  game.nudgePersonality('curiosity', 0.002);
  grantXp('chat');
}

/**
 * The user's answer to a proposed planner change. The action runs only now;
 * the character confirms only if it was actually saved.
 */
export function resolveAction(entryId: string, accept: boolean): void {
  const entry = useChatSession.getState().entries.find((e) => e.id === entryId);
  if (!entry?.action || entry.action.state !== 'pending') return;
  if (!accept) {
    patch(entryId, { action: { ...entry.action, state: 'cancelled' } });
    const a = entry.action.action;
    if (a.type === 'createJournal') a.images?.forEach(deleteLocalFile);
    append({ from: 'character', text: 'Okay, I won’t change anything.', source: 'command' });
    emit({ type: 'chatReply', text: 'Okay!', expression: 'calm' });
    return;
  }
  const outcome = executeAction(entry.action.action, { data: () => usePlanner.getState(), memories: useMemories.getState().items, now: Date.now() });
  patch(entryId, { action: { ...entry.action, state: outcome.ok ? 'done' : 'failed' } });
  append({ from: 'character', text: outcome.text, source: 'command' });
  emit({ type: 'chatReply', text: outcome.text, expression: outcome.ok ? 'happy' : 'sad' });
  if (!outcome.ok) feedback('warn');
}

/**
 * Propose a planner change built from text the user already reviewed (e.g.
 * text read from a photo). It goes through the same validation and confirm
 * card as anything typed; nothing is saved until the user taps.
 */
export function proposeFromText(raw: RawIntent, sourceText: string, label: string, images: string[] = []): void {
  append({ from: 'user', text: label });
  const res = resolveIntent(raw, { now: Date.now(), data: usePlanner.getState(), sourceText });
  if (res.kind === 'action' && isWriteAction(res.action)) {
    const action = res.action.type === 'createJournal' && images.length > 0 ? { ...res.action, images } : res.action;
    if (action.type !== 'createJournal') images.forEach(deleteLocalFile);
    const card = describeAction(action, dayKey(Date.now()));
    append({ from: 'character', text: `${card.heading}? Tap to confirm.`, source: 'parser', action: { action, state: 'pending' } });
  } else {
    images.forEach(deleteLocalFile);
    if (res.kind === 'ask') {
      append({ from: 'character', text: res.question, source: 'parser' });
      useChatSession.setState({ pending: res.pending });
    } else {
      append({ from: 'character', text: res.kind === 'reject' ? res.message : 'I couldn’t turn that into anything. Try editing the text?', source: 'parser' });
    }
  }
  emit({ type: 'chatReply', text: 'Let’s see…', expression: 'curious' });
}

export function actionCard(action: AssistantAction) {
  return describeAction(action, dayKey(Date.now()));
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
  append({ from: 'character', text: answer, source: 'command' });
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
  useChatSession.setState({ entries: [], busy: false, pending: null });
}
