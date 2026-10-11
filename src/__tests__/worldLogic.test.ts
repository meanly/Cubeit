import { circadianEnergy, driftMood, moodLabel } from '../character/mood';
import { characterRect, makeGeometry, projectX, projectY, touchesCharacter, unprojectFloor, WORLD } from '../physics/geometry';
import { bodyHalfX, PHYS, scatter, shapeTilt, stepBall, stepBody, stepMess, stepTilt } from '../physics/simulation';
import { initialBall, initialBody, initialMess, initialTilt, PhysicsEvent, type PhysicsParams, type TiltState } from '../physics/types';
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
  orientLocked: 0,
  ...over,
});

/** A calibrated tilt state held at raw gravity x (m/s²; negative = left edge down) and y (positive = top edge down). */
function heldTilt(rawX: number, rawY = -6, steps = 120, p = params()): { t: TiltState; events: number[] } {
  const t = { ...initialTilt(), rawX: 0, rawY: -6, rawZ: -7.5, hasRaw: 1 };
  const events: number[] = [];
  stepTilt(t, p, 1 / 60, events); // calibrate to holding still
  t.rawX = rawX;
  t.rawY = rawY;
  for (let i = 0; i < steps; i++) stepTilt(t, p, 1 / 60, events);
  return { t, events };
}

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

  it('catches a falling star that lands on him on screen, whatever its depth', () => {
    const head = WORLD.charHeight - 0.02;
    // Same x, very different depth: on the flat LCD that's a few dots, still on him.
    expect(touchesCharacter(g, 0.5, 0.64, head, 3, 0.5, 0.08, 0)).toBe(true);
    expect(touchesCharacter(g, 0.55, 0.1, 0.12, 3, 0.5, 0.6, 0)).toBe(true);
    // Off to the side, or still well above his head: not caught.
    expect(touchesCharacter(g, 0.8, 0.3, head, 3, 0.5, 0.3, 0)).toBe(false);
    expect(touchesCharacter(g, 0.5, 0.3, WORLD.charHeight + 0.2, 3, 0.5, 0.3, 0)).toBe(false);
  });
});

