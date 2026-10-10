/** Every animation state the character can be in. */
export type CharacterState =
  | 'idle'
  | 'walking'
  | 'lookingAround'
  | 'curious'
  | 'happy'
  | 'excited'
  | 'thinking'
  | 'listening'
  | 'sleeping'
  | 'surprised'
  | 'sad'
  | 'celebrating'
  | 'interacting'
  | 'dizzy'
  | 'held'
  | 'dancing'
  | 'sliding'
  | 'waving'
  | 'love'
  | 'hidden'
  // Using things in the room (each has its own animation, some with a prop in hand):
  | 'watering'
  | 'reading'
  | 'reaching'
  | 'tugging'
  | 'peeking'
  | 'pointing'
  | 'checkingWatch'
  | 'clapping'
  | 'presenting'
  | 'sitting';

export type EyeShape = 'open' | 'happy' | 'closed' | 'wide' | 'sad' | 'sparkle' | 'dizzy' | 'focus' | 'sleepy' | 'look-up';
export type MouthShape = 'smile' | 'grin' | 'open' | 'o' | 'flat' | 'frown' | 'wavy' | 'cat';

export interface Expression {
  eyes: EyeShape;
  mouth: MouthShape;
  /** 0..1 cheek blush. */
  blush: number;
}

export const EXPRESSIONS: Record<CharacterState, Expression> = {
  idle: { eyes: 'open', mouth: 'smile', blush: 0.35 },
  walking: { eyes: 'open', mouth: 'smile', blush: 0.35 },
  lookingAround: { eyes: 'open', mouth: 'cat', blush: 0.3 },
  curious: { eyes: 'wide', mouth: 'o', blush: 0.3 },
  happy: { eyes: 'happy', mouth: 'grin', blush: 0.7 },
  excited: { eyes: 'sparkle', mouth: 'open', blush: 0.8 },
  thinking: { eyes: 'look-up', mouth: 'wavy', blush: 0.25 },
  listening: { eyes: 'open', mouth: 'cat', blush: 0.4 },
  sleeping: { eyes: 'closed', mouth: 'o', blush: 0.45 },
  surprised: { eyes: 'wide', mouth: 'open', blush: 0.3 },
  sad: { eyes: 'sad', mouth: 'frown', blush: 0.2 },
  celebrating: { eyes: 'happy', mouth: 'open', blush: 0.9 },
  interacting: { eyes: 'focus', mouth: 'smile', blush: 0.4 },
  dizzy: { eyes: 'dizzy', mouth: 'wavy', blush: 0.3 },
  held: { eyes: 'wide', mouth: 'open', blush: 0.6 },
  dancing: { eyes: 'happy', mouth: 'grin', blush: 0.7 },
  sliding: { eyes: 'wide', mouth: 'o', blush: 0.5 },
  waving: { eyes: 'happy', mouth: 'grin', blush: 0.6 },
  love: { eyes: 'happy', mouth: 'cat', blush: 1 },
  hidden: { eyes: 'open', mouth: 'smile', blush: 0.3 },
  watering: { eyes: 'focus', mouth: 'smile', blush: 0.4 },
  reading: { eyes: 'focus', mouth: 'cat', blush: 0.3 },
  reaching: { eyes: 'look-up', mouth: 'o', blush: 0.3 },
  tugging: { eyes: 'focus', mouth: 'flat', blush: 0.4 },
  peeking: { eyes: 'look-up', mouth: 'o', blush: 0.3 },
  pointing: { eyes: 'sparkle', mouth: 'grin', blush: 0.5 },
  checkingWatch: { eyes: 'focus', mouth: 'flat', blush: 0.25 },
  clapping: { eyes: 'happy', mouth: 'open', blush: 0.8 },
  presenting: { eyes: 'happy', mouth: 'grin', blush: 0.7 },
  sitting: { eyes: 'happy', mouth: 'smile', blush: 0.5 },
};

/** Shapes that are already "closed" shouldn't blink. */
export const canBlink = (shape: EyeShape) =>
  shape === 'open' || shape === 'wide' || shape === 'sparkle' || shape === 'look-up' || shape === 'focus' || shape === 'sad';

/** Little symbols that pop above the character's head. */
export type EmoteId = 'heart' | 'note' | 'question' | 'exclaim' | 'zzz' | 'sparkle' | 'dots' | 'star' | 'swirl' | 'book' | 'drop' | 'bulb' | 'sweat';

/**
 * Pose targets the rig animates toward for each state. Arms are "raise"
 * angles in radians: positive lifts the arm outward/up, negative folds it in
 * across the body. bounce/sway/lower are 0..1 amplitudes; tilt is a head tilt
 * in radians. Applied with smooth timing on state change.
 */
export interface Pose {
  armL: number;
  armR: number;
  bounce: number;
  sway: number;
  lower: number;
  tilt: number;
}

const BASE: Pose = { armL: 0, armR: 0, bounce: 0, sway: 0, lower: 0, tilt: 0 };

export const POSES: Record<CharacterState, Pose> = {
  idle: BASE,
  walking: BASE,
  lookingAround: BASE,
  curious: { ...BASE, tilt: 0.12, armR: 0.3 },
  happy: { ...BASE, armL: 0.6, armR: 0.6, bounce: 0.5 },
  excited: { ...BASE, armL: 1.1, armR: 1.1, bounce: 1 },
  thinking: { ...BASE, armR: -2.1, tilt: -0.1 },
  listening: { ...BASE, tilt: 0.1 },
  sleeping: { ...BASE, lower: 1, armL: -0.3, armR: -0.3 },
  surprised: { ...BASE, armL: 1.4, armR: 1.4 },
  sad: { ...BASE, lower: 0.4, armL: -0.35, armR: -0.35, tilt: -0.05 },
  celebrating: { ...BASE, armL: 2.4, armR: 2.4, bounce: 1 },
  interacting: { ...BASE, armR: 1.2 },
  dizzy: { ...BASE, sway: 1, armL: 0.4, armR: 0.4 },
  held: { ...BASE, armL: 1.8, armR: 1.8 },
  dancing: { ...BASE, sway: 1, bounce: 0.6, armL: 1.2, armR: 1.2 },
  sliding: { ...BASE, armL: 1, armR: 1 },
  waving: { ...BASE, armR: 2.4 },
  love: { ...BASE, armL: 0.8, armR: 0.8, bounce: 0.3 },
  hidden: BASE,
  // The item states pose the hands themselves (in the sprite); these only set the mood of the body.
  watering: BASE,
  reading: { ...BASE, tilt: -0.05 },
  reaching: BASE,
  tugging: BASE,
  peeking: BASE,
  pointing: { ...BASE, tilt: 0.1 },
  checkingWatch: BASE,
  clapping: { ...BASE, bounce: 0.35 },
  presenting: { ...BASE, bounce: 0.25 },
  sitting: BASE,
};
