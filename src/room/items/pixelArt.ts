import type { FindId } from '../../content/finds';
import type { ItemId, SlotId } from '../../content/items';
import type { ThemeId } from '../../content/themes';
import { Bitmap, INK, LCD_DOTS, PAPER } from '../../lcd/bitmap';

/**
 * Every room object as 1-bit LCD pixel art, drawn into small bitmaps on the
 * screen's dot grid. Static art is a list of rows ('#' ink, 'o' paper, other
 * characters transparent); live art (window, clock, lights) is drawn in code.
 */

export type SkyPhase = 'night' | 'dawn' | 'day' | 'dusk';

export function skyPhase(hour: number): SkyPhase {
  if (hour >= 21 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  return 'dusk';
}

export interface ItemDrawProps {
  lampOn: boolean;
  /** Local time, for the window sky and the clock. */
  hour: number;
  minute: number;
  finds: readonly FindId[];
  /** Animation frame for twinkling / swaying items. */
  tick: number;
}

export interface DotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each slot sits on the 60×60 screen, in dots. Floor items stand on the bottom edge. */
export const SLOT_DOTS: Record<Exclude<SlotId, 'toy'>, DotRect> = {
  ceiling: { x: 0, y: 0, w: LCD_DOTS, h: 10 },
  wallLeft: { x: 5, y: 12, w: 17, h: 16 },
  wallRight: { x: 38, y: 11, w: 13, h: 18 },
  rest: { x: 2, y: LCD_DOTS - 10, w: 26, h: 10 },
  corner: { x: 46, y: LCD_DOTS - 26, w: 12, h: 26 },
  rug: { x: 15, y: LCD_DOTS - 7, w: 30, h: 7 },
};

/** Height of each rest item's top surface, in dots above the floor. */
export const REST_DOTS: Partial<Record<ItemId, number>> = { cushion: 4, bed: 6, beanbag: 6 };

// ───────────────────────── wall items ─────────────────────────

function drawWindow(b: Bitmap, { hour }: ItemDrawProps) {
  const phase = skyPhase(hour);
  b.fill(0, 0, 17, 15, PAPER).box(0, 0, 17, 15);
  const night = phase === 'night';
  if (night) {
    b.fill(1, 1, 15, 13, INK);
    // Crescent moon and stars, unlit on the dark sky.
    b.disc(11.5, 4.5, 2.4, PAPER).disc(12.6, 3.6, 2, INK);
    for (const [x, y] of [
      [3, 3],
      [6, 2],
      [2, 6],
      [5, 10],
      [13, 10],
      [10, 12],
      [14, 8],
    ])
      b.set(x, y, PAPER);
  } else {
    if (phase === 'day') {
      b.disc(12, 4, 1.4);
      for (const [x, y] of [
        [10, 2],
        [14, 2],
        [10, 6],
        [14, 6],
      ])
        b.set(x, y);
      b.sprite(['.##.', '####'], 3, 3);
    } else {
      // Low sun on the horizon, a hatched sky band above.
      for (let y = 1; y <= 3; y += 2) b.dotted(1 + (y % 4 === 1 ? 0 : 1), 15, y, 2);
      b.disc(phase === 'dawn' ? 4 : 12, 11, 2.6);
    }
    // Rolling hills with a little texture below the ridge.
    for (let x = 1; x <= 15; x++) {
      const ridge = Math.round(11 - 1.4 * Math.sin(x * 0.55));
      b.fill(x, ridge + 1, 1, 13 - ridge, PAPER);
      b.set(x, ridge);
      for (let y = ridge + 1; y <= 13; y++) if ((x * 3 + y * 5) % 7 === 0) b.set(x, y);
    }
  }
  const bar = night ? PAPER : INK;
  b.fill(8, 1, 1, 13, bar).fill(1, 7, 15, 1, bar);
  b.fill(0, 15, 17, 1);
}

function drawFindsShelf(b: Bitmap, { finds }: ItemDrawProps) {
  b.fill(0, 7, 17, 1).fill(0, 15, 17, 1);
  b.set(2, 8).set(14, 8);
  finds.slice(0, 8).forEach((id, i) => {
    const glyph = FIND_GLYPHS[id] ?? FIND_GLYPHS.pebble;
    const shelfTop = i < 4 ? 7 : 15;
    b.sprite(glyph, 1 + (i % 4) * 4, shelfTop - 3);
  });
}

const FIND_GLYPHS: Record<FindId, readonly string[]> = {
  pebble: ['...', '.#.', '###'],
  feather: ['..#', '.#.', '#..'],
  button: ['###', '#o#', '###'],
  acorn: ['###', '#o#', '.#.'],
  shell: ['.##', '#o#', '###'],
  marble: ['.#.', '#o#', '.#.'],
  key: ['#..', '###', '#.#'],
  leaf: ['.##', '##.', '#..'],
  starShard: ['.#.', '###', '#.#'],
  bottleCap: ['###', '###', '#.#'],
};

function drawPoster(b: Bitmap) {
  b.fill(0, 1, 13, 16, PAPER).box(0, 1, 13, 16);
  b.set(6, 0);
  const stars: [number, number][] = [
    [3, 5],
    [5, 3],
    [8, 6],
    [6, 9],
    [9, 10],
  ];
  for (let i = 0; i < stars.length - 1; i++) {
    const [x0, y0] = stars[i];
    const [x1, y1] = stars[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k += 2) b.set(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n);
  }
  for (const [x, y] of stars) b.set(x, y).set(x - 1, y).set(x + 1, y).set(x, y - 1).set(x, y + 1);
  b.disc(6.5, 13.5, 1.3);
  b.set(3, 14).set(4, 14).set(9, 13).set(10, 13);
}

function drawClock(b: Bitmap, { hour, minute }: ItemDrawProps) {
  b.disc(6, 6, 6, PAPER).ring(6, 6, 6);
  b.set(6, 2).set(10, 6).set(6, 10).set(2, 6);
  const m = (minute / 60) * Math.PI * 2;
  const h = (((hour % 12) + minute / 60) / 12) * Math.PI * 2;
  b.line(6, 6, 6 + Math.sin(m) * 4.4, 6 - Math.cos(m) * 4.4);
  b.line(6, 6, 6 + Math.sin(h) * 2.8, 6 - Math.cos(h) * 2.8);
  b.fill(5, 13, 3, 1);
}

function drawPhotoFrame(b: Bitmap) {
  b.fill(0, 0, 13, 15).fill(2, 2, 9, 11, PAPER);
  b.sprite(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], 3, 3);
  b.disc(4.5, 11, 0.9).disc(8.5, 11, 0.9);
}

