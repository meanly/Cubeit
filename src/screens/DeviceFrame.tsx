import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors, fonts } from '../theme/tokens';
import { useSvgId } from '../ui/useSvgId';

/** Housing around the bezel: sides/top, and the taller chin with the label and light. */
export const HOUSING = 14;
export const CHIN = 38;
/** Dark bezel around the LCD. */
export const BEZEL = 8;
const RADIUS = 30;

/** Total frame size for an LCD of `screen` × `screen` px. */
export function deviceSize(screen: number) {
  return { width: screen + (HOUSING + BEZEL) * 2, height: screen + BEZEL * 2 + HOUSING + CHIN };
}

/**
 * The room's LCD mounted in a little gadget, like a product shot: light
 * plastic lit from the top left, a dark inset bezel, corner screws, and a
 * chin with the name and an orange indicator light. The LCD itself is untouched.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const body = useSvgId('housing');
  return (
    <View style={styles.shadow}>
      <View style={styles.housing}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={body} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.housingLight} />
              <Stop offset="1" stopColor={colors.housingDark} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${body})`} />
        </Svg>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim]} />
        {[styles.screwTL, styles.screwTR, styles.screwBL, styles.screwBR].map((pos, i) => (
          <View key={i} pointerEvents="none" style={[styles.screw, pos]} />
        ))}
        <View style={styles.bezel}>{children}</View>
        <View style={styles.chin} pointerEvents="none">
          <Text style={styles.brand}>CUBEIT</Text>
          <View style={styles.grille}>
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={styles.slot} />
            ))}
          </View>
          <View style={styles.light} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    flex: 1,
    borderRadius: RADIUS,
    shadowColor: '#3F4236',
    shadowOpacity: 0.28,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 14,
  },
  housing: { flex: 1, borderRadius: RADIUS, overflow: 'hidden', padding: HOUSING, paddingBottom: CHIN },
  // Bright top-left edge, shaded bottom-right edge.
  rim: {
    borderRadius: RADIUS,
    borderWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.9)',
    borderLeftColor: 'rgba(255,255,255,0.7)',
    borderRightColor: 'rgba(0,0,0,0.08)',
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  screw: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#B7BAAE' },
  screwTL: { top: 5, left: 12 },
  screwTR: { top: 5, right: 12 },
  screwBL: { bottom: 7, left: 12 },
  screwBR: { bottom: 7, right: 12 },
  bezel: {
    flex: 1,
    paddingHorizontal: BEZEL,
    // The 1-px edges below come out of the padding, so the LCD keeps its exact size.
    paddingVertical: BEZEL - 1,
    borderRadius: 14,
    backgroundColor: colors.bezel,
    alignItems: 'center',
    justifyContent: 'center',
    // Inset look: darker top edge, lighter bottom edge.
    borderTopWidth: 1,
    borderTopColor: '#141413',
    borderBottomWidth: 1,
    borderBottomColor: '#4A4A45',
  },
  chin: {
    position: 'absolute',
    left: HOUSING + 6,
    right: HOUSING + 6,
    bottom: 0,
    height: CHIN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontFamily: fonts.pixelBold, fontSize: 10, letterSpacing: 1.5, color: '#8E9184' },
  grille: { flexDirection: 'row', gap: 3 },
  slot: { width: 3, height: 10, borderRadius: 1.5, backgroundColor: '#B3B6AA' },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
