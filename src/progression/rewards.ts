import { FINDS } from '../content/finds';
import { emit } from '../services/bus';
import { feedback } from '../services/feedback';
import { useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import { useUi } from '../state/uiStore';
import { milestoneById, milestoneMemory } from './milestones';
import type { XpReason } from './progression';

/** Award friendship XP; level-ups are celebrated (slightly delayed so they don't cut off the current reaction). */
export function grantXp(reason: XpReason): void {
  const { leveledUpTo } = useGame.getState().awardXp(reason);
  if (leveledUpTo) {
    setTimeout(() => {
      emit({ type: 'levelUp', level: leveledUpTo });
      reachMilestone(`bond-${leveledUpTo}`);
    }, 900);
  }
}

/**
 * Record a milestone once. If the user allows it (Settings → "Record
 * milestones"), it's also saved as a memory they can see, edit or delete.
 */
export function reachMilestone(id: string): void {
  const def = milestoneById(id);
  if (!def) return;
  const game = useGame.getState();
  if (!game.reachMilestone(id)) return;
  if (game.settings.recordMilestones) useMemories.getState().add(milestoneMemory(def, game.character.name));
  useUi.getState().toast({ text: `Milestone · ${def.title}`, tone: 'reward' });
}

export function checkCollectionMilestones(): void {
  const { progress } = useGame.getState();
  if (progress.finds.length >= FINDS.length) reachMilestone('all-finds');
  if (progress.visitDays >= 7) reachMilestone('seven-days');
}

/** Spend stars on an item; returns false if it can't be afforded. */
export function buy(id: string, cost: number): boolean {
  const ok = useGame.getState().purchase(id, cost);
  if (ok) {
    feedback('unlock');
    emit({ type: 'unlocked' });
  } else {
    feedback('warn');
  }
  return ok;
}
