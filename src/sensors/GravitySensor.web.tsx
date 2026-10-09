import { useEffect } from 'react';
import type { SharedValue } from 'react-native-reanimated';

import type { TiltState } from '../physics/types';
import { useSensorStatus } from './sensorStatus';

/**
 * Web preview only: there's no reliable gravity sensor in desktop browsers, so
 * arrow keys / WASD simulate tilting the phone, holding Shift tilts hard
 * (enough to stand the stickman on that side, or on the ceiling with Up), and X is a
 * hard shake. This is a development aid and is labeled as a simulation in
 * Settings — real tilt needs a phone.
 */
const NEUTRAL = { x: 0, y: -5.6, z: -8.0 }; // phone held at ~35°
const TILT = 4.2; // ≈ 25° of tilt
const HARD_TILT = 8.5; // ≈ 60°

export function GravitySensor({ tilt }: { tilt: SharedValue<TiltState> }) {
  const setStatus = useSensorStatus((s) => s.setStatus);

  useEffect(() => {
    setStatus(true, 'keyboard-sim');
    const held = new Set<string>();
    const apply = () => {
      const left = held.has('ArrowLeft') || held.has('a');
      const right = held.has('ArrowRight') || held.has('d');
      const up = held.has('ArrowUp') || held.has('w');
      const down = held.has('ArrowDown') || held.has('s');
      const amount = held.has('Shift') ? HARD_TILT : TILT;
      const x = NEUTRAL.x + (right ? amount : 0) - (left ? amount : 0);
      const y = NEUTRAL.y + (up ? amount : 0) - (down ? amount : 0);
      tilt.modify((t) => {
        'worklet';
        t.rawX = x;
        t.rawY = y;
        t.rawZ = NEUTRAL.z;
        t.hasRaw = 1;
        return t;
      });
    };
    const isTyping = () => {
      const el = document.activeElement;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'x' && !e.repeat) {
        // One press = a hard shake.
        tilt.modify((t) => {
          'worklet';
          t.jolt += 3;
          return t;
        });
        return;
      }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'Shift'].includes(key)) return;
      e.preventDefault();
      held.add(key);
      apply();
    };
    const up = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      held.delete(key);
      apply();
    };
    apply();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      tilt.modify((t) => {
        'worklet';
        t.hasRaw = 0;
        t.autoValid = 0;
        return t;
      });
    };
  }, [tilt, setStatus]);

  return null;
}
