import type { AccessoryId } from '../../content/appearance';
import type { CharacterState } from '../states';

/**
 * Cube World–style pixel stickman, drawn the way the toy's LCD figures are:
 * no face, a solid rounded 4×4 head, a 4-dot chest narrowing to a 2-dot
 * waist, slim arms (solid 1-dot lines), sturdier 2-dot legs (thighs angled out over
 * straight shins), and a toe on each foot. About 28 dots tall on the 60-dot screen.
 *
 * A skeleton is posed in dot units (x right from the body's center line,
 * u up from the floor), then every bone is stamped with a square brush onto
 * a GRID×GRID dot sprite, so each pose snaps to the grid like an LCD frame.
 *
 * Everything here is a pure worklet so the rig can redraw on the UI thread
 * every frame; the output is SVG path data in the sprite's 0..GRID viewBox.
 */
export const GRID = 36;
/** The body's center line runs between columns C-1 and C. */
const C = GRID / 2;
/** Lit dots overlap a hair so no seams show between them. */
const INSET = -0.02;
const DOT = 1 - INSET * 2;

const HIP_U = 15;
/** Hip to the top of the chest. */
const TORSO = 9;
/** Height of the top of the head above the floor when standing. */
export const HEAD_TOP_U = HIP_U + TORSO + 4;
const UPPER_ARM = 5;
const FOREARM = 5;
const THIGH = 7;
const SHIN = 8;
/** Resting arm angle from straight down (the classic A-shaped arms). */
const ARM_REST = 0.85;
/** Upper arms stop here; any further raise bends the forearm, so hands stay clear of the head. */
const ARM_MAX = 2.3;
const FEET_SPREAD = 4;
const HIP_X = 1;
/** Limb thickness in dots. */
const ARM_W = 1;
/** Legs are 2 dots (thighs read wider on the diagonal), heavier than the slim arms. */
const THIGH_W = 2;
const LEG_W = 2;
const SHOULDER_X = 2;

const STATE_ORDER: readonly CharacterState[] = [
  'idle',
  'walking',
  'lookingAround',
  'curious',
  'happy',
  'excited',
  'thinking',
  'listening',
  'sleeping',
  'surprised',
  'sad',
  'celebrating',
  'interacting',
  'dizzy',
  'held',
  'dancing',
  'sliding',
  'waving',
  'love',
  'hidden',
];
const S_IDLE = 0;
const S_LOOK = 2;
const S_CURIOUS = 3;
const S_HAPPY = 4;
const S_EXCITED = 5;
const S_THINKING = 6;
const S_LISTENING = 7;
const S_SLEEPING = 8;
const S_SURPRISED = 9;
const S_SAD = 10;
const S_CELEBRATING = 11;
const S_INTERACTING = 12;
const S_DIZZY = 13;
const S_HELD = 14;
const S_DANCING = 15;
const S_SLIDING = 16;
const S_LOVE = 18;

const ACCESSORY_ORDER: readonly AccessoryId[] = ['none', 'sprout', 'bow', 'beanie', 'headphones', 'scarf', 'crown'];

export const stateCode = (s: CharacterState) => STATE_ORDER.indexOf(s);
export const accessoryCode = (a: AccessoryId) => Math.max(0, ACCESSORY_ORDER.indexOf(a));

/**
 * Accessory dots in head-local cells: the 4×4 head spans columns -2..1 and
 * rows -2..1; negative rows are above it, row 2 is the top of the chest.
 * Flat [col, row, col, row, …] lists.
 */
const ACCESSORY_CELLS: readonly (readonly number[])[] = [
  [],
  [0, -3, 0, -4, -1, -5, 1, -5, 1, -4],
  [0, -3, 1, -3, 2, -3, 0, -4, 2, -4],
  [-2, -2, 1, -2, -2, -3, -1, -3, 0, -3, 1, -3, -1, -4, 0, -4],
  [-3, -1, -3, 0, 2, -1, 2, 0, -3, -2, 2, -2, -2, -3, -1, -3, 0, -3, 1, -3],
  [-3, 2, 2, 2, 2, 3, 3, 3, 3, 4],
  [-3, -3, -2, -3, -1, -3, 0, -3, 1, -3, 2, -3, -3, -4, -1, -4, 0, -4, 2, -4],
];

