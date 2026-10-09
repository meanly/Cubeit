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
  b.onCeil = 0;
  b.lean += (clamp(-b.vx * 0.25, -0.35, 0.35) - b.lean) * Math.min(1, dt * 10);
}

function stepSquash(b: BodyState, dt: number): void {
  'worklet';
  b.squashV += (-170 * b.squash - 13 * b.squashV) * dt;
  b.squash = clamp(b.squash + b.squashV * dt, -0.35, 0.45);
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
    return;
  }
  if (b.held === 1) {
    stepHeld(b, g, dt);
    stepSquash(b, dt);
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
      stepSquash(b, dt);
      return;
    }
  }

  const gdir = b.gUp === 1 ? -1 : 1;
  const grounded = b.y <= 0.0001 && b.vy <= 0 && gdir > 0;
  const airFactor = grounded ? 1 : 0.35;
  let ax = t.x * PHYS.tiltAccel * airFactor;
  let az = t.z * PHYS.tiltDepthAccel * airFactor;

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
    const f = Math.exp(-PHYS.friction * dt);
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
      b.vy = impact > 1.6 ? impact * 0.22 : 0;
    }
    if (b.y >= yMax) {
      const impact = b.vy;
      b.y = yMax;
      if (impact > PHYS.bumpThreshold && now - b.lastBumpAt > 0.35) {
        b.lastBumpAt = now;
        events.push(PhysicsEvent.Bump, impact, 4);
        if (p.reduceMotion === 0) b.squashV += impact * 1.2;
      }
      // Pressed against the ceiling while gravity points up; otherwise bounce back down.
      b.vy = gdir < 0 ? 0 : -impact * 0.3;
    }
  } else {
    b.airborneFrom = now;
  }
  b.onCeil = gdir < 0 && b.y >= yMax - 0.002 ? 1 : 0;

  b.x += b.vx * dt;
  b.z += b.vz * dt;

  // Walls: soft bounce, and tell JS about hard bumps (rate-limited).
  let bumpSpeed = 0;
  let bumpSide = -1;
  // Lying down, the stickman is much longer: his head reaches the wall sooner.
  const xMin = lying ? WORLD.lieHalf : WORLD.xMin;
  const xMax = lying ? 1 - WORLD.lieHalf : WORLD.xMax;
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
  if (bumpSide >= 0 && bumpSpeed > PHYS.bumpThreshold) {
    if (p.reduceMotion === 0) {
      b.squashV -= bumpSpeed * 1.2;
      // The head is knocked back from the wall.
      if (bumpSide <= 1) b.lean = clamp(b.lean + (bumpSide === 0 ? 1 : -1) * Math.min(0.35, bumpSpeed * 0.3), -0.4, 0.4);
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
  stepSquash(b, dt);
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
