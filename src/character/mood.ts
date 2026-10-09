import type { MoodState, Personality } from '../state/schema';

export type MoodLabel = 'joyful' | 'happy' | 'playful' | 'content' | 'calm' | 'sleepy' | 'blue';

export const MOOD_TEXT: Record<MoodLabel, string> = {
  joyful: 'Joyful',
  happy: 'Happy',
  playful: 'Playful',
  content: 'Content',
  calm: 'Calm',
  sleepy: 'Sleepy',
  blue: 'A bit blue',
};

export function moodLabel(mood: Pick<MoodState, 'valence' | 'energy'>): MoodLabel {
  const { valence, energy } = mood;
  if (energy < 0.25) return 'sleepy';
  if (valence < -0.15) return 'blue';
  if (valence > 0.7) return 'joyful';
  if (valence > 0.4 && energy > 0.7) return 'playful';
  if (valence > 0.4) return 'happy';
  if (energy < 0.45) return 'calm';
  return 'content';
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Natural energy for the local hour: low at night, a small dip after lunch. */
export function circadianEnergy(hour: number): number {
  const points: [number, number][] = [
    [0, 0.15],
    [6, 0.2],
    [9, 0.75],
    [12, 0.82],
    [14, 0.62],
    [16, 0.8],
    [19, 0.72],
    [22, 0.3],
    [24, 0.15],
  ];
  const h = ((hour % 24) + 24) % 24;
  for (let i = 1; i < points.length; i++) {
    const [h1, e1] = points[i];
    const [h0, e0] = points[i - 1];
    if (h <= h1) return e0 + ((h - h0) / (h1 - h0)) * (e1 - e0);
  }
  return 0.15;
}

/** Valence the character gently returns to. Calm characters are a touch steadier. */
export const baselineValence = (p: Personality) => 0.3 + p.calm * 0.1;

/**
 * Let mood relax toward its baseline over real elapsed time. There is no decay
 * into negative territory from being left alone — after any absence the
 * character simply settles back to content.
 */
export function driftMood(mood: MoodState, now: number, personality: Personality, localHour: number): MoodState {
  const elapsedMin = clamp((now - mood.updatedAt) / 60000, 0, 24 * 60);
  if (elapsedMin <= 0) return mood;
  const valenceK = 1 - Math.exp(-elapsedMin / 90);
  const energyK = 1 - Math.exp(-elapsedMin / 40);
  const base = baselineValence(personality);
  return {
    valence: clamp(mood.valence + (base - mood.valence) * valenceK, -1, 1),
    energy: clamp(mood.energy + (circadianEnergy(localHour) - mood.energy) * energyK, 0, 1),
    updatedAt: now,
  };
}

export function nudgeMood(mood: MoodState, dValence: number, dEnergy: number, now: number): MoodState {
  return {
    valence: clamp(mood.valence + dValence, -0.5, 1),
    energy: clamp(mood.energy + dEnergy, 0, 1),
    updatedAt: now,
  };
}
