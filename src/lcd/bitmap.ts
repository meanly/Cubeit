/**
 * Monochrome LCD look, sampled from a Cube World–style handheld: a faded
 * green-gray panel with near-black dots. The whole room is a LCD_DOTS ×
 * LCD_DOTS dot matrix; every object is 1-bit pixel art on that grid.
 */
export const LCD_DOTS = 60;
/** Lit dots. */
export const LCD_INK = '#171A13';
/** The panel (center of the screen; the edges fall off toward LCD_EDGE). */
export const LCD_PAPER = '#89947D';
/** Tint of the darker panel edges, applied as an overlay. */
export const LCD_EDGE = '#141E0A';

/** Cell values: transparent, a lit dot, or opaque panel ("paper") that hides what's behind. */
export const CLEAR = 0;
export const INK = 1;
export const PAPER = 2;

/** A small 1-bit (+ paper) raster with just enough drawing tools for pixel art. */
export class Bitmap {
  readonly px: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Uint8Array(w * h);
  }

  set(x: number, y: number, v: number = INK): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.px[y * this.w + x] = v;
    return this;
  }

  get(x: number, y: number): number {
    return x >= 0 && x < this.w && y >= 0 && y < this.h ? this.px[y * this.w + x] : CLEAR;
  }

  fill(x: number, y: number, w: number, h: number, v: number = INK): this {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, v);
    return this;
  }

  /** Rectangle outline. */
  box(x: number, y: number, w: number, h: number, v: number = INK): this {
    this.fill(x, y, w, 1, v).fill(x, y + h - 1, w, 1, v);
    return this.fill(x, y, 1, h, v).fill(x + w - 1, y, 1, h, v);
  }

  /** Straight dot line (Bresenham-style stepping). */
  line(x0: number, y0: number, x1: number, y1: number, v: number = INK): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) {
      const k = n === 0 ? 0 : i / n;
      this.set(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, v);
    }
    return this;
  }

  /** Every other dot along a horizontal line. */
  dotted(x0: number, x1: number, y: number, step = 2, v: number = INK): this {
    for (let x = x0; x <= x1; x += step) this.set(x, y, v);
    return this;
  }

  /** Filled circle; centers may be on half dots. */
  disc(cx: number, cy: number, r: number, v: number = INK): this {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + r * 0.6) this.set(x, y, v);
    return this;
  }

  /** One-dot circle outline: the edge cells of the matching disc. */
  ring(cx: number, cy: number, r: number, v: number = INK): this {
    const inside = (x: number, y: number) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r + r * 0.6;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if (inside(x, y) && (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1))) this.set(x, y, v);
    return this;
  }

  /** Checkerboard shading over an area (only where it's empty). */
  dither(x: number, y: number, w: number, h: number, phase = 0, v: number = INK): this {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if ((i + j + phase) % 2 === 0 && this.get(i, j) !== INK) this.set(i, j, v);
    return this;
  }

  /** Hand-drawn rows: '#' ink, 'o' paper, anything else is left alone. */
  sprite(rows: readonly string[], x: number, y: number, flip = false): this {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = row[flip ? row.length - 1 - i : i];
        if (c === '#') this.set(x + i, y + j, INK);
        else if (c === 'o') this.set(x + i, y + j, PAPER);
      }
    });
    return this;
  }

  /** Copies another bitmap's non-clear cells. */
  blit(src: Bitmap, x: number, y: number): this {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const v = src.px[j * src.w + i];
        if (v !== CLEAR) this.set(x + i, y + j, v);
      }
    return this;
  }

  /** Surrounds every ink dot with paper, so the shape reads on top of anything. */
  outline(): this {
    const copy = this.px.slice();
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (copy[y * this.w + x] !== INK) continue;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if (this.get(x + dx, y + dy) === CLEAR) this.set(x + dx, y + dy, PAPER);
      }
    return this;
  }

  /** Text in the 3×5 dot font; returns the bitmap for chaining. */
  text(str: string, x: number, y: number, v: number = INK): this {
    let cx = x;
    for (const ch of str) {
      const glyph = FONT[ch] ?? FONT[ch.toUpperCase()];
      if (glyph) {
        glyph.forEach((row, j) => {
          for (let i = 0; i < row.length; i++) if (row[i] === '#') this.set(cx + i, y + j, v);
        });
        cx += glyph[0].length + 1;
      } else cx += 2;
    }
    return this;
  }

  /** SVG path of every cell with value v (horizontal runs, slightly overlapping rows to avoid seams). */
  path(v: number = INK): string {
    let d = '';
    for (let y = 0; y < this.h; y++) {
      let start = -1;
      for (let x = 0; x <= this.w; x++) {
        const on = x < this.w && this.px[y * this.w + x] === v;
        if (on && start < 0) start = x;
        else if (!on && start >= 0) {
          const len = x - start;
          d += `M${start} ${y - 0.02}h${len}v1.04h-${len}z`;
          start = -1;
        }
      }
    }
    return d;
  }
}

export function textWidth(str: string): number {
  let w = 0;
  for (const ch of str) {
    const glyph = FONT[ch] ?? FONT[ch.toUpperCase()];
    w += (glyph ? glyph[0].length : 1) + 1;
  }
  return Math.max(0, w - 1);
}

/** 3×5 dot font (digits, a few letters and signs). */
const FONT: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  ':': ['.', '#', '.', '#', '.'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['###', '..#', '.##', '...', '.#.'],
  '.': ['.', '.', '.', '.', '#'],
  z: ['...', '###', '.#.', '#..', '###'],
  Z: ['###', '..#', '.#.', '#..', '###'],
};
