import type { AccessoryId } from '../../content/appearance';
import type { CharacterState } from '../states';

/**
 * Cube World–style pixel stickman, copied dot for dot from the toy's LCD
 * figure (21 dots tall): a 4×4 head with its top corners cut, a 2-dot neck,
 * a collar and shoulder bar, short stepped 1-dot arms, a 2-dot spine, a hip
 * bar and 2-dot legs that step out once at the knee, with a toe on each foot.
 *
 *   ........##........
 *   .......####.......
 *   .......####.......
 *   .......####.......
 *   ........##........
 *   ......######......
 *   .....########.....
 *   .....#..##..#.....
 *   ....##..##..##....
 *   ....#...##...#....
 *   ...##...##...##...
 *   ........##........
 *   .......####.......
 *   ......##..##......
 *   ......##..##......
 *   .....##....##.....   (×5)
 *   ....###....###....
 *
 * A skeleton is posed in dot units (x right from the body's center line,
 * u up from the floor), rotated as a whole when the figure tips over, then
 * every bone is drawn row by row (or column by column) onto a GRID×GRID dot
 * sprite with mirror-exact rounding, so the rest pose reproduces the toy's
 * figure exactly and every other pose snaps to the grid like an LCD frame.
 *
 * Everything here is a pure worklet so the rig can redraw on the UI thread
 * every frame; the output is SVG path data in the sprite's 0..GRID viewBox.
 */
export const GRID = 32;
/** The body's center line runs between columns C-1 and C. */
const C = GRID / 2;
/** Lit dots overlap a hair so no seams show between them. */
const INSET = -0.02;
const DOT = 1 - INSET * 2;

/** Height of the hip bar (dot-row centers sit on .5). */
const HIP_U = 8.5;
/** Hip bar to the shoulder bar. */
const TORSO = 6;
/** Shoulder bar to the head's center. */
const HEAD_ABOVE = 4.5;
/** Height of the top of the head above the floor when standing. */
export const HEAD_TOP_U = HIP_U + TORSO + HEAD_ABOVE + 2;
/** Shoulder joints sit at the ends of the 8-dot shoulder bar. */
const SHOULDER_X = 3.5;
/** Each arm bone runs 1 across and 2 down at rest: the toy's stepped arm. */
const UPPER_ARM = Math.sqrt(5);
const FOREARM = Math.sqrt(5);
/** Resting arm angle from straight down. */
const ARM_REST = Math.atan2(1, 2);
/** Upper arms stop here; any further raise bends the forearm, so hands stay clear of the head. */
const ARM_MAX = 2.3;
/** Hip joints, just under the hip bar; feet rest one dot further out. */
const HIP_X = 2;
const HIP_JOINT_DROP = 1;
const FEET_SPREAD = 3;
/** Thigh drops 2 rows and steps out 1; the shin runs straight down. */
const THIGH = Math.sqrt(5);
const SHIN = 5;
/** Limb thickness in dots. */
const ARM_W = 1;
const LEG_W = 2;
/** Lying on its side the figure is seen edge-on, this much narrower. */
const SIDE_SQUISH = 0.45;

/**
 * How far the standing figure, turned by `rot` about its middle, drops so its
 * lowest point rests on the floor (dots) — so turned onto his side he lies
 * along the floor against the border instead of hanging in mid-air.
 */
export function turnDrop(rot: number): number {
  'worklet';
  const mid = HEAD_TOP_U / 2;
  const lowest = mid - mid * Math.abs(Math.cos(rot)) - 6 * Math.abs(Math.sin(rot));
  return Math.max(0, lowest);
}

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
  /**
   * Whole-figure turn in radians (BodyState.rot: which side is "down" for him plus
   * any shake spin), + clockwise. The figure turns in place about its middle.
   */
  rot: number;
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
  rot: 0,
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

/** Cell (relative to C) containing x; a point on a cell edge goes to the cell nearer the center line. Mirror-exact. */
function cellIn(x: number): number {
  'worklet';
  return x > 0 ? Math.ceil(x) - 1 : -Math.ceil(-x);
}

