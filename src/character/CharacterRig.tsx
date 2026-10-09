import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import type { AccessoryId } from '../content/appearance';
import { LCD_INK, LCD_PAPER } from '../lcd/bitmap';
import { projectX, projectY, type RoomGeometry } from '../physics/geometry';
import type { BodyState, ReadonlyShared } from '../physics/types';
import type { PoseValues } from '../physics/World';
import { accessoryCode, drawStickman, GRID, stateCode } from './pixel/stickman';
import type { CharacterState } from './states';

export type RigBody = Pick<
  BodyState,
  'x' | 'z' | 'y' | 'vx' | 'vy' | 'facing' | 'walkPhase' | 'walking' | 'squash' | 'lean' | 'anchored' | 'fallen' | 'fallDir'
>;

interface Props {
  body: ReadonlyShared<RigBody>;
  pose: PoseValues;
  clock: SharedValue<number>;
  geo: SharedValue<RoomGeometry>;
  /** Pixel size of the GRID×GRID sprite box (GRID dots). */
  size: number;
  accessory: AccessoryId;
  state: CharacterState;
  reduceMotion: boolean;
  /** Varies idle fidgets between characters. */
  seed?: number;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Pixel stickman (Cube World style). The skeleton is posed and rasterized to
 * dots on the UI thread every frame (`drawStickman`), and the sprite snaps to
 * the LCD's dot grid so it moves in whole-dot steps. It knows where the
 * screen's edges are, so hands press against walls and hops stop at the
 * ceiling. React only re-renders when the state or accessory changes.
 */
export const CharacterRig = memo(function CharacterRig({
  body,
  pose,
  clock,
  geo,
  size,
  accessory,
  state,
  reduceMotion,
  seed = 0,
}: Props) {
  const motion = reduceMotion ? 0.35 : 1;
  const st = stateCode(state);
  const acc = accessoryCode(accessory);

  const frame = useDerivedValue(() => {
    const b = body.value;
    const g = geo.value;
    const cx = projectX(g, b.x, b.z);
    const feet = projectY(g, b.z, b.y);
    return drawStickman({
      t: clock.value,
      seed,
      state: st,
      accessory: acc,
      motion,
      facing: b.facing,
      walking: b.walking,
      walkPhase: b.walkPhase,
      air: b.y > 0.02 && b.anchored === 0 ? 1 : 0,
      vy: b.vy,
      squash: b.squash,
      lean: b.lean,
      fallen: b.fallen > 0 ? 1 : 0,
      fallDir: b.fallDir,
      roomL: (cx - g.L0) / g.dot,
      roomR: (g.R0 - cx) / g.dot,
      roomT: (feet - g.T0) / g.dot,
      armL: pose.armL.value,
      armR: pose.armR.value,
      bounce: pose.bounce.value,
      sway: pose.sway.value,
      lower: pose.lower.value,
      tilt: pose.tilt.value,
      wave: pose.wave.value,
      lookX: pose.lookX.value,
      spin: pose.spin.value,
    });
  }, [st, acc, motion, seed]);

  const rootStyle = useAnimatedStyle(() => {
    const g = geo.value;
    const b = body.value;
    const pitch = size / GRID;
    // Snap the sprite to the dot grid.
    const left = Math.round((projectX(g, b.x, b.z) - size / 2) / pitch) * pitch;
    const bottom = Math.round(projectY(g, b.z, b.y) / pitch - frame.value.lift) * pitch;
    return {
      opacity: pose.visible.value,
      transform: [{ translateX: left }, { translateY: bottom - size }],
    };
  });

  const haloProps = useAnimatedProps(() => ({ d: frame.value.halo }));
  const dotsProps = useAnimatedProps(() => ({ d: frame.value.dots }));
  const accProps = useAnimatedProps(() => ({ d: frame.value.acc }));

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { width: size, height: size }, rootStyle]}>
      <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`}>
        <AnimatedPath animatedProps={haloProps} fill={LCD_PAPER} />
        <AnimatedPath animatedProps={dotsProps} fill={LCD_INK} />
        <AnimatedPath animatedProps={accProps} fill={LCD_INK} />
      </Svg>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0 },
});
