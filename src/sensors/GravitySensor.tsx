import { useEffect, useState } from 'react';
import { SensorType, useAnimatedReaction, useAnimatedSensor, type SharedValue } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';

import type { TiltState } from '../physics/types';
import { useSensorStatus } from './sensorStatus';

/** ~30 Hz is plenty for a toy and much kinder to the battery than every frame. */
const INTERVAL_MS = 33;

/**
 * Streams the device's gravity vector straight into the physics state on the
 * UI thread (no JS bridge per reading). Mounted only while motion controls are
 * on and the app is in the foreground; unmounting stops the sensor.
 */
export function GravitySensor({ tilt }: { tilt: SharedValue<TiltState> }) {
  const sensor = useAnimatedSensor(SensorType.GRAVITY, { interval: INTERVAL_MS });
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
      if (Math.hypot(v.x, v.y, v.z) < 4) return;
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
