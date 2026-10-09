import { ceilingY, depthScale, floorY, unprojectFloor, WORLD, type RoomGeometry } from './geometry';
import { PhysicsEvent, type BallState, type BodyState, type PhysicsParams, type TiltState } from './types';

/**
 * Tuning for the character's "weight". Units: world units (room width = 1)
 * and seconds. Kept together so feel can be tuned in one place.
 */
export const PHYS = {
  tiltAccel: 4.2,
  tiltDepthAccel: 3.4,
  friction: 2.6,
  maxSpeed: 1.7,
  steerGain: 7,
  gravity: 6.5,
  wallRestitution: 0.35,
  bumpThreshold: 0.4,
  landThreshold: 0.9,
  deadzone: 0.035,
  filterTau: 0.08,
  tiltOn: 0.2,
  tiltOff: 0.1,
  tiltQuietSec: 0.8,
  dislodgeTilt: 0.45,
  ballTiltAccel: 5.2,
  ballFriction: 0.9,
  ballRestitution: 0.7,
  ballFloorBounce: 0.5,
  charRadius: 0.085,
  /** Sideways tilt that knocks the stickman over, and the calmer tilt at which he gets back up. */
  fallOn: 0.5,
  fallOff: 0.25,
  /** Tipping the screen's top edge down this far flips gravity toward the ceiling (and back below flipOff). */
  flipOn: 0.6,
  flipOff: 0.35,
  /** Whole-body recoil spring: stiffness, damping (underdamped, so it wobbles back), */
  recoilK: 120,
  recoilDamp: 5.5,
  /** how strongly velocity changes throw the upper body, */
  recoilInertia: 4,
  /** and how hard a wall knocks it back (per unit of impact speed). */
  recoilKick: 12,
  /** Impact speed above which the stickman is knocked off his feet and flails. */
  knockHop: 0.9,
  flailDecay: 1.5,
  /** Toppling: angular pull while falling over (grows as he tips, like a pole), */
  topple: 7,
  toppleGrow: 16,
  /** the springy get-up / settle, */
  rotK: 70,
  rotDamp: 13,
  /** how far past flat he crumples head-first into the corner (radians), */
  cornerTip: Math.PI / 4,
  /** and the extra pull toward the wall a hard sideways tilt adds while he's down. */
  sideGravity: 5,
  lyingFriction: 1.1,
  /** Standing on a side wall: how long he stays crumpled in the corner first, */
  wallStandAfter: 0.7,
  /** the sideways tilt that keeps the wall "down" (enter above `wallOn`, leave below `wallOff`), */
  wallOn: 0.78,
  wallOff: 0.45,
} as const;

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
 * Turn raw gravity into a smoothed, calibrated tilt vector.
 * Gravity points toward the ground in device coordinates (Reanimated reports
 * the same convention on iOS and Android), so lowering the left edge makes
 * x negative and the character slides left — like a marble.
 */
