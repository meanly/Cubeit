import { memo, useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { ThemeId } from '../content/themes';
import { LCD_EDGE } from '../lcd/bitmap';
import { LcdArt } from '../lcd/LcdArt';
import type { RoomGeometry } from '../physics/geometry';
import { drawBackdrop, skyPhase } from './items/pixelArt';

/** Wallpaper, the horizon line and the ground strip. Static per theme. */
export const LcdBackdrop = memo(function LcdBackdrop({ g, theme }: { g: RoomGeometry; theme: ThemeId }) {
  const bitmap = useMemo(() => drawBackdrop(theme), [theme]);
  return <LcdArt bitmap={bitmap} dot={g.dot} />;
});

/**
 * Night: the panel loses its backlight and goes a little darker, unless the
 * floor lamp is on. Dawn and dusk dim it slightly.
 */
export const LcdNight = memo(function LcdNight({ hour, lampLit }: { hour: number; lampLit: boolean }) {
  const phase = skyPhase(hour);
  const dim = phase === 'night' ? (lampLit ? 0.04 : 0.14) : phase === 'dusk' || phase === 'dawn' ? 0.05 : 0;
  const value = useSharedValue(dim);
  useEffect(() => {
    value.set(withTiming(dim, { duration: 600 }));
  }, [dim, value]);
  const style = useAnimatedStyle(() => ({ opacity: value.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.night, style]} />;
});

const styles = StyleSheet.create({ night: { backgroundColor: LCD_EDGE } });
