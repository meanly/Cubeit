import { Image, StyleSheet, Text, View } from 'react-native';

import { fonts } from '../theme/tokens';
import { useColors, useStyles, type Colors } from '../theme/theme';

// The app icon's cube (assets/brand/cube.svg, rendered by scripts/build-icons.mjs).
const MARK = require('../../assets/brand/cube-mark.png');

/** The cube mark: the app icon's cube gadget with its little screen. */
export function CubeMark({ size = 22 }: { size?: number }) {
  return <Image source={MARK} style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
}

/**
 * "cubeit" wordmark with the cube mark, as one lockup: the cube is as tall as the
 * type and centered optically on the letters. ("cubeit" has no descenders, and
 * most of its weight is the x-height, so its visual middle sits about a tenth of
 * the size below the middle of the text box; the cube is moved down to match.)
 * A fixed line height keeps the lockup identical on iOS, Android and web.
 */
export function Logo({ size = 20, light = false }: { size?: number; light?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Cubeit">
      <View style={{ transform: [{ translateY: Math.round(size * 0.1) }] }}>
        <CubeMark size={size} />
      </View>
      <Text style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.25), letterSpacing: -size * 0.03, color: light ? '#FFFFFF' : colors.text }]}>
        cubeit
      </Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    text: { fontFamily: fonts.black, includeFontPadding: false },
  });
