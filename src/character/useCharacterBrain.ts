import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { WORLD } from '../physics/geometry';
import { useWorld } from '../physics/World';
import { subscribe } from '../services/bus';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { Brain, type BrainMode } from './brain/Brain';

let current: Brain | null = null;
/** The running brain, for code that needs to talk to it outside React (e.g. games). */
export const getBrain = (): Brain | null => current;

function modeFromUi(): BrainMode {
  const ui = useUi.getState();
  if (ui.activeGame) return 'game';
  if (ui.visitor) return 'visit';
  if (ui.panel === 'talk') return 'talk';
  return 'free';
}

/**
 * Creates the character's brain and wires it to physics events, app events,
 * panels and the app lifecycle. Also keeps mood drifting naturally and
 * remembers where the character was standing.
 */
export function useCharacterBrain(): void {
  const world = useWorld();
  const brainRef = useRef<Brain | null>(null);

  useEffect(() => {
    const brain = new Brain({
      world,
      rng: Math.random,
      now: () => Date.now(),
      hour: () => new Date().getHours(),
      reduceMotion: () => world.params.value.reduceMotion === 1,
    });
    brainRef.current = brain;
    current = brain;
    brain.mode = modeFromUi();
    brain.start();

    const offPhysics = world.onPhysics((code, a, b) => brain.onPhysics(code, a, b));
    const offBus = subscribe((event) => brain.onEvent(event));
    const offUi = useUi.subscribe(() => brain.setMode(modeFromUi()));

    const savePosition = () => {
      const body = world.body.value;
      const last = useGame.getState().character.lastPosition;
      const z = Math.min(body.z, WORLD.zMax);
      if (Math.abs(last.x - body.x) > 0.02 || Math.abs(last.z - z) > 0.02) useGame.getState().setLastPosition(body.x, z);
    };
    const positionTimer = setInterval(savePosition, 8000);
    const moodTimer = setInterval(() => useGame.getState().settleMood(), 60_000);

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        useGame.getState().settleMood();
        brain.start();
      } else {
        savePosition();
        useGame.getState().touchLastSeen();
        brain.stop();
      }
    });

    return () => {
      offPhysics();
      offBus();
      offUi();
      appSub.remove();
      clearInterval(positionTimer);
      clearInterval(moodTimer);
      brain.stop();
      if (current === brain) current = null;
    };
  }, [world]);
}
