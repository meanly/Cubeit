import { useMemo } from 'react';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import { WORLD } from './geometry';
import { stepBody } from './simulation';
import { initialBody, initialTilt, type BodyState, type PhysicsParams } from './types';
import { useWorld } from './World';

const STILL_PARAMS: PhysicsParams = {
  tiltEnabled: 0,
  sensitivity: 1,
  calValid: 0,
  calX: 0,
  calY: 0,
  calZ: 0,
  reduceMotion: 0,
  speedBoost: 1,
};

/**
 * A second, scripted body (e.g. a visiting character) that walks and hops
 * with the same physics as the main character but ignores tilt and touch.
 * Its frame loop only exists while the owning component is mounted.
 */
export function useVirtualBody(x: number, z: number) {
  const { geo, clock } = useWorld();
  const body = useSharedValue<BodyState>(initialBody(x, z));
  const tilt = useSharedValue(initialTilt());

  useFrameCallback((info) => {
    'worklet';
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const events: number[] = [];
    const t = tilt.value;
    const g = geo.value;
    const now = clock.value;
    body.modify((b) => {
      'worklet';
      stepBody(b, t, STILL_PARAMS, g, dt, now, events);
      return b;
    });
  }, true);

  const commands = useMemo(
    () => ({
      walkTo(tx: number, tz: number, speed = 0.3) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.tx = Math.min(WORLD.xMax, Math.max(WORLD.xMin, tx));
            b.tz = Math.min(WORLD.zMax, Math.max(WORLD.zMin, tz));
            b.walkSpeed = speed;
            b.hasTarget = 1;
            return b;
          });
        });
      },
      hop(vy = 1.4) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            if (b.y < 0.02) {
              b.vy = vy;
              b.y = 0.001;
              b.squashV -= 2.5;
            }
            return b;
          });
        });
      },
    }),
    [body],
  );

  return { body, ...commands };
}
