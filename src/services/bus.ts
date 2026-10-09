import type { ItemId, SlotId } from '../content/items';
import type { CharacterAction, ExpressionHint } from '../conversation/types';
import type { GameId } from '../state/schema';

/**
 * App-wide events the character reacts to. Panels, games and the room emit
 * these; the behavior brain listens. Keeps UI code from reaching into the brain.
 */
export type WorldEvent =
  | { type: 'levelUp'; level: number }
  | { type: 'chatTyping' }
  | { type: 'chatThinking' }
  | { type: 'chatReply'; text: string; expression: ExpressionHint; action?: CharacterAction }
  | { type: 'chatClosed' }
  | { type: 'characterTapped' }
  | { type: 'characterPetted' }
  | { type: 'characterHeld'; held: boolean }
  | { type: 'itemTapped'; slot: SlotId; item: ItemId }
  | { type: 'floorTapped'; x: number; z: number }
  | { type: 'ballTapped' }
  | { type: 'greet'; text: string }
  | { type: 'gameStarted'; game: GameId }
  | { type: 'gameEnded'; game: GameId; outcome: 'great' | 'good' | 'meh'; quit: boolean }
  | { type: 'unlocked' }
  | { type: 'customizeApplied' };

type Listener = (event: WorldEvent) => void;
const listeners = new Set<Listener>();

export function emit(event: WorldEvent): void {
  listeners.forEach((l) => {
    try {
      l(event);
    } catch (error) {
      console.warn('[cubeit] event listener failed', error);
    }
  });
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
