import { useEffect } from 'react';
import { AppState } from 'react-native';

import { greetingFor } from '../character/lines';
import { findById } from '../content/finds';
import { rememberedUserName } from '../memory/recall';
import { emit } from '../services/bus';
import { useGame } from '../state/gameStore';
import { useMemories } from '../state/memoryStore';
import { useUi } from '../state/uiStore';
import { checkCollectionMilestones, grantXp, reachMilestone } from './rewards';

const WELCOME_BACK_MS = 2 * 60 * 60 * 1000;

/**
 * Gentle daily rhythm: a greeting and a small discovery on each new day, a
 * "welcome back" after a long break. Nothing is lost by skipping days.
 */
export function useDailyLife(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      const game = useGame.getState();
      const now = Date.now();
      const away = now - game.progress.lastSeenAt;
      const check = game.registerVisit(now);
      const name = rememberedUserName(useMemories.getState().items);
      game.touchLastSeen(now);

      if (!check.isNewDay) {
        if (away > WELCOME_BACK_MS) setTimeout(() => emit({ type: 'greet', text: name ? `Welcome back, ${name}!` : 'Welcome back!' }), 900);
        return;
      }

      if (check.daysAway === null) reachMilestone('first-wake');
      grantXp('daily');
      const hour = new Date(now).getHours();
      setTimeout(() => emit({ type: 'greet', text: greetingFor(hour, name, check.daysAway) }), 1200);

      const gift = check.gift;
      if (gift?.kind === 'find') {
        const def = findById(gift.id);
        game.addFind(gift.id);
        if (def) {
          game.logActivity('find', `found a ${def.name.toLowerCase()}`);
          setTimeout(() => useUi.getState().toast({ text: `${game.character.name} found a ${def.name.toLowerCase()}!`, tone: 'reward' }), 2600);
        }
      } else if (gift?.kind === 'stars') {
        game.addStars(gift.amount);
        setTimeout(() => useUi.getState().toast({ text: `A little gift: ${gift.amount} stars`, tone: 'reward' }), 2600);
      }
      checkCollectionMilestones();
    };
    run();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') run();
    });
    return () => sub.remove();
  }, [enabled]);
}
