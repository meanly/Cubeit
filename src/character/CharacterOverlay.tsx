import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, ZoomIn, ZoomOut, type SharedValue } from 'react-native-reanimated';

import { projectX, projectY, WORLD, type RoomGeometry } from '../physics/geometry';
import type { ReadonlyShared } from '../physics/types';
import { useCharacterView } from '../state/uiStore';
import type { RigBody } from './CharacterRig';
import { EMOTE_DOTS, EmoteGlyph } from './EmoteGlyph';
import { LcdBubble } from './LcdBubble';

interface Props {
  body: ReadonlyShared<RigBody>;
  geo: SharedValue<RoomGeometry>;
  visible: SharedValue<number>;
  /** Pixels per LCD dot. */
  dot: number;
}

/** Emotes and speech bubbles that follow the character's head, on the dot grid. */
export const CharacterOverlay = memo(function CharacterOverlay({ body, geo, visible, dot }: Props) {
  const emote = useCharacterView((s) => s.emote);
  const speech = useCharacterView((s) => s.speech);
  const sleeping = useCharacterView((s) => s.state === 'sleeping');
  const bubbleW = useSharedValue(0);
  const bubbleH = useSharedValue(0);
  const emoteSize = EMOTE_DOTS * dot;

  const emoteStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const b = body.value;
    // Lying down (asleep or knocked over), the head is low and off to one side.
    const lying = sleeping || b.fallen > 0;
    const dir = b.fallen > 0 ? b.fallDir : b.facing;
    const head = projectY(g, b.z, b.y + (lying ? WORLD.lieHeight : WORLD.charHeight));
    const x = projectX(g, b.x, b.z) + (lying ? dir * 9 - 2 : 3) * g.dot;
    const top = Math.max(g.T0, head - emoteSize * (lying ? 1 : 0.6));
    return {
      opacity: visible.value,
      transform: [{ translateX: Math.round(x / g.dot) * g.dot }, { translateY: Math.round(top / g.dot) * g.dot }],
    };
  });

  const bubbleStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const b = body.value;
    const lying = sleeping || b.fallen > 0;
    const head = projectY(g, b.z, b.y + (lying ? WORLD.lieHeight : WORLD.charHeight));
    const cx = projectX(g, b.x, b.z);
    const w = bubbleW.value;
    const left = Math.min(Math.max(cx - w / 2, g.L0 + 2 * g.dot), g.R0 - w - 2 * g.dot);
    const top = Math.max(g.T0 + 2 * g.dot, head - bubbleH.value - 2 * g.dot);
    return {
      opacity: bubbleW.value > 0 ? visible.value : 0,
      transform: [{ translateX: Math.round(left / g.dot) * g.dot }, { translateY: Math.round(top / g.dot) * g.dot }],
    };
  });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {emote && (
        <Animated.View style={[styles.abs, emoteStyle]}>
          <Animated.View key={emote.key} entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(120)}>
            <EmoteGlyph id={emote.id} dot={dot} />
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

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
});
