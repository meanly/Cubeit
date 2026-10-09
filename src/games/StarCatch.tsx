import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet } from 'react-native';
import Animated, { FadeOutUp, useAnimatedStyle, useFrameCallback, useSharedValue, ZoomIn, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { getBrain } from '../character/useCharacterBrain';
import { Bitmap, textWidth } from '../lcd/bitmap';
import { LcdArt } from '../lcd/LcdArt';
import { floorY, projectX, projectY, WORLD, type RoomGeometry } from '../physics/geometry';
import { useWorld } from '../physics/World';
import { feedback } from '../services/feedback';
import { finishGame } from './results';
import { useGameSession } from './session';

const ROUND_SECONDS = 40;
const POOL = 7;

interface FallingStar {
  active: number;
  x: number;
  z: number;
  y: number;
  vy: number;
  gold: number;
}

interface Pop {
  id: number;
  x: number;
  y: number;
  text: string;
}

const emptyPool = (): FallingStar[] => Array.from({ length: POOL }, () => ({ active: 0, x: 0, z: 0, y: 0, vy: 0, gold: 0 }));

/**
 * Stars fall into the room; tilt the phone (or drag on the floor) to move the
 * character under them. Simulation runs on the UI thread alongside the
 * character's physics; only catches are reported to JS.
 */
export function StarCatch({ g }: { g: RoomGeometry }) {
  const world = useWorld();
  const stars = useSharedValue<FallingStar[]>(emptyPool());
  const elapsed = useSharedValue(0);
  const spawnIn = useSharedValue(0.5);
  const running = useSharedValue(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const scoreRef = useRef(0);
  const popId = useRef(0);

  const onEvent = useCallback(
    (points: number, x: number, z: number) => {
      if (points === 0) return;
      scoreRef.current += points;
      useGameSession.getState().patch({ score: scoreRef.current });
      feedback(points > 1 ? 'gold' : 'catch');
      const brain = getBrain();
      brain?.setState(points > 1 ? 'excited' : 'happy');
      if (points > 1) world.commands.hop(1.2);
      const id = popId.current++;
      setPops((p) => [...p.slice(-5), { id, x: projectX(g, x, z), y: projectY(g, z, WORLD.charHeight + 0.08), text: `+${points}` }]);
      setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 700);
    },
    [g, world.commands],
  );

  const frame = useFrameCallback((info) => {
    'worklet';
    if (running.value !== 1) return;
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    elapsed.value += dt;
    const progress = Math.min(1, elapsed.value / ROUND_SECONDS);
    const b = world.body.value;
    const events: number[] = [];
    spawnIn.value -= dt;
    const spawn = spawnIn.value <= 0;
    if (spawn) spawnIn.value = 0.95 - progress * 0.5 + Math.random() * 0.25;
    stars.modify((arr) => {
      'worklet';
      if (spawn) {
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          if (s.active === 1) continue;
          s.active = 1;
          s.x = 0.14 + Math.random() * 0.72;
          s.z = 0.08 + Math.random() * 0.56;
          s.y = 1.05;
          s.vy = -(0.32 + progress * 0.3 + Math.random() * 0.1);
          s.gold = Math.random() < 0.12 ? 1 : 0;
          break;
        }
      }
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        if (s.active === 0) continue;
        s.y += s.vy * dt;
        if (s.y <= WORLD.charHeight + 0.04 && s.y > 0.02 && Math.hypot(s.x - b.x, s.z - b.z) < 0.12) {
          s.active = 0;
          events.push(s.gold === 1 ? 3 : 1, s.x, s.z);
        } else if (s.y <= 0) {
          s.active = 0;
          events.push(0, s.x, s.z);
        }
      }
      return arr;
    });
    for (let i = 0; i < events.length; i += 3) scheduleOnRN(onEvent, events[i], events[i + 1], events[i + 2]);
  }, false);

  // Session wiring: start / pause / resume, the clock, and the end of the round.
  useEffect(() => {
    const session = useGameSession.getState();
    const params = world.params;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopClock = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const runClock = () => {
      stopClock();
      timer = setInterval(() => {
        const left = Math.max(0, ROUND_SECONDS - elapsed.value);
        if (Math.ceil(left) !== Math.ceil(useGameSession.getState().timeLeft ?? 0)) useGameSession.getState().patch({ timeLeft: left });
        if (left <= 0) end();
      }, 200);
    };
    const setRunning = (on: boolean) => {
      running.set(on ? 1 : 0);
      frame.setActive(on);
      world.mode.set(on ? 1 : 3);
      params.set({ ...params.value, speedBoost: on ? 2.8 : 1 });
    };
    const end = () => {
      stopClock();
      setRunning(false);
      stars.set(emptyPool());
      const score = scoreRef.current;
      const result = finishGame('starCatch', score, score >= 25 ? 'great' : score >= 10 ? 'good' : 'meh');
      useGameSession.getState().patch({ phase: 'results', result, timeLeft: 0 });
    };
    const start = () => {
      scoreRef.current = 0;
      stars.set(emptyPool());
      elapsed.set(0);
      spawnIn.set(0.6);
      useGameSession.getState().patch({ phase: 'playing', score: 0, timeLeft: ROUND_SECONDS, result: null, message: null });
      getBrain()?.setState('excited');
      setRunning(true);
      runClock();
    };
    const pause = () => {
      if (useGameSession.getState().phase !== 'playing') return;
      stopClock();
      setRunning(false);
      useGameSession.getState().patch({ phase: 'paused' });
    };
    const resume = () => {
      useGameSession.getState().patch({ phase: 'playing' });
      setRunning(true);
      runClock();
    };

    world.mode.set(3);
    world.commands.stop();
    session.patch({ actions: { start, pause, resume }, timeLeft: ROUND_SECONDS });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') pause();
    });
    return () => {
      appSub.remove();
      stopClock();
      running.set(0);
      frame.setActive(false);
      params.set({ ...params.value, speedBoost: 1 });
    };
    // Set up once per game.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <StarSprite key={i} index={i} stars={stars} geo={world.geo} dot={g.dot} />
      ))}
      {pops.map((p) => (
        <Animated.View
          key={p.id}
          entering={ZoomIn.duration(120)}
          exiting={FadeOutUp.duration(400)}
          pointerEvents="none"
          style={[styles.abs, { left: Math.round(p.x / g.dot - 4) * g.dot, top: Math.round(p.y / g.dot - 8) * g.dot }]}
        >
          <PopText text={p.text} dot={g.dot} />
        </Animated.View>
      ))}
    </>
  );
}

const STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.'];
const GOLD_STAR = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'];
/** Both stars centered in the same 9×9 box (with a panel-colored border). */
const STAR_BOX = 9;
const NORMAL_ART = new Bitmap(STAR_BOX, STAR_BOX).sprite(STAR, 2, 2).outline();
const GOLD_ART = new Bitmap(STAR_BOX, STAR_BOX).sprite(GOLD_STAR, 1, 1).outline();
/** Dotted landing mark on the ground, 7 dots wide. */
const MARK_ART = new Bitmap(7, 1).dotted(0, 6, 0, 2);

const PopText = memo(function PopText({ text, dot }: { text: string; dot: number }) {
  const bitmap = useMemo(() => new Bitmap(textWidth(text) + 2, 7).text(text, 1, 1).outline(), [text]);
  return <LcdArt bitmap={bitmap} dot={dot} />;
});

const StarSprite = memo(function StarSprite({
  index,
  stars,
  geo,
  dot,
}: {
  index: number;
  stars: SharedValue<FallingStar[]>;
  geo: SharedValue<RoomGeometry>;
  dot: number;
}) {
  const starStyle = useAnimatedStyle(() => {
    const s = stars.value[index];
    const g = geo.value;
    const x = projectX(g, s.x, s.z) - (STAR_BOX / 2) * g.dot;
    const y = projectY(g, s.z, s.y) - (STAR_BOX / 2) * g.dot;
    return {
      opacity: s.active,
      transform: [{ translateX: Math.round(x / g.dot) * g.dot }, { translateY: Math.round(y / g.dot) * g.dot }],
    };
  });
  const goldStyle = useAnimatedStyle(() => ({ opacity: stars.value[index].gold }));
  const normalStyle = useAnimatedStyle(() => ({ opacity: 1 - stars.value[index].gold }));
  const markStyle = useAnimatedStyle(() => {
    const s = stars.value[index];
    const g = geo.value;
    const x = projectX(g, s.x, s.z) - 3.5 * g.dot;
    // The mark blinks faster as the star gets close.
    const near = 1 - Math.min(1, s.y / 1.05);
    const blink = near > 0.6 ? Math.floor(Date.now() / 120) % 2 : 1;
    return {
      opacity: s.active * blink,
      transform: [{ translateX: Math.round(x / g.dot) * g.dot }, { translateY: Math.round(floorY(g, s.z) / g.dot - 1) * g.dot }],
    };
  });
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.abs, markStyle]}>
        <LcdArt bitmap={MARK_ART} dot={dot} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.abs, { width: STAR_BOX * dot, height: STAR_BOX * dot }, starStyle]}>
        <Animated.View style={[StyleSheet.absoluteFill, normalStyle]}>
          <LcdArt bitmap={NORMAL_ART} dot={dot} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, goldStyle]}>
          <LcdArt bitmap={GOLD_ART} dot={dot} />
        </Animated.View>
      </Animated.View>
    </>
  );
});

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