export interface StickmanInput {
  /** Seconds (the world clock). */
  t: number;
  /** Per-character offset so two stickmen don't fidget in sync. */
  seed: number;
  state: number;
  accessory: number;
  /** 1 normal, < 1 when reduce motion is on (fidgets and flourishes off). */
  motion: number;
  // body
  facing: number;
  walking: number;
  walkPhase: number;
  air: number;
  vy: number;
  squash: number;
  lean: number;
  /** 1 = knocked over by tilt (lying, head toward fallDir). */
  fallen: number;
  fallDir: number;
  // room edges, in dots from the body's center line / up from its feet
  roomL: number;
  roomR: number;
  roomT: number;
  // pose channels
  armL: number;
  armR: number;
  bounce: number;
  sway: number;
  lower: number;
  tilt: number;
  wave: number;
  lookX: number;
  spin: number;
  /**
   * Whole-body inertia from the physics (BodyState.recoil): + means the upper
   * body is thrown right. Hips, chest and head move by growing amounts and the
   * arms trail behind, so a knock ripples through the entire figure.
   */
  recoil: number;
  /** 0..1 after a hard knock: arms fly out, knees buckle, feet stagger. */
  flail: number;
}

export interface StickmanFrame {
  /** Lit body dots. */
  dots: string;
  /** Accessory dots. */
  acc: string;
  /** One-dot outline around everything, drawn in the panel color to mask what's behind. */
  halo: string;
  /** Whole-sprite hop height in dots. */
  lift: number;
}

export const IDLE_INPUT: StickmanInput = {
  t: 0,
  seed: 0,
  state: 0,
  accessory: 0,
  motion: 0,
  facing: 1,
  walking: 0,
  walkPhase: 0,
  air: 0,
  vy: 0,
  squash: 0,
  lean: 0,
  fallen: 0,
  fallDir: 1,
  roomL: 99,
  roomR: 99,
  roomT: 99,
  armL: 0,
  armR: 0,
  bounce: 0,
  sway: 0,
  lower: 0,
  tilt: 0,
  wave: 0,
  lookX: 0,
  spin: 0,
  recoil: 0,
  flail: 0,
};

function plot(grid: number[], c: number, r: number, v: number) {
  'worklet';
  if (c >= 0 && c < GRID && r >= 0 && r < GRID) grid[r * GRID + c] = v;
}

/** The dot column (relative to C) containing x, mirrored exactly about the center line. */
function symCell(x: number): number {
  'worklet';
  return x >= 0 ? Math.floor(x) : -Math.floor(-x) - 1;
}

/** Square brush of s×s dots centered on (x, u). Columns are mirror-exact about the center line. */
function stamp(grid: number[], x: number, u: number, s: number) {
  'worklet';
  const c0 = s % 2 === 1 ? C + symCell(x) - (s - 1) / 2 : C + (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(-x + 0.5)) - s / 2;
  const r0 = Math.round(GRID - u - s / 2);
  for (let r = r0; r < r0 + s; r++) for (let c = c0; c < c0 + s; c++) plot(grid, c, r, 1);
}

