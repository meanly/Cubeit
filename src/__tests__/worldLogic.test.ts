import { circadianEnergy, driftMood, moodLabel } from '../character/mood';
import { characterRect, makeGeometry, projectX, projectY, unprojectFloor, WORLD } from '../physics/geometry';
import { shapeTilt, stepBall, stepBody, stepTilt } from '../physics/simulation';
import { initialBall, initialBody, initialTilt, PhysicsEvent, type PhysicsParams } from '../physics/types';
import { bondLevel, bondProgress, dailyCheck, dayKey, daysBetween, starsForGame } from '../progression/progression';

const params = (over: Partial<PhysicsParams> = {}): PhysicsParams => ({
  tiltEnabled: 1,
  sensitivity: 1,
  calValid: 0,
  calX: 0,
  calY: 0,
  calZ: 0,
  reduceMotion: 0,
  speedBoost: 1,
  ...over,
});

const g = makeGeometry(360, 480);

describe('room projection', () => {
  it('maps the floor corners to the room shape and back', () => {
    expect(projectX(g, 0, 0)).toBeCloseTo(g.L0);
    expect(projectX(g, 1, 0)).toBeCloseTo(g.R0);
    expect(projectX(g, 0, 1)).toBeCloseTo(g.bL);
    expect(projectY(g, 1, 0)).toBeCloseTo(g.bB);
    const p = unprojectFloor(g, projectX(g, 0.3, 0.6), projectY(g, 0.6, 0));
    expect(p.x).toBeCloseTo(0.3);
    expect(p.z).toBeCloseTo(0.6);
  });

  it('keeps the character the same size at any depth, a little higher further back', () => {
    const near = characterRect(g, 0.5, 0, 0);
    const far = characterRect(g, 0.5, 0.7, 0);
    expect(far.height).toBeCloseTo(near.height);
    expect(far.bottom).toBeLessThan(near.bottom);
  });
});

describe('tilt processing', () => {
  it('ignores tiny tilts (dead zone)', () => {
    expect(shapeTilt(0.02, 0.035)).toBe(0);
    expect(shapeTilt(-0.5, 0.035)).toBeLessThan(0);
  });

  it('auto-calibrates to the first reading so holding still means no motion', () => {
    const t = { ...initialTilt(), rawX: 1.2, rawY: -6, rawZ: -7.5, hasRaw: 1 };
    const events: number[] = [];
    for (let i = 0; i < 60; i++) stepTilt(t, params(), 1 / 60, events);
    expect(t.autoValid).toBe(1);
    expect(Math.abs(t.x)).toBeLessThan(1e-6);
    expect(events).toEqual([]);
  });

  it('turns a sustained left tilt into negative x and reports start/end', () => {
    const t = { ...initialTilt(), rawX: 0, rawY: -6, rawZ: -7.5, hasRaw: 1 };
    const events: number[] = [];
    stepTilt(t, params(), 1 / 60, events); // calibrate
    t.rawX = -4; // left edge down: gravity points left
    for (let i = 0; i < 60; i++) stepTilt(t, params(), 1 / 60, events);
    expect(t.x).toBeLessThan(-0.3);
    expect(events[0]).toBe(PhysicsEvent.TiltStart);
    t.rawX = 0;
    for (let i = 0; i < 120; i++) stepTilt(t, params(), 1 / 60, events);
    expect(events).toContain(PhysicsEvent.TiltEnd);
  });

  it('does nothing when tilt is disabled', () => {
    const t = { ...initialTilt(), rawX: -9, hasRaw: 1 };
    for (let i = 0; i < 30; i++) stepTilt(t, params({ tiltEnabled: 0 }), 1 / 60, []);
    expect(t.x).toBe(0);
  });
});

