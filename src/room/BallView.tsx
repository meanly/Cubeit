import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Bitmap, INK, LCD_INK, LCD_PAPER, PAPER } from '../lcd/bitmap';
import { projectX, projectY, WORLD, type RoomGeometry } from '../physics/geometry';
import type { BallState, BodyState } from '../physics/types';

interface Props {
  ball: SharedValue<BallState>;
  body: SharedValue<BodyState>;
  geo: SharedValue<RoomGeometry>;
  /** Pixels per LCD dot. */
  dot: number;
  /**
   * The ball is drawn twice — once behind the character and once in front —
   * and each copy shows only when it's on the correct side in depth.
   */
  layer: 'behind' | 'front';
}

const SIZE = 6;
const OUTLINE = ['.####.', '#oooo#', '#oooo#', '#oooo#', '#oooo#', '.####.'];
/** Four rolling frames: the seam turns a quarter at a time. */
const SEAMS: readonly [number, number, number, number][] = [
  [1, 3, 4, 3],
  [1, 4, 4, 1],
  [3, 1, 3, 4],
  [1, 1, 4, 4],
];
const FRAMES = SEAMS.map(([x0, y0, x1, y1]) => new Bitmap(SIZE, SIZE).sprite(OUTLINE, 0, 0).line(x0, y0, x1, y1));
const INK_PATHS = FRAMES.map((b) => b.path(INK));
const PAPER_PATH = FRAMES[0].path(PAPER);

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The bouncy ball: a 6-dot sprite that rolls in quarter turns and snaps to the dot grid. */
export const BallView = memo(function BallView({ ball, body, geo, dot, layer }: Props) {
  const style = useAnimatedStyle(() => {
    const g = geo.value;
    const b = ball.value;
    const behind = b.z > body.value.z;
    const show = b.present === 1 && (layer === 'behind' ? behind : !behind);
    const half = (SIZE / 2) * g.dot;
    const left = Math.round((projectX(g, b.x, b.z) - half) / g.dot) * g.dot;
    const top = Math.round((projectY(g, b.z, b.y + WORLD.ballR) - half) / g.dot) * g.dot;
    return { opacity: show ? 1 : 0, transform: [{ translateX: left }, { translateY: top }] };
  });
  const inkProps = useAnimatedProps(() => {
    const turn = ((ball.value.rot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    return { d: INK_PATHS[Math.floor(turn / (Math.PI / 2)) % 4] };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { width: SIZE * dot, height: SIZE * dot }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Path d={PAPER_PATH} fill={LCD_PAPER} />
        <AnimatedPath animatedProps={inkProps} fill={LCD_INK} />
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({ abs: { position: 'absolute', left: 0, top: 0 } });
