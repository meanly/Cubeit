import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useUi, type PanelId } from '../state/uiStore';
import { colors, fonts } from '../theme/tokens';
import { PressableScale, type IconName } from '../ui/primitives';

export const ACTION_BAR_HEIGHT = 76;

const ACTIONS: { panel: PanelId; label: string; icon: IconName; iconActive: IconName }[] = [
  { panel: 'talk', label: 'Talk', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { panel: 'play', label: 'Play', icon: 'game-controller-outline', iconActive: 'game-controller' },
  { panel: 'customize', label: 'Customize', icon: 'color-palette-outline', iconActive: 'color-palette' },
  { panel: 'memories', label: 'Memories', icon: 'book-outline', iconActive: 'book' },
];

/** Four quiet actions under the room. */
export function ActionBar({ disabled }: { disabled?: boolean }) {
  const panel = useUi((s) => s.panel);
  const openPanel = useUi((s) => s.openPanel);
  return (
    <View style={[styles.bar, disabled && { opacity: 0.4 }]} pointerEvents={disabled ? 'none' : 'auto'}>
      {ACTIONS.map((a) => {
        const active = panel === a.panel;
        return (
          <PressableScale
            key={a.panel}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityState={{ selected: active }}
            onPress={() => openPanel(active ? 'none' : a.panel)}
            style={styles.action}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Ionicons name={active ? a.iconActive : a.icon} size={22} color={active ? colors.text : colors.textDim} />
            </View>
            <Text style={[styles.label, active && { color: colors.text }]}>{a.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: ACTION_BAR_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  action: { alignItems: 'center', gap: 4, minWidth: 72, paddingVertical: 4 },
  iconWrap: { width: 48, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.accentSoft },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.textDim },
});
