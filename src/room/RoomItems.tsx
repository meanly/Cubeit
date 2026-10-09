import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import type { FindId } from '../content/finds';
import type { ItemId, SlotId } from '../content/items';
import { LcdArt } from '../lcd/LcdArt';
import type { RoomGeometry } from '../physics/geometry';
import { MESS_ORDER, type MessState, type TiltState } from '../physics/types';
import type { RoomConfig } from '../state/schema';
import { slotRect } from './items/placement';
import { drawItem, TICKING } from './items/pixelArt';

interface LayerProps {
  g: RoomGeometry;
  room: RoomConfig;
  slots: readonly SlotId[];
  hour: number;
  minute: number;
  finds: readonly FindId[];
  /** Per-slot "poke" counters; bumping one plays that item's wiggle. */
  pokes: Record<SlotId, SharedValue<number>>;
  reduceMotion: boolean;
  /** The phone's tilt: every item leans a little with it (`TiltState.lean`). */
  tilt: SharedValue<TiltState>;
  /** Shake mess: each item's knocked-about offset and twist. */
  mess: SharedValue<MessState>;
}

/** Renders the furniture in the given slots, in order (back to front). */
export const RoomItems = memo(function RoomItems({ g, room, slots, hour, minute, finds, pokes, reduceMotion, tilt, mess }: LayerProps) {
  return (
    <>
      {slots.map((slot) => {
        const item = room.items[slot];
        if (!item || slot === 'toy') return null;
        return (
          <ItemView
            key={slot}
            g={g}
            slot={slot}
            item={item}
            poke={pokes[slot]}
            lampOn={room.lampOn}
            hour={hour}
            minute={minute}
            finds={finds}
            animate={!reduceMotion}
            tilt={tilt}
            mess={mess}
          />
        );
      })}
    </>
  );
});

function useTick(ms: number | undefined, enabled: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!ms || !enabled) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms, enabled]);
  return tick;
}

function ItemView({
  g,
  slot,
  item,
  poke,
  lampOn,
  hour,
  minute,
  finds,
  animate,
  tilt,
  mess,
}: {
  g: RoomGeometry;
  slot: Exclude<SlotId, 'toy'>;
  item: ItemId;
  poke: SharedValue<number>;
  lampOn: boolean;
  hour: number;
  minute: number;
  finds: readonly FindId[];
  animate: boolean;
  tilt: SharedValue<TiltState>;
  mess: SharedValue<MessState>;
}) {
  const tick = useTick(TICKING[item], animate);
  const bitmap = useMemo(
    () => drawItem(slot, item, { lampOn, hour, minute, finds, tick }),
    [slot, item, lampOn, hour, minute, finds, tick],
  );
  const wiggle = useSharedValue(0);

  // A poke jiggles the item a dot left and right, LCD style.
  useAnimatedReaction(
    () => poke.value,
    (value, previous) => {
      if (previous === null || value === previous) return;
      wiggle.value = withSequence(
        withTiming(1, { duration: 70 }),
        withTiming(-1, { duration: 110 }),
        withTiming(1, { duration: 110 }),
        withTiming(0, { duration: 110 }),
      );
    },
  );
  const slotIndex = (MESS_ORDER as readonly string[]).indexOf(slot);
  const lean = LEAN[slot];
  // Wiggle when poked, knocked about by a shake, and lean a little with the tilt.
  const style = useAnimatedStyle(() => {
    const o = slotIndex * 6;
    const m = mess.value.v;
    const dx = slotIndex >= 0 ? m[o] : 0;
    const dy = slotIndex >= 0 ? m[o + 1] : 0;
    const twist = slotIndex >= 0 ? m[o + 2] : 0;
    return {
      transform: [
        { translateX: (Math.round(wiggle.value) + Math.round(dx)) * g.dot },
        { translateY: Math.round(dy) * g.dot },
        { rotate: `${tilt.value.lean * lean + twist}rad` },
      ],
    };
  });

  if (!bitmap) return null;
  const rect = slotRect(g, slot);
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.item, { left: rect.left, top: rect.top, transformOrigin: lean < 0 ? 'center top' : 'center bottom' }, style]}
    >
      <LcdArt bitmap={bitmap} dot={g.dot} />
    </Animated.View>
  );
}

/**
 * How far each slot leans with the tilt. Standing pieces rock on their base
 * toward the low side (+); hung ones swing from the top, their bottom toward it
 * (-); the string lights barely sway, and the rug lies flat.
 */
const LEAN: Record<Exclude<SlotId, 'toy'>, number> = {
  rest: 0.6,
  corner: 1,
  rug: 0,
  wallLeft: -1,
  wallRight: -1,
  ceiling: -0.25,
};

const styles = StyleSheet.create({ item: { position: 'absolute' } });