// ───────────────────────── floor items ─────────────────────────

const CUSHION = [
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '..######################..',
  '.#oooooooooooooooooooooo#.',
  '#oooooo#ooooooooo#ooooooo#',
  '.########################.',
];

const BED = [
  '##........................',
  '##........................',
  '##.#####..................',
  '###ooooo#.................',
  '##########################',
  '##oooooooo#o#o#o#o#o#o#o##',
  '##########################',
  '##.....................#.#',
  '##.....................#.#',
  '##.....................#.#',
];

const BEANBAG = [
  '..........................',
  '..........................',
  '..........................',
  '..........................',
  '.........#########........',
  '.....####ooooooooo####....',
  '..###ooooooooooooooooo###.',
  '.#ooooooooooooooooooooooo#',
  '.#oooooo#oooooooo#ooooooo#',
  '..#######################.',
];

const PLANT = [
  '............',
  '......#.....',
  '.....###....',
  '.##..###..#.',
  '###..###.###',
  '###...#..###',
  '.#....#.##..',
  '..#...#.#...',
  '...#..##....',
  '....#.#.....',
  '.....##.....',
  '##....#.....',
  '###...#..##.',
  '.###..#.###.',
  '...##.#.#...',
  '.....###....',
  '......#.....',
  '......#.....',
  '.##########.',
  '.#oooooooo#.',
  '.##########.',
  '..#oooooo#..',
  '..#oooooo#..',
  '..#oooooo#..',
  '...#oooo#...',
  '...######...',
];

