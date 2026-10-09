import { useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { rebooted } from '../character/brain/behaviors';
import { getBrain } from '../character/useCharacterBrain';
import { deviceFinish, type DeviceFinish, type DeviceId } from '../content/devices';
import { useWorld } from '../physics/World';
import { feedback } from '../services/feedback';
import { useReduceMotion } from '../services/motion';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { useTheme } from '../theme/theme';
import { fonts } from '../theme/tokens';
import { PressableScale } from '../ui/primitives';
import { AppSymbol } from '../ui/Symbol';
import { useSvgId } from '../ui/useSvgId';

/** Housing around the bezel: sides/top, and the taller chin with the label and light. */
export const HOUSING = 14;
export const CHIN = 38;
/** Dark bezel around the LCD. */
export const BEZEL = 8;
const RADIUS = 30;
const LIGHT = '#F26A1B';

/** Total frame size for an LCD of `screen` × `screen` px. */
export function deviceSize(screen: number) {
  return { width: screen + (HOUSING + BEZEL) * 2, height: screen + BEZEL * 2 + HOUSING + CHIN };
}

/** The device color being shown: the Customize draft while previewing, otherwise the saved room. */
function useDeviceFinish(): DeviceFinish {
  const { scheme } = useTheme();
  const saved = useGame((s) => s.room.device);
  const draft = useUi((s) => s.draft?.room.device);
  return deviceFinish(draft ?? saved, scheme);
}

/**
 * The room's LCD mounted in a little gadget, like a product shot: plastic in
 * the chosen color lit from the top left, a dark inset bezel, corner screws,
 * and a chin with the name and an orange indicator light. A thin outline runs
 * all the way round so the shaded right and bottom edges and the corners read
 * on any background. The LCD itself is untouched.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const finish = useDeviceFinish();
  const styles = useMemo(() => makeStyles(finish), [finish]);
  const body = useSvgId('housing');
  const restart = useScreenRestart();
  return (
    <View style={styles.shadow}>
      <View style={styles.housing}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id={body} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={finish.light} />
              <Stop offset="1" stopColor={finish.dark} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${body})`} />
        </Svg>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.rim]} />
        {[styles.screwTL, styles.screwTR, styles.screwBL, styles.screwBR].map((pos, i) => (
          <View key={i} pointerEvents="none" style={[styles.screw, pos]} />
        ))}
        <View style={styles.bezel}>
          <Animated.View style={restart.screen}>
            {children}
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glow, restart.glow]} />
          </Animated.View>
        </View>
        <View style={styles.chin} pointerEvents="box-none">
          <Text style={styles.brand}>CUBEIT</Text>
          <View style={styles.grille} pointerEvents="none">
            {Array.from({ length: 5 }, (_, i) => (
              <View key={i} style={styles.slot} />
            ))}
          </View>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Restart the screen"
            accessibilityHint="Turns the screen off and on, putting everything back in place"
            hitSlop={10}
            onPress={restart.run}
            style={styles.reset}
          >
            <AppSymbol name="reload" size={11} color={finish.label} weight="bold" />
            <Animated.View style={[styles.light, restart.led]} />
          </PressableScale>
        </View>
      </View>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.outline]} />
    </View>
  );
}

/** Timings of the screen restart, in ms: collapse to a line, to a dot, stay dark, then power back on. */
const OFF_LINE = 150;
const OFF_DOT = 130;
const DARK = 650;
const ON_LINE = 130;
const ON_FULL = 220;

/**
 * The LED button: the LCD dies like an old screen (squashes to a bright line,
 * then to nothing), everything is put back where it started while it's dark,
 * and it powers back on. Not during games.
 */
function useScreenRestart() {
  const world = useWorld();
  const reduceMotion = useReduceMotion();
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const glow = useSharedValue(0);
  const busy = useRef(false);

  // Only the device restarts: everything inside it goes back to the start; the app around it is untouched.
  const reset = () => {
    world.commands.resetAll();
    getBrain()?.interrupt(rebooted);
  };

  const run = () => {
    if (busy.current || useUi.getState().activeGame !== null) return;
    busy.current = true;
    feedback('select');
    if (reduceMotion) {
      // No collapse: just a quick fade to dark and back.
      glow.set(withSequence(withTiming(1, { duration: 120 }), withDelay(300, withTiming(0, { duration: 160 }))));
      setTimeout(reset, 140);
      setTimeout(() => (busy.current = false), 620);
      return;
    }
    const ease = Easing.in(Easing.cubic);
    const out = Easing.out(Easing.cubic);
    const darkAt = OFF_LINE + OFF_DOT;
    const onAt = darkAt + DARK;
    sy.set(withSequence(withTiming(0.02, { duration: OFF_LINE, easing: ease }), withDelay(OFF_DOT + DARK + ON_LINE, withTiming(1, { duration: ON_FULL, easing: out }))));
    sx.set(withSequence(withDelay(OFF_LINE, withTiming(0.001, { duration: OFF_DOT, easing: ease })), withDelay(DARK, withTiming(1, { duration: ON_LINE, easing: out }))));
    // The collapsing line burns bright, then fades as the picture returns.
    glow.set(withSequence(withTiming(1, { duration: OFF_LINE }), withDelay(OFF_DOT + DARK + ON_LINE, withTiming(0, { duration: ON_FULL }))));
    setTimeout(reset, darkAt + 60);
    setTimeout(() => (busy.current = false), onAt + ON_LINE + ON_FULL);
  };

  const screen = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }, { scaleY: sy.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  // The LED goes out with the screen and lights again as it comes back.
  const led = useAnimatedStyle(() => ({ opacity: 0.15 + 0.85 * Math.min(sx.value, sy.value > 0.05 ? 1 : sy.value * 20) }));
  return { run, screen, glow: glowStyle, led };
}

/** A tiny device for the Customize picker: the housing gradient around a dark screen. */
export function DevicePreview({ id, size = 52 }: { id: DeviceId; size?: number }) {
  const { scheme } = useTheme();
  const f = deviceFinish(id, scheme);
  const grad = useSvgId('devprev');
  const w = size * 0.82;
  const h = size;
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <LinearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={f.light} />
          <Stop offset="1" stopColor={f.dark} />
        </LinearGradient>
      </Defs>
      <Rect x={0.5} y={0.5} width={w - 1} height={h - 1} rx={w * 0.2} fill={`url(#${grad})`} stroke={f.outline} />
      <Rect x={w * 0.14} y={w * 0.14} width={w * 0.72} height={w * 0.72} rx={w * 0.08} fill={f.bezel} />
      <Rect x={w * 0.2} y={w * 0.2} width={w * 0.6} height={w * 0.6} fill="#89947D" />
      <Rect x={w * 0.74} y={h - w * 0.17} width={w * 0.08} height={w * 0.08} rx={w * 0.04} fill={LIGHT} />
    </Svg>
  );
}

