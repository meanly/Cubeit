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
  /**
   * Whole-body rotation in radians, for drawing (+ = clockwise, head toward +x):
   * which way is "down" for him (TiltState.angle — standing on a side wall it's
   * ±π/2) plus `messRot`, a springy spin from being knocked about by a shake.
   */
  rot: number;
  messRot: number;
  messRotV: number;

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
  /**
   * Auto neutral for forward/back tilt: captured from the first reading after
   * the sensor starts, then slowly following the way the phone is held.
   */
  autoX: number;
  autoY: number;
  autoZ: number;
  autoValid: number;
  /**
   * Filtered tilt signals, -1..1: `x` slides things sideways (measured from true
   * level), `y` slides him up/down a side wall he stands on (measured from true
   * level), `z` moves things toward the back (measured from the neutral angle).
   */
  x: number;
  y: number;
  z: number;
  /** Smoothed gravity in the screen's plane, in g (x right, y toward the top edge): decides which side is down. */
  gx: number;
  gy: number;
  /**
   * Which side of the room is "down" for the stickman: 0 the floor, 1 the left
   * wall, 2 the ceiling (screen upside down), 3 the right wall. He falls to it
   * and stands on it; the furniture stays put.
   */
  side: number;
  /** The stickman's orientation in radians (eased toward the side's angle), and its speed. */
  angle: number;
  angleV: number;
  /**
   * 1 while the phone is tilted at all (or a side is down), with `quietFor`
   * timing how long it's been level before that ends.
   */
  active: number;
  quietFor: number;
  /** Furniture lean in radians (+ = toward +x), springing after the sideways tilt, and its speed. */
  lean: number;
  leanV: number;
  /** Sensor jolts since the last step (from the accelerometer, or the web's shake key). */
  jolt: number;
  /** Accumulated shaking; past 1 the room gets messy. */
  shake: number;
  messCooldown: number;
  /** Set for one step when the room should be scattered (the frame loop consumes it). */
  messNow: number;
}

/**
 * Furniture knocked out of place by a shake, per slot (MESS_ORDER): offset x,
 * y (dots) and twist r (radians), then their targets. `hold` counts down the
 * seconds before everything eases home.
 */
export interface MessState {
  hold: number;
  v: number[];
}

/** The furniture slots that can be knocked about, in MessState order. */
export const MESS_ORDER = ['rest', 'corner', 'wallLeft', 'wallRight', 'rug', 'ceiling'] as const;
export const MESS_SLOTS = MESS_ORDER.length;

export const initialMess = (): MessState => ({ hold: 0, v: new Array(MESS_SLOTS * 6).fill(0) });

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
  /** 1 keeps "down" on the floor (games), whatever way the phone is held: tilting only slides things. */
  orientLocked: number;
}

/** Event codes sent from the UI-thread simulation to JS (numbers cross threads cheaply). */
export const PhysicsEvent = {
  /** a = impact speed, b = side: 0 left, 1 right, 2 front (bottom edge), 3 back, 4 ceiling, 5 floor. */
  Bump: 1,
  Land: 2,
  Arrive: 3,
  /**
   * The phone started tilting, or "down" moved to another side (a = side, b =
   * previous); TiltEnd once it's level again with the floor down.
   */
  TiltStart: 4,
  TiltEnd: 5,
  BallHit: 6,
  /** Shaken too hard: everything was knocked out of place. */
  MessUp: 7,
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
    rot: 0,
    messRot: 0,
    messRotV: 0,
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
  y: 0,
  z: 0,
  gx: 0,
  gy: 0,
  side: 0,
  angle: 0,
  angleV: 0,
  active: 0,
  quietFor: 0,
  lean: 0,
  leanV: 0,
  jolt: 0,
  shake: 0,
  messCooldown: 0,
  messNow: 0,
});
