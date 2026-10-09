import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { playSound, type SoundId } from '../audio/sounds';
import { useGame } from '../state/gameStore';

type Haptic = 'light' | 'medium' | 'soft' | 'selection' | 'success' | 'warning';

const KINDS = {
  tap: { sound: 'pop', haptic: 'light' },
  select: { sound: 'tick', haptic: 'selection' },
  bump: { sound: 'bump', haptic: 'soft' },
  land: { sound: 'boing', haptic: 'soft' },
  hop: { sound: 'boing' },
  giggle: { sound: 'giggle', haptic: 'light' },
  pet: { sound: 'giggle', haptic: 'soft' },
  catch: { sound: 'chime', haptic: 'light' },
  gold: { sound: 'gold', haptic: 'medium' },
  success: { sound: 'success', haptic: 'success' },
  aww: { sound: 'aww' },
  whoosh: { sound: 'whoosh' },
  unlock: { sound: 'unlock', haptic: 'success' },
  warn: { haptic: 'warning' },
} as const satisfies Record<string, { sound?: SoundId; haptic?: Haptic }>;

export type FeedbackKind = keyof typeof KINDS;

function haptic(kind: Haptic) {
  if (Platform.OS === 'web') return;
  const run = () => {
    switch (kind) {
      case 'light':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      case 'medium':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      case 'soft':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      case 'selection':
        return Haptics.selectionAsync();
      case 'success':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      case 'warning':
        return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  };
  run()?.catch(() => {});
}

/** Sound + haptic cue, each respecting the user's settings. */
export function feedback(kind: FeedbackKind): void {
  const { soundEnabled, hapticsEnabled } = useGame.getState().settings;
  const spec: { sound?: SoundId; haptic?: Haptic } = KINDS[kind];
  if (soundEnabled && spec.sound) playSound(spec.sound);
  if (hapticsEnabled && spec.haptic) haptic(spec.haptic);
}
