import { useReducedMotion } from 'react-native-reanimated';

import { useGame } from '../state/gameStore';

/** True when animations should be calmer: the user's in-app choice wins, else the OS setting. */
export function useReduceMotion(): boolean {
  const system = useReducedMotion();
  const pref = useGame((s) => s.settings.reduceMotion);
  return pref === 'on' || (pref === 'system' && system);
}