const makeStyles = (f: DeviceFinish) =>
  StyleSheet.create({
    // The background color gives iOS a solid shape to cast the shadow from.
    shadow: {
      flex: 1,
      borderRadius: RADIUS,
      backgroundColor: f.dark,
      shadowColor: f.shadow,
      shadowOpacity: 0.3,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 16 },
      elevation: 14,
    },
    housing: { flex: 1, borderRadius: RADIUS, overflow: 'hidden', padding: HOUSING, paddingBottom: CHIN },
    // Bright top-left edge, clearly shaded bottom-right edge.
    rim: {
      borderRadius: RADIUS,
      borderWidth: 1.5,
      borderTopColor: f.rim,
      borderLeftColor: f.rim,
      borderRightColor: 'rgba(0,0,0,0.16)',
      borderBottomColor: 'rgba(0,0,0,0.22)',
    },
    outline: { borderRadius: RADIUS, borderWidth: 1, borderColor: f.outline },
    screw: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5, backgroundColor: f.screw },
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
      backgroundColor: f.bezel,
      alignItems: 'center',
      justifyContent: 'center',
      // Inset look: darker top edge, lighter bottom edge.
      borderTopWidth: 1,
      borderTopColor: 'rgba(0,0,0,0.45)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.16)',
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
    brand: { fontFamily: fonts.pixelBold, fontSize: 10, letterSpacing: 1.5, color: f.label },
    grille: { flexDirection: 'row', gap: 3 },
    slot: { width: 3, height: 10, borderRadius: 1.5, backgroundColor: f.screw },
    reset: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingLeft: 4 },
    // The bright face of the collapsing screen.
    glow: { backgroundColor: '#E4EBD9' },
    light: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: LIGHT,
      shadowColor: LIGHT,
      shadowOpacity: 0.8,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 0 },
    },
  });
