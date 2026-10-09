import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { useUi, type PanelId } from '../state/uiStore';
import { colors, fonts } from '../theme/tokens';
import { Glass } from '../ui/Glass';
import { PressableScale, type IconName } from '../ui/primitives';

export const ACTION_BAR_HEIGHT = 84;

const ACTIONS: { panel: PanelId; label: string; icon: IconName; iconActive: IconName }[] = [
  { panel: 'talk', label: 'Talk', icon: 'chatbubble-ellipses-outline', iconActive: 'chatbubble-ellipses' },
  { panel: 'play', label: 'Play', icon: 'game-controller-outline', iconActive: 'game-controller' },
  { panel: 'customize', label: 'Customize', icon: 'color-palette-outline', iconActive: 'color-palette' },
  { panel: 'memories', label: 'Memories', icon: 'book-outline', iconActive: 'book' },
];

/** Floating glass tab bar under the room; the open panel's tab sits in a brighter lens. */
export function ActionBar({ disabled }: { disabled?: boolean }) {
  const panel = useUi((s) => s.panel);
  const openPanel = useUi((s) => s.openPanel);
  return (
    <View style={styles.wrap} pointerEvents={disabled ? 'none' : 'box-none'}>
      <Glass radius={32} style={[styles.bar, disabled && styles.disabled]}>
        {ACTIONS.map((a) => {
          const active = panel === a.panel;
          return (
            <PressableScale
              key={a.panel}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              accessibilityState={{ selected: active }}
              onPress={() => openPanel(active ? 'none' : a.panel)}
              style={[styles.action, active && styles.actionActive]}
            >
              <Ionicons name={active ? a.iconActive : a.icon} size={21} color={active ? colors.accent : colors.textDim} />
              <Text style={[styles.label, active && styles.labelActive]}>{a.label}</Text>
            </PressableScale>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: ACTION_BAR_HEIGHT, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
    padding: 5,
    width: '100%',
    maxWidth: 460,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  disabled: { opacity: 0.45 },
  action: { flex: 1, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', gap: 2 },
  actionActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.08)',
    borderTopColor: 'rgba(255,255,255,0.22)',
  },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.textDim },
  labelActive: { color: colors.text },
});
