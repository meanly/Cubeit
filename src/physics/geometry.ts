import { LCD_DOTS } from '../lcd/bitmap';

/**
 * The room is a 1 × 1 floor (x across, z into the room) drawn flat, like a
 * handheld LCD: no perspective or depth scaling. Depth only lifts things a
 * few dots up a ground strip at the bottom of the screen (FLOOR_DOTS tall).
 * y is height above the floor, in the same units as x. These pure functions
 * are worklets so the UI thread can project positions every frame without
 * touching React.
 */
export interface RoomGeometry {
  width: number;
  height: number;
  bezel: number;
  /** Front opening (the cube's "screen"). */
  L0: number;
  R0: number;
  T0: number;
  B0: number;
  /** Back wall rectangle. */
  bL: number;
  bR: number;
  bT: number;
  bB: number;
  /** Scale of the back wall relative to the front opening. */
  k: number;
  /** Pixels per world unit. */
  unit: number;
  /** Pixels per LCD dot. */
  dot: number;
}

/** Depth of the ground strip, in dots: z = 1 sits this far above the bottom edge. */
export const FLOOR_DOTS = 6;

/** Half the stickman's shoulder width: his body and head touch the side walls at this distance. */
const BODY_HALF = 3 / LCD_DOTS;

export const WORLD = {
  /** The stickman stands 21 dots tall; hit-testing uses a 12-dot-wide box. */
  charHeight: 21 / LCD_DOTS,
  charWidth: 12 / LCD_DOTS,
  /** Lying down (knocked over): 5 dots tall, 21 long, centered on x. */
  lieHeight: 5 / LCD_DOTS,
  lieHalf: 10.5 / LCD_DOTS,
  xMin: BODY_HALF,
  xMax: 1 - BODY_HALF,
  zMin: 0,
  zMax: 0.7,
  /** Deeper z allowed while visiting furniture at the back. */
  zMaxInteract: 0.93,
  ballR: 3 / LCD_DOTS,
  ballZMax: 0.82,
} as const;

/** The LCD fills the whole box; the "back wall" is the screen itself, minus the ground strip. */
export function makeGeometry(width: number, height: number): RoomGeometry {
  const dot = width / LCD_DOTS;
  return {
    width,
    height,
    bezel: 0,
    L0: 0,
    R0: width,
    T0: 0,
    B0: height,
    k: 1,
    unit: width,
    dot,
    bL: 0,
    bR: width,
    bT: 0,
    bB: height - FLOOR_DOTS * dot,
  };
}

export function depthScale(g: RoomGeometry, z: number): number {
  'worklet';
  return 1 - (1 - g.k) * z;
}

export function floorY(g: RoomGeometry, z: number): number {
  'worklet';
  return g.B0 + (g.bB - g.B0) * z;
}

export function projectX(g: RoomGeometry, x: number, z: number): number {
  'worklet';
  const left = g.L0 + (g.bL - g.L0) * z;
  const right = g.R0 + (g.bR - g.R0) * z;
  return left + (right - left) * x;
}

export function projectY(g: RoomGeometry, z: number, y: number): number {
  'worklet';
  return floorY(g, z) - y * depthScale(g, z) * g.unit;
}

/** Screen point on the floor → world (x, z). Values may fall outside 0..1. */
export function unprojectFloor(g: RoomGeometry, sx: number, sy: number): { x: number; z: number } {
  'worklet';
  const z = (g.B0 - sy) / (g.B0 - g.bB);
  const left = g.L0 + (g.bL - g.L0) * z;
  const right = g.R0 + (g.bR - g.R0) * z;
  return { x: (sx - left) / (right - left), z };
}

/** Interior height in world units (floor to ceiling). */
export function roomHeight(g: RoomGeometry): number {
  'worklet';
  return (g.B0 - g.T0) / g.unit;
}

/** Highest the body can rise at depth z before its head (or, lying, its side) touches the ceiling. */
export function ceilingY(g: RoomGeometry, z: number, lying: boolean): number {
  'worklet';
  return (floorY(g, z) - g.T0) / g.unit - (lying ? WORLD.lieHeight : WORLD.charHeight);
}

/** Screen rectangle of the character's body at a world position. */
export function characterRect(g: RoomGeometry, x: number, z: number, y: number) {
  'worklet';
  const s = depthScale(g, z);
  const w = WORLD.charWidth * g.unit * s;
  const h = WORLD.charHeight * g.unit * s;
  const cx = projectX(g, x, z);
  const bottom = projectY(g, z, y);
  return { left: cx - w / 2, top: bottom - h, width: w, height: h, cx, bottom, s };
}
