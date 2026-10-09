import { useEffect, useState } from 'react';
import { SensorType, useAnimatedReaction, useAnimatedSensor, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import type { TiltState } from '../physics/types';
import { useSensorStatus } from './sensorStatus';

/** ~30 Hz is plenty for a toy and much kinder to the battery than every frame. */
const INTERVAL_MS = 33;
/** How sharply (in g, between two accelerometer readings) the phone must lurch to count as a jolt. */
const JOLT_G = 1.1;

/**
 * Streams the device's gravity vector straight into the physics state on the
 * UI thread (no JS bridge per reading). Mounted only while motion controls are
 * on and the app is in the foreground; unmounting stops the sensor.
 */
export function GravitySensor({ tilt }: { tilt: SharedValue<TiltState> }) {
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: INTERVAL_MS });
  // Shakes barely register in the (filtered) gravity vector, so watch the raw accelerometer too.
  const accel = useAnimatedSensor(SensorType.ACCELEROMETER, { interval: 20 });
  // 1 g in the sensors' units (from the gravity sensor), and the last accelerometer reading.
  const oneG = useSharedValue(0);
  const last = useSharedValue({ x: 0, y: 0, z: 0, valid: 0 });
  const sinceJolt = useSharedValue(0);
  // Reanimated fills in `isAvailable` after mount, so render once more to read it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const setStatus = useSensorStatus((s) => s.setStatus);
  useEffect(() => {
    if (mounted) setStatus(sensor.isAvailable, 'gravity');
  }, [mounted, sensor.isAvailable, setStatus]);

  useAnimatedReaction(
    () => sensor.sensor.value,
    (v) => {
      // Ignore the zero vector Reanimated reports before the first real sample.
      const mag = Math.hypot(v.x, v.y, v.z);
      if (mag < 4) return;
      oneG.value = mag;
      tilt.modify((t) => {
        'worklet';
        t.rawX = v.x;
        t.rawY = v.y;
        t.rawZ = v.z;
        t.hasRaw = 1;
        return t;
      });
    },
  );

  // A jolt is the acceleration swinging by more than JOLT_G between two
  // readings, as it does when a shake reverses. Nothing adapts while shaking,
  // so every shake counts the same (an adaptive baseline crept up during one
  // shake and ignored the next). Jolts at least 80 ms apart feed
  // TiltState.jolt, and enough of them in a row make a mess.
  useAnimatedReaction(
    () => accel.sensor.value,
    (v) => {
      const prev = last.value;
      last.value = { x: v.x, y: v.y, z: v.z, valid: 1 };
      const g = oneG.value;
      if (prev.valid === 0 || g === 0) return;
      sinceJolt.value += 1;
      const swing = Math.hypot(v.x - prev.x, v.y - prev.y, v.z - prev.z) / g;
      if (swing > JOLT_G && sinceJolt.value >= 4) {
        sinceJolt.value = 0;
        tilt.modify((t) => {
          'worklet';
          t.jolt += 1;
          return t;
        });
      }
    },
  );

  useEffect(
    () => () => {
      scheduleOnUI(() => {
        'worklet';
        tilt.modify((t) => {
          'worklet';
          t.hasRaw = 0;
          t.autoValid = 0;
          return t;
        });
      });
    },
    [tilt],
  );

  return null;
}
