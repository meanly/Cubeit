import type { MoodLabel } from '../character/mood';
import type { Memory, MemoryDraft } from '../memory/types';
import type { ActivityEntry, Personality } from '../state/schema';

/** How the character should look while saying a reply. */
export type ExpressionHint =
  | 'happy'
  | 'excited'
  | 'love'
  | 'thinking'
  | 'sad'
  | 'surprised'
  | 'curious'
  | 'sleepy'
  | 'calm'
  | 'celebrating';

/** Something the character physically does in the room as part of a reply. */
export type CharacterAction = 'dance' | 'jump' | 'sleep' | 'wake' | 'twirl' | 'wave' | 'comeHere' | 'playBall';

export interface ChatMessage {
  id: string;
  from: 'user' | 'character';
  text: string;
  at: number;
}

export interface ConversationContext {
  characterName: string;
  personality: Personality;
  mood: MoodLabel;
  energy: number;
  bondLevel: number;
  daysTogether: number;
  hour: number;
  /** Real, logged in-app events — never invented. */
  activities: readonly ActivityEntry[];
  memories: readonly Memory[];
  unlockedDance: boolean;
}

export interface MemoryProposal {
  draft: MemoryDraft;
  /** Reasons the content may be sensitive; shown before saving. */
  sensitiveReasons: string[];
}

export interface CompanionReply {
  text: string;
  expression: ExpressionHint;
  action?: CharacterAction;
  /** Suggest saving a memory. Never saved without the user tapping "Save". */
  proposal?: MemoryProposal;
  /** Suggest opening a panel (rendered as a button in the chat). */
  suggestion?: { label: string; panel: 'play' | 'memories' };
  /** False when the engine didn't understand — used for honest fallbacks. */
  understood: boolean;
  usedMemoryIds?: string[];
}

export type EngineKind = 'scripted' | 'local-model' | 'online';

export interface EngineStatus {
  available: boolean;
  /** Human-readable explanation shown in Settings. */
  detail: string;
}

/**
 * Any conversation backend: the scripted fallback today, an on-device model
 * later (see docs/LOCAL_AI.md), or an optional online model that is off by
 * default. The UI only talks to this interface.
 */
export interface ConversationEngine {
  readonly kind: EngineKind;
  readonly label: string;
  status(): Promise<EngineStatus>;
  reply(input: string, context: ConversationContext, history: readonly ChatMessage[]): Promise<CompanionReply>;
}
