import { ceilingFor, ceilingY, depthScale, floorY, unprojectFloor, WORLD, type RoomGeometry } from './geometry';
import { MESS_SLOTS, PhysicsEvent, type BallState, type BodyState, type MessState, type PhysicsParams, type TiltState } from './types';

/**
 * Tuning for the character's "weight". Units: world units (room width = 1)
 * and seconds. Kept together so feel can be tuned in one place.
 */
export const PHYS = {
  /**
   * Tilt slides him along whatever he's standing on, like a marble with drag:
   * acceleration `slideAccel` per unit of tilt, surface drag `surfaceDrag`/s, so
   * he settles to a speed proportional to the tilt within ~¼ s and stops soon
   * after the phone is level again. (`depthAccel` for forward/back tilt.)
   */
  slideAccel: 5.5,
  depthAccel: 4.4,
  surfaceDrag: 4,
  airDrag: 0.4,
  maxSpeed: 1.7,
  steerGain: 7,
  /** Walking gives way to tilt: fully above `steerYield + steerYieldRange` of tilt. */
  steerYield: 0.03,
  steerYieldRange: 0.12,
  gravity: 6.5,
  wallRestitution: 0.35,
  bumpThreshold: 0.4,
  landThreshold: 0.9,
  deadzone: 0.035,
  filterTau: 0.07,
  /** Smoothing for the gravity direction that picks the "down" side. */
  gravTau: 0.12,
  /** Without a saved neutral, the forward/back neutral follows the way the phone is held over ~this many seconds. */
  neutralTau: 8,
  ballTiltAccel: 5.2,
  ballFriction: 0.9,
  ballRestitution: 0.7,
  ballFloorBounce: 0.5,
  charRadius: 0.085,
  /** Tilting counts as started above `tiltOn`, and over once below `tiltOff` for `tiltQuietSec`. */
  tiltOn: 0.15,
  tiltOff: 0.08,
  tiltQuietSec: 0.8,
  /**
   * "Down" is whichever edge of the screen gravity points at. The current side
   * holds until gravity is `sideHold` radians (52°) away from it (7° of
   * hysteresis past the 45° diagonal, so it never flickers), and a side wall or
   * the ceiling only takes over when gravity in the screen's plane is at least
   * `sideMinG` (the phone isn't lying flat); below `sideDropG` it's the floor again.
   */
  sideHold: 0.91,
  sideMinG: 0.3,
  sideDropG: 0.18,
  /** He turns to the new "down" on an eased spring (slightly underdamped). */
  orientK: 80,
  orientDamp: 13,
  /**
   * Furniture stays standing on its base and only leans with a sideways tilt:
   * up to `itemLean` radians, on a wobbly spring.
   */
  itemLean: 0.12,
  leanK: 60,
  leanDamp: 6,
  /** Shaking: each jolt adds this much "shake"; it drains at `shakeDrain`/s, and past 1 the room gets messy. */
  joltShake: 0.34,
  shakeDrain: 1.1,
  messCooldown: 1.5,
  /** How long things stay knocked out of place before they ease back. */
  messHold: 3.2,
  /** Whole-body recoil spring: stiffness, damping (underdamped, so it wobbles back), */
  recoilK: 120,
  recoilDamp: 5.5,
  /** how strongly velocity changes throw the upper body, */
  recoilInertia: 4,
  /** and how hard a wall knocks it back (per unit of impact speed). */
  recoilKick: 12,
  /** Impact speed above which the stickman is knocked off his feet and flails. */
  knockHop: 1.2,
  flailDecay: 1.5,
} as const;

/** Rotation for each gravity side: down, left edge down, top edge down, right edge down. */
const SIDE_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2] as const;
/** Direction of gravity in the screen's plane (0 = toward the bottom edge, + toward the right) at each side's center. */
const SIDE_GRAVITY = [0, -Math.PI / 2, Math.PI, Math.PI / 2] as const;

