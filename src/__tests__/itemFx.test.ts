import { Bitmap, CLEAR, LCD_DOTS, PAPER } from '../lcd/bitmap';
import { composeFx, drawFx, FX_FRAME_MS, FX_FRAMES, type ItemFxKind } from '../room/itemFx';

const KINDS = Object.keys(FX_FRAMES) as ItemFxKind[];
const lit = (b: Bitmap) => {
  let n = 0;
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.get(x, y) !== CLEAR) n++;
  return n;
};

describe('item effects', () => {
  it('every effect draws something and animates', () => {
    for (const kind of KINDS) {
      const frames = Array.from({ length: FX_FRAMES[kind] }, (_, f) => {
        const b = new Bitmap(LCD_DOTS, LCD_DOTS);
        drawFx(b, kind, f);
        return b;
      });
      expect({ kind, drawn: frames.some((b) => lit(b) > 0) }).toEqual({ kind, drawn: true });
      expect({ kind, moves: new Set(frames.map((b) => b.path() + b.path(PAPER))).size > 1 }).toEqual({ kind, moves: true });
    }
  });

  it('finished effects drop out, and reduced motion holds one still frame', () => {
    const at = 1000;
    const done = composeFx([{ id: 1, kind: 'poof', at }], at + FX_FRAMES.poof * FX_FRAME_MS, false);
    expect(done && lit(done)).toBe(0);
    const still = [0, 300, 600].map((dt) => composeFx([{ id: 1, kind: 'lampOn', at }], at + dt, true)!.path());
    expect(new Set(still).size).toBe(1);
    expect(composeFx([], at, false)).toBeNull();
  });
});