describe('tilt processing', () => {
  it('ignores tiny tilts (dead zone)', () => {
    expect(shapeTilt(0.02, 0.035)).toBe(0);
    expect(shapeTilt(-0.5, 0.035)).toBeLessThan(0);
  });

  it('holding the phone the way it was picked up means no motion', () => {
    const t = { ...initialTilt(), rawX: 0, rawY: -6, rawZ: -7.5, hasRaw: 1 };
    const events: number[] = [];
    for (let i = 0; i < 60; i++) stepTilt(t, params(), 1 / 60, events);
    expect(t.autoValid).toBe(1);
    expect(Math.abs(t.x)).toBeLessThan(1e-6);
    expect(Math.abs(t.z)).toBeLessThan(1e-6);
    expect(events).toEqual([]);
  });

  it('measures sideways tilt from true level, so opening the app tilted never skews it', () => {
    // Opened while rolled right: that roll is real tilt, not the new "level".
    const t = { ...initialTilt(), rawX: 2, rawY: -6, rawZ: -7.5, hasRaw: 1 };
    for (let i = 0; i < 60; i++) stepTilt(t, params(), 1 / 60, []);
    expect(t.x).toBeGreaterThan(0.1);
    // Level again → no sideways tilt at all.
    t.rawX = 0;
    for (let i = 0; i < 60; i++) stepTilt(t, params(), 1 / 60, []);
    expect(Math.abs(t.x)).toBeLessThan(1e-3);
  });

  it('lets the forward/back neutral follow a change of posture', () => {
    const t = { ...initialTilt(), rawX: 0, rawY: -6, rawZ: -7.5, hasRaw: 1 };
    stepTilt(t, params(), 1 / 60, []);
    t.rawY = -8; // now holding it more upright
    for (let i = 0; i < 30; i++) stepTilt(t, params(), 1 / 60, []);
    expect(t.z).toBeLessThan(-0.1);
    for (let i = 0; i < 60 * 40; i++) stepTilt(t, params(), 1 / 60, []);
    expect(Math.abs(t.z)).toBeLessThan(0.02);
    // A saved neutral stays put.
    const saved = { ...initialTilt(), rawX: 0, rawY: -8, rawZ: -5.5, hasRaw: 1 };
    for (let i = 0; i < 60 * 40; i++) stepTilt(saved, params({ calValid: 1, calY: -6 }), 1 / 60, []);
    expect(saved.z).toBeLessThan(-0.1);
  });

  it('turns "down" to whichever side is lowest, and back', () => {
    const { t, events } = heldTilt(-8);
    expect(t.x).toBeLessThan(-0.6);
    // Left edge down: side 1, the stickman turned a quarter clockwise.
    expect(t.side).toBe(1);
    expect(t.angle).toBeCloseTo(Math.PI / 2, 2);
    expect(events[0]).toBe(PhysicsEvent.TiltStart);
    t.rawX = 0;
    for (let i = 0; i < 120; i++) stepTilt(t, params(), 1 / 60, events);
    expect(t.side).toBe(0);
    expect(t.angle).toBeCloseTo(0, 2);
    expect(events).toContain(PhysicsEvent.TiltEnd);
  });

  it('turns right and upside down too, and keeps a side until the tilt really eases (no flicker)', () => {
    expect(heldTilt(8).t.angle).toBeCloseTo(-Math.PI / 2, 2);
    expect(Math.abs(heldTilt(0, 3).t.angle)).toBeCloseTo(Math.PI, 2);
    const { t } = heldTilt(-8);
    // Easing to just under the entry tilt still holds the side…
    t.rawX = -5;
    for (let i = 0; i < 60; i++) stepTilt(t, params(), 1 / 60, []);
    expect(t.side).toBe(1);
    // …and a gentle tilt never moves "down" off the floor.
    expect(heldTilt(-3).t.side).toBe(0);
  });

  it('keeps the floor down during games', () => {
    expect(heldTilt(-8, -6, 120, params({ orientLocked: 1 })).t.side).toBe(0);
  });

  it('tells the brain when a gentle tilt starts and ends', () => {
    const { t, events } = heldTilt(-3);
    expect(events.slice(0, 2)).toEqual([PhysicsEvent.TiltStart, 0]);
    t.rawX = 0;
    for (let i = 0; i < 120; i++) stepTilt(t, params(), 1 / 60, events);
    expect(events).toContain(PhysicsEvent.TiltEnd);
  });

  it('only leans the furniture a little, toward the low side, even on a hard tilt', () => {
    const gentle = heldTilt(-3).t;
    expect(gentle.lean).toBeLessThan(-0.01);
    const hard = heldTilt(-8, -6, 240).t;
    expect(hard.side).toBe(1);
    expect(hard.lean).toBeLessThan(0);
    expect(Math.abs(hard.lean)).toBeLessThanOrEqual(PHYS.itemLean + 1e-3);
    expect(heldTilt(8, -6, 240).t.lean).toBeGreaterThan(0);
    // Games keep everything still.
    expect(heldTilt(-8, -6, 240, params({ orientLocked: 1 })).t.lean).toBe(0);
  });

  it('only a real shake makes a mess', () => {
    const t = { ...initialTilt() };
    const events: number[] = [];
    // A couple of bumps drain away…
    for (let i = 0; i < 120; i++) {
      if (i % 40 === 0) t.jolt += 1;
      stepTilt(t, params(), 1 / 60, events);
    }
    expect(events).not.toContain(PhysicsEvent.MessUp);
    // …several hard jolts in quick succession don't.
    for (let i = 0; i < 20; i++) {
      if (i % 5 === 0) t.jolt += 1;
      stepTilt(t, params(), 1 / 60, events);
    }
    expect(events).toContain(PhysicsEvent.MessUp);
    expect(t.messNow).toBe(1);
  });

  it('does nothing when tilt is disabled', () => {
    const t = { ...initialTilt(), rawX: -9, hasRaw: 1 };
    for (let i = 0; i < 30; i++) stepTilt(t, params({ tiltEnabled: 0 }), 1 / 60, []);
    expect(t.x).toBe(0);
  });
});