/** Nearest cell edge to x, ties toward the center line. Mirror-exact. */
function edgeNear(x: number): number {
  'worklet';
  return x >= 0 ? Math.ceil(x - 0.5) : -Math.ceil(-x - 0.5);
}

/** First cell (relative to C) of a run `w` cells wide centered on x. */
function runStart(x: number, w: number): number {
  'worklet';
  return w % 2 === 1 ? cellIn(x) - (w - 1) / 2 : edgeNear(x) - w / 2;
}

/** Grid row of the dot level `l` (level 0 = the bottom row). */
function rowOf(l: number): number {
  'worklet';
  return GRID - 1 - l;
}

/**
 * A bone `w` dots thick from (x0, u0) to (x1, u1). Steep bones are drawn one
 * dot row at a time (a `w`-wide run per row), shallow ones one column at a
 * time; each run is stretched to touch the previous one so the line never
 * breaks into diagonal-only steps.
 */
function bone(grid: number[], x0: number, u0: number, x1: number, u1: number, w: number) {
  'worklet';
  const dx = x1 - x0;
  const du = u1 - u0;
  let prevA = NaN;
  let prevB = NaN;
  if (Math.abs(du) >= Math.abs(dx)) {
    const lo = Math.min(u0, u1);
    const hi = Math.max(u0, u1);
    const l0 = Math.floor(lo + 1e-6);
    const l1 = Math.floor(hi - 1e-6);
    // Walk from u0 toward u1 so the joining runs stretch the right way.
    const step = u1 >= u0 ? 1 : -1;
    const first = step > 0 ? l0 : l1;
    const last = step > 0 ? l1 : l0;
    for (let l = first; step > 0 ? l <= last : l >= last; l += step) {
      const uc = Math.max(lo, Math.min(hi, l + 0.5));
      const x = du === 0 ? x0 : x0 + (dx * (uc - u0)) / du;
      let a = C + runStart(x, w);
      let b = a + w - 1;
      if (!Number.isNaN(prevA)) {
        if (a > prevB) a = prevB;
        if (b < prevA) b = prevA;
      }
      for (let c = a; c <= b; c++) plot(grid, c, rowOf(l), 1);
      prevA = a;
      prevB = b;
    }
  } else {
    const lo = Math.min(x0, x1);
    const hi = Math.max(x0, x1);
    const k0 = cellIn(lo + 1e-6);
    const k1 = cellIn(hi - 1e-6);
    const step = x1 >= x0 ? 1 : -1;
    const first = step > 0 ? k0 : k1;
    const last = step > 0 ? k1 : k0;
    for (let k = first; step > 0 ? k <= last : k >= last; k += step) {
      const xc = Math.max(lo, Math.min(hi, k + 0.5));
      const u = u0 + (du * (xc - x0)) / dx;
      let a = w % 2 === 0 ? Math.round(u) - w / 2 : Math.floor(u) - (w - 1) / 2;
      let b = a + w - 1;
      if (!Number.isNaN(prevA)) {
        if (a > prevB) a = prevB;
        if (b < prevA) b = prevA;
      }
      for (let l = a; l <= b; l++) plot(grid, C + k, rowOf(l), 1);
      prevA = a;
      prevB = b;
    }
  }
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
// Bars and spine ends, transformed with the joints.
const PEL_L = 30;
const PEL_R = 32;
const SPINE_LO = 34;
const SPINE_HI = 36;
const BAR_L = 38;
const BAR_R = 40;
const COL_L = 42;
const COL_R = 44;
const POINTS = 46;

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
  let chestDX = Math.max(-2, Math.min(2, p.lean * 6));
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
  // Sleeping lies on its side (a quarter turn, resting on the floor); the room's
  // orientation then turns the whole figure in place.
  let lieRot = 0;
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

  if (walking) {
    // 8 frames per stride, side view.
    const ph = (Math.floor((p.walkPhase / (Math.PI * 2)) * 8) / 8) * Math.PI * 2;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    spread = 0;
    footLX = p.facing * s * 2.2;
    footRX = -p.facing * s * 2.2;
    footLU += Math.max(0, c) * 1.5 * m;
    footRU += Math.max(0, -c) * 1.5 * m;
    kneeSide = p.facing;
    hipU -= Math.abs(s) * 0.4 * m;
    swingL = -s * 0.6;
    swingR = s * 0.6;
    chestDX += p.facing * 0.8;
    headDX += p.facing;
  } else if (!grounded) {
    footLU += 1.5;
    footRU += 1.5;
    spread += 0.5;
    const up = p.vy > 0 ? 0.6 : 1.3;
    armL += up;
    armR += up;
    bendL += Math.sin(tq * 18) * 0.35 * m;
    bendR -= Math.sin(tq * 18) * 0.35 * m;
  }

  const beat = Math.floor(t * 2.5);
  {
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
        reachRX = 2.5;
        reachRU = 2.5;
        reachLX = -2.6;
        reachLU = -TORSO + 1.5;
        if (grounded) footRU += (Math.floor(tq * 4) % 2) * m;
        break;
      case S_LISTENING:
        // Hand cupped to the ear.
        reachRX = 2.8;
        reachRU = 4;
        break;
      case S_SLEEPING:
        // Lying on its side, arms along the body, knees a little bent.
        lieRot = (p.facing >= 0 ? 1 : -1) * (Math.PI / 2);
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
        spread = open ? 4.5 : 2;
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
        footLU += Math.max(0, k) * 2;
        footRU += Math.max(0, -k) * 2;
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
  if (st === S_IDLE && grounded && !walking && lively && settled) {
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
  const lie = lieRot !== 0;
  const lieDir = lieRot >= 0 ? 1 : -1;
  const turn = p.rot;
  const rot = lieRot + turn;
  const upright = !lie && Math.abs(turn) < 0.05;
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
    chestDX += rc * 1.8;
    headDX += Math.round(rc * 1.2);
    if (Math.abs(rc) > 0.55) headDU -= 1;
    armL += rc * 0.9;
    armR -= rc * 0.9;
    bendL += rc * 0.5;
    bendR -= rc * 0.5;
    crouch += Math.abs(rc) * 0.25 + fl * 0.5;
    // Flail: arms thrown out, legs splayed, a staggering step to catch himself.
    armL += fl * (1.9 + jit * 0.5);
    armR += fl * (1.9 - jit * 0.5);
    bendL += fl * jit * 0.8;
    bendR -= fl * jit * 0.8;
    spread += fl * 1.5;
    if (grounded && upright && fl > 0.15) {
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
  hipU -= crouch * 2.2;
  const pt: number[] = new Array(POINTS).fill(0);
  const chestU = hipU + torso - crouch * 0.3;
  const hipJ = hipU - HIP_JOINT_DROP;
  pt[HIP_L] = hipX - HIP_X;
  pt[HIP_L + 1] = hipJ;
  pt[HIP_R] = hipX + HIP_X;
  pt[HIP_R + 1] = hipJ;
  pt[WAIST] = hipX;
  pt[WAIST + 1] = hipU;
  pt[CHEST] = hipX + chestDX;
  pt[CHEST + 1] = chestU;
  pt[SH_L] = pt[CHEST] - SHOULDER_X;
  pt[SH_L + 1] = chestU;
  pt[SH_R] = pt[CHEST] + SHOULDER_X;
  pt[SH_R + 1] = chestU;
  pt[HEAD] = pt[CHEST] + headDX;
  pt[HEAD + 1] = chestU + HEAD_ABOVE + headDU;
  pt[PEL_L] = hipX - 1.5;
  pt[PEL_L + 1] = hipU;
  pt[PEL_R] = hipX + 1.5;
  pt[PEL_R + 1] = hipU;
  pt[SPINE_LO] = hipX;
  pt[SPINE_LO + 1] = hipU + 1;
  pt[SPINE_HI] = pt[CHEST];
  pt[SPINE_HI + 1] = chestU - 1;
  pt[BAR_L] = pt[CHEST] - 3.5;
  pt[BAR_L + 1] = chestU;
  pt[BAR_R] = pt[CHEST] + 3.5;
  pt[BAR_R + 1] = chestU;
  pt[COL_L] = pt[CHEST] - 2.5;
  pt[COL_L + 1] = chestU + 1;
  pt[COL_R] = pt[CHEST] + 2.5;
  pt[COL_R + 1] = chestU + 1;

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

  // Shoulders aren't bolted on: an arm raised toward (or over) its shoulder
  // lifts that shoulder in a shrug of up to 1.5 dots, pulled in a little; the
  // shoulder bar runs between the two shoulders, so it tilts with them, and the
  // collar follows halfway. Hanging arms (the rest pose) leave them level.
  for (let side = -1; side <= 1; side += 2) {
    const sh = side < 0 ? SH_L : SH_R;
    const el = side < 0 ? ELB_L : ELB_R;
    const hd = side < 0 ? HAND_L : HAND_R;
    const shrug = Math.max(0, Math.min(1.5, (pt[hd + 1] - pt[sh + 1] + 1) * 0.4)) * (lively ? 1 : 0.6);
    if (shrug > 0) {
      const dx = -side * shrug * 0.3;
      pt[sh] += dx;
      pt[sh + 1] += shrug;
      pt[el] += dx;
      pt[el + 1] += shrug;
      pt[hd] += dx;
      pt[hd + 1] += shrug;
    }
  }
  pt[BAR_L] = pt[SH_L];
  pt[BAR_L + 1] = pt[SH_L + 1];
  pt[BAR_R] = pt[SH_R];
  pt[BAR_R + 1] = pt[SH_R + 1];
  pt[COL_L + 1] = chestU + 1 + (pt[SH_L + 1] - chestU) * 0.5;
  pt[COL_R + 1] = chestU + 1 + (pt[SH_R + 1] - chestU) * 0.5;

  // Arms never poke through the walls or the ceiling: against a wall the arm
  // straightens along it (down, or up if it was raised); under the ceiling the
  // hand presses flat against it.
  if (upright) {
    const reach = (UPPER_ARM + FOREARM) * 0.98;
    for (let side = -1; side <= 1; side += 2) {
      const sh = side < 0 ? SH_L : SH_R;
      const el = side < 0 ? ELB_L : ELB_R;
      const hd = side < 0 ? HAND_L : HAND_R;
      const minX = -p.roomL + 1;
      const maxX = p.roomR - 1;
      const maxU = p.roomT - lift - 1;
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
  const footMin = -p.roomL + 1.5;
  const footMax = p.roomR - 1.5;
  const clampFoot = (x: number) => {
    'worklet';
    return upright ? Math.max(footMin, Math.min(footMax, x)) : x;
  };
  solve(pt, HIP_L, KNEE_L, FOOT_L, clampFoot(-spread + footLX), 0.5 + footLU, THIGH, SHIN, kneeSide || -1);
  solve(pt, HIP_R, KNEE_R, FOOT_R, clampFoot(spread + footRX), 0.5 + footRU, THIGH, SHIN, kneeSide || 1);

  // ── Spin (mirror + narrow side view), lying down, and turning with the room ──
  const c = Math.cos(p.spin * Math.PI * 4);
  const mx = (c < 0 ? -1 : 1) * (Math.abs(c) < 0.45 ? 0.35 : 1);
  if (upright) {
    for (let i = 0; i < POINTS; i += 2) pt[i] *= mx;
  } else {
    let pivot = HEAD_TOP_U / 2;
    if (lie) {
      // Asleep: a quarter turn onto his side, seen edge-on, resting on the floor.
      const sn = Math.sin(lieRot);
      const cs = Math.cos(lieRot);
      const squish = mx * (1 - SIDE_SQUISH);
      let minU = Infinity;
      for (let i = 0; i < POINTS; i += 2) {
        const x = pt[i] * squish;
        const u = pt[i + 1] - pivot;
        pt[i] = x * cs + u * sn;
        pt[i + 1] = -x * sn + u * cs + pivot;
        minU = Math.min(minU, pt[i + 1]);
      }
      minU = Math.min(minU, pt[HEAD + 1] - 2 + 0.5);
      const drop = 0.5 - minU;
      for (let i = 1; i < POINTS; i += 2) pt[i] += drop;
      pivot = 2.5;
    } else {
      for (let i = 0; i < POINTS; i += 2) pt[i] *= mx;
    }
    if (Math.abs(turn) > 0.0005) {
      // Standing on a wall (or the ceiling): spin the whole figure about its middle, then let it
      // settle onto the floor (gravity has already pushed him against the border).
      const sn = Math.sin(turn);
      const cs = Math.cos(turn);
      const drop = lie ? 0 : turnDrop(turn);
      for (let i = 0; i < POINTS; i += 2) {
        const x = pt[i];
        const u = pt[i + 1] - pivot;
        pt[i] = x * cs + u * sn;
        pt[i + 1] = -x * sn + u * cs + pivot - drop;
      }
    }
  }

  // ── Rasterize ──
  const grid: number[] = new Array(GRID * GRID).fill(0);
  const seg = (a: number, b: number, w: number) => {
    'worklet';
    bone(grid, pt[a], pt[a + 1], pt[b], pt[b + 1], w);
  };
  // Hip bar, spine, shoulder bar and collar, then the limbs.
  seg(PEL_L, PEL_R, 1);
  seg(SPINE_LO, SPINE_HI, 2);
  seg(BAR_L, BAR_R, 1);
  seg(COL_L, COL_R, 1);
  seg(HIP_L, KNEE_L, LEG_W);
  seg(KNEE_L, FOOT_L, LEG_W);
  seg(HIP_R, KNEE_R, LEG_W);
  seg(KNEE_R, FOOT_R, LEG_W);
  seg(SH_L, ELB_L, ARM_W);
  seg(ELB_L, HAND_L, ARM_W);
  seg(SH_R, ELB_R, ARM_W);
  seg(ELB_R, HAND_R, ARM_W);

  // Toes point outward (or ahead when walking) on feet that touch the floor.
  if (toes && upright) {
    const toeL = walking ? p.facing : -1;
    const toeR = walking ? p.facing : 1;
    const toeFits = (x: number) => {
      'worklet';
      return x > -p.roomL + 0.5 && x < p.roomR - 0.5;
    };
    const tl = pt[FOOT_L] + toeL * (LEG_W / 2 + 0.5);
    const tr = pt[FOOT_R] + toeR * (LEG_W / 2 + 0.5);
    if (pt[FOOT_L + 1] < 1 && toeFits(tl)) plot(grid, C + cellIn(tl), rowOf(0), 1);
    if (pt[FOOT_R + 1] < 1 && toeFits(tr)) plot(grid, C + cellIn(tr), rowOf(0), 1);
  }

  // Head: a solid 4×4 block with its top corners cut, over a 2-dot neck
  // (cells -2..1 around its center), turned in quarter steps as it tips.
  const hc = Math.round(C + pt[HEAD]);
  const hr = Math.round(GRID - pt[HEAD + 1]);
  // Quarter turns, folded into -1..2 (3π/2 on a wall is the same as -π/2).
  const q4 = (((Math.round(rot / (Math.PI / 2)) % 4) + 4) % 4) as number;
  const q = q4 === 3 ? -1 : q4;
  const at = (lc: number, lr: number, v: number) => {
    'worklet';
    if (q === 0) plot(grid, hc + lc, hr + lr, v);
    else if (q === 1) plot(grid, hc - lr - 1, hr + lc, v);
    else if (q === -1) plot(grid, hc + lr, hr - lc - 1, v);
    else plot(grid, hc - lc - 1, hr - lr - 1, v);
  };
  for (let lr = -2; lr <= 1; lr++)
    for (let lc = -2; lc <= 1; lc++) {
      if ((lc === -2 || lc === 1) && lr === -2) continue;
      at(lc, lr, 1);
    }
  at(-1, 2, 1);
  at(0, 2, 1);

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
