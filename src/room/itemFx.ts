import { create } from 'zustand';

import { Bitmap, LCD_DOTS, PAPER } from '../lcd/bitmap';
import { SLOT_DOTS } from './items/pixelArt';

/**
 * Little pixel effects that play on furniture while the stickman uses it: the
 * lamp's light bursting out, a flower popping up on the watered sprout, a bird
 * flying past the window… There's no real lighting on the LCD, only dots.
 * Each effect is a short run of frames at 10 fps, drawn on the 60×60 screen.
 */

export type ItemFxKind =
  | 'lampOn'
  | 'lampOff'
  | 'plantBloom'
  | 'bird'
  | 'shootingStar'
  | 'posterStars'
  | 'clockRing'
  | 'hearts'
  | 'findsSparkle'
  | 'lightsChase'
  | 'mobileStars'
  | 'poof';

export const FX_FRAME_MS = 100;

/** How many frames each effect lasts. */
export const FX_FRAMES: Record<ItemFxKind, number> = {
  lampOn: 16,
  lampOff: 7,
  plantBloom: 22,
  bird: 24,
  shootingStar: 12,
  posterStars: 24,
  clockRing: 14,
  hearts: 20,
  findsSparkle: 16,
  lightsChase: 20,
  mobileStars: 16,
  poof: 8,
};

export interface ActiveFx {
  id: number;
  kind: ItemFxKind;
  at: number;
}

interface ItemFxStore {
  fx: ActiveFx[];
  play(kind: ItemFxKind): void;
  clear(id: number): void;
}

let nextId = 0;

export const useItemFx = create<ItemFxStore>((set) => ({
  fx: [],
  // Replaying a kind restarts it; at most three run at once.
  play: (kind) => set((s) => ({ fx: [...s.fx.filter((f) => f.kind !== kind).slice(-2), { id: nextId++, kind, at: Date.now() }] })),
  clear: (id) => set((s) => ({ fx: s.fx.filter((f) => f.id !== id) })),
}));

export const playItemFx = (kind: ItemFxKind) => useItemFx.getState().play(kind);

const PLUS = ['.#.', '###', '.#.'];
const X = ['#.#', '.#.', '#.#'];
const HEART = ['#.#', '###', '.#.'];

// Where things sit on the screen (absolute dots), from the slot layout.
const CORNER = SLOT_DOTS.corner;
const WALL_L = SLOT_DOTS.wallLeft;
const WALL_R = SLOT_DOTS.wallRight;
const REST = SLOT_DOTS.rest;

