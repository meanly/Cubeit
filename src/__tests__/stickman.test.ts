import { accessoryCode, GRID, IDLE_INPUT, rasterStickman, stateCode, type StickmanInput } from '../character/pixel/stickman';

const draw = (over: Partial<StickmanInput>) => rasterStickman({ ...IDLE_INPUT, motion: 1, ...over });

/** Lit cells as [col, row]. */
function cells(grid: number[], v?: number): [number, number][] {
  const out: [number, number][] = [];
  grid.forEach((c, i) => {
    if (c !== 0 && (v === undefined || c === v)) out.push([i % GRID, Math.floor(i / GRID)]);
  });
  return out;
}

function bounds(grid: number[]) {
  const c = cells(grid);
  const cols = c.map(([x]) => x);
  const rows = c.map(([, y]) => y);
  return {
    left: Math.min(...cols),
    right: Math.max(...cols),
    w: Math.max(...cols) - Math.min(...cols) + 1,
    h: Math.max(...rows) - Math.min(...rows) + 1,
    bottom: Math.max(...rows),
  };
}

describe('pixel stickman', () => {
  it('stands about 25 dots tall with its feet on the bottom row', () => {
    const b = bounds(rasterStickman(IDLE_INPUT).grid);
    expect(b.bottom).toBe(GRID - 1);
    expect(b.h).toBeGreaterThanOrEqual(24);
    expect(b.h).toBeLessThanOrEqual(GRID);
  });

  it('is built thick: a solid 4-dot head with no face and 2-dot legs', () => {
    const { grid } = rasterStickman(IDLE_INPUT);
    const rowWidth = (r: number) => grid.slice(r * GRID, (r + 1) * GRID).filter((c) => c !== 0).length;
    const top = Math.min(...cells(grid).map(([, y]) => y));
    // Rounded head: 2 dots, then two solid rows of 4.
    expect([rowWidth(top), rowWidth(top + 1), rowWidth(top + 2)]).toEqual([2, 4, 4]);
    // Shins: two 2-dot columns.
    expect(rowWidth(GRID - 4)).toBe(4);
  });

  it('is symmetric at rest', () => {
    const { grid } = rasterStickman(IDLE_INPUT);
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) expect(grid[r * GRID + c] !== 0).toBe(grid[r * GRID + (GRID - 1 - c)] !== 0);
  });

  it('lies down to sleep and when knocked over by a tilt', () => {
    const sleep = bounds(draw({ state: stateCode('sleeping') }).grid);
    expect(sleep.w).toBeGreaterThan(sleep.h);
    const fallen = bounds(draw({ fallen: 1, fallDir: 1 }).grid);
    expect(fallen.w).toBeGreaterThan(fallen.h * 2);
  });

  it('keeps its hands inside a nearby wall', () => {
    const free = bounds(draw({}).grid);
    const atWall = bounds(draw({ roomL: 3.5 }).grid);
    expect(atWall.left).toBeGreaterThan(free.left);
    expect(GRID / 2 - atWall.left).toBeLessThanOrEqual(4);
  });

  it('walks in distinct frames', () => {
    const frames = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => draw({ walking: 1, walkPhase: (i / 8) * Math.PI * 2 }).grid.join('')));
    expect(frames.size).toBeGreaterThanOrEqual(4);
  });

  it('fidgets when idle, but not with reduced motion', () => {
    const lively = new Set(Array.from({ length: 60 }, (_, i) => draw({ t: i * 0.5 }).grid.join('')));
    expect(lively.size).toBeGreaterThan(2);
    const calm = new Set(Array.from({ length: 60 }, (_, i) => draw({ t: i * 0.5, motion: 0.35 }).grid.join('')));
    expect(calm.size).toBe(1);
  });

  it('raises both arms for jumping jacks', () => {
    const frames = [0, 0.3].map((t) => draw({ t, state: stateCode('celebrating') }));
    expect(frames[0].grid.join('')).not.toBe(frames[1].grid.join(''));
    expect(Math.max(...frames.map((f) => f.lift))).toBeGreaterThan(0);
  });

  it('draws accessories as their own dots', () => {
    const { grid } = draw({ accessory: accessoryCode('crown') });
    expect(cells(grid, 2).length).toBe(10);
  });
});
