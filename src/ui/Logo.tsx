import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { fonts } from '../theme/tokens';
import { useColors, useStyles, type Colors } from '../theme/theme';

/** The cube mark: three faces in brand tints, lit from the top. */
export function CubeMark({ size = 22, light = false }: { size?: number; light?: boolean }) {
  const colors = useColors();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2.5 21 7.5 12 12.5 3 7.5Z" fill={light ? '#FFFFFF' : '#8FB3CF'} />
      <Path d="M3 7.5 12 12.5V22L3 17Z" fill={light ? '#BFD3E3' : colors.brand} />
      <Path d="M21 7.5 12 12.5V22L21 17Z" fill={light ? '#7FA3C0' : '#1F4560'} />
    </Svg>
  );
}

/** "cubeit" wordmark with the cube mark. */
export function Logo({ size = 20, light = false }: { size?: number; light?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="Cubeit">
      <CubeMark size={size + 2} light={light} />
      <Text style={[styles.text, { fontSize: size, color: light ? '#FFFFFF' : colors.text }]}>cubeit</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text: { fontFamily: fonts.black, letterSpacing: -0.6 },
});