function drawLamp(b: Bitmap, { lampOn }: ItemDrawProps) {
  b.sprite(['...######...', '..#oooooo#..', '..#oooooo#..', '.#oooooooo#.', '.#oooooooo#.', '############'], 0, 1);
  b.fill(5, 7, 2, 17).sprite(['...######...', '..########..'], 0, 24);
  if (lampOn) {
    b.dither(2, 2, 8, 4, 0);
    b.fill(4, 7, 4, 1);
    // Light rays fanning out under the shade.
    for (const [x, y] of [
      [2, 9],
      [1, 11],
      [9, 9],
      [10, 11],
      [3, 9],
      [8, 9],
    ])
      b.set(x, y);
  }
}

function drawBookshelf(b: Bitmap) {
  b.fill(0, 2, 12, 24, PAPER).box(0, 2, 12, 24).fill(0, 9, 12, 1).fill(0, 17, 12, 1);
  const heights = [4, 5, 3, 5, 4, 3, 5, 4, 3, 5];
  for (let shelf = 0; shelf < 3; shelf++) {
    const floor = [8, 16, 24][shelf];
    for (let i = 0; i < 10; i++) {
      if ((i + shelf) % 3 === 2) continue; // gaps between books
      const h = heights[(i + shelf * 3) % heights.length];
      b.fill(1 + i, floor - h + 1, 1, h);
    }
  }
}

function drawRoundRug(b: Bitmap) {
  const inside = (x: number, y: number, rx: number, ry: number) => ((x - 14.5) / rx) ** 2 + ((y - 3) / ry) ** 2 <= 1;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 30; x++) {
      if (!inside(x, y, 14.8, 3.6)) continue;
      const edge = !inside(x - 1, y, 14.8, 3.6) || !inside(x + 1, y, 14.8, 3.6) || !inside(x, y - 1, 14.8, 3.6) || !inside(x, y + 1, 14.8, 3.6);
      b.set(x, y, edge ? INK : PAPER);
      if (!edge && inside(x, y, 9, 1.6) && (x + y) % 2 === 0) b.set(x, y);
    }
}

function drawStripedRug(b: Bitmap) {
  b.fill(1, 1, 28, 5, PAPER).box(1, 1, 28, 5);
  for (let x = 4; x < 27; x += 4) b.fill(x, 2, 2, 3);
  b.dotted(2, 27, 0, 2).dotted(2, 27, 6, 2);
}

// ───────────────────────── ceiling ─────────────────────────

function drawStringLights(b: Bitmap, { tick }: ItemDrawProps) {
  const wire = (x: number) => Math.round(1 + 4 * Math.sin((Math.PI * x) / (LCD_DOTS - 1)));
  for (let x = 0; x < LCD_DOTS; x++) b.set(x, wire(x));
  for (let i = 0; i < 8; i++) {
    const x = 5 + i * 7;
    const y = wire(x) + 1;
    const lit = (i + tick) % 2 === 0;
    b.set(x, y).sprite(lit ? ['###', '###', '.#.'] : ['###', '#o#', '.#.'], x - 1, y + 1);
    if (lit) b.set(x - 2, y + 4).set(x + 2, y + 4);
  }
}

function drawMoonMobile(b: Bitmap, { tick }: ItemDrawProps) {
  const sway = [0, 1, 0, -1][tick % 4];
  b.fill(30, 0, 1, 2).line(20, 2, 40, 2);
  b.line(20, 3, 20 + sway, 4).line(30, 3, 30 + sway, 4).line(40, 3, 40 + sway, 3);
  b.sprite(['.###', '##..', '#...', '##..', '.###'], 28 + sway, 5);
  b.sprite(['.#.', '###', '.#.'], 19 + sway, 5);
  b.sprite(['.#.', '###', '.#.'], 39 + sway, 4);
}

// ───────────────────────── registry ─────────────────────────

