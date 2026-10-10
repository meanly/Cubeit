import { accessoryCode, GRID, IDLE_INPUT, rasterStickman, stateCode, type StickmanInput } from '../character/pixel/stickman';
import { EXPRESSIONS, type CharacterState } from '../character/states';

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

/** The toy's figure, dot for dot (center line between columns 8 and 9). */
const REFERENCE = [
  '........##........',
  '.......####.......',
  '.......####.......',
  '.......####.......',
  '........##........',
  '......######......',
  '.....########.....',
  '.....#..##..#.....',
  '....##..##..##....',
  '....#...##...#....',
  '...##...##...##...',
  '........##........',
  '.......####.......',
  '......##..##......',
  '......##..##......',
  '.....##....##.....',
  '.....##....##.....',
  '.....##....##.....',
  '.....##....##.....',
  '.....##....##.....',
  '....###....###....',
];

describe('pixel stickman', () => {
  it('matches the toy figure exactly at rest', () => {
    const { grid } = rasterStickman(IDLE_INPUT);
    const left = GRID / 2 - 9;
    const rows: string[] = [];
    for (let r = GRID - REFERENCE.length; r < GRID; r++) {
      let line = '';
      for (let c = left; c < left + 18; c++) line += grid[r * GRID + c] ? '#' : '.';
      rows.push(line);
    }
    expect(rows).toEqual(REFERENCE);
    // Nothing outside the reference box.
    expect(cells(grid).length).toBe(REFERENCE.join('').split('#').length - 1);
  });

  it('stands 21 dots tall with its feet on the bottom row', () => {
    const b = bounds(rasterStickman(IDLE_INPUT).grid);
    expect(b.bottom).toBe(GRID - 1);
    expect(b.h).toBe(21);
    expect(b.h).toBeLessThanOrEqual(GRID);
  });

  it('has a solid 4-dot head with no face, thin arms and chunky legs', () => {
    const { grid } = rasterStickman(IDLE_INPUT);
    const rowWidth = (r: number) => grid.slice(r * GRID, (r + 1) * GRID).filter((c) => c !== 0).length;
    const top = Math.min(...cells(grid).map(([, y]) => y));
    // Rounded head: 2 dots, then two solid rows of 4.
    expect([rowWidth(top), rowWidth(top + 1), rowWidth(top + 2)]).toEqual([2, 4, 4]);
    // Shins: two 2-dot columns.
    expect(rowWidth(GRID - 4)).toBe(4);
    // Arms: slim solid lines, a single stair-stepped line, never more than 3 dots across in a row.
    for (let r = top + 8; r <= top + 11; r++) {
      const row = grid.slice(r * GRID, (r + 1) * GRID);
      let run = 0;
      let longest = 0;
      row.forEach((c, x) => {
        run = c !== 0 && (x < GRID / 2 - 2 || x > GRID / 2 + 1) ? run + 1 : 0;
        longest = Math.max(longest, run);
      });
      expect(longest).toBeLessThanOrEqual(3);
    }
  });

  it('throws its whole body with recoil: hips, chest and head all shift, arms trail', () => {
    const rest = rasterStickman(IDLE_INPUT).grid;
    const hit = draw({ recoil: 1, motion: 1 }).grid;
    // Median column of a band of rows (robust to a stray hand passing through it).
    const centroid = (grid: number[], r0: number, r1: number) => {
      const xs = cells(grid)
        .filter(([, y]) => y >= r0 && y <= r1)
        .map(([x]) => x)
        .sort((a, b) => a - b);
      return xs[Math.floor(xs.length / 2)];
    };
    const top = Math.min(...cells(rest).map(([, y]) => y));
    // Head, chest and hips each move right, and the higher up, the further.
    const head = centroid(hit, top, top + 3) - centroid(rest, top, top + 3);
    const chest = centroid(hit, top + 5, top + 9) - centroid(rest, top + 5, top + 9);
    expect(head).toBeGreaterThan(1);
    expect(chest).toBeGreaterThan(0.5);
    // The feet stay planted.
    expect(centroid(hit, GRID - 2, GRID - 1)).toBeCloseTo(centroid(rest, GRID - 2, GRID - 1), 0);
  });

  it('shrugs: raising one arm lifts that shoulder and tilts the shoulder bar', () => {
    const top = Math.min(...cells(rasterStickman(IDLE_INPUT).grid).map(([, y]) => y));
    const shoulderRow = top + 6; // the 8-dot shoulder bar at rest
    const lit = (grid: number[], col: number, row: number) => grid[row * GRID + col] !== 0;
    const rest = rasterStickman(IDLE_INPUT).grid;
    const raised = draw({ armR: 2.2 }).grid;
    // At rest the bar spans both shoulders on one row.
    expect(lit(rest, GRID / 2 - 4, shoulderRow)).toBe(true);
    expect(lit(rest, GRID / 2 + 2, shoulderRow)).toBe(true);
    // Raising the right arm lifts the right end of the bar off that row; the left end stays.
    expect(lit(raised, GRID / 2 - 4, shoulderRow)).toBe(true);
    expect(lit(raised, GRID / 2 + 2, shoulderRow)).toBe(false);
  });

  it('flails after a hard knock: arms thrown up above the shoulders', () => {
    const top = Math.min(...cells(draw({}).grid).map(([, y]) => y));
    // Lit dots above the shoulder bar but outside the collar are hands.
    const raised = (grid: number[]) => cells(grid).filter(([x, y]) => y <= top + 5 && (x < GRID / 2 - 3 || x > GRID / 2 + 2)).length;
    expect(raised(draw({}).grid)).toBe(0);
    expect(raised(draw({ flail: 1 }).grid)).toBeGreaterThan(2);
  });

  it('is symmetric at rest', () => {
    const { grid } = rasterStickman(IDLE_INPUT);
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++) expect(grid[r * GRID + c] !== 0).toBe(grid[r * GRID + (GRID - 1 - c)] !== 0);
  });

  it('lies down on its side to sleep', () => {
    const sleep = bounds(draw({ state: stateCode('sleeping') }).grid);
    expect(sleep.w).toBeGreaterThan(sleep.h);
  });

  it('turns with the room: on its side it lies along the floor (not floating), full width', () => {
    const turned = bounds(draw({ rot: Math.PI / 2, motion: 0.35 }).grid);
    // The whole standing figure, a quarter turn round: 21 long, as thick as it is wide…
    expect(turned.w).toBeGreaterThanOrEqual(20);
    expect(turned.h).toBeGreaterThanOrEqual(bounds(rasterStickman(IDLE_INPUT).grid).w - 1);
    // …resting on the bottom row.
    expect(turned.bottom).toBe(GRID - 1);
    // Upside down it keeps its full height.
    expect(bounds(draw({ rot: Math.PI, motion: 0.35 }).grid).h).toBe(21);
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

  it('stays in one piece through hard jumps, knocks, walls, spins and every state', () => {
    // Regressions: shrugging shoulders lifted the shoulder bar off the spine; limbs
    // past a wall were erased (cutting a hand off at the elbow); a jolt while lying
    // down pushed the head off the neck; turned figures could round apart at a joint.
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const states = Object.keys(EXPRESSIONS) as CharacterState[];
    for (let i = 0; i < 4000; i++) {
      const st = states[Math.floor(rnd() * states.length)];
      if (st === 'hidden') continue;
      const turn = rnd();
      const { grid } = draw({
        t: rnd() * 20,
        seed: Math.floor(rnd() * 5),
        state: stateCode(st),
        motion: rnd() < 0.85 ? 1 : 0.35,
        walking: st === 'walking' ? 1 : 0,
        walkPhase: rnd() * 7,
        facing: rnd() < 0.5 ? -1 : 1,
        air: rnd() < 0.5 ? 1 : 0,
        vy: (rnd() - 0.5) * 8,
        squash: -0.35 + rnd() * 0.8,
        recoil: (rnd() - 0.5) * 2.8,
        flail: rnd() < 0.5 ? rnd() : 0,
        lean: (rnd() - 0.5) * 0.8,
        armL: (rnd() - 0.3) * 3,
        armR: (rnd() - 0.3) * 3,
        bounce: rnd(),
        sway: rnd() < 0.3 ? rnd() : 0,
        lower: rnd() < 0.3 ? rnd() : 0,
        lookX: (rnd() - 0.5) * 2,
        spin: rnd() < 0.2 ? rnd() : 0,
        rot: turn < 0.5 ? 0 : turn < 0.65 ? Math.PI / 2 : turn < 0.8 ? -Math.PI / 2 : turn < 0.9 ? Math.PI : (rnd() - 0.5) * 7,
        roomL: rnd() < 0.3 ? 3 + rnd() * 6 : 99,
        roomR: rnd() < 0.3 ? 3 + rnd() * 6 : 99,
        roomT: rnd() < 0.3 ? 16 + rnd() * 10 : 99,
      });
      const n = pieces(grid);
      // Watering also drips loose drops from the spout.
      if (st !== 'watering') expect({ st, i, n }).toEqual({ st, i, n: 1 });
    }
  });

  it('holds its props and stays in one piece using room items', () => {
    for (const st of ['watering', 'reading', 'reaching', 'tugging', 'peeking', 'pointing', 'checkingWatch', 'clapping', 'presenting', 'sitting'] as const)
      for (const t of [0, 0.4, 1.1]) {
        // Watering also drips two loose drops from the spout.
        const n = pieces(draw({ t, state: stateCode(st) }).grid);
        expect({ st, t, n: st === 'watering' && n <= 3 ? 1 : n }).toEqual({ st, t, n: 1 });
      }
    // The can and the book add dots beyond the bare figure.
    const bare = cells(draw({}).grid).length;
    expect(cells(draw({ state: stateCode('watering') }).grid).length).toBeGreaterThan(bare + 10);
    expect(draw({ state: stateCode('reading') }).grid.join('')).not.toBe(draw({ state: stateCode('idle') }).grid.join(''));
  });
});

/** How many 8-connected groups of body dots the frame has (1 = nothing floating loose). */
function pieces(grid: number[]): number {
  const seen = new Array<boolean>(grid.length).fill(false);
  let n = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== 1 || seen[i]) continue;
    n++;
    const stack = [i];
    seen[i] = true;
    while (stack.length) {
      const j = stack.pop()!;
      const c = j % GRID;
      const r = Math.floor(j / GRID);
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const cc = c + dc;
          const rr = r + dr;
          const k = rr * GRID + cc;
          if (cc >= 0 && rr >= 0 && cc < GRID && rr < GRID && grid[k] === 1 && !seen[k]) {
            seen[k] = true;
            stack.push(k);
          }
        }
    }
  }
  return n;
}
