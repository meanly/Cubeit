import { celebrate, reactSurprise } from '../character/brain/behaviors';
import { LINES, pick } from '../character/lines';
import { getBrain } from '../character/useCharacterBrain';
import { grantXp, reachMilestone } from '../progression/rewards';
import { feedback } from '../services/feedback';
import type { GameId } from '../state/schema';
import { useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import type { GameResult } from './session';

/**
 * Record a finished game: stars, best score, friendship, milestones, a
 * "shared moment" memory for new records — and the character's reaction.
 */
export function finishGame(game: GameId, score: number, outcome: 'great' | 'good' | 'meh', outOf?: number): GameResult {
  const store = useGame.getState();
  const { newBest, previousBest, starsEarned } = store.recordGame(game, score);
  store.nudgePersonality('playfulness', 0.005);
  store.nudgeMood(outcome === 'meh' ? 0.01 : 0.05, -0.05);
  grantXp('game');
  reachMilestone('first-game');
  if (game === 'starCatch' && score >= 20) reachMilestone('starcatch-20');
  if (game === 'starCatch' && score >= 40) reachMilestone('starcatch-40');
  if (game === 'peekaboo' && outOf && score === outOf) reachMilestone('peekaboo-perfect');
  const name = store.character.name;
  store.logActivity('game', game === 'starCatch' ? `played Star Catch with you (${score} stars)` : `played Peekaboo with you`);
  if (newBest && previousBest > 0 && store.settings.recordMilestones) {
    useMemories.getState().add({
      type: 'experience',
      content: game === 'starCatch' ? `You and ${name} set a new Star Catch record: ${score}!` : `You and ${name} set a new Peekaboo record: ${score}!`,
      tags: ['game', 'record'],
      importance: 1,
      related: { kind: 'game', id: game },
      source: 'app',
    });
  }

  feedback(outcome === 'meh' ? 'aww' : 'success');
  const brain = getBrain();
  if (outcome === 'great') brain?.interrupt(celebrate(pick(LINES.gameGreat)));
  else if (outcome === 'good') brain?.interrupt(reactSurprise(LINES.gameGood, 'happy'));
  else brain?.interrupt(reactSurprise(LINES.gameMeh, 'sad'));

  return { score, best: Math.max(previousBest, score), newBest: newBest && score > 0, starsEarned, outOf };
}
