import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { useUi } from '../state/uiStore';
import { colors, fonts } from '../theme/tokens';
import { NavIcon, type NavIconName } from '../ui/NavIcons';
import { PressableScale } from '../ui/primitives';

export const ACTION_BAR_HEIGHT = 84;

const TABS: { id: NavIconName; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'talk', label: 'Talk' },
  { id: 'memories', label: 'Memories' },
  { id: 'settings', label: 'Settings' },
];

const ITEM = 48;

/**
 * Compact floating ink pill, centered on the screen. Every tab is the same
 * size; the selected one widens to show its label on a soft highlight.
 */
export function ActionBar({ disabled }: { disabled?: boolean }) {
  const panel = useUi((s) => s.panel);
  const settingsOpen = useUi((s) => s.settingsOpen);
  const active: NavIconName = settingsOpen ? 'settings' : panel === 'talk' ? 'talk' : panel === 'memories' ? 'memories' : 'home';

  const go = (tab: NavIconName) => {
    const ui = useUi.getState();
    if (tab === 'settings') ui.setSettingsOpen(true);
    else if (tab === 'home') ui.openPanel('none');
    else ui.openPanel(active === tab ? 'none' : tab);
  };

  return (
    <View style={styles.wrap} pointerEvents={disabled ? 'none' : 'box-none'}>
      <Animated.View layout={LinearTransition.duration(220)} style={[styles.bar, disabled && styles.disabled]}>
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <Animated.View key={t.id} layout={LinearTransition.duration(220)}>
              <PressableScale
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityState={{ selected: on }}
                onPress={() => go(t.id)}
                style={[styles.tab, on && styles.tabActive]}
              >
                <NavIcon name={t.id} size={22} color={on ? colors.onInk : 'rgba(255,255,255,0.62)'} />
                {on && (
                  <Animated.Text entering={FadeIn.duration(200)} style={styles.label} numberOfLines={1}>
                    {t.label}
                  </Animated.Text>
                )}
              </PressableScale>
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  tab: { height: ITEM, minWidth: ITEM, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  tabActive: { paddingLeft: 14, paddingRight: 18, gap: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.onInk, letterSpacing: -0.1 },
});
