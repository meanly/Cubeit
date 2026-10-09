import { useWorld } from '../physics/World';
import { useAppActive } from '../services/useAppActive';
import { useGame } from '../state/gameStore';
import { GravitySensor } from './GravitySensor';

/** Runs the motion sensor only when it's wanted: motion on and app in the foreground. */
export function TiltSensorHost() {
  const { tilt } = useWorld();
  const enabled = useGame((s) => s.settings.motionEnabled);
  const active = useAppActive();
  if (!enabled || !active) return null;
  return <GravitySensor tilt={tilt} />;
}