describe('character physics', () => {
  it('slides with a gentle tilt until his body touches the wall', () => {
    const b = initialBody(0.5, 0.3);
    const t = { ...initialTilt(), x: -0.4, z: 0.3 };
    const events: number[] = [];
    for (let i = 0; i < 600; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, events);
    expect(b.fallen).toBe(0);
    expect(b.z).toBeLessThanOrEqual(WORLD.zMax);
    expect(b.x).toBeCloseTo(WORLD.xMin, 2);
    expect(events).toContain(PhysicsEvent.Bump);
  });

  it('is knocked over by a hard tilt, slides head-first into the wall, then gets up', () => {
    const b = initialBody(0.5, 0.3);
    const t = { ...initialTilt(), x: -1 };
    const events: number[] = [];
    for (let i = 0; i < 300; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, events);
    expect(b.fallen).toBeGreaterThan(0);
    expect(b.fallDir).toBe(-1);
    expect(b.x).toBeCloseTo(WORLD.lieHalf, 2);
    t.x = 0;
    for (let i = 300; i < 420; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, events);
    expect(b.fallen).toBe(0);
  });

  it('falls up and bumps the ceiling when the screen is tipped over, then drops back', () => {
    const b = initialBody(0.5, 0.3);
    const t = { ...initialTilt(), z: 1 };
    const events: number[] = [];
    for (let i = 0; i < 300; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, events);
    expect(b.onCeil).toBe(1);
    const bumps = events.filter((_, i) => i % 3 === 0 && events[i] === PhysicsEvent.Bump).length;
    expect(bumps).toBeGreaterThan(0);
    expect(events.some((e, i) => i % 3 === 2 && events[i - 2] === PhysicsEvent.Bump && e === 4)).toBe(true);
    t.z = 0;
    for (let i = 300; i < 500; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, events);
    expect(b.onCeil).toBe(0);
    expect(b.y).toBe(0);
    expect(events).toContain(PhysicsEvent.Land);
  });

  it('walks to a target and reports arrival', () => {
    const b = { ...initialBody(0.2, 0.2), hasTarget: 1, tx: 0.7, tz: 0.5, cmdId: 9 };
    const events: number[] = [];
    for (let i = 0; i < 600 && b.hasTarget === 1; i++) stepBody(b, initialTilt(), params(), g, 1 / 60, i / 60, events);
    expect(b.hasTarget).toBe(0);
    expect(events.slice(0, 2)).toEqual([PhysicsEvent.Arrive, 9]);
    expect(b.x).toBeCloseTo(0.7, 1);
  });

  it('falls back to the floor after a hop and squashes on landing', () => {
    const b = { ...initialBody(0.5, 0.3), vy: 2.5, y: 0.001 };
    const events: number[] = [];
    for (let i = 0; i < 240; i++) stepBody(b, initialTilt(), params(), g, 1 / 60, i / 60, events);
    expect(b.y).toBe(0);
    expect(events).toContain(PhysicsEvent.Land);
  });

  it('stays put while anchored unless tilted hard', () => {
    const b = { ...initialBody(0.2, 0.9), anchored: 1, anchorX: 0.2, anchorZ: 0.9, anchorY: 0.05, zMax: 0.93 };
    const gentle = { ...initialTilt(), x: 0.2 };
    for (let i = 0; i < 60; i++) stepBody(b, gentle, params(), g, 1 / 60, i / 60, []);
    expect(b.anchored).toBe(1);
    const hard = { ...initialTilt(), x: 0.8 };
    const events: number[] = [];
    stepBody(b, hard, params(), g, 1 / 60, 2, events);
    expect(b.anchored).toBe(0);
    expect(events[0]).toBe(PhysicsEvent.Dislodged);
  });

  it('kicks the ball when walking into it', () => {
    const body = { ...initialBody(0.5, 0.3), vx: 0.6 };
    const ball = { ...initialBall(), x: 0.58, z: 0.3 };
    const events: number[] = [];
    stepBall(ball, body, initialTilt(), 1 / 60, 1, events);
    expect(ball.vx).toBeGreaterThan(0);
    expect(events[0]).toBe(PhysicsEvent.BallHit);
  });
});

describe('mood', () => {
  it('labels moods', () => {
    expect(moodLabel({ valence: 0.8, energy: 0.6 })).toBe('joyful');
    expect(moodLabel({ valence: 0.5, energy: 0.1 })).toBe('sleepy');
    expect(moodLabel({ valence: -0.3, energy: 0.6 })).toBe('blue');
  });

  it('settles back to content after a long absence — no punishment', () => {
    const p = { curiosity: 0.5, playfulness: 0.5, calm: 0.5 };
    const blue = { valence: -0.4, energy: 0.2, updatedAt: 0 };
    const later = driftMood(blue, 3 * 24 * 3600_000, p, 14);
    expect(later.valence).toBeGreaterThan(0.3);
    expect(later.energy).toBeCloseTo(circadianEnergy(14), 1);
  });

  it('is sleepier at night', () => {
    expect(circadianEnergy(2)).toBeLessThan(circadianEnergy(11));
  });
});

describe('progression', () => {
  it('computes friendship levels', () => {
    expect(bondLevel(0)).toBe(1);
    expect(bondLevel(25)).toBe(2);
    expect(bondProgress(30).fraction).toBeCloseTo(5 / 45);
  });

  it('gives one discovery per new day with no streak penalty', () => {
    const now = new Date(2026, 9, 10, 9).getTime();
    expect(dailyCheck(dayKey(now), [], now)).toEqual({ isNewDay: false, daysAway: 0, gift: null });
    const back = dailyCheck('2026-10-01', [], now, () => 0);
    expect(back.isNewDay).toBe(true);
    expect(back.daysAway).toBe(9);
    expect(back.gift).toEqual({ kind: 'find', id: 'pebble' });
  });

  it('counts calendar days', () => {
    expect(daysBetween('2026-02-27', '2026-03-01')).toBe(2);
  });

  it('rewards games modestly', () => {
    expect(starsForGame('starCatch', 10, false)).toBe(8);
    expect(starsForGame('starCatch', 100, false)).toBe(40);
    expect(starsForGame('peekaboo', 3, true)).toBe(17);
  });
});