/** A bone `w` dots thick between two (already transformed) points. */
function bone(grid: number[], p: number[], a: number, b: number, w: number) {
  'worklet';
  if (w === 1) {
    // Arms: a 1-dot Bresenham line with every diagonal step filled in, so it
    // reads a touch heavier than 1 dot (and lighter than the 2-dot legs).
    // Columns round away from the center line so mirrored poses stay mirrored.
    let c0 = C + symCell(p[a]);
    let r0 = Math.round(GRID - p[a + 1] - 0.5);
    const c1 = C + symCell(p[b]);
    const r1 = Math.round(GRID - p[b + 1] - 0.5);
    const dc = Math.abs(c1 - c0);
    const dr = -Math.abs(r1 - r0);
    const sc = c0 < c1 ? 1 : -1;
    const sr = r0 < r1 ? 1 : -1;
    let err = dc + dr;
    for (let i = 0; i < 64; i++) {
      plot(grid, c0, r0, 1);
      if (c0 === c1 && r0 === r1) break;
      const e2 = 2 * err;
      const stepC = e2 >= dr;
      const stepR = e2 <= dc;
      if (stepC) {
        err += dr;
        c0 += sc;
      }
      if (stepR) {
        err += dc;
        if (stepC) plot(grid, c0, r0, 1);
        r0 += sr;
      }
    }
    return;
  }
  const dx = p[b] - p[a];
  const du = p[b + 1] - p[a + 1];
  const n = Math.max(1, Math.ceil(Math.hypot(dx, du) * 2));
  for (let i = 0; i <= n; i++) stamp(grid, p[a] + (dx * i) / n, p[a + 1] + (du * i) / n, w);
}

/** Two-bone IK: writes the middle joint and the (reach-clamped) end into p. */
function solve(p: number[], root: number, mid: number, end: number, tx: number, tu: number, a: number, b: number, side: number) {
  'worklet';
  const ax = p[root];
  const au = p[root + 1];
  const dx = tx - ax;
  const du = tu - au;
  const dist = Math.max(0.001, Math.hypot(dx, du));
  const d = Math.max(Math.abs(a - b) + 0.01, Math.min(dist, (a + b) * 0.999));
  const ux = dx / dist;
  const uu = du / dist;
  const along = (a * a + d * d - b * b) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  let nx = -uu;
  let nu = ux;
  // Bend outward (away from the body); a sideways limb bends downward.
  const flip = Math.abs(nx) < 0.2 ? nu > 0 : nx * side < 0;
  if (flip) {
    nx = -nx;
    nu = -nu;
  }
  p[mid] = ax + ux * along + nx * h;
  p[mid + 1] = au + uu * along + nu * h;
  p[end] = ax + ux * d;
  p[end + 1] = au + uu * d;
}

/** Forward kinematics for an arm: angle from straight down, then the elbow bend. */
function armFK(p: number[], sh: number, elbow: number, hand: number, side: number, raise: number, bend: number) {
  'worklet';
  const theta = Math.min(ARM_MAX, raise);
  bend += Math.min(0.6, Math.max(0, raise - ARM_MAX) * 0.8);
  const ex = p[sh] + side * Math.sin(theta) * UPPER_ARM;
  const eu = p[sh + 1] - Math.cos(theta) * UPPER_ARM;
  const phi = theta + bend;
  p[elbow] = ex;
  p[elbow + 1] = eu;
  p[hand] = ex + side * Math.sin(phi) * FOREARM;
  p[hand + 1] = eu - Math.cos(phi) * FOREARM;
}

function rand(n: number): number {
  'worklet';
  const h = Math.sin(n * 12.9898) * 43758.5453;
  return h - Math.floor(h);
}

// Joint slots in the point buffer (x, u pairs).
const HIP_L = 0;
const HIP_R = 2;
const WAIST = 4;
const CHEST = 6;
const SH_L = 8;
const SH_R = 10;
const ELB_L = 12;
const HAND_L = 14;
const ELB_R = 16;
const HAND_R = 18;
const KNEE_L = 20;
const FOOT_L = 22;
const KNEE_R = 24;
const FOOT_R = 26;
const HEAD = 28;
const POINTS = 30;

export interface StickmanRaster {
  /** GRID×GRID cells, row-major: 0 empty, 1 body, 2 accessory. */
  grid: number[];
  lift: number;
}