/** Draws frame `f` of an effect into the screen bitmap. */
export function drawFx(b: Bitmap, kind: ItemFxKind, f: number): void {
  switch (kind) {
    case 'lampOn': {
      // Rays burst out of the shade, then the glow twinkles at its edges.
      const cx = CORNER.x + 5.5;
      const cy = CORNER.y + 4;
      const angles = [-150, 180, 150, 120, 90, 60, 30, 0, -30];
      if (f < 6) {
        const r = 7 + f * 1.3;
        for (const a of angles) {
          const t = (a * Math.PI) / 180;
          for (let k = 0; k < 2; k++) b.set(Math.round(cx + Math.cos(t) * (r + k)), Math.round(cy + Math.sin(t) * (r + k)));
        }
      } else {
        const on = f % 2 === 0;
        b.sprite(on ? PLUS : X, CORNER.x - 3, CORNER.y + 2).sprite(on ? X : PLUS, CORNER.x - 1, CORNER.y + 10);
      }
      break;
    }
    case 'lampOff': {
      // The glow shrinks back into the shade.
      const cx = CORNER.x + 5.5;
      const cy = CORNER.y + 5;
      const r = 9 - f * 1.2;
      for (const a of [180, 135, 90, 45, 0]) {
        const t = (a * Math.PI) / 180;
        b.set(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r));
      }
      break;
    }
    case 'plantBloom': {
      // A bud pushes up from the top leaf and opens into a flower; sparkles around the pot.
      const x = CORNER.x + 6;
      const top = CORNER.y + 1;
      const grow = Math.min(3, Math.floor(f / 2));
      for (let k = 1; k <= grow; k++) b.set(x, top - k);
      if (f >= 6) b.sprite(['.#.', '#o#', '.#.'], x - 1, top - grow - 3);
      if (f >= 8) {
        const spots: [number, number][] = [
          [CORNER.x - 2, CORNER.y + 6],
          [CORNER.x + 11, CORNER.y + 4],
          [CORNER.x - 1, CORNER.y + 14],
          [CORNER.x + 11, CORNER.y + 12],
        ];
        const [sx, sy] = spots[f % spots.length];
        b.sprite(PLUS, sx - 1, sy - 1);
      }
      break;
    }
    case 'bird': {
      // A little bird flaps across the window, right to left.
      const x = WALL_L.x + 14 - Math.floor(f * 0.6);
      const y = WALL_L.y + 3 + (Math.floor(f / 3) % 2);
      const wings = f % 2 === 0 ? ['#.#', '.#.'] : ['...', '###'];
      wings.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const px = x + i;
          if (row[i] === '#' && px > WALL_L.x && px < WALL_L.x + 16) b.set(px, y + j);
        }
      });
      break;
    }
    case 'shootingStar': {
      // A pale streak (and its tail) across the dark window.
      for (let k = 0; k < 3; k++) {
        const s = f - k;
        if (s < 0) continue;
        const px = WALL_L.x + 15 - s;
        const py = WALL_L.y + 2 + Math.floor(s * 0.6);
        if (px > WALL_L.x && px < WALL_L.x + 16 && py < WALL_L.y + 14) b.set(px, py, PAPER);
      }
      break;
    }
    case 'posterStars': {
      // The constellation lights up one star at a time, then all twinkle together.
      const stars: [number, number][] = [
        [3, 5],
        [5, 3],
        [8, 6],
        [6, 9],
        [9, 10],
      ];
      const lit = Math.floor(f / 4);
      stars.forEach(([sx, sy], i) => {
        if (i === lit || (lit >= stars.length && f % 2 === i % 2)) {
          for (const [dx, dy] of [
            [-2, -2],
            [2, -2],
            [-2, 2],
            [2, 2],
          ])
            b.set(WALL_R.x + sx + dx, WALL_R.y + sy + dy);
        }
      });
      break;
    }
    case 'clockRing': {
      // "Ring ring!": shake lines either side of the clock, and two little bells on top.
      const cx = WALL_R.x + 6;
      const cy = WALL_R.y + 6;
      const d = f % 2 === 0 ? 8 : 9;
      for (const side of [-1, 1]) for (const dy of [-3, -1, 1, 3]) b.set(cx + side * (d - (Math.abs(dy) === 3 ? 1 : 0)), cy + dy);
      if (f % 2 === 0) b.set(cx - 4, cy - 7).set(cx + 4, cy - 7);
      else b.set(cx - 3, cy - 8).set(cx + 3, cy - 8);
      break;
    }
    case 'hearts': {
      // Hearts float up off the frame, wobbling as they go.
      [0, 5, 10].forEach((delay, i) => {
        const s = f - delay;
        if (s < 0 || s > 10) return;
        const x = WALL_R.x + 2 + i * 4 + Math.round(Math.sin(s * 0.9 + i) * 1);
        const y = WALL_R.y - 1 - Math.floor(s * 0.8);
        if (y >= 0) b.sprite(HEART, x, y);
      });
      break;
    }
    case 'findsSparkle': {
      // Sparkles hop between the treasures on both shelves.
      const k = (f * 3) % 8;
      const x = WALL_L.x + 1 + (k % 4) * 4;
      const y = WALL_L.y + (k < 4 ? 7 : 15) - 6;
      b.sprite(f % 2 === 0 ? PLUS : X, x, y);
      break;
    }
    case 'lightsChase': {
      // A wave of extra-bright bulbs chases along the string.
      const wire = (x: number) => Math.round(1 + 4 * Math.sin((Math.PI * x) / (LCD_DOTS - 1)));
      for (let i = 0; i < 8; i++) {
        if ((i - f + 80) % 4 !== 0) continue;
        const x = 5 + i * 7;
        const y = wire(x) + 1;
        b.set(x - 3, y + 5).set(x + 3, y + 5).set(x, y + 5).set(x, y + 6);
      }
      break;
    }
    case 'mobileStars': {
      // Tiny stars shaken loose from the mobile drift down.
      [
        [20, 8, 0],
        [31, 10, 3],
        [41, 7, 6],
      ].forEach(([x, y, delay]) => {
        const s = f - delay;
        if (s < 0) return;
        const py = y + Math.floor(s * 0.8);
        if (s % 2 === 0) b.sprite(PLUS, x - 1 + (s % 4 === 0 ? 0 : 1), py);
        else b.set(x, py + 1);
      });
      break;
    }
    case 'poof': {
      // Dust puffs either side of the rest spot as he plops down.
      const top = LCD_DOTS - 6;
      const r = 1 + Math.floor(f / 2);
      if (f < 6) for (const x of [REST.x + 2, REST.x + REST.w - 3]) b.ring(x, top - r, r);
      break;
    }
  }
}

/** All running effects, at their current frames, as one outlined screen-sized bitmap (or null). */
export function composeFx(fx: readonly ActiveFx[], now: number, reduceMotion: boolean): Bitmap | null {
  if (fx.length === 0) return null;
  const b = new Bitmap(LCD_DOTS, LCD_DOTS);
  for (const f of fx) {
    const frames = FX_FRAMES[f.kind];
    const frame = Math.floor((now - f.at) / FX_FRAME_MS);
    if (frame >= frames) continue;
    // Reduced motion: one still frame from the middle of the effect.
    drawFx(b, f.kind, reduceMotion ? Math.floor(frames / 2) : Math.max(0, frame));
  }
  return b.outline();
}
