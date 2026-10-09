import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useUi, type PanelId } from '../state/uiStore';
import { colors, fonts, radii } from '../theme/tokens';
import { Glass } from '../ui/Glass';
import { IconButton } from '../ui/primitives';

export type OpenPanel = Exclude<PanelId, 'none'>;

/** Share of the screen each panel takes; the room shrinks to fit above it. */
const PANEL_HEIGHT: Record<OpenPanel, number> = {
  talk: 0.5,
  play: 0.46,
  customize: 0.5,
  memories: 0.6,
  nearby: 0.5,
};

interface Props {
  panels: Record<OpenPanel, ComponentType>;
  rootHeight: number;
  /** Space to keep visible above the sheet for the header and a mini room. */
  topReserve: number;
  bottomInset: number;
  /** Written with the sheet's current top edge, so the room can make room. */
  panelTop: SharedValue<number>;
}

/** Bottom sheet that hosts one panel at a time and keeps the room visible above it. */
export function PanelHost({ panels, rootHeight, topReserve, bottomInset, panelTop }: Props) {
  const panel = useUi((s) => s.panel);
  const closePanel = useUi((s) => s.closePanel);
  // Keep rendering the last panel while the sheet slides closed.
  const [shown, setShown] = useState<PanelId>(panel);
  if (panel !== 'none' && panel !== shown) setShown(panel);
  const progress = useSharedValue(0);
  const height = useSharedValue(0);
  const keyboard = useReanimatedKeyboardAnimation();

  useEffect(() => {
    if (panel !== 'none') {
      height.set(withTiming(Math.round(rootHeight * PANEL_HEIGHT[panel]) + bottomInset, { duration: 260 }));
      progress.set(withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.set(
        withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) scheduleOnRN(setShown, 'none');
        }),
      );
    }
  }, [panel, rootHeight, bottomInset, height, progress]);

  // Android back button closes the open panel first.
  useEffect(() => {
    if (panel === 'none') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closePanel();
      return true;
    });
    return () => sub.remove();
  }, [panel, closePanel]);

  useAnimatedReaction(
    () => {
      const kb = Math.abs(keyboard.height.value);
      const h = Math.min(height.value, rootHeight - kb - topReserve);
      return rootHeight - (h + kb) * progress.value;
    },
    (top) => {
      panelTop.set(top);
    },
  );

  const style = useAnimatedStyle(() => {
    // Fully closed: collapse so nothing hangs below the screen edge (on web that
    // overflow can be scrolled into view by focus changes). No opacity here:
    // native Liquid Glass never renders again once a parent has faded to 0.
    if (progress.value === 0) return { height: 0, paddingBottom: 0, transform: [{ translateY: 0 }] };
    const kb = Math.abs(keyboard.height.value);
    const h = Math.max(160, Math.min(height.value, rootHeight - kb - topReserve));
    return {
      height: h,
      paddingBottom: kb > 0 ? 8 : Math.max(8, bottomInset),
      transform: [{ translateY: (1 - progress.value) * (h + 30) - kb }],
    };
  });

  const Content = shown !== 'none' ? panels[shown] : null;
  return (
    <Animated.View style={[styles.sheet, style]} pointerEvents={panel === 'none' ? 'none' : 'box-none'}>
      <View style={styles.shadow}>
        <Glass radius={radii.xl + 4} strong style={styles.glass}>
          <View style={styles.grabber} />
          {Content && <Content />}
        </Glass>
      </View>
    </Animated.View>
  );
}

/** Title row used at the top of every panel. */
export function PanelHeader({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const closePanel = useUi((s) => s.closePanel);
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack && <IconButton icon="chevron-back" label="Back" onPress={onBack} color={colors.text} />}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={styles.headerRight}>
        {right}
        <IconButton icon="close" label="Close" onPress={closePanel} />
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
  },
  // A floating glass slab, inset from the screen edges.
  glass: { flex: 1, overflow: 'hidden' },
  shadow: {
    flex: 1,
    borderRadius: radii.xl + 4,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 8,
    height: 48,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: fonts.black, fontSize: 19, color: colors.text },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textDim, textAlign: 'center' },
});
