import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { moodLabel } from '../character/mood';
import { useGame } from '../state/gameStore';
import { colors, moodColors } from '../theme/tokens';
import { useSvgId } from './useSvgId';

/**
 * Soft ambient light behind everything, so the glass has something to frost:
 * a graphite wash, a mood-colored glow behind the room, and two cool/warm
 * pools at the corners. Static; it only redraws when the mood changes.
 */
export const Ambient = memo(function Ambient() {
  const mood = useGame((s) => moodLabel(s.mood));
  const base = useSvgId('amb-base');
  const glow = useSvgId('amb-glow');
  const cool = useSvgId('amb-cool');
  const warm = useSvgId('amb-warm');
  const tint = moodColors[mood];
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={base} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0E1211" />
          <Stop offset="0.55" stopColor={colors.bg} />
          <Stop offset="1" stopColor="#0A0C0C" />
        </LinearGradient>
        <RadialGradient id={glow} cx="50%" cy="44%" rx="62%" ry="38%" fx="50%" fy="44%">
          <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
          <Stop offset="0.55" stopColor={tint} stopOpacity={0.06} />
          <Stop offset="1" stopColor={tint} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={cool} cx="96%" cy="6%" rx="60%" ry="34%" fx="96%" fy="6%">
          <Stop offset="0" stopColor={colors.blue} stopOpacity={0.16} />
          <Stop offset="1" stopColor={colors.blue} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id={warm} cx="4%" cy="96%" rx="62%" ry="32%" fx="4%" fy="96%">
          <Stop offset="0" stopColor={colors.star} stopOpacity={0.12} />
          <Stop offset="1" stopColor={colors.star} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${base})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${cool})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${warm})`} />
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${glow})`} />
    </Svg>
  );
});