export function stepTilt(t: TiltState, p: PhysicsParams, dt: number, events: number[]): void {
  'worklet';
  let tx = 0;
  let tz = 0;
  if (p.tiltEnabled === 1 && t.hasRaw === 1) {
    if (p.calValid === 0 && t.autoValid === 0) {
      t.autoX = t.rawX;
      t.autoY = t.rawY;
      t.autoZ = t.rawZ;
      t.autoValid = 1;
    }
    const cx = p.calValid === 1 ? p.calX : t.autoX;
    const cy = p.calValid === 1 ? p.calY : t.autoY;
    tx = shapeTilt((t.rawX - cx) / 9.81, PHYS.deadzone) * p.sensitivity;
    tz = shapeTilt((t.rawY - cy) / 9.81, PHYS.deadzone) * p.sensitivity;
  }
  const a = 1 - Math.exp(-dt / PHYS.filterTau);
  t.x += (clamp(tx, -1.5, 1.5) - t.x) * a;
  t.z += (clamp(tz, -1.5, 1.5) - t.z) * a;

  const mag = Math.hypot(t.x, t.z);
  if (t.active === 0) {
    if (mag > PHYS.tiltOn) {
      t.active = 1;
      t.quietFor = 0;
      events.push(PhysicsEvent.TiltStart, mag, 0);
    }
  } else if (mag < PHYS.tiltOff) {
    t.quietFor += dt;
    if (t.quietFor > PHYS.tiltQuietSec) {
      t.active = 0;
      events.push(PhysicsEvent.TiltEnd, 0, 0);
    }
  } else {
    t.quietFor = 0;
  }
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
  b.fallen = 0;
  // Picked up, he's righted at once.
  b.rot = 0;
  b.rotV = 0;
  b.wall = 0;
  b.wallBlend = 0;
  b.wallT = 0;
  b.onCeil = 0;
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
 * Whole-body rotation. Knocked over, he topples toward `target` like a pole
 * (slow at first, faster as he tips), thuds and bounces when he lands, and
 * springs back otherwise (settling out of the corner, getting up).
 */
function stepRot(
  b: BodyState,
  target: number,
  dt: number,
  now: number,
  events: number[],
  reduceMotion: number,
  deliberate: boolean,
): void {
  'worklet';
  const err = target - b.rot;
  // A deliberate move (rolling onto the wall) is the controlled spring, never a free fall.
  const toppling = !deliberate && target !== 0 && Math.abs(target) > Math.abs(b.rot) + 0.01;
  if (toppling) {
    const dir = err > 0 ? 1 : -1;
    const before = Math.abs(b.rot);
    b.rotV += dir * (PHYS.topple + PHYS.toppleGrow * Math.abs(Math.sin(b.rot))) * dt;
    b.rot += b.rotV * dt;
    const impact = Math.abs(b.rotV);
    const landed = (target - b.rot) * dir <= 0;
    // Thud as his body slaps flat on the floor (or into the corner).
    if ((landed || (before < Math.PI / 2 && Math.abs(b.rot) >= Math.PI / 2)) && impact > 2.5 && now - b.lastLandAt > 0.25) {
      b.lastLandAt = now;
      events.push(PhysicsEvent.Land, impact * 0.3, 0);
      if (reduceMotion === 0) {
        b.squashV += impact * 0.6;
        knock(b, impact * 0.12);
        b.recoilV += -dir * impact * 0.8;
      }
    }
    if (landed) {
      // Bounce a little off the floor / wall; a gentle landing just comes to rest
      // (otherwise long frames keep it micro-bouncing and it never settles).
      b.rot = target;
      b.rotV = impact > 1.5 ? -b.rotV * 0.28 : 0;
    }
  } else {
    b.rotV += (err * PHYS.rotK - b.rotV * PHYS.rotDamp) * dt;
    b.rot += b.rotV * dt;
    if (Math.abs(err) < 0.002 && Math.abs(b.rotV) < 0.05) {
      b.rot = target;
      b.rotV = 0;
    }
  }
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

  const tiltMag = Math.hypot(t.x, t.z);

  // Gravity follows the device, like a Cube World toy: tip the screen's top
  // edge down far enough and the stickman falls up to the ceiling; tilt hard
  // sideways and he's knocked over and slides head-first into the wall.
  if (p.tiltEnabled === 1 && b.gUp === 0 && t.z > PHYS.flipOn) b.gUp = 1;
  else if (b.gUp === 1 && (p.tiltEnabled === 0 || t.z < PHYS.flipOff)) b.gUp = 0;
  const knocked = b.gUp === 1 || (p.tiltEnabled === 1 && Math.abs(t.x) > PHYS.fallOn);
  if (knocked && b.anchored === 0) {
    if (b.fallen === 0) b.fallDir = Math.abs(t.x) > 0.05 ? Math.sign(t.x) : b.facing;
    b.fallen = 1;
    b.hasTarget = 0;
    b.chase = 0;
  } else if (b.fallen > 0 && Math.abs(t.x) < PHYS.fallOff && b.y <= 0.0001) {
    // Back on the floor and the tilt has eased: get up after a moment.
    b.fallen = Math.max(0, b.fallen - dt * 1.6);
  }
  const lying = b.fallen > 0;

  if (b.anchored === 1) {
    if (tiltMag > PHYS.dislodgeTilt || b.gUp === 1) {
      // Tilted hard enough to tumble out of bed / off the cushion.
      b.anchored = 0;
      b.zMax = WORLD.zMax;
      b.vy = 1.1;
      events.push(PhysicsEvent.Dislodged, tiltMag, 0);
    } else {
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
      b.rot = 0;
      b.rotV = 0;
      b.wall = 0;
      b.wallBlend = 0;
      stepSquash(b, dt);
      stepRecoil(b, 0, 0, dt, p.reduceMotion);
      return;
    }
  }

  const vx0 = b.vx;
  const gdir = b.gUp === 1 ? -1 : 1;
  const grounded = b.y <= 0.0001 && b.vy <= 0 && gdir > 0;
  const airFactor = grounded ? 1 : 0.35;
  let ax = t.x * PHYS.tiltAccel * airFactor;
  let az = t.z * PHYS.tiltDepthAccel * airFactor;
  // Knocked over by a hard sideways tilt, that wall becomes "down": he falls
  // toward it rather than just sliding.
  if (lying && p.tiltEnabled === 1 && Math.abs(t.x) > PHYS.fallOff) ax += t.x * PHYS.sideGravity;

  const steering = b.hasTarget === 1 || b.chase === 1;
  if (steering) {
    const dx = b.tx - b.x;
    const dz = b.tz - b.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.012 && b.chase === 0) {
      b.hasTarget = 0;
      events.push(PhysicsEvent.Arrive, b.cmdId, 0);
    } else if (dist > 1e-4) {
      const desired = b.walkSpeed * p.speedBoost * Math.min(1, dist / 0.12);
      // Strong tilt overpowers walking — the character gets swept along.
      const will = lying ? 0 : 1 - Math.min(0.9, tiltMag * 2);
      ax += ((dx / dist) * desired - b.vx) * PHYS.steerGain * will * airFactor;
      az += ((dz / dist) * desired - b.vz) * PHYS.steerGain * will * airFactor;
    }
  }
  if (grounded && !steering) {
    const f = Math.exp(-(lying ? PHYS.lyingFriction : PHYS.friction) * dt);
    b.vx *= f;
    b.vz *= f;
  }

  b.vx += ax * dt;
  b.vz += az * dt;
  const sp = Math.hypot(b.vx, b.vz);
  if (sp > PHYS.maxSpeed) {
    b.vx *= PHYS.maxSpeed / sp;
    b.vz *= PHYS.maxSpeed / sp;
  }

  // Vertical: hops, drops, landings and bumping the ceiling.
  const yMax = ceilingY(g, b.z, lying);
  if (b.y > 0 || b.vy > 0 || gdir < 0) {
    b.vy -= PHYS.gravity * gdir * dt;
    b.y += b.vy * dt;
    if (b.y <= 0) {
      const impact = -b.vy;
      b.y = 0;
      if (impact > PHYS.landThreshold && now - b.lastLandAt > 0.25) {
        b.lastLandAt = now;
        events.push(PhysicsEvent.Land, impact, now - b.airborneFrom);
      }
      if (p.reduceMotion === 0) b.squashV += impact * 1.4;
      if (impact > 1.6) knock(b, (impact - 1.6) * 0.8);
      b.vy = impact > 1.6 ? impact * 0.22 : 0;
    }
    if (b.y >= yMax) {
      const impact = b.vy;
      b.y = yMax;
      if (impact > PHYS.bumpThreshold && now - b.lastBumpAt > 0.35) {
        b.lastBumpAt = now;
        events.push(PhysicsEvent.Bump, impact, 4);
        if (p.reduceMotion === 0) b.squashV += impact * 1.2;
        knock(b, impact * 0.5);
      }
      // Pressed against the ceiling while gravity points up; otherwise bounce back down.
      b.vy = gdir < 0 ? 0 : -impact * 0.3;
    }
  } else {
    b.airborneFrom = now;
  }
  b.onCeil = gdir < 0 && b.y >= yMax - 0.002 ? 1 : 0;

  // Velocity change from forces only (walls are handled as knocks below).
  const dvx = b.vx - vx0;
  b.x += b.vx * dt;
  b.z += b.vz * dt;

  // Walls: soft bounce, and tell JS about hard bumps (rate-limited).
  let bumpSpeed = 0;
  let bumpSide = -1;
  // Tipped over, the stickman is much wider: his head reaches the wall sooner.
  const half = bodyHalfX(b.rot);
  const xMin = half;
  const xMax = 1 - half;
  if (b.x < xMin) {
    b.x = xMin;
    if (-b.vx > bumpSpeed) {
      bumpSpeed = -b.vx;
      bumpSide = 0;
    }
    b.vx = -b.vx * PHYS.wallRestitution;
  } else if (b.x > xMax) {
    b.x = xMax;
    if (b.vx > bumpSpeed) {
      bumpSpeed = b.vx;
      bumpSide = 1;
    }
    b.vx = -b.vx * PHYS.wallRestitution;
  }
  if (b.z < WORLD.zMin) {
    b.z = WORLD.zMin;
    if (-b.vz > bumpSpeed) {
      bumpSpeed = -b.vz;
      bumpSide = 2;
    }
    b.vz = -b.vz * PHYS.wallRestitution;
  } else if (b.z > b.zMax) {
    b.z = b.zMax;
    if (b.vz > bumpSpeed) {
      bumpSpeed = b.vz;
      bumpSide = 3;
    }
    b.vz = -b.vz * PHYS.wallRestitution;
  }
  let kick = 0;
  if (bumpSide >= 0 && bumpSpeed > PHYS.bumpThreshold) {
    if (p.reduceMotion === 0) {
      b.squashV -= bumpSpeed * 1.2;
      // The whole body is knocked back from a side wall: head and chest snap
      // away, the arms fly, and on a hard hit his feet leave the floor.
      if (bumpSide <= 1) {
        kick = (bumpSide === 0 ? 1 : -1) * bumpSpeed * PHYS.recoilKick;
        if (!lying && grounded && bumpSpeed > PHYS.knockHop) {
          b.vy = Math.min(1.3, (bumpSpeed - PHYS.knockHop) * 1.4 + 0.5);
          b.y = 0.001;
          b.airborneFrom = now;
        }
      }
      knock(b, (bumpSpeed - 0.5) * 1.1);
    }
    if (now - b.lastBumpAt > 0.35) {
      b.lastBumpAt = now;
      events.push(PhysicsEvent.Bump, bumpSpeed, bumpSide);
    }
  }

  // Once back in the open floor area, tighten the depth limit again.
  if (b.zMax > WORLD.zMax && b.z < WORLD.zMax && !(b.hasTarget === 1 && b.tz > WORLD.zMax)) b.zMax = WORLD.zMax;

  // Derived animation values.
  b.speed = Math.hypot(b.vx, b.vz);
  if (Math.abs(b.vx) > 0.05) b.facing = b.vx > 0 ? 1 : -1;
  else if (steering && Math.abs(b.tx - b.x) > 0.03) b.facing = b.tx > b.x ? 1 : -1;
  b.walking = grounded && steering && b.speed > 0.04 && tiltMag < 0.3 ? 1 : 0;
  if (b.walking === 1) b.walkPhase += b.speed * dt * 30;
  const leanTarget = b.walking === 1 ? clamp(b.vx * 0.3, -0.2, 0.2) : clamp(-t.x * 0.25, -0.3, 0.3);
  b.lean += (leanTarget - b.lean) * Math.min(1, dt * 8);

  // Toppling over, crumpling head-first into the corner, then — while the tilt
  // holds that wall "down" — rolling over onto his feet to stand on it.
  let target = 0;
  let deliberate = false;
  if (b.wall !== 0) {
    if (p.tiltEnabled === 0 || b.gUp === 1 || t.x * b.wall < PHYS.wallOff) {
      // The tilt eased: the floor is the floor again. He's already on his feet,
      // so he just pivots back down onto it (3π/2 and -π/2 are the same pose).
      b.rot -= b.wall * Math.PI * 2;
      b.wall = 0;
      b.fallen = 0;
    } else {
      target = b.wall * Math.PI * 1.5;
      deliberate = true;
    }
  } else if (b.fallen > 0) {
    const dir = b.fallDir >= 0 ? 1 : -1;
    target = dir * (Math.PI / 2);
    // Near the wall he's falling toward (a little slack so he doesn't flicker in and out).
    const atWall = dir > 0 ? b.x >= xMax - 0.03 : b.x <= xMin + 0.03;
    const hard = p.tiltEnabled === 1 && b.gUp === 0 ? clamp((Math.abs(t.x) - 0.6) / 0.35, 0, 1) : 0;
    if (atWall && t.x * dir > 0) target += dir * PHYS.cornerTip * hard;
    const settled = atWall && t.x * dir > PHYS.wallOn && Math.abs(b.rotV) < 0.6 && Math.abs(b.rot - target) < 0.12;
    b.wallT = settled ? b.wallT + dt : 0;
    if (b.wallT > PHYS.wallStandAfter) {
      b.wall = dir;
      b.wallT = 0;
      target = dir * Math.PI * 1.5;
      deliberate = true;
    }
  } else {
    b.wallT = 0;
  }
  stepRot(b, target, dt, now, events, p.reduceMotion, deliberate);
  b.wallBlend += ((b.wall !== 0 ? 1 : 0) - b.wallBlend) * Math.min(1, dt * 5);
  // Rotating can widen him past a wall: shove him back out.
  const half2 = bodyHalfX(b.rot);
  b.x = clamp(b.x, half2, 1 - half2);

  stepSquash(b, dt);
  stepRecoil(b, dvx, kick, dt, p.reduceMotion);
}

export function stepBall(ball: BallState, b: BodyState, t: TiltState, dt: number, now: number, events: number[]): void {
  'worklet';
  if (ball.present === 0) return;
  const grounded = ball.y <= 0.0001 && ball.vy <= 0;
  ball.vx += t.x * PHYS.ballTiltAccel * dt;
  ball.vz += t.z * PHYS.ballTiltAccel * 0.85 * dt;
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
