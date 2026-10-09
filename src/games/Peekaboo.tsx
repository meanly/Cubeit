import { memo, useEffect, useRef } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';

import { getBrain } from '../character/useCharacterBrain';
import { Bitmap, LCD_DOTS } from '../lcd/bitmap';
import { LcdArt } from '../lcd/LcdArt';
import { floorY, projectX, WORLD, type RoomGeometry } from '../physics/geometry';
import { useWorld } from '../physics/World';
import { feedback } from '../services/feedback';
import { useReduceMotion } from '../services/motion';
import { useGame } from '../state/gameStore';
import { finishGame } from './results';
import { useGameSession } from './session';

const POSITIONS = [0.25, 0.5, 0.75];
const BOX_Z = 0.36;
/** Box art size in dots. */
const BOX_DW = 13;
const BOX_DH = 12;
const BOX_W = BOX_DW / LCD_DOTS;
const BOX_H = BOX_DH / LCD_DOTS;
/** Swaps per round and how long each swap takes (ms). */
const ROUNDS = [
  { swaps: 3, ms: 560 },
  { swaps: 5, ms: 430 },
  { swaps: 7, ms: 330 },
];

/**
 * Shell-game style hide and seek. JS sequences each round with cancellable
 * waits; box motion is animated on the UI thread with withTiming.
 */
export function Peekaboo({ g }: { g: RoomGeometry }) {
  const world = useWorld();
  const name = useGame((s) => s.character.name);
  const reduceMotion = useReduceMotion();
  const bx = [useSharedValue(POSITIONS[0]), useSharedValue(POSITIONS[1]), useSharedValue(POSITIONS[2])];
  const bz = [useSharedValue(BOX_Z), useSharedValue(BOX_Z), useSharedValue(BOX_Z)];
  const lift = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const appear = useSharedValue(0);
  const phase = useRef<'idle' | 'busy' | 'guess'>('idle');
  const hidden = useRef(0);
  const run = useRef(0);
  const guessResolver = useRef<((box: number) => void) | null>(null);

  useEffect(() => {
    const session = useGameSession.getState();
    const brain = getBrain();
    const { commands, pose, mode, body } = world;
    let paused = false;
    let resumeWaiters: (() => void)[] = [];

    /** Cancellable, pausable wait for the current run. */
    const wait = async (ms: number, id: number) => {
      await new Promise((r) => setTimeout(r, ms));
      while (paused && run.current === id) await new Promise<void>((r) => resumeWaiters.push(r));
      if (run.current !== id) throw new Error('stopped');
    };
    const message = (text: string | null) => useGameSession.getState().patch({ message: text });

    // Paced so the player can clearly see which box gets the character.
    const hideCharacter = async (box: number, id: number) => {
      const x = bx[box].value;
      appear.set(withTiming(0, { duration: 250 }));
      commands.freeze(false);
      pose.visible.set(withTiming(1, { duration: 150 }));
      brain?.setState('walking');
      const b = body.value;
      commands.walkTo(x, BOX_Z + 0.07, 0.45, WORLD.zMax);
      await wait(Math.max(900, (Math.hypot(b.x - x, b.z - BOX_Z) / 0.45) * 1000 + 400), id);
      brain?.setState('excited');
      brain?.say('I’ll hide here!', 1400);
      appear.set(withTiming(1, { duration: 400 }));
      await wait(900, id);
      commands.hop(1.5);
      await wait(280, id);
      pose.visible.set(withTiming(0, { duration: 140 }));
      commands.freeze(true);
      feedback('hop');
      lift[box].set(
        withSequence(
          withTiming(0.18, { duration: 110 }),
          withTiming(0, { duration: 150 }),
          withTiming(0.12, { duration: 110 }),
          withTiming(0, { duration: 150 }),
        ),
      );
      await wait(1100, id);
    };

    const shuffle = async (round: (typeof ROUNDS)[number], id: number) => {
      const ms = reduceMotion ? round.ms * 1.6 : round.ms;
      const slotOf = [0, 1, 2]; // slotOf[box] = position index
      for (let i = 0; i < round.swaps; i++) {
        const p = Math.floor(Math.random() * 3);
        const q = (p + 1 + Math.floor(Math.random() * 2)) % 3;
        const a = slotOf.indexOf(p);
        const b = slotOf.indexOf(q);
        bx[a].set(withTiming(POSITIONS[q], { duration: ms }));
        bx[b].set(withTiming(POSITIONS[p], { duration: ms }));
        bz[a].set(withSequence(withTiming(BOX_Z + 0.16, { duration: ms / 2 }), withTiming(BOX_Z, { duration: ms / 2 })));
        bz[b].set(withSequence(withTiming(BOX_Z - 0.16, { duration: ms / 2 }), withTiming(BOX_Z, { duration: ms / 2 })));
        slotOf[a] = q;
        slotOf[b] = p;
        feedback('whoosh');
        await wait(ms + 70, id);
      }
    };

    const reveal = async (choice: number, id: number) => {
      const correct = choice === hidden.current;
      lift[choice].set(withTiming(1, { duration: 320 }));
      feedback('tap');
      await wait(380, id);
      if (!correct) {
        brain?.say('Not here!', 1000);
        await wait(700, id);
        lift[hidden.current].set(withTiming(1, { duration: 320 }));
        await wait(340, id);
      }
      const at = hidden.current;
      commands.freeze(false);
      commands.teleport(bx[at].value, BOX_Z);
      pose.visible.set(withTiming(1, { duration: 160 }));
      commands.hop(1.7);
      if (correct) {
        brain?.setState('celebrating');
        brain?.say('You found me!', 1400);
        feedback('catch');
      } else {
        brain?.setState('happy');
        brain?.say('Here I am! Hehe.', 1400);
        feedback('giggle');
      }
      await wait(1500, id);
      for (const l of lift) l.set(withTiming(0, { duration: 250 }));
      return correct;
    };

    const play = async () => {
      const id = ++run.current;
      let score = 0;
      useGameSession.getState().patch({ phase: 'playing', score: 0, result: null });
      mode.set(2);
      try {
        for (let r = 0; r < ROUNDS.length; r++) {
          useGameSession.getState().patch({ round: `Round ${r + 1} of ${ROUNDS.length}` });
          bx.forEach((v, i) => v.set(POSITIONS[i]));
          hidden.current = Math.floor(Math.random() * 3);
          message('Watch closely!');
          phase.current = 'busy';
          await hideCharacter(hidden.current, id);
          message('Shuffle!');
          await shuffle(ROUNDS[r], id);
          message(`Where’s ${name}? Tap a box!`);
          phase.current = 'guess';
          const choice = await new Promise<number>((resolve) => (guessResolver.current = resolve));
          phase.current = 'busy';
          message(null);
          if (run.current !== id) return;
          if (await reveal(choice, id)) {
            score += 1;
            useGameSession.getState().patch({ score });
          }
        }
        appear.set(withTiming(0, { duration: 300 }));
        mode.set(3);
        phase.current = 'idle';
        const result = finishGame('peekaboo', score, score === ROUNDS.length ? 'great' : score >= 1 ? 'good' : 'meh', ROUNDS.length);
        useGameSession.getState().patch({ phase: 'results', result, message: null, round: null });
      } catch {
        // Stopped (quit / unmounted) — nothing to record.
      }
    };

    const pause = () => {
      if (useGameSession.getState().phase !== 'playing') return;
      paused = true;
      useGameSession.getState().patch({ phase: 'paused' });
    };
    const resume = () => {
      paused = false;
      useGameSession.getState().patch({ phase: 'playing' });
      const waiters = resumeWaiters;
      resumeWaiters = [];
      waiters.forEach((w) => w());
    };

    mode.set(3);
    commands.stop();
    session.patch({
      actions: { start: () => void play(), pause, resume },
      tapHandler: (x, y) => {
        if (phase.current !== 'guess') return phase.current === 'busy';
        const geo = world.geo.value;
        for (let i = 0; i < 3; i++) {
          const cx = projectX(geo, bx[i].value, bz[i].value);
          const w = BOX_W * geo.unit;
          const h = BOX_H * geo.unit;
          const bottom = floorY(geo, bz[i].value);
          if (x > cx - w / 2 - 8 && x < cx + w / 2 + 8 && y > bottom - h - 8 && y < bottom + 8) {
            guessResolver.current?.(i);
            guessResolver.current = null;
            return true;
          }
        }
        return true;
      },
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => {
      appSub.remove();
      run.current += 1;
      paused = false;
      resumeWaiters.forEach((w) => w());
      commands.freeze(false);
      pose.visible.set(withTiming(1, { duration: 200 }));
    };
    // Set up once per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {[0, 1, 2].map((i) => (
        <BoxView key={i} x={bx[i]} z={bz[i]} lift={lift[i]} appear={appear} geo={world.geo} dot={g.dot} />
      ))}
    </>
  );
}

