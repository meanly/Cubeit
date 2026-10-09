import { memo, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, ZoomIn, ZoomOut, type SharedValue } from 'react-native-reanimated';

import { Bitmap } from '../lcd/bitmap';
import { LcdArt } from '../lcd/LcdArt';
import { projectX, projectY, type RoomGeometry } from '../physics/geometry';
import type { ReadonlyShared } from '../physics/types';
import { useCharacterView } from '../state/uiStore';
import type { RigBody } from './CharacterRig';
import { turnDrop } from './pixel/stickman';
import { EMOTE_DOTS, EmoteGlyph } from './EmoteGlyph';
import { LcdBubble } from './LcdBubble';

interface Props {
  body: ReadonlyShared<RigBody>;
  geo: SharedValue<RoomGeometry>;
  visible: SharedValue<number>;
  /** Pixels per LCD dot. */
  dot: number;
  reduceMotion?: boolean;
}

/** Size of the sleeping Z Z Z box, in dots. */
const ZZZ_W = 12;
const ZZZ_H = 15;

/**
 * Where something sits relative to the stickman, turned with him. `lx`, `ly`
 * are a center offset in dots (x right, y up) from his middle — 10.5 dots up
 * standing, 2.5 lying asleep — rotated by his turn; returns screen pixels.
 */
function around(g: RoomGeometry, b: RigBody, lying: boolean, lx: number, ly: number) {
  'worklet';
  const pivotU = lying ? 2.5 : 10.5 - turnDrop(b.rot);
  const px = projectX(g, b.x, b.z);
  const py = projectY(g, b.z, b.y) - pivotU * g.dot;
  const cs = Math.cos(b.rot);
  const sn = Math.sin(b.rot);
  // Screen y points down; rotation is clockwise.
  const x = lx * g.dot;
  const y = -ly * g.dot;
  return { x: px + x * cs - y * sn, y: py + x * sn + y * cs };
}

/** Clamp a turned box's center so the whole box stays inside the room. */
function inRoom(g: RoomGeometry, cx: number, cy: number, w: number, h: number, rot: number) {
  'worklet';
  const cs = Math.abs(Math.cos(rot));
  const sn = Math.abs(Math.sin(rot));
  const hw = (w * cs + h * sn) / 2 + 2 * g.dot;
  const hh = (w * sn + h * cs) / 2 + 2 * g.dot;
  return {
    x: Math.min(Math.max(cx, g.L0 + hw), g.R0 - hw),
    y: Math.min(Math.max(cy, g.T0 + hh), g.B0 - hh),
  };
}

