import { create } from 'zustand';

import type { GameId } from '../state/schema';
import { useUi } from '../state/uiStore';

export type GamePhase = 'intro' | 'playing' | 'paused' | 'results';

export interface GameResult {
  score: number;
  best: number;
  newBest: boolean;
  starsEarned: number;
  outOf?: number;
}

export interface GameActions {
  start(): void;
  pause(): void;
  resume(): void;
}

interface GameSession {
  game: GameId | null;
  phase: GamePhase;
  score: number;
  /** Seconds left (Star Catch) or null. */
  timeLeft: number | null;
  /** "Round 2 of 3" (Peekaboo) or null. */
  round: string | null;
  /** Short line shown over the room during play. */
  message: string | null;
  result: GameResult | null;
  actions: GameActions | null;
  /** Lets a game take over room taps (Peekaboo boxes). Return true when handled. */
  tapHandler: ((x: number, y: number) => boolean) | null;
  patch(p: Partial<Omit<GameSession, 'patch' | 'reset'>>): void;
  reset(game: GameId | null): void;
}

export const useGameSession = create<GameSession>()((set) => ({
  game: null,
  phase: 'intro',
  score: 0,
  timeLeft: null,
  round: null,
  message: null,
  result: null,
  actions: null,
  tapHandler: null,
  patch: (p) => set(p),
  reset: (game) =>
    set({ game, phase: 'intro', score: 0, timeLeft: null, round: null, message: null, result: null, actions: null, tapHandler: null }),
}));

/** Start a game: fresh session first, then show it in the room. */
export function startGame(game: GameId): void {
  useGameSession.getState().reset(game);
  const ui = useUi.getState();
  ui.closePanel();
  ui.setActiveGame(game);
}
