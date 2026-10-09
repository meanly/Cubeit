import { StyleSheet, View } from 'react-native';

import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';

import { Logo } from '../ui/Logo';
import { PressableScale } from '../ui/primitives';
import { AppSymbol } from '../ui/Symbol';
import { useColors, useStyles, type Colors } from '../theme/theme';

export const HEADER_HEIGHT = 60;

/** Logo centered at the top; notifications on the right, with a dot when something new happened. */
export function Header() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const unread = useGame((s) => s.progress.activities.some((a) => a.at > s.progress.notificationsSeenAt));
  const open = useUi((s) => s.panel === 'notifications');
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.side} />
      <Logo size={20} />
      <View style={[styles.side, styles.right]}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={unread ? 'Notifications, new activity' : 'Notifications'}
          hitSlop={6}
          onPress={() => useUi.getState().openPanel(open ? 'none' : 'notifications')}
          style={styles.bell}
        >
          <AppSymbol name="bell" size={20} color={colors.text} filled={false} weight="medium" />
          {unread && <View style={styles.dot} />}
        </PressableScale>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  bar: { height: HEADER_HEIGHT, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  side: { flex: 1 },
  right: { alignItems: 'flex-end' },
  bell: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  dot: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
    borderWidth: 1.5,
    borderColor: colors.paper,
  },
});
