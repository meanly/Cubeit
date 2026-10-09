import { bondLevel, idleUnlocked } from '../progression/progression';
import { moodLabel } from '../character/mood';
import { useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import { localModelEngine } from './llm/localModelEngine';
import { scriptedEngine } from './scripted/scriptedEngine';
import type { ConversationContext, ConversationEngine } from './types';

/**
 * Engines in order of preference. The first available one is used. An online
 * engine could be appended later — it must stay opt-in and off by default.
 */
const ENGINES: readonly ConversationEngine[] = [localModelEngine, scriptedEngine];

let resolved: ConversationEngine | null = null;

export async function getEngine(): Promise<ConversationEngine> {
  if (resolved) return resolved;
  for (const engine of ENGINES) {
    try {
      if ((await engine.status()).available) {
        resolved = engine;
        return engine;
      }
    } catch {
      // Try the next engine.
    }
  }
  resolved = scriptedEngine;
  return scriptedEngine;
}

export async function describeEngines() {
  return Promise.all(ENGINES.map(async (e) => ({ kind: e.kind, label: e.label, ...(await e.status()) })));
}

/** Snapshot of everything a reply may use. Memories are included only from the local store. */
export function buildContext(): ConversationContext {
  const game = useGame.getState();
  const level = bondLevel(game.progress.bondXp);
  return {
    characterName: game.character.name,
    personality: game.character.personality,
    mood: moodLabel(game.mood),
    energy: game.mood.energy,
    bondLevel: level,
    daysTogether: Math.floor((Date.now() - game.character.bornAt) / 86_400_000),
    hour: new Date().getHours(),
    activities: game.progress.activities,
    memories: useMemories.getState().items,
    unlockedDance: idleUnlocked('dance', level),
  };
}