const BOX_ART = new Bitmap(BOX_DW, BOX_DH).sprite(
  [
    '.###########.',
    '#ooooo#ooooo#',
    '#############',
    '#ooooo#ooooo#',
    '#ooooo#ooooo#',
    '#o##ooooo##o#',
    '#ooooo#ooooo#',
    '#ooooo#ooooo#',
    '#ooooo#ooooo#',
    '#ooooo#ooooo#',
    '#ooooo#ooooo#',
    '#############',
  ],
  0,
  0,
);

const BoxView = memo(function BoxView({
  x,
  z,
  lift,
  appear,
  geo,
  dot,
}: {
  x: SharedValue<number>;
  z: SharedValue<number>;
  lift: SharedValue<number>;
  appear: SharedValue<number>;
  geo: SharedValue<RoomGeometry>;
  dot: number;
}) {
  const style = useAnimatedStyle(() => {
    const g = geo.value;
    const left = projectX(g, x.value, z.value) - (BOX_DW / 2) * g.dot;
    // Lifts and the drop-in both move in whole dots.
    const raise = Math.round(lift.value * BOX_DH * 2.1 + (1 - appear.value) * BOX_DH * 0.8) * g.dot;
    const top = floorY(g, z.value) - BOX_DH * g.dot - raise;
    return {
      opacity: appear.value > 0.05 ? 1 : 0,
      transform: [{ translateX: Math.round(left / g.dot) * g.dot }, { translateY: Math.round(top / g.dot) * g.dot }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, style]}>
      <LcdArt bitmap={BOX_ART} dot={dot} />
    </Animated.View>
  );
});

const styles = StyleSheet.create({ abs: { position: 'absolute', left: 0, top: 0 } });