/** Poses the skeleton for this frame and rasterizes it to dots. */
export function rasterStickman(p: StickmanInput): StickmanRaster {
  'worklet';
  const lively = p.motion >= 1 ? 1 : 0;
  const m = p.motion;
  const t = p.t;
  // LCD frame time: flourishes advance in 12 fps steps.
  const tq = Math.floor(t * 12) / 12;
  const st = p.state;
  const grounded = p.air === 0;
  const walking = p.walking === 1 && grounded;

  let hipX = 0;
  let hipU = HIP_U;
  let chestDX = Math.max(-2.5, Math.min(2.5, p.lean * 7));
  let torso = TORSO;
  let crouch = Math.max(0, p.lower) + Math.max(0, p.squash) * 1.6;
  let spread = FEET_SPREAD;
  let footLU = 0;
  let footRU = 0;
  let footLX = 0;
  let footRX = 0;
  let armL = p.armL;
  let armR = p.armR;
  // Arms folded in past their sides bend at the elbow too.
  let bendL = p.armL < -0.5 ? p.armL * 0.9 : 0;
  let bendR = p.armR < -0.5 ? p.armR * 0.9 : 0;
  // IK hand targets relative to the top of the chest (NaN = use the arm angles).
  let reachLX = NaN;
  let reachLU = NaN;
  let reachRX = NaN;
  let reachRU = NaN;
  let lift = Math.abs(Math.sin(t * 7)) * p.bounce * 2.4 * m;
  let headDX = Math.round(Math.max(-1, Math.min(1, p.tilt * 8 + p.lookX)));
  let headDU = 0;
  let lie = 0;
  let lieDir = p.facing >= 0 ? 1 : -1;
  // Walking is drawn in profile: limbs swing toward/away from `facing`.
  let swingL = NaN;
  let swingR = NaN;
  let kneeSide = 0;
  let toes = grounded ? 1 : 0;

  // Sway: hips swing, shoulders counter-swing, feet stay planted.
  const sw = p.sway * Math.sin(tq * 5.2) * 1.3 * m;
  hipX += sw;
  chestDX -= sw * 0.6;

  bendR += p.wave * Math.sin(tq * 11) * 0.4;

  if (p.fallen === 1) {
    // Knocked over by the tilt: lying flat, sliding head-first.
    lie = 1;
    lieDir = p.fallDir >= 0 ? 1 : -1;
    armL = 1.2 + Math.sin(tq * 14) * 0.3 * m;
    armR = 1.2 - Math.sin(tq * 14) * 0.3 * m;
    spread = 2;
  } else if (walking) {
    // 8 frames per stride, side view.
    const ph = (Math.floor((p.walkPhase / (Math.PI * 2)) * 8) / 8) * Math.PI * 2;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    spread = 0;
    footLX = p.facing * s * 3.2;
    footRX = -p.facing * s * 3.2;
    footLU += Math.max(0, c) * 2 * m;
    footRU += Math.max(0, -c) * 2 * m;
    kneeSide = p.facing;
    hipU -= Math.abs(s) * 0.6 * m;
    swingL = -s * 0.6;
    swingR = s * 0.6;
    chestDX += p.facing * 0.8;
    headDX += p.facing;
  } else if (!grounded) {
    footLU += 2;
    footRU += 2;
    spread += 0.5;
    const up = p.vy > 0 ? 0.6 : 1.3;
    armL += up;
    armR += up;
    bendL += Math.sin(tq * 18) * 0.35 * m;
    bendR -= Math.sin(tq * 18) * 0.35 * m;
  }

  const beat = Math.floor(t * 2.5);
  if (p.fallen !== 1) {
    switch (st) {
      case S_LOOK:
        headDX = Math.round(Math.sin(tq * 1.7) * 1.3);
        break;
      case S_CURIOUS:
        chestDX += p.facing * 0.9;
        headDX += p.facing;
        crouch += 0.15;
        break;
      case S_HAPPY:
        bendL += Math.sin(tq * 8) * 0.3 * m;
        bendR -= Math.sin(tq * 8) * 0.3 * m;
        break;
      case S_EXCITED: {
        const k = Math.floor(tq * 10) % 2;
        bendL += (k ? 0.6 : -0.4) * m;
        bendR += (k ? -0.4 : 0.6) * m;
        if (grounded) {
          footLU += k * m;
          footRU += (1 - k) * m;
        }
        break;
      }
      case S_THINKING:
        // Hand on chin, other hand on hip, foot tapping.
        reachRX = 2.8;
        reachRU = 1.2;
        reachLX = -2.6;
        reachLU = -TORSO + 1.5;
        if (grounded) footRU += (Math.floor(tq * 4) % 2) * m;
        break;
      case S_LISTENING:
        // Hand cupped to the ear.
        reachRX = 3.2;
        reachRU = 3.5;
        break;
      case S_SLEEPING:
        // Lying on its side, arms along the body, knees a little bent.
        lie = 1;
        crouch = 0.2;
        spread = 1;
        armL = -0.55;
        armR = -0.55;
        bendL = 0;
        bendR = 0;
        break;
      case S_SURPRISED:
        spread += 1;
        bendL += 0.5;
        bendR += 0.5;
        break;
      case S_SAD:
        headDU -= 1;
        chestDX += 0.5;
        if (grounded && Math.sin(t * 1.3 + p.seed) > 0.93) footRU += 1;
        break;
      case S_CELEBRATING: {
        // Jumping jacks.
        const open = Math.floor(tq * 3.5) % 2 === 0;
        armL = open ? 1.9 : 0.4;
        armR = armL;
        spread = open ? 5.5 : 2;
        lift = open ? 2 * m : 0;
        break;
      }
      case S_INTERACTING:
        bendR += Math.sin(tq * 9) * 0.5 * m;
        break;
      case S_DIZZY:
        headDX += Math.round(Math.cos(tq * 7) * 1.2 * m);
        headDU += Math.round(Math.sin(tq * 7) * 0.8 * m);
        break;
      case S_HELD: {
        const k = Math.sin(tq * 9) * m;
        footLU += Math.max(0, k) * 2.5;
        footRU += Math.max(0, -k) * 2.5;
        break;
      }
      case S_DANCING: {
        const move = Math.floor(beat / 8) % 3;
        const odd = beat % 2;
        if (move === 0) {
          // Disco point.
          armL = odd ? 2.6 : 0.3;
          armR = odd ? 0.3 : 2.6;
          footLU += odd * 1.5 * m;
          footRU += (1 - odd) * 1.5 * m;
        } else if (move === 1) {
          // Hands in the air, waving.
          armL = 2.3;
          armR = 2.3;
          bendL = odd ? 0.7 : -0.5;
          bendR = odd ? -0.5 : 0.7;
        } else {
          // Squat pump.
          crouch += odd * 0.6;
          armL = 1.3;
          armR = 1.3;
          bendL = odd ? 0.9 : 0;
          bendR = bendL;
        }
        break;
      }
      case S_SLIDING:
        crouch += 0.5;
        break;
      case S_LOVE:
        // Hugging itself.
        reachLX = -1.2;
        reachLU = -2.5;
        reachRX = 1.2;
        reachRU = -2.5;
        break;
    }
  }

  // Idle fidgets: every few seconds, a short, randomly chosen bit of business.
  const settled = Math.abs(p.armL) + Math.abs(p.armR) + p.bounce + p.lower < 0.1;
  if (st === S_IDLE && grounded && !walking && lively && settled && p.fallen !== 1) {
    const period = 5.5 + rand(p.seed + 3) * 2;
    const at = t + p.seed * 1.7;
    const k = Math.floor(at / period);
    const lt = at - k * period;
    const kind = Math.floor(rand(k * 7 + p.seed * 13) * 8);
    if (lt < 2.4) {
      switch (kind) {
        case 1: // scratch head
          reachRX = 3;
          reachRU = 4.5 + (Math.floor(tq * 10) % 2);
          break;
        case 2: // look around
          headDX = Math.round(Math.sin(lt * 3) * 1.3);
          break;
        case 3: // tap foot
          footRU += Math.floor(tq * 6) % 2;
          break;
        case 4: // stretch
          armL = 2.6;
          armR = 2.6;
          torso += 1;
          break;
        case 5: // shift weight
          hipX += Math.round(Math.sin(lt * 2.6));
          break;
        case 6: // hands on hips
          reachLX = -2.6;
          reachLU = -TORSO + 1.5;
          reachRX = 2.6;
          reachRU = -TORSO + 1.5;
          break;
        case 7: // little hop
          if (lt > 0.5 && lt < 0.9) {
            lift = 2;
            armL += 0.8;
            armR += 0.8;
          }
          break;
      }
    }
  }

  // Whole-body inertia: when the body is jolted the hips shift a little, the
  // chest more and the head most, while the arms trail behind and the knees
  // give, so a knock travels through the entire figure instead of one side.
  const rc = Math.max(-1.3, Math.min(1.3, p.recoil)) * m;
  const fl = Math.max(0, Math.min(1, p.flail)) * m;
  const jit = Math.sin(tq * 23 + p.seed * 5);
  if (lie) {
    // Lying down the jolt runs along the body: the head and chest shove
    // toward the wall and spring back, the knees fold up.
    const along = rc * lieDir;
    headDU += Math.round(along * 1.5);
    torso += along;
    crouch += Math.abs(rc) * 0.4 + fl * 0.6;
    armL += fl * (1 + jit * 0.6);
    armR += fl * (1 - jit * 0.6);
  } else {
    hipX += rc * 0.9;
    chestDX += rc * 2.2;
    headDX += Math.round(rc * 1.2);
    if (Math.abs(rc) > 0.55) headDU -= 1;
    armL += rc * 0.9;
    armR -= rc * 0.9;
    bendL += rc * 0.5;
    bendR -= rc * 0.5;
    crouch += Math.abs(rc) * 0.25 + fl * 0.5;
    // Flail: arms thrown out, legs splayed, a staggering step to catch himself.
    armL += fl * (1.5 + jit * 0.5);
    armR += fl * (1.5 - jit * 0.5);
    bendL += fl * jit * 0.8;
    bendR -= fl * jit * 0.8;
    spread += fl * 1.5;
    if (grounded && fl > 0.15) {
      if (rc >= 0) {
        footRX += fl * 2.5;
        footRU += fl * 2;
      } else {
        footLX -= fl * 2.5;
        footLU += fl * 2;
      }
    }
  }

  // Breathing: the chest rises one dot on each breath.
  if (!walking && grounded && lively) torso += Math.sin(t * 2.3 + p.seed) > 0.35 ? 1 : 0;

  // Hops never push the head through the ceiling.
  if (!lie) lift = Math.min(lift, Math.max(0, p.roomT - HEAD_TOP_U));

  // ── Skeleton ──
  crouch = Math.min(1.3, crouch);
  hipU -= crouch * 3.5;
  const pt: number[] = new Array(POINTS).fill(0);
  const chestU = hipU + torso - crouch * 0.4;
  pt[HIP_L] = hipX - HIP_X;
  pt[HIP_L + 1] = hipU;
  pt[HIP_R] = hipX + HIP_X;
  pt[HIP_R + 1] = hipU;
  pt[WAIST] = hipX;
  pt[WAIST + 1] = hipU;
  pt[CHEST] = hipX + chestDX;
  pt[CHEST + 1] = chestU;
  pt[SH_L] = pt[CHEST] - SHOULDER_X;
  pt[SH_L + 1] = chestU - 1;
  pt[SH_R] = pt[CHEST] + SHOULDER_X;
  pt[SH_R + 1] = chestU - 1;
  pt[HEAD] = pt[CHEST] + headDX;
  pt[HEAD + 1] = chestU + 2 + headDU;

  if (!Number.isNaN(swingL)) {
    // Profile arms: swing forward/back, elbows bent forward.
    const f = p.facing >= 0 ? 1 : -1;
    armFK(pt, SH_L, ELB_L, HAND_L, f, swingL + Math.max(0, armL) * 0.5, 0.3);
    armFK(pt, SH_R, ELB_R, HAND_R, f, swingR + Math.max(0, armR) * 0.5, 0.3);
  } else {
    if (Number.isNaN(reachLX)) armFK(pt, SH_L, ELB_L, HAND_L, -1, ARM_REST + armL, bendL);
    else solve(pt, SH_L, ELB_L, HAND_L, pt[CHEST] + reachLX, chestU + reachLU, UPPER_ARM, FOREARM, -1);
    if (Number.isNaN(reachRX)) armFK(pt, SH_R, ELB_R, HAND_R, 1, ARM_REST + armR, bendR);
    else solve(pt, SH_R, ELB_R, HAND_R, pt[CHEST] + reachRX, chestU + reachRU, UPPER_ARM, FOREARM, 1);
  }

  // Arms never poke through the walls or the ceiling: against a wall the arm
  // straightens along it (down, or up if it was raised); under the ceiling the
  // hand presses flat against it.
  if (!lie) {
    const reach = (UPPER_ARM + FOREARM) * 0.98;
    for (let side = -1; side <= 1; side += 2) {
      const sh = side < 0 ? SH_L : SH_R;
      const el = side < 0 ? ELB_L : ELB_R;
      const hd = side < 0 ? HAND_L : HAND_R;
      const minX = -p.roomL + 1.2;
      const maxX = p.roomR - 1.2;
      const maxU = p.roomT - lift - 1.2;
      const outside = (x: number) => {
        'worklet';
        return x < minX || x > maxX;
      };
      if (outside(pt[hd]) || outside(pt[el])) {
        const up = pt[hd + 1] > pt[sh + 1];
        const x = Math.max(minX, Math.min(maxX, pt[sh]));
        solve(pt, sh, el, hd, x, pt[sh + 1] + (up ? reach : -reach), UPPER_ARM, FOREARM, side);
      }
      if (pt[hd + 1] > maxU) solve(pt, sh, el, hd, pt[hd], maxU, UPPER_ARM, FOREARM, side);
    }
  }

  // Feet stay inside the walls too (a narrower stance when pressed against one).
  const footMin = -p.roomL + 1.2;
  const footMax = p.roomR - 1.2;
  const clampFoot = (x: number) => {
    'worklet';
    return lie ? x : Math.max(footMin, Math.min(footMax, x));
  };
  solve(pt, HIP_L, KNEE_L, FOOT_L, clampFoot(-spread + footLX), 1 + footLU, THIGH, SHIN, kneeSide || -1);
  solve(pt, HIP_R, KNEE_R, FOOT_R, clampFoot(spread + footRX), 1 + footRU, THIGH, SHIN, kneeSide || 1);

  // ── Spin (mirror + narrow side view) and lying down ──
  const c = Math.cos(p.spin * Math.PI * 4);
  const mx = (c < 0 ? -1 : 1) * (Math.abs(c) < 0.45 ? 0.35 : 1);
  for (let i = 0; i < POINTS; i += 2) {
    const x = pt[i] * mx;
    const u = pt[i + 1];
    if (lie) {
      // Rotate a quarter turn so the head points toward lieDir, body flat on the floor.
      pt[i] = lieDir * (u - HEAD_TOP_U / 2);
      pt[i + 1] = 2.5 - lieDir * x * 0.45;
    } else {
      pt[i] = x;
    }
  }

  // ── Rasterize ──
  const grid: number[] = new Array(GRID * GRID).fill(0);
  // Torso: a 2-dot waist widening to a 4-dot chest.
  const tx0 = pt[WAIST];
  const tu0 = pt[WAIST + 1];
  const tx1 = pt[CHEST];
  const tu1 = pt[CHEST + 1];
  const len = Math.hypot(tx1 - tx0, tu1 - tu0);
  const steps = Math.max(2, Math.ceil(len * 2));
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const chest = k > 0.4;
    const s = chest ? 4 : 2;
    // Keep the brush inside the spine's ends.
    const kk = Math.max(1 / len, Math.min(1 - s / 2 / len, k));
    stamp(grid, tx0 + (tx1 - tx0) * kk, tu0 + (tu1 - tu0) * kk, s);
  }
  bone(grid, pt, HIP_L, KNEE_L, THIGH_W);
  bone(grid, pt, KNEE_L, FOOT_L, LEG_W);
  bone(grid, pt, HIP_R, KNEE_R, THIGH_W);
  bone(grid, pt, KNEE_R, FOOT_R, LEG_W);
  bone(grid, pt, SH_L, ELB_L, ARM_W);
  bone(grid, pt, ELB_L, HAND_L, ARM_W);
  bone(grid, pt, SH_R, ELB_R, ARM_W);
  bone(grid, pt, ELB_R, HAND_R, ARM_W);

  // Toes point outward (or ahead when walking) on feet that touch the floor.
  if (toes && !lie) {
    const toeL = walking ? p.facing : -1;
    const toeR = walking ? p.facing : 1;
    const toeFits = (x: number) => {
      'worklet';
      return x > -p.roomL + 0.5 && x < p.roomR - 0.5;
    };
    const tl = pt[FOOT_L] + toeL * (LEG_W / 2 + 0.5);
    const tr = pt[FOOT_R] + toeR * (LEG_W / 2 + 0.5);
    if (pt[FOOT_L + 1] < 1.5 && toeFits(tl)) stamp(grid, tl, pt[FOOT_L + 1] - 0.5, 1);
    if (pt[FOOT_R + 1] < 1.5 && toeFits(tr)) stamp(grid, tr, pt[FOOT_R + 1] - 0.5, 1);
  }

  // Head: a solid 4×4 block with rounded corners (cells -2..1 around its center).
  const hc = Math.round(C + pt[HEAD]);
  const hr = Math.round(GRID - pt[HEAD + 1]);
  const at = (lc: number, lr: number, v: number) => {
    'worklet';
    if (!lie) plot(grid, hc + lc, hr + lr, v);
    else if (lieDir > 0) plot(grid, hc - lr - 1, hr + lc, v);
    else plot(grid, hc + lr, hr - lc - 1, v);
  };
  for (let lr = -2; lr <= 1; lr++)
    for (let lc = -2; lc <= 1; lc++) {
      if ((lc === -2 || lc === 1) && (lr === -2 || lr === 1)) continue;
      at(lc, lr, 1);
    }

  const cells = ACCESSORY_CELLS[p.accessory] ?? ACCESSORY_CELLS[0];
  for (let i = 0; i < cells.length; i += 2) at(cells[i], cells[i + 1], 2);

  // Nothing passes through the screen's edges: whatever would is flattened against them.
  const minCol = Math.round(C - p.roomL);
  const maxCol = Math.round(C + p.roomR);
  const minRow = Math.round(GRID - (p.roomT - lift));
  for (let r = 0; r < GRID; r++)
    for (let col = 0; col < GRID; col++) if (col < minCol || col >= maxCol || r < minRow) grid[r * GRID + col] = 0;

  return { grid, lift };
}

/** One frame as SVG path data (viewBox 0..GRID). */
export function drawStickman(p: StickmanInput): StickmanFrame {
  'worklet';
  const { grid, lift } = rasterStickman(p);
  let dots = '';
  let acc = '';
  const halo: number[] = new Array(GRID * GRID).fill(0);
  for (let r = 0; r < GRID; r++) {
    for (let col = 0; col < GRID; col++) {
      const v = grid[r * GRID + col];
      if (v === 0) continue;
      const seg = `M${col + INSET} ${r + INSET}h${DOT}v${DOT}h-${DOT}z`;
      if (v === 1) dots += seg;
      else acc += seg;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) plot(halo, col + dc, r + dr, 1);
    }
  }
  let haloPath = '';
  for (let r = 0; r < GRID; r++) {
    let start = -1;
    for (let col = 0; col <= GRID; col++) {
      const on = col < GRID && halo[r * GRID + col] === 1;
      if (on && start < 0) start = col;
      else if (!on && start >= 0) {
        const len = col - start;
        // Rows overlap slightly so no hairline seams show between them.
        haloPath += `M${start} ${r - 0.03}h${len}v1.06h-${len}z`;
        start = -1;
      }
    }
  }

  return { dots, acc, halo: haloPath, lift };
}
