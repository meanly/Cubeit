import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { characterRect, depthScale, unprojectFloor, WORLD } from '../physics/geometry';
import type { World } from '../physics/World';

export interface RoomGestureHandlers {
  onTap(x: number, y: number): void;
  onPet(): void;
  onHeld(held: boolean): void;
}

function clamp(v: number, lo: number, hi: number) {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

/**
 * All touch input for the room, resolved on the UI thread:
 * - drag starting on the character picks it up (release to drop / toss)
 * - long-press on the character pets it
 * - tap anywhere is forwarded to JS for hit-testing (character, ball, furniture, floor)
 * - in steering mode (Star Catch) dragging anywhere guides the character
 */
export function useRoomGesture(world: World, handlers: RoomGestureHandlers, steering: boolean) {
  const { body, geo, mode } = world;
  const dragging = useSharedValue(0);
  const steer = useSharedValue(0);

  return useMemo(() => {
    const hitCharacter = (x: number, y: number) => {
      'worklet';
      const b = body.value;
      const r = characterRect(geo.value, b.x, b.z, b.y);
      const pad = 14;
      return x >= r.left - pad && x <= r.left + r.width + pad && y >= r.top - pad && y <= r.bottom + pad;
    };

    const setSteerTarget = (x: number, y: number) => {
      'worklet';
      const p = unprojectFloor(geo.value, x, y);
      body.modify((b) => {
        'worklet';
        b.tx = clamp(p.x, WORLD.xMin, WORLD.xMax);
        b.tz = clamp(p.z, WORLD.zMin, WORLD.zMax);
        b.hasTarget = 1;
        b.chase = 0;
        return b;
      });
    };

    const pan = Gesture.Pan()
      .minDistance(steering ? 0 : 8)
      .onBegin((e) => {
        'worklet';
        if (mode.value === 0 && hitCharacter(e.x, e.y)) dragging.value = 1;
        else if (mode.value === 1) {
          steer.value = 1;
          setSteerTarget(e.x, e.y);
        }
      })
      .onStart((e) => {
        'worklet';
        if (dragging.value !== 1) return;
        const b0 = body.value;
        const r = characterRect(geo.value, b0.x, b0.z, b0.y);
        body.modify((b) => {
          'worklet';
          b.held = 1;
          b.anchored = 0;
          b.hasTarget = 0;
          b.chase = 0;
          b.heldSX = e.x;
          b.heldSY = e.y;
          b.grabOffsetY = r.bottom - e.y;
          b.zMax = WORLD.zMax;
          return b;
        });
        scheduleOnRN(handlers.onHeld, true);
      })
      .onUpdate((e) => {
        'worklet';
        if (dragging.value === 1) {
          body.modify((b) => {
            'worklet';
            b.heldSX = e.x;
            b.heldSY = e.y;
            return b;
          });
        } else if (steer.value === 1) {
          setSteerTarget(e.x, e.y);
        }
      })
      .onFinalize((e) => {
        'worklet';
        if (dragging.value === 1 && body.value.held === 1) {
          const g = geo.value;
          const px = g.unit * depthScale(g, body.value.z);
          body.modify((b) => {
            'worklet';
            b.held = 0;
            b.vx = clamp(e.velocityX / px, -2.2, 2.2);
            b.vy = clamp(-e.velocityY / px, -1, 2.6);
            if (b.y < 0.001 && b.vy > 0) b.y = 0.001;
            return b;
          });
          scheduleOnRN(handlers.onHeld, false);
        }
        dragging.value = 0;
        steer.value = 0;
      });

    const longPress = Gesture.LongPress()
      .minDuration(450)
      .onStart((e) => {
        'worklet';
        if (mode.value === 0 && hitCharacter(e.x, e.y)) scheduleOnRN(handlers.onPet);
      });

    const tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd((e, success) => {
        'worklet';
        if (success) scheduleOnRN(handlers.onTap, e.x, e.y);
      });

    return Gesture.Race(pan, longPress, tap);
    // handlers are stable refs supplied by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steering]);
}
