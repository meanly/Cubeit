import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useSvgId } from '../ui/useSvgId';
import { INK, LCD_DOTS, LCD_EDGE, LCD_INK, LCD_PAPER, PAPER, type Bitmap } from './bitmap';

/** Draws a bitmap at `dot` px per dot: paper cells in the panel color, ink cells in black. */
export const LcdArt = memo(function LcdArt({ bitmap, dot }: { bitmap: Bitmap; dot: number }) {
  return (
    <Svg width={bitmap.w * dot} height={bitmap.h * dot} viewBox={`0 0 ${bitmap.w} ${bitmap.h}`}>
      <Path d={bitmap.path(PAPER)} fill={LCD_PAPER} />
      <Path d={bitmap.path(INK)} fill={LCD_INK} />
    </Svg>
  );
});

/** A small square of LCD panel with art on it (option tiles, avatars). */
export const LcdTile = memo(function LcdTile({ bitmap, size }: { bitmap: Bitmap; size: number }) {
  const dot = size / Math.max(bitmap.w, bitmap.h);
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: Math.max(3, dot * 1.2) }]}>
      <LcdArt bitmap={bitmap} dot={dot} />
    </View>
  );
});

/**
 * The glass over the panel: the darker edges of the photo and a little inner
 * shadow under the top/left rim. Drawn above the room, ignores touches.
 */
export const LcdGlass = memo(function LcdGlass({ size }: { size: number }) {
  const id = useSvgId('glass');
  const n = LCD_DOTS;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id={`${id}edge`} cx="0.5" cy="0.46" r="0.72">
          <Stop offset="0" stopColor={LCD_EDGE} stopOpacity="0" />
          <Stop offset="0.55" stopColor={LCD_EDGE} stopOpacity="0.05" />
          <Stop offset="1" stopColor={LCD_EDGE} stopOpacity="0.26" />
        </RadialGradient>
        <LinearGradient id={`${id}top`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={LCD_EDGE} stopOpacity="0.35" />
          <Stop offset="1" stopColor={LCD_EDGE} stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id={`${id}left`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={LCD_EDGE} stopOpacity="0.28" />
          <Stop offset="1" stopColor={LCD_EDGE} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={n} height={n} fill={`url(#${id}edge)`} />
      <Rect x={0} y={0} width={n} height={1.6} fill={`url(#${id}top)`} />
      <Rect x={0} y={0} width={1.2} height={n} fill={`url(#${id}left)`} />
    </Svg>
  );
});

const styles = StyleSheet.create({
  tile: { backgroundColor: LCD_PAPER, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
