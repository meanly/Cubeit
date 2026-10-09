import { useEffect, useMemo } from 'react';

import { getBrain } from '../character/useCharacterBrain';
import { makeGeometry } from '../physics/geometry';
import { useWorld } from '../physics/World';
import { emit } from '../services/bus';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { Peekaboo } from './Peekaboo';
import { useGameSession } from './session';
import { StarCatch } from './StarCatch';

/**
 * In-room part of the active game. Sets the game up when it starts and puts
 * the room back (ball, touch mode, normal life) when it ends or is quit —
 * a game never leaves the character stuck.
 */
export function GameHost({ roomWidth, roomHeight }: { roomWidth: number; roomHeight: number }) {
  const game = useUi((s) => s.activeGame);
  const world = useWorld();
  const g = useMemo(() => makeGeometry(roomWidth, roomHeight), [roomWidth, roomHeight]);

  // The session is reset in startGame() before this mounts: child effects run
  // before parent effects, so resetting here would wipe the scene's actions.
  useEffect(() => {
    if (!game) return;
    world.commands.setBallPresent(false);
    world.commands.unanchor();
    getBrain()?.setState('idle');
    emit({ type: 'gameStarted', game });
    return () => {
      const { phase } = useGameSession.getState();
      useGameSession.getState().reset(null);
      world.mode.set(0);
      world.commands.freeze(false);
      world.commands.setBallPresent(useGame.getState().room.items.toy === 'ball');
      if (phase !== 'results') emit({ type: 'gameEnded', game, outcome: 'meh', quit: true });
    };
  }, [game, world]);

  if (game === 'starCatch') return <StarCatch g={g} />;
  if (game === 'peekaboo') return <Peekaboo g={g} />;
  return null;
}