describe('character physics', () => {
  it('slides toward the low side on a gentle tilt, still on its feet', () => {
    const b = initialBody(0.5, 0.3);
    const { t } = heldTilt(-3);
    for (let i = 0; i < 60; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, []);
    expect(b.x).toBeLessThan(0.4);
    expect(b.rot).toBe(0);
    // Leaning back against the slope.
    expect(b.lean).toBeGreaterThan(0);
  });

  it('gets swept along instead of walking uphill against a strong tilt', () => {
    const b = { ...initialBody(0.5, 0.3), hasTarget: 1, tx: 0.9, tz: 0.3, cmdId: 1 };
    const t = { ...initialTilt(), x: -0.5 };
    for (let i = 0; i < 60; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, []);
    expect(b.x).toBeLessThan(0.5);
    expect(b.walking).toBe(0);
  });

  it('reacts to a wall with its whole body: knocked back, off its feet, then settles', () => {
    const b = { ...initialBody(0.92, 0.3), vx: 1.6 };
    const events: number[] = [];
    let minRecoil = 0;
    let flew = false;
    let maxFlail = 0;
    for (let i = 0; i < 30; i++) {
      stepBody(b, initialTilt(), params({ tiltEnabled: 0 }), g, 1 / 60, 10 + i / 60, events);
      minRecoil = Math.min(minRecoil, b.recoil);
      maxFlail = Math.max(maxFlail, b.flail);
      if (b.y > 0.01) flew = true;
    }
    expect(events).toContain(PhysicsEvent.Bump);
    // Hit the right wall: the upper body is thrown left, away from it.
    expect(minRecoil).toBeLessThan(-0.5);
    expect(maxFlail).toBeGreaterThan(0.5);
    expect(flew).toBe(true);
    for (let i = 30; i < 400; i++) stepBody(b, initialTilt(), params({ tiltEnabled: 0 }), g, 1 / 60, 10 + i / 60, events);
    expect(Math.abs(b.recoil)).toBeLessThan(0.02);
    expect(b.flail).toBe(0);
    expect(b.y).toBe(0);
  });

  it('keeps the body still on knocks with reduce motion', () => {
    const b = { ...initialBody(0.85, 0.3), vx: 1.6 };
    for (let i = 0; i < 30; i++) stepBody(b, initialTilt(), params({ tiltEnabled: 0, reduceMotion: 1 }), g, 1 / 60, i / 60, []);
    expect(b.recoil).toBe(0);
    expect(b.flail).toBe(0);
  });

  it('falls to the side that is down and stands on it', () => {
    const b = initialBody(0.5, 0.3);
    const { t } = heldTilt(-8);
    const events: number[] = [];
    for (let i = 0; i < 240; i++) stepBody(b, t, params(), g, 1 / 60, 10 + i / 60, events);
    expect(b.rot).toBeCloseTo(Math.PI / 2, 2);
    // Feet against the left border: he landed on it.
    expect(b.x).toBeCloseTo(bodyHalfX(b.rot), 3);
    expect(events).toContain(PhysicsEvent.Land);
    // Upright again, he stays where he landed and stands back up.
    t.rawX = 0;
    for (let i = 0; i < 120; i++) {
      stepTilt(t, params(), 1 / 60, []);
      stepBody(b, t, params(), g, 1 / 60, 20 + i / 60, []);
    }
    expect(b.rot).toBeCloseTo(0, 2);
    expect(b.y).toBe(0);
  });

  it('slides up and down a side wall with the tilt instead of sticking in the corner', () => {
    const b = initialBody(0.5, 0.3);
    // Phone turned onto its left edge, top tipped a little lower than the bottom.
    const { t } = heldTilt(-8, 2.5, 30);
    expect(t.side).toBe(1);
    for (let i = 0; i < 240; i++) {
      stepTilt(t, params(), 1 / 60, []);
      stepBody(b, t, params(), g, 1 / 60, 10 + i / 60, []);
    }
    const high = b.y;
    expect(high).toBeGreaterThan(0.2);
    // Bottom edge lower again: he slides back down the wall, to the corner.
    t.rawY = -5;
    for (let i = 0; i < 300; i++) {
      stepTilt(t, params(), 1 / 60, []);
      stepBody(b, t, params(), g, 1 / 60, 20 + i / 60, []);
    }
    expect(t.side).toBe(1);
    expect(b.y).toBe(0);
    // Out of the corner as soon as the phone tips the other way.
    t.rawX = 4;
    t.rawY = -6;
    for (let i = 0; i < 90; i++) {
      stepTilt(t, params(), 1 / 60, []);
      stepBody(b, t, params(), g, 1 / 60, 30 + i / 60, []);
    }
    expect(t.side).toBe(0);
    expect(b.x).toBeGreaterThan(0.4);
  });

  it('rests still against a wall it is tilted into (no buzzing)', () => {
    const b = initialBody(0.5, 0.3);
    const { t } = heldTilt(-4);
    expect(t.side).toBe(0);
    for (let i = 0; i < 180; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, []);
    const xs: number[] = [];
    for (let i = 0; i < 60; i++) {
      stepBody(b, t, params(), g, 1 / 60, 3 + i / 60, []);
      xs.push(b.x);
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(1e-6);
    expect(b.vx).toBe(0);
  });

  it('follows even a gentle tilt rather than walking against it', () => {
    const b = { ...initialBody(0.5, 0.3), hasTarget: 1, tx: 0.9, tz: 0.3, cmdId: 1 };
    const t = { ...initialTilt(), x: -0.2 };
    for (let i = 0; i < 60; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, []);
    expect(b.x).toBeLessThan(0.45);
  });

  it('follows a whole tilt gesture smoothly: onto the left wall and back, no jumps, no flicker, never stuck', () => {
    // Phone held at 45°; it's turned onto its left edge over 2 s, held, then
    // turned back past level to the right. Sensor at 30 Hz, physics at 60 Hz.
    const G = 9.81;
    const m = Math.cos(Math.PI / 4);
    const b = initialBody(0.5, 0.3);
    const t = { ...initialTilt(), rawX: 0, rawY: -G * m, rawZ: -G * m, hasRaw: 1 };
    const keyframes: [number, number][] = [
      [0, 0],
      [2, -100],
      [3, -100],
      [5.5, 35],
      [7, 35],
    ];
    const angleAt = (time: number) => {
      for (let i = 1; i < keyframes.length; i++) {
        const [t1, a1] = keyframes[i];
        const [t0, a0] = keyframes[i - 1];
        if (time <= t1) return a0 + ((time - t0) / (t1 - t0)) * (a1 - a0);
      }
      return keyframes[keyframes.length - 1][1];
    };
    const sides: number[] = [];
    let maxStep = 0;
    let minX = 1;
    for (let i = 0; i < 7 * 60; i++) {
      const time = i / 60;
      if (i % 2 === 0) {
        const a = (angleAt(time) * Math.PI) / 180;
        t.rawX = G * m * Math.sin(a);
        t.rawY = -G * m * Math.cos(a);
      }
      const x0 = b.x;
      const y0 = b.y;
      stepTilt(t, params(), 1 / 60, []);
      stepBody(b, t, params(), g, 1 / 60, time, []);
      if (sides[sides.length - 1] !== t.side) sides.push(t.side);
      maxStep = Math.max(maxStep, Math.hypot(b.x - x0, b.y - y0));
      minX = Math.min(minX, b.x);
    }
    // Floor → left wall → floor, each switch once.
    expect(sides).toEqual([0, 1, 0]);
    // He reached the left wall…
    expect(minX).toBeLessThan(0.2);
    // …never teleported (< 2 dots a frame)…
    expect(maxStep).toBeLessThan(2 / 60);
    // …and tipped the other way, he left the corner and is upright again.
    expect(b.x).toBeGreaterThan(0.45);
    expect(b.rot).toBeCloseTo(0, 2);
  });

  it('rests against the top edge when the phone is upside down, and drops back', () => {
    const b = initialBody(0.5, 0.3);
    const { t } = heldTilt(0, 3);
    const events: number[] = [];
    for (let i = 0; i < 240; i++) stepBody(b, t, params(), g, 1 / 60, 10 + i / 60, events);
    expect(b.y).toBeGreaterThan(0.2);
    expect(Math.abs(b.rot)).toBeCloseTo(Math.PI, 2);
    t.rawY = -6;
    for (let i = 0; i < 300; i++) {
      stepTilt(t, params(), 1 / 60, []);
      stepBody(b, t, params(), g, 1 / 60, 20 + i / 60, events);
    }
    expect(b.y).toBe(0);
    expect(events).toContain(PhysicsEvent.Land);
  });

  it("doesn't walk while he's on the ceiling", () => {
    const b = { ...initialBody(0.5, 0.3), hasTarget: 1, tx: 0.5, tz: 0.6, cmdId: 3 };
    const { t } = heldTilt(0, 3);
    for (let i = 0; i < 120; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, []);
    expect(b.z).toBeCloseTo(0.3, 3);
    expect(b.walking).toBe(0);
  });

  it('a shake knocks everything out of place, then it all settles back home', () => {
    const mess = initialMess();
    const b = initialBody(0.5, 0.3);
    const ball = initialBall();
    scatter(mess, b, ball, 0);
    expect(b.vy).toBeGreaterThan(0);
    expect(Math.abs(b.messRotV)).toBeGreaterThan(0);
    expect(ball.vy).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) stepMess(mess, 1 / 60);
    // Furniture is knocked about while the mess holds…
    expect(mess.v.slice(0, 3).some((v) => Math.abs(v) > 0.2)).toBe(true);
    for (let i = 0; i < 600; i++) stepMess(mess, 1 / 60);
    // …and back in place afterwards.
    expect(mess.v.filter((_, i) => i % 6 < 3).every((v) => Math.abs(v) < 0.01)).toBe(true);
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

  it('stays tucked in bed, level with it, on a hard tilt', () => {
    const b = { ...initialBody(0.2, 0.9), anchored: 1, anchorX: 0.2, anchorZ: 0.9, anchorY: 0.05, zMax: 0.93 };
    const { t } = heldTilt(-8);
    for (let i = 0; i < 120; i++) stepBody(b, t, params(), g, 1 / 60, i / 60, []);
    expect(b.anchored).toBe(1);
    expect(b.x).toBeCloseTo(0.2, 3);
    expect(b.rot).toBeCloseTo(0, 2);
  });

  it('rolls the ball downhill', () => {
    const ball = initialBall();
    const x0 = ball.x;
    const t = { ...initialTilt(), x: 0.4 };
    for (let i = 0; i < 30; i++) stepBall(ball, initialBody(0.1, 0.8), t, params(), 1 / 60, i / 60, []);
    expect(ball.x).toBeGreaterThan(x0 + 0.02);
  });

  it('kicks the ball when walking into it', () => {
    const body = { ...initialBody(0.5, 0.3), vx: 0.6 };
    const ball = { ...initialBall(), x: 0.58, z: 0.3 };
    const events: number[] = [];
    stepBall(ball, body, initialTilt(), params(), 1 / 60, 1, events);
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
