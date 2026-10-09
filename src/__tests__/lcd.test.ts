import { FINDS } from '../content/finds';
import { ITEMS } from '../content/items';
import { THEMES } from '../content/themes';
import { Bitmap, CLEAR, INK, LCD_DOTS, PAPER, textWidth } from '../lcd/bitmap';
import { drawBackdrop, drawItem, itemPreview, SLOT_DOTS, skyPhase } from '../room/items/pixelArt';
import { itemAnchor } from '../room/items/placement';

const count = (b: Bitmap, v: number) => b.px.reduce((n, c) => n + (c === v ? 1 : 0), 0);
const props = { lampOn: false, hour: 12, minute: 0, finds: FINDS.map((f) => f.id), tick: 0 };

describe('LCD bitmap', () => {
  it('merges each row of dots into runs', () => {
    const b = new Bitmap(4, 2).fill(0, 0, 3, 1);
    expect(b.path(INK).match(/M/g)).toHaveLength(1);
    expect(new Bitmap(4, 2).path(INK)).toBe('');
  });

  it('clips drawing to its bounds', () => {
    const b = new Bitmap(3, 3).line(-5, 1, 10, 1).disc(1, 1, 9);
    expect(b.px).toHaveLength(9);
    expect(count(b, INK)).toBe(9);
  });

  it('outlines ink with paper only where nothing is drawn', () => {
    const b = new Bitmap(5, 5).set(2, 2).outline();
    expect(count(b, INK)).toBe(1);
    expect(count(b, PAPER)).toBe(8);
  });

  it('writes digits in the 3×5 font', () => {
    const b = new Bitmap(textWidth('+12'), 5).text('+12', 0, 0);
    expect(b.w).toBe(11);
    expect(count(b, INK)).toBeGreaterThan(15);
  });
});

describe('room pixel art', () => {
  it('draws every furniture item inside its slot', () => {
    for (const item of ITEMS) {
      if (item.slot === 'toy') continue;
      const b = drawItem(item.slot, item.id, props);
      expect(b).not.toBeNull();
      expect(count(b!, INK)).toBeGreaterThan(5);
      const r = SLOT_DOTS[item.slot];
      expect(r.x + r.w).toBeLessThanOrEqual(LCD_DOTS);
      expect(r.y + r.h).toBeLessThanOrEqual(LCD_DOTS);
      expect(itemPreview(item.slot, item.id)).not.toBeNull();
    }
  });

  it('stands floor items on the bottom edge and hangs wall items above the stickman', () => {
    for (const slot of ['rest', 'corner', 'rug'] as const) {
      const r = SLOT_DOTS[slot];
      expect(r.y + r.h).toBe(LCD_DOTS);
    }
    for (const slot of ['wallLeft', 'wallRight', 'ceiling'] as const) {
      const r = SLOT_DOTS[slot];
      // The stickman is 25 dots tall.
      expect(r.y + r.h).toBeLessThanOrEqual(LCD_DOTS - 26);
    }
  });

  it('puts rest-spot anchors on top of the furniture', () => {
    const bed = itemAnchor('rest', 'bed')!;
    const cushion = itemAnchor('rest', 'cushion')!;
    expect(bed.y).toBeGreaterThan(cushion.y);
  });

  it('shows the time of day in the window', () => {
    const day = drawItem('wallLeft', 'window', { ...props, hour: 12 })!;
    const night = drawItem('wallLeft', 'window', { ...props, hour: 23 })!;
    expect(skyPhase(23)).toBe('night');
    expect(count(night, INK)).toBeGreaterThan(count(day, INK));
  });

  it('moves the clock hands with the time', () => {
    const a = drawItem('wallRight', 'clock', { ...props, hour: 3, minute: 0 })!;
    const b = drawItem('wallRight', 'clock', { ...props, hour: 9, minute: 30 })!;
    expect(a.path(INK)).not.toBe(b.path(INK));
  });

  it('has a plain default room and a distinct wallpaper for every other theme', () => {
    expect(count(drawBackdrop('midnight'), INK)).toBe(0);
    const papers = new Set(THEMES.map((t) => drawBackdrop(t.id).path(INK)));
    expect(papers.size).toBe(THEMES.length);
    const b = drawBackdrop('meadow');
    expect(count(b, INK)).toBeGreaterThan(0);
    // Nothing on the ground strip.
    for (let x = 0; x < LCD_DOTS; x++) expect(b.get(x, LCD_DOTS - 1)).toBe(CLEAR);
  });
});
