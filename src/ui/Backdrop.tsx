import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { RadialGradient, Rect, Stop, Defs } from 'react-native-svg';

import { useSvgId } from './useSvgId';
import { useColors } from '../theme/theme';

/** The screen background: `bg` everywhere, deepening to `bgCenter` in the middle. */
export const Backdrop = memo(function Backdrop() {
  const colors = useColors();
  const id = useSvgId('backdrop');
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" rx="70%" ry="50%" fx="50%" fy="50%">
          <Stop offset="0" stopColor={colors.bgCenter} />
          <Stop offset="1" stopColor={colors.bg} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
});