const sprite = (rows: readonly string[]) => (b: Bitmap) => {
  b.sprite(rows, 0, 0);
};

/** Item id → how to draw it into its slot's bitmap. (The ball is drawn by BallView.) */
export const ITEM_DRAW: Partial<Record<ItemId, (b: Bitmap, p: ItemDrawProps) => void>> = {
  cushion: sprite(CUSHION),
  bed: sprite(BED),
  beanbag: sprite(BEANBAG),
  plant: sprite(PLANT),
  lamp: drawLamp,
  bookshelf: drawBookshelf,
  window: drawWindow,
  findsShelf: drawFindsShelf,
  poster: drawPoster,
  clock: drawClock,
  photoFrame: drawPhotoFrame,
  roundRug: drawRoundRug,
  stripedRug: drawStripedRug,
  stringLights: drawStringLights,
  moonMobile: drawMoonMobile,
};

/** Items that animate on their own and want a ticking frame counter. */
export const TICKING: Partial<Record<ItemId, number>> = { stringLights: 700, moonMobile: 650 };

export function drawItem(slot: Exclude<SlotId, 'toy'>, item: ItemId, props: ItemDrawProps): Bitmap | null {
  const draw = ITEM_DRAW[item];
  if (!draw) return null;
  const r = SLOT_DOTS[slot];
  const b = new Bitmap(r.w, r.h);
  draw(b, props);
  return b;
}

const PREVIEW_PROPS: ItemDrawProps = { lampOn: true, hour: 12, minute: 10, finds: ['pebble', 'button', 'key', 'leaf'], tick: 0 };

/** The interesting part of an item's art, cropped to a square for option tiles. */
export function itemPreview(slot: Exclude<SlotId, 'toy'>, item: ItemId): Bitmap | null {
  const art = drawItem(slot, item, PREVIEW_PROPS);
  if (!art) return null;
  // Trim to the drawn area, then center it in a square.
  let x0 = art.w;
  let y0 = art.h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < art.h; y++)
    for (let x = 0; x < art.w; x++)
      if (art.get(x, y) !== 0) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return art;
  // Wide ceiling art: show the middle third.
  if (x1 - x0 > 30) {
    x0 = 18;
    x1 = 41;
  }
  const side = Math.max(x1 - x0 + 1, y1 - y0 + 1) + 2;
  const out = new Bitmap(side, side);
  const cropped = new Bitmap(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cropped.set(x - x0, y - y0, art.get(x, y));
  return out.blit(cropped, Math.floor((side - cropped.w) / 2), Math.floor((side - cropped.h) / 2));
}

// ───────────────────────── wall & floor ─────────────────────────

/** Wallpaper per room theme, in a single ink. The default (midnight) room is plain. */
function wallpaper(b: Bitmap, theme: ThemeId, rows: number) {
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < b.w; x++) {
      let on = false;
      switch (theme) {
        case 'midnight': // plain
          break;
        case 'meadow': // dotted stripes
          on = x % 6 === 2 && y % 2 === 0;
          break;
        case 'peach': // diamond lattice
          on = ((x + y) % 8 === 0 || (x - y + 80) % 8 === 0) && (x + y) % 2 === 0;
          break;
        case 'deepsea': // waves
          on = y % 8 === Math.round(3 + Math.sin(x * 0.6)) % 8 && x % 2 === 0;
          break;
        case 'lantern': // paper panels
          on = (y % 8 === 7 && x % 2 === 0) || ((x + (Math.floor(y / 8) % 2) * 5) % 10 === 0 && y % 8 !== 7 && y % 2 === 0);
          break;
      }
      if (on) b.set(x, y);
    }
}

/** The screen behind everything: plain, or the theme's wallpaper (kept off the ground strip). */
export function drawBackdrop(theme: ThemeId, size = LCD_DOTS): Bitmap {
  const b = new Bitmap(size, size);
  wallpaper(b, theme, size === LCD_DOTS ? LCD_DOTS - 8 : size);
  return b;
}
