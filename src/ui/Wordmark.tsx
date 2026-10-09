import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors, fonts } from '../theme/tokens';
import { useSvgId } from './useSvgId';

/** Simple cube mark: legible at tiny sizes, no fine details. */
export function CubeMark({ size = 22 }: { size?: number }) {
  const id = useSvgId('mark');
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.accentStrong} />
          <Stop offset="1" stopColor={colors.blue} />
        </LinearGradient>
      </Defs>
      <Path d="M16 2.5 L28 9 V23 L16 29.5 L4 23 V9 Z" fill={`url(#${id})`} />
      <Path d="M16 2.5 L28 9 L16 15.5 L4 9 Z" fill="#FFFFFF" opacity={0.22} />
      <Path d="M11 17.5 v3 M21 17.5 v3" stroke="#14123A" strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
}

/** Lowercase "cubeit" wordmark. */
export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Cubeit">
      <CubeMark size={size + 4} />
      <Text style={[styles.text, { fontSize: size }]}>cubeit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text: { fontFamily: fonts.black, color: colors.text, letterSpacing: -0.3 },
});
