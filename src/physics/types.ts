/**
 * Physics state shared with the UI thread. All mutation happens on the UI
 * thread (frame loop, gesture callbacks, or commands sent with scheduleOnUI);
 * JS only reads. Booleans are 0/1 numbers to keep the objects flat and cheap.
 */
/** Read-only view of a shared value (shared values are invariant, so props accept this instead). */
export type ReadonlyShared<T> = { readonly value: T };

export interface BodyState {
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  /** 1 = facing right, -1 = facing left. */
  facing: number;
  walkPhase: number;
  walking: number;
  speed: number;
  /** Squash/stretch spring: positive = squashed. */
  squash: number;
  squashV: number;
  lean: number;
  /**
   * Whole-body inertia spring (+ = upper body thrown right, roughly -1.4..1.4).
   * Every change in velocity drives it, and hard knocks kick it directly, so
   * the rig can bend hips, chest, head and arms together instead of only leaning.
   */
  recoil: number;
  recoilV: number;
  /** 0..1, set by hard knocks and decaying: arms fly out, knees buckle, feet stagger. */
  flail: number;
  /** > 0 while knocked over by a hard tilt (counts down to getting up); head toward fallDir. */
  fallen: number;
  fallDir: number;
  /** The screen is tipped over so far that gravity pulls toward its top edge. */
  gUp: number;
  /** Lying pressed against the ceiling. */
  onCeil: number;

  // Control (set by commands)
  hasTarget: number;
  tx: number;
  tz: number;
  walkSpeed: number;
  cmdId: number;
  chase: number;
  anchored: number;
  anchorX: number;
  anchorZ: number;
  anchorY: number;
  zMax: number;
  frozen: number;

  // Dragging
  held: number;
  heldSX: number;
  heldSY: number;
  grabOffsetY: number;

  lastBumpAt: number;
  lastLandAt: number;
  airborneFrom: number;
}

export interface BallState {
  present: number;
  x: number;
  z: number;
  y: number;
  vx: number;
  vz: number;
  vy: number;
  rot: number;
  lastHitAt: number;
}

export interface TiltState {
  /** Latest raw gravity reading (m/s², points toward the ground). */
  rawX: number;
  rawY: number;
  rawZ: number;
  hasRaw: number;
  /** Auto-calibration captured from the first reading after the sensor starts. */
  autoX: number;
  autoY: number;
  autoZ: number;
  autoValid: number;
  /** Filtered, calibrated tilt, -1..1 per axis. */
  x: number;
  z: number;
  active: number;
  quietFor: number;
}

export interface PhysicsParams {
  tiltEnabled: number;
  sensitivity: number;
  calValid: number;
  calX: number;
  calY: number;
  calZ: number;
  reduceMotion: number;
  /** Multiplier on walking speed (games make the character nimbler). */
  speedBoost: number;
}

/** Event codes sent from the UI-thread simulation to JS (numbers cross threads cheaply). */
export const PhysicsEvent = {
  /** a = impact speed, b = side: 0 left, 1 right, 2 front (bottom edge), 3 back, 4 ceiling. */
  Bump: 1,
  Land: 2,
  Arrive: 3,
  TiltStart: 4,
  TiltEnd: 5,
  BallHit: 6,
  Dislodged: 7,
} as const;
export type PhysicsEventCode = (typeof PhysicsEvent)[keyof typeof PhysicsEvent];

export function initialBody(x: number, z: number): BodyState {
  return {
    x,
    z,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    facing: 1,
    walkPhase: 0,
    walking: 0,
    speed: 0,
    squash: 0,
    squashV: 0,
    lean: 0,
    recoil: 0,
    recoilV: 0,
    flail: 0,
    fallen: 0,
    fallDir: 1,
    gUp: 0,
    onCeil: 0,
    hasTarget: 0,
    tx: x,
    tz: z,
    walkSpeed: 0.3,
    cmdId: 0,
    chase: 0,
    anchored: 0,
    anchorX: x,
    anchorZ: z,
    anchorY: 0,
    zMax: 0.7,
    frozen: 0,
    held: 0,
    heldSX: 0,
    heldSY: 0,
    grabOffsetY: 0,
    lastBumpAt: 0,
    lastLandAt: 0,
    airborneFrom: 0,
  };
}

export const initialBall = (): BallState => ({
  present: 1,
  x: 0.72,
  z: 0.25,
  y: 0,
  vx: 0,
  vz: 0,
  vy: 0,
  rot: 0,
  lastHitAt: 0,
});

export const initialTilt = (): TiltState => ({
  rawX: 0,
  rawY: 0,
  rawZ: 0,
  hasRaw: 0,
  autoX: 0,
  autoY: 0,
  autoZ: 0,
  autoValid: 0,
  x: 0,
  z: 0,
  active: 0,
  quietFor: 0,
});