function wrapAngle(a: number): number {
  'worklet';
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function clamp(v: number, lo: number, hi: number): number {
  'worklet';
  return v < lo ? lo : v > hi ? hi : v;
}

/** Dead zone + rescale so tiny hand tremors don't move anything. */
export function shapeTilt(v: number, deadzone: number): number {
  'worklet';
  const m = Math.abs(v);
  if (m < deadzone) return 0;
  return (Math.sign(v) * (m - deadzone)) / (1 - deadzone);
}

/**
 * Turn raw gravity into smoothed tilt signals, decide which side of the room
 * is "down" for the stickman and ease his orientation toward it, and spring the
 * furniture's lean after it. Gravity points toward the ground in device
 * coordinates (Reanimated reports the same convention on iOS and Android), so
 * lowering the left edge makes x negative and things slide left.
 *
 * Sideways tilt and "which side is down" come straight from gravity in the
 * screen's plane, so holding the phone level always means level (no stale
 * calibration). Forward/back is measured from the neutral holding angle (saved
 * in Settings, or automatic and slowly following posture).
 * Also turns sensor jolts into shake, and flags a mess (`messNow`) when the
 * phone has been shaken too hard.
 */
export function stepTilt(t: TiltState, p: PhysicsParams, dt: number, events: number[]): void {
  'worklet';
  let tx = 0;
  let ty = 0;
  let tz = 0;
  let gx = 0;
  let gy = 0;
  const live = p.tiltEnabled === 1 && t.hasRaw === 1;
  if (live) {
    const g = Math.hypot(t.rawX, t.rawY, t.rawZ) || 9.81;
    gx = t.rawX / g;
    gy = t.rawY / g;
    if (p.calValid === 0 && t.autoValid === 0) {
      t.autoX = t.rawX;
      t.autoY = t.rawY;
      t.autoZ = t.rawZ;
      t.autoValid = 1;
    }
    // A saved neutral also offsets sideways (e.g. for someone lying on their side).
    const x0 = p.calValid === 1 ? p.calX / g : 0;
    const y0 = p.calValid === 1 ? p.calY : t.autoY;
    tx = shapeTilt(gx - x0, PHYS.deadzone) * p.sensitivity;
    ty = shapeTilt(gy, PHYS.deadzone) * p.sensitivity;
    tz = shapeTilt((t.rawY - y0) / g, PHYS.deadzone) * p.sensitivity;
    // The automatic neutral drifts after the way the phone is held, so a change
    // of posture never leaves him pushed against the back or front for long.
    if (p.calValid === 0 && t.side === 0) t.autoY += (t.rawY - t.autoY) * (1 - Math.exp(-dt / PHYS.neutralTau));
  }
  const a = 1 - Math.exp(-dt / PHYS.filterTau);
  t.x += (clamp(tx, -1.5, 1.5) - t.x) * a;
  t.y += (clamp(ty, -1.5, 1.5) - t.y) * a;
  t.z += (clamp(tz, -1.5, 1.5) - t.z) * a;
  const ga = 1 - Math.exp(-dt / PHYS.gravTau);
  t.gx += (gx - t.gx) * ga;
  t.gy += (gy - t.gy) * ga;

  // Which side is down? The edge of the screen gravity points at, with
  // hysteresis so it never flickers on the diagonal. (Games keep the floor
  // down: their controls assume it.)
  const prev = t.side;
  let side = prev;
  if (!live || p.orientLocked === 1) {
    side = 0;
  } else {
    const inPlane = Math.hypot(t.gx, t.gy);
    const dir = Math.atan2(t.gx, -t.gy);
    if (Math.abs(wrapAngle(dir - SIDE_GRAVITY[prev])) > PHYS.sideHold) {
      const q = Math.round(dir / (Math.PI / 2));
      const nearest = q === 0 ? 0 : q === -1 ? 1 : q === 1 ? 3 : 2;
      side = nearest === 0 || inPlane >= PHYS.sideMinG ? nearest : 0;
    }
    // Lying flat there's no real "down" in the screen's plane: back to the floor.
    if (side !== 0 && inPlane < PHYS.sideDropG) side = 0;
  }
  t.side = side;

  // Tilting started (any noticeable tilt, or a new side down) / ended (level for a moment, floor down).
  const mag = Math.hypot(t.x, t.z);
  if (side !== prev && side !== 0) {
    t.active = 1;
    t.quietFor = 0;
    events.push(PhysicsEvent.TiltStart, side, prev);
  } else if (t.active === 0) {
    if (mag > PHYS.tiltOn) {
      t.active = 1;
      t.quietFor = 0;
      events.push(PhysicsEvent.TiltStart, side, prev);
    }
  } else if (side === 0 && mag < PHYS.tiltOff) {
    t.quietFor += dt;
    if (t.quietFor > PHYS.tiltQuietSec) {
      t.active = 0;
      events.push(PhysicsEvent.TiltEnd, 0, prev);
    }
  } else {
    t.quietFor = 0;
  }

  // Furniture leans a little toward the low side, rocking on its base.
  const leanTarget = p.tiltEnabled === 1 && p.orientLocked === 0 ? clamp(t.x, -1, 1) * PHYS.itemLean : 0;
  t.leanV += ((leanTarget - t.lean) * PHYS.leanK - t.leanV * PHYS.leanDamp) * dt;
  t.lean += t.leanV * dt;

  // Ease toward the side's angle, taking the short way round.
  let target = SIDE_ANGLE[t.side];
  while (target - t.angle > Math.PI) target -= Math.PI * 2;
  while (target - t.angle < -Math.PI) target += Math.PI * 2;
  t.angleV += ((target - t.angle) * PHYS.orientK - t.angleV * PHYS.orientDamp) * dt;
  t.angle += t.angleV * dt;
  if (Math.abs(target - t.angle) < 0.001 && Math.abs(t.angleV) < 0.01) {
    t.angle = SIDE_ANGLE[t.side];
    t.angleV = 0;
  }

  // Shaking: jolts pile up faster than they drain only when the phone is really shaken.
  t.shake = Math.max(0, t.shake - dt * PHYS.shakeDrain) + t.jolt * PHYS.joltShake;
  t.jolt = 0;
  t.messCooldown = Math.max(0, t.messCooldown - dt);
  if (t.shake > 1 && t.messCooldown === 0) {
    t.messNow = 1;
    t.shake = 0.3;
    t.messCooldown = PHYS.messCooldown;
    events.push(PhysicsEvent.MessUp, 1, 0);
  }
}

/** Random in [-1, 1], but at least `min` in size. */
function kickRand(min: number): number {
  'worklet';
  const r = Math.random() * 2 - 1;
  return Math.sign(r || 1) * (min + (1 - min) * Math.abs(r));
}

/**
 * Shaken too hard: every object is knocked out of place. Furniture gets a
 * random offset (in dots) and twist that holds for a few seconds before it
 * eases home; the ball and the stickman are flung by their own physics.
 */
export function scatter(mess: MessState, b: BodyState, ball: BallState, reduceMotion: number): void {
  'worklet';
  const k = reduceMotion === 1 ? 0.35 : 1;
  mess.hold = PHYS.messHold;
  for (let i = 0; i < MESS_SLOTS; i++) {
    const o = i * 6;
    mess.v[o + 3] = kickRand(0.3) * 6 * k;
    mess.v[o + 4] = kickRand(0.2) * 4 * k;
    mess.v[o + 5] = kickRand(0.3) * 0.7 * k;
  }
  if (b.held === 0 && b.frozen === 0) {
    b.anchored = 0;
    b.zMax = WORLD.zMax;
    b.hasTarget = 0;
    b.chase = 0;
    b.vx += kickRand(0.4) * 1.2 * k;
    b.vz += kickRand(0) * 0.5 * k;
    b.vy = Math.max(b.vy, 1.1 * k);
    b.y = Math.max(b.y, 0.001);
    b.messRotV += kickRand(0.5) * 9 * k;
    b.flail = 1;
  }
  if (ball.present === 1) {
    ball.vx += kickRand(0.4) * 1.6 * k;
    ball.vz += kickRand(0) * 0.6 * k;
    ball.vy += 1.4 * k;
    ball.y = Math.max(ball.y, 0.001);
  }
}

/** Furniture offsets: spring toward their knocked-about targets while the mess holds, then home. */
export function stepMess(mess: MessState, dt: number): void {
  'worklet';
  mess.hold = Math.max(0, mess.hold - dt);
  const holding = mess.hold > 0;
  for (let i = 0; i < MESS_SLOTS; i++) {
    const o = i * 6;
    for (let c = 0; c < 3; c++) {
      const target = holding ? mess.v[o + 3 + c] : 0;
      const pos = mess.v[o + c];
      // Velocity is implicit: a critically-damped ease (no overshoot through walls).
      const rate = holding ? 14 : 4;
      mess.v[o + c] = pos + (target - pos) * Math.min(1, dt * rate);
    }
  }
}

/** Put every object back where it belongs at once (the LED reset). */
export function clearMess(mess: MessState): void {
  'worklet';
  mess.hold = 0;
  for (let i = 0; i < mess.v.length; i++) mess.v[i] = 0;
}

/** Character being dragged: follow the finger in the plane of the screen. */
function stepHeld(b: BodyState, g: RoomGeometry, dt: number): void {
  'worklet';
  const feetY = b.heldSY + b.grabOffsetY;
  // Lifting something off the bed brings it forward into the open floor.
  let z = Math.min(b.z, WORLD.zMax);
  let y: number;
  if (feetY > floorY(g, z)) {
    // Dragging below the current floor line pulls the character toward the front.
    z = clamp(unprojectFloor(g, b.heldSX, feetY).z, WORLD.zMin, WORLD.zMax);
    y = Math.max(0, (floorY(g, z) - feetY) / (depthScale(g, z) * g.unit));
  } else {
    y = (floorY(g, z) - feetY) / (depthScale(g, z) * g.unit);
  }
  const x = clamp(unprojectFloor(g, b.heldSX, floorY(g, z)).x, WORLD.xMin, WORLD.xMax);
  y = clamp(y, 0, ceilingY(g, z, false));

  const k = Math.min(1, dt * 20);
  const nx = b.x + (x - b.x) * k;
  const ny = b.y + (y - b.y) * k;
  const nz = b.z + (z - b.z) * k;
  const inv = dt > 0 ? 1 / dt : 0;
  b.vx = b.vx * 0.6 + (nx - b.x) * inv * 0.4;
  b.vy = 0;
  b.vz = 0;
  b.x = nx;
  b.y = ny;
  b.z = nz;
  b.speed = 0;
  b.walking = 0;
  b.lean += (clamp(-b.vx * 0.25, -0.35, 0.35) - b.lean) * Math.min(1, dt * 10);
}

function stepSquash(b: BodyState, dt: number): void {
  'worklet';
  b.squashV += (-170 * b.squash - 13 * b.squashV) * dt;
  b.squash = clamp(b.squash + b.squashV * dt, -0.35, 0.45);
}

/**
 * Whole-body follow-through. `dvx` is this step's change in sideways velocity
 * from forces (the upper body lags behind it); collisions add `kick` directly.
 */
function stepRecoil(b: BodyState, dvx: number, kick: number, dt: number, reduceMotion: number): void {
  'worklet';
  if (reduceMotion === 1) {
    b.recoil = 0;
    b.recoilV = 0;
    b.flail = 0;
    return;
  }
  b.recoilV += -dvx * PHYS.recoilInertia + kick;
  b.recoilV += (-PHYS.recoilK * b.recoil - PHYS.recoilDamp * b.recoilV) * dt;
  b.recoil = clamp(b.recoil + b.recoilV * dt, -1.4, 1.4);
  if (Math.abs(b.recoil) >= 1.4) b.recoilV *= 0.5;
  b.flail = Math.max(0, b.flail - dt * PHYS.flailDecay);
}

/** A hard knock: flail for a moment (strength 0..1). */
function knock(b: BodyState, strength: number): void {
  'worklet';
  b.flail = Math.max(b.flail, clamp(strength, 0, 1));
}

/** Half the figure's width across the room at its current rotation. */
export function bodyHalfX(rot: number): number {
  'worklet';
  return Math.max(WORLD.xMin, WORLD.lieHalf * Math.abs(Math.sin(rot)));
}

/**
 * The stickman turns to whichever side is "down" (TiltState.angle), so he
 * stands on that wall, plus a springy spin when he's been knocked about by a
 * shake. Tucked in on the furniture he stays level with it.
 */
function stepTurn(b: BodyState, t: TiltState, dt: number): void {
  'worklet';
  const turn = b.rot - b.messRot;
  let d = (b.anchored === 1 ? 0 : t.angle) - turn;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  b.messRotV += (-b.messRot * 60 - b.messRotV * 7) * dt;
  b.messRot += b.messRotV * dt;
  b.rot = turn + d * Math.min(1, dt * 12) + b.messRot;
}

/**
 * Coming down on the surface that's "down": squash, a Land event for real
 * drops, a stagger for hard ones. Returns the (small) bounce speed — resting
 * on it gives 0, so standing still never jitters.
 */
function landing(b: BodyState, impact: number, p: PhysicsParams, now: number, events: number[]): number {
  'worklet';
  if (impact <= 0) return 0;
  if (impact > 0.25 && p.reduceMotion === 0) b.squashV += impact * 1.4;
  if (impact > PHYS.landThreshold && now - b.lastLandAt > 0.25) {
    b.lastLandAt = now;
    events.push(PhysicsEvent.Land, impact, now - b.airborneFrom);
  }
  if (impact > 1.6) knock(b, (impact - 1.6) * 0.8);
  return impact > 1.6 ? impact * 0.22 : 0;
}

/**
 * Hitting any other border: a squash and knock on a real hit, and a
 * (rate-limited) Bump event. Returns the rebound speed — none for a gentle
 * touch, so pressing against a wall rests there instead of buzzing.
 */
function bumpBack(b: BodyState, impact: number, where: number, p: PhysicsParams, now: number, events: number[]): number {
  'worklet';
  if (impact <= PHYS.bumpThreshold) return 0;
  if (p.reduceMotion === 0) {
    b.squashV -= impact * 1.2;
    knock(b, (impact - 0.5) * 1.1);
  }
  if (now - b.lastBumpAt > 0.35) {
    b.lastBumpAt = now;
    events.push(PhysicsEvent.Bump, impact, where);
  }
  return impact * PHYS.wallRestitution;
}

export function stepBody(
  b: BodyState,
  t: TiltState,
  p: PhysicsParams,
  g: RoomGeometry,
  dt: number,
  now: number,
  events: number[],
): void {
  'worklet';
  stepTurn(b, t, dt);
  if (b.frozen === 1) {
    b.vx = 0;
    b.vz = 0;
    b.vy = 0;
    b.speed = 0;
    b.walking = 0;
    stepRecoil(b, 0, 0, dt, p.reduceMotion);
    return;
  }
  if (b.held === 1) {
    // Swinging him around on a finger throws his whole body about.
    const vx0 = b.vx;
    stepHeld(b, g, dt);
    stepSquash(b, dt);
    stepRecoil(b, (b.vx - vx0) * 0.6, 0, dt, p.reduceMotion);
    return;
  }

  if (b.anchored === 1) {
    // Napping on the furniture: stays put (the room may turn around him).
    const k = Math.min(1, dt * 6);
    b.x += (b.anchorX - b.x) * k;
    b.z += (b.anchorZ - b.z) * k;
    b.y += (b.anchorY - b.y) * k;
    b.vx = 0;
    b.vz = 0;
    b.vy = 0;
    b.speed = 0;
    b.walking = 0;
    b.lean *= 1 - Math.min(1, dt * 6);
    stepSquash(b, dt);
    stepRecoil(b, 0, 0, dt, p.reduceMotion);
    return;
  }

  // Whichever side is "down" pulls him onto it (the floor, a side wall, or the
  // ceiling), and the tilt slides him along that surface — so standing on a
  // wall he can slide up and down it instead of being pinned in a corner.
  const side = t.side;
  const onWall = side === 1 || side === 3;
  const half = bodyHalfX(b.rot);
  const xMin = half;
  const xMax = 1 - half;
  const yMax = ceilingFor(g, b.z, b.rot);
  const supported =
    side === 0
      ? b.y <= 0.0001 && b.vy <= 0
      : side === 2
        ? b.y >= yMax - 0.0001 && b.vy >= 0
        : side === 1
          ? b.x <= xMin + 0.0001 && b.vx <= 0
          : b.x >= xMax - 0.0001 && b.vx >= 0;
  if (supported) b.airborneFrom = now;
  const tiltMag = Math.hypot(t.x, t.z);

  let ax = 0;
  let ay = 0;
  let az = 0;
  // (Resting on the surface, its pull is already balanced, so it isn't re-applied.)
  const pull = supported ? 0 : PHYS.gravity;
  if (side === 0) {
    ax = t.x * PHYS.slideAccel;
    az = t.z * PHYS.depthAccel;
    ay = -pull;
  } else if (side === 2) {
    ax = t.x * PHYS.slideAccel;
    ay = pull;
  } else {
    ax = (side === 1 ? -1 : 1) * pull;
    ay = t.y * PHYS.slideAccel;
  }

  // Walking (floor only) gives way as soon as the phone tips, so he always goes
  // where the tilt takes him instead of fighting it.
  const steering = side === 0 && (b.hasTarget === 1 || b.chase === 1);
  let will = 0;
  if (steering) {
    const dx = b.tx - b.x;
    const dz = b.tz - b.z;
    const dist = Math.hypot(dx, dz);
    will = clamp(1 - (tiltMag - PHYS.steerYield) / PHYS.steerYieldRange, 0, 1);
    if (dist < 0.012 && b.chase === 0) {
      b.hasTarget = 0;
      events.push(PhysicsEvent.Arrive, b.cmdId, 0);
    } else if (dist > 1e-4) {
      const desired = b.walkSpeed * p.speedBoost * Math.min(1, dist / 0.12);
      const airFactor = supported ? 1 : 0.35;
      ax += ((dx / dist) * desired - b.vx) * PHYS.steerGain * will * airFactor;
      az += ((dz / dist) * desired - b.vz) * PHYS.steerGain * will * airFactor;
    }
  }

  // Drag along the surface (walking replaces it while he walks), light drag in the air.
  const drag = Math.exp(-(supported ? PHYS.surfaceDrag * (1 - will) : PHYS.airDrag) * dt);
  if (onWall) b.vy *= drag;
  else b.vx *= drag;
  b.vz *= drag;

  const vx0 = b.vx;
  const vy0 = b.vy;
  b.vx += ax * dt;
  b.vy += ay * dt;
  b.vz += az * dt;
  const sp = Math.hypot(onWall ? b.vy : b.vx, b.vz);
  if (sp > PHYS.maxSpeed) {
    const k = PHYS.maxSpeed / sp;
    if (onWall) b.vy *= k;
    else b.vx *= k;
    b.vz *= k;
  }
  // Velocity change from forces along the surface, in his own frame (the upper
  // body lags behind it); collisions are handled as knocks below.
  const dAlong = side === 0 ? b.vx - vx0 : side === 2 ? vx0 - b.vx : side === 1 ? vy0 - b.vy : b.vy - vy0;

  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;

  // Floor and ceiling: landing on the one that's "down", a knock on the other.
  if (b.y <= 0) {
    const impact = -b.vy;
    b.y = 0;
    if (side === 0) b.vy = landing(b, impact, p, now, events);
    else b.vy = bumpBack(b, impact, 5, p, now, events);
  } else if (b.y >= yMax) {
    const impact = b.vy;
    b.y = yMax;
    if (side === 2) b.vy = -landing(b, impact, p, now, events);
    else b.vy = -bumpBack(b, impact, 4, p, now, events);
  }

  // Side walls: standing on one is a landing; otherwise a soft bounce, and the
  // whole body is knocked back from it.
  let kick = 0;
  if (b.x < xMin || b.x > xMax) {
    const left = b.x < xMin;
    const impact = left ? -b.vx : b.vx;
    b.x = left ? xMin : xMax;
    if ((left && side === 1) || (!left && side === 3)) {
      b.vx = (left ? 1 : -1) * landing(b, impact, p, now, events);
    } else {
      b.vx = (left ? 1 : -1) * bumpBack(b, impact, left ? 0 : 1, p, now, events);
      if (impact > PHYS.bumpThreshold && p.reduceMotion === 0 && side === 0) {
        // Head and chest snap away from the wall, the arms fly, and on a hard
        // hit his feet leave the floor.
        kick = (left ? 1 : -1) * impact * PHYS.recoilKick;
        if (supported && impact > PHYS.knockHop) {
          b.vy = Math.min(1.3, (impact - PHYS.knockHop) * 1.4 + 0.5);
          b.y = 0.001;
          b.airborneFrom = now;
        }
      }
    }
  }
  if (b.z < WORLD.zMin || b.z > b.zMax) {
    const front = b.z < WORLD.zMin;
    const impact = front ? -b.vz : b.vz;
    b.z = front ? WORLD.zMin : b.zMax;
    b.vz = (front ? 1 : -1) * bumpBack(b, impact, front ? 2 : 3, p, now, events);
  }

  // Once back in the open floor area, tighten the depth limit again.
  if (b.zMax > WORLD.zMax && b.z < WORLD.zMax && !(b.hasTarget === 1 && b.tz > WORLD.zMax)) b.zMax = WORLD.zMax;

  // Derived animation values.
  b.speed = Math.hypot(onWall ? b.vy : b.vx, b.vz);
  if (!onWall && Math.abs(b.vx) > 0.05) b.facing = b.vx > 0 ? 1 : -1;
  else if (steering && Math.abs(b.tx - b.x) > 0.03) b.facing = b.tx > b.x ? 1 : -1;
  b.walking = side === 0 && supported && steering && will > 0.5 && b.speed > 0.04 ? 1 : 0;
  if (b.walking === 1) b.walkPhase += b.speed * dt * 30;
  // Sliding, he leans back against the tilt to keep his balance.
  const leanTarget = b.walking === 1 ? clamp(b.vx * 0.3, -0.2, 0.2) : side === 0 ? clamp(-t.x * 0.25, -0.3, 0.3) : 0;
  b.lean += (leanTarget - b.lean) * Math.min(1, dt * 8);

  stepSquash(b, dt);
  stepRecoil(b, dAlong, kick, dt, p.reduceMotion);
}

export function stepBall(ball: BallState, b: BodyState, t: TiltState, p: PhysicsParams, dt: number, now: number, events: number[]): void {
  'worklet';
  if (ball.present === 0) return;
  const grounded = ball.y <= 0.0001 && ball.vy <= 0;
  // Rolls downhill when the phone tilts.
  if (p.tiltEnabled === 1) {
    ball.vx += t.x * PHYS.ballTiltAccel * dt;
    ball.vz += t.z * PHYS.ballTiltAccel * 0.85 * dt;
  }
  const f = Math.exp(-(grounded ? PHYS.ballFriction : 0.1) * dt);
  ball.vx *= f;
  ball.vz *= f;
  if (ball.y > 0 || ball.vy > 0) {
    ball.vy -= PHYS.gravity * dt;
    ball.y += ball.vy * dt;
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = -ball.vy > 0.35 ? -ball.vy * PHYS.ballFloorBounce : 0;
    }
  }

  ball.x += ball.vx * dt;
  ball.z += ball.vz * dt;
  const r = WORLD.ballR;
  if (ball.x < r) {
    ball.x = r;
    ball.vx = Math.abs(ball.vx) * PHYS.ballRestitution;
  } else if (ball.x > 1 - r) {
    ball.x = 1 - r;
    ball.vx = -Math.abs(ball.vx) * PHYS.ballRestitution;
  }
  if (ball.z < WORLD.zMin) {
    ball.z = WORLD.zMin;
    ball.vz = Math.abs(ball.vz) * PHYS.ballRestitution;
  } else if (ball.z > WORLD.ballZMax) {
    ball.z = WORLD.ballZMax;
    ball.vz = -Math.abs(ball.vz) * PHYS.ballRestitution;
  }
  ball.rot += (ball.vx / r) * dt;

  // Character nudges the ball (the character is much heavier, so it isn't pushed back).
  if (b.held === 0 && b.frozen === 0 && b.y < 0.2 && ball.y < 0.2) {
    const dx = ball.x - b.x;
    const dz = ball.z - b.z;
    const d = Math.hypot(dx, dz);
    const minD = PHYS.charRadius + r;
    if (d < minD) {
      const nx = d > 1e-4 ? dx / d : b.facing;
      const nz = d > 1e-4 ? dz / d : 0;
      ball.x = clamp(b.x + nx * minD, r, 1 - r);
      ball.z = clamp(b.z + nz * minD, WORLD.zMin, WORLD.ballZMax);
      const rel = (ball.vx - b.vx) * nx + (ball.vz - b.vz) * nz;
      if (rel < 0.05) {
        const impulse = -1.6 * Math.min(rel, 0) + 0.3;
        ball.vx += nx * impulse;
        ball.vz += nz * impulse;
        ball.vy += Math.min(0.9, impulse * 0.45);
        if (now - ball.lastHitAt > 0.3) {
          ball.lastHitAt = now;
          events.push(PhysicsEvent.BallHit, impulse, 0);
        }
      }
    }
  }
}