/** Emotes, speech bubbles and sleeping Z's that follow the character's head, turned with him, on the dot grid. */
export const CharacterOverlay = memo(function CharacterOverlay({ body, geo, visible, dot, reduceMotion = false }: Props) {
  const emote = useCharacterView((s) => s.emote);
  const speech = useCharacterView((s) => s.speech);
  const sleeping = useCharacterView((s) => s.state === 'sleeping');
  const bubbleW = useSharedValue(0);
  const bubbleH = useSharedValue(0);
  const emoteSize = EMOTE_DOTS * dot;
  // While asleep the Z's loop on their own; the old static "zzz" emote is replaced by them.
  const showZzz = sleeping || emote?.id === 'zzz';
  const shownEmote = emote && emote.id !== 'zzz' ? emote : null;

  const emoteStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const b = body.value;
    const e = EMOTE_DOTS;
    const dir = b.facing >= 0 ? 1 : -1;
    const c = sleeping ? around(g, b, true, dir * 9 + e / 2 - 2, 2.5 + e / 2) : around(g, b, false, 3 + e / 2, 10.5 + e * 0.1);
    const p = inRoom(g, c.x, c.y, emoteSize, emoteSize, b.rot);
    return {
      opacity: visible.value,
      transform: [
        { translateX: Math.round((p.x - emoteSize / 2) / g.dot) * g.dot },
        { translateY: Math.round((p.y - emoteSize / 2) / g.dot) * g.dot },
        { rotate: `${b.rot}rad` },
      ],
    };
  });

  const zzzStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const b = body.value;
    const dir = b.facing >= 0 ? 1 : -1;
    const c = sleeping
      ? around(g, b, true, dir * 8 + (dir > 0 ? ZZZ_W / 2 - 2 : -ZZZ_W / 2 + 2), 3 + ZZZ_H / 2)
      : around(g, b, false, 2 + ZZZ_W / 2, 9 + ZZZ_H / 2);
    const w = ZZZ_W * g.dot;
    const h = ZZZ_H * g.dot;
    const p = inRoom(g, c.x, c.y, w, h, b.rot);
    return {
      opacity: visible.value,
      transform: [
        { translateX: Math.round((p.x - w / 2) / g.dot) * g.dot },
        { translateY: Math.round((p.y - h / 2) / g.dot) * g.dot },
        { rotate: `${b.rot}rad` },
      ],
    };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const b = body.value;
    const w = bubbleW.value;
    const h = bubbleH.value;
    const dir = b.facing >= 0 ? 1 : -1;
    // Above the head (or above his side when lying asleep), turned with him.
    const c = sleeping ? around(g, b, true, dir * 8, 3 + 2 + h / g.dot / 2) : around(g, b, false, 0, 10.5 + 2 + h / g.dot / 2);
    const p = inRoom(g, c.x, c.y, w, h, b.rot);
    return {
      opacity: w > 0 ? visible.value : 0,
      transform: [
        { translateX: Math.round((p.x - w / 2) / g.dot) * g.dot },
        { translateY: Math.round((p.y - h / 2) / g.dot) * g.dot },
        { rotate: `${b.rot}rad` },
      ],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {showZzz && (
        <Animated.View style={[styles.abs, zzzStyle]}>
          <ZzzLoop dot={dot} still={reduceMotion} />
        </Animated.View>
      )}
      {shownEmote && (
        <Animated.View style={[styles.abs, emoteStyle]}>
          <Animated.View key={shownEmote.key} entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(120)}>
            <EmoteGlyph id={shownEmote.id} dot={dot} />
          </Animated.View>
        </Animated.View>
      )}
      {speech && (
        <Animated.View
          style={[styles.abs, { maxWidth: Math.max(190, 48 * dot) }, bubbleStyle]}
          onLayout={(e) => {
            bubbleW.set(e.nativeEvent.layout.width);
            bubbleH.set(e.nativeEvent.layout.height);
          }}
        >
          <Animated.View key={speech.key} entering={FadeIn.duration(120)} exiting={FadeOut.duration(120)}>
            <LcdBubble text={speech.text} dot={dot} />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
});

const Z_SMALL = ['###', '.#.', '###'];
const Z_MID = ['####', '..#.', '.#..', '####'];
const Z_BIG = ['#####', '...#.', '..#..', '.#...', '#####'];
/** Steps in one loop (at 5 per second), and how far apart the three Z's start. */
const LOOP = 12;
const STAGGER = 4;

/**
 * Sleeping Z's: three pixel Z's drift up and away from the head, growing as
 * they rise and vanishing at the top, one after another, forever — stepped
 * like an LCD animation. Reduced motion shows them still.
 */
const ZzzLoop = memo(function ZzzLoop({ dot, still }: { dot: number; still: boolean }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setStep((s) => (s + 1) % LOOP), 200);
    return () => clearInterval(id);
  }, [still]);
  const bitmap = useMemo(() => {
    const b = new Bitmap(ZZZ_W, ZZZ_H);
    for (let i = 0; i < 3; i++) {
      const f = (step + i * STAGGER) % LOOP;
      if (f === LOOP - 1) continue; // blink out at the top before starting again
      const glyph = f < 4 ? Z_SMALL : f < 8 ? Z_MID : Z_BIG;
      const size = glyph.length;
      // Bottom-left (by the head) to top-right, swaying a dot side to side.
      const x = Math.round((f / (LOOP - 1)) * (ZZZ_W - 6)) + (f % 4 < 2 ? 0 : 1);
      const y = Math.round((1 - f / (LOOP - 1)) * (ZZZ_H - size));
      b.sprite(glyph, x, y);
    }
    return b.outline();
  }, [step]);
  return <LcdArt bitmap={bitmap} dot={dot} />;
});

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
