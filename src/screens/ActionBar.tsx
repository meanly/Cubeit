import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useUi } from '../state/uiStore';
import { fonts } from '../theme/tokens';
import type { IconId } from '../ui/Icons';
import { PressableScale } from '../ui/primitives';
import { AppSymbol } from '../ui/Symbol';
import { useColors, useStyles, type Colors } from '../theme/theme';

export const ACTION_BAR_HEIGHT = 84;

type Tab = Extract<IconId, 'home' | 'talk' | 'planner' | 'settings'>;

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'talk', label: 'Talk' },
  { id: 'planner', label: 'Planner' },
  { id: 'settings', label: 'Settings' },
];

const ITEM = 48;
const ICON = 22;
/** Left inset of the icon: centers it in a collapsed tab (13 + 22 + 13 = 48). */
const INSET = (ITEM - ICON) / 2;
const LABEL_GAP = 8;
const PAD_RIGHT = 18;
/** One curve for the whole morph: the pill's width, its color and the label. */
const MORPH_MS = 320;
const EASE = Easing.bezier(0.65, 0, 0.35, 1); // ease-in-out

/**
 * Compact floating ink pill, centered on the screen. Every tab is the same
 * size; the selected one smoothly widens into a brand-colored pill with its label.
 */
export function ActionBar({ disabled }: { disabled?: boolean }) {
  const styles = useStyles(makeStyles);
  const panel = useUi((s) => s.panel);
  const settingsOpen = useUi((s) => s.settingsOpen);
  const active: Tab = settingsOpen ? 'settings' : panel === 'talk' ? 'talk' : panel === 'planner' ? 'planner' : 'home';

  const go = (tab: Tab) => {
    const ui = useUi.getState();
    if (tab === 'settings') ui.setSettingsOpen(true);
    else if (tab === 'home') ui.openPanel('none');
    else ui.openPanel(active === tab ? 'none' : tab);
  };

  return (
    <View style={styles.wrap} pointerEvents={disabled ? 'none' : 'box-none'}>
      <View style={[styles.bar, disabled && styles.disabled]}>
        {TABS.map((t) => (
          <NavTab key={t.id} id={t.id} label={t.label} on={active === t.id} onPress={() => go(t.id)} />
        ))}
      </View>
    </View>
  );
}

/**
 * A tab whose width is animated explicitly (no layout transitions, which
 * scale content on web): it grows from a 48-pt circle to icon + label, its
 * brand fill fades in, and the label fades in once there's room for it.
 */
function NavTab({ id, label, on, onPress }: { id: Tab; label: string; on: boolean; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [labelW, setLabelW] = useState(0);
  const progress = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    progress.set(withTiming(on ? 1 : 0, { duration: MORPH_MS, easing: EASE }));
  }, [on, progress]);

  const open = INSET + ICON + LABEL_GAP + labelW + PAD_RIGHT;
  const pill = useAnimatedStyle(() => ({
    width: ITEM + (open - ITEM) * progress.value,
    backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(48,96,133,0)', colors.brand]),
  }));
  const text = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0.5, 1], [0, 1], 'clamp') }));
  const measure = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w !== labelW) setLabelW(w);
  };

  return (
    <PressableScale accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: on }} onPress={onPress}>
      <Animated.View style={[styles.tab, pill]}>
        <View style={styles.icon}>
          <AppSymbol name={id} size={ICON} color={on ? colors.onInk : 'rgba(255,255,255,0.6)'} />
        </View>
        <Animated.Text onLayout={measure} style={[styles.label, text]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Animated.View>
    </PressableScale>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  wrap: { height: ACTION_BAR_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 24,
    backgroundColor: colors.ink,
    shadowColor: colors.ink,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  disabled: { opacity: 0.5 },
  tab: { height: ITEM, borderRadius: 18, overflow: 'hidden' },
  icon: { position: 'absolute', left: INSET, top: (ITEM - ICON) / 2, width: ICON, height: ICON },
  // Absolutely placed so it keeps its natural width (and can be measured) while the pill is narrow.
  label: {
    position: 'absolute',
    left: INSET + ICON + LABEL_GAP,
    top: 0,
    lineHeight: ITEM,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.onInk,
    letterSpacing: -0.1,
  },
});
