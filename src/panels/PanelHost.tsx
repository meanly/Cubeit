import { Ionicons } from '@expo/vector-icons';
import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useUi, type PanelId } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import { IconButton } from '../ui/primitives';
import { useColors, useStyles, type Colors } from '../theme/theme';

export type OpenPanel = Exclude<PanelId, 'none'>;

/** Share of the screen each panel takes; the room shrinks to fit above it. */
const PANEL_HEIGHT: Record<OpenPanel, number> = {
  talk: 0.5,
  play: 0.46,
  customize: 0.5,
  planner: 0.72,
  nearby: 0.5,
  notifications: 0.55,
  friend: 0.62,
};

/** Pull the sheet down this far (or flick it) and it closes. */
const CLOSE_DRAG = 120;
const CLOSE_FLICK = 900;

interface SheetDrag {
  /** How far the sheet is pulled down by a finger, in px. */
  offset: SharedValue<number>;
  close: () => void;
}

const SheetDragContext = createContext<SheetDrag | null>(null);

/**
 * Drag-down-to-dismiss, for the sheet's grabber and title row. Each caller gets
 * its own gesture (a gesture can only be attached to one detector).
 */
function useSheetDragGesture() {
  const ctx = useContext(SheetDragContext);
  const offset = ctx?.offset;
  const close = ctx?.close;
  // Measured from the absolute finger position (translation isn't reliable on web).
  const startY = useSharedValue(0);
  return Gesture.Pan()
    .enabled(!!ctx)
    .activeOffsetY([-10, 10])
    .failOffsetX([-20, 20])
    .onBegin((e) => {
      'worklet';
      startY.set(e.absoluteY);
    })
    .onUpdate((e) => {
      'worklet';
      if (!offset) return;
      const dy = e.absoluteY - startY.value;
      // Down follows the finger; up only gives a little.
      offset.set(dy > 0 ? dy : dy * 0.15);
    })
    .onEnd((e) => {
      'worklet';
      if (!offset || !close) return;
      // How far it was pulled, as last applied (end events don't always carry a position).
      const dy = offset.value;
      if (dy > CLOSE_DRAG || (dy > 20 && e.velocityY > CLOSE_FLICK)) scheduleOnRN(close);
      else offset.set(withSpring(0, { damping: 18, stiffness: 220 }));
    });
}

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
  const styles = useStyles(makeStyles);
  const panel = useUi((s) => s.panel);
  const closePanel = useUi((s) => s.closePanel);
  // Keep rendering the last panel while the sheet slides closed.
  const [shown, setShown] = useState<PanelId>(panel);
  if (panel !== 'none' && panel !== shown) setShown(panel);
  const progress = useSharedValue(0);
  const height = useSharedValue(0);
  const drag = useSharedValue(0);
  const keyboard = useReanimatedKeyboardAnimation();

  useEffect(() => {
    if (panel !== 'none') {
      drag.set(withSpring(0, { damping: 18, stiffness: 220 }));
      height.set(withTiming(Math.round(rootHeight * PANEL_HEIGHT[panel]) + bottomInset, { duration: 260 }));
      progress.set(withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));
    } else {
      progress.set(
        withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (!finished) return;
          // A dismiss by dragging closes from wherever the finger let go.
          drag.set(0);
          scheduleOnRN(setShown, 'none');
        }),
      );
    }
  }, [panel, rootHeight, bottomInset, height, progress, drag]);

  // Android back button closes the open panel first.
  useEffect(() => {
    if (panel === 'none') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void closePanel();
      return true;
    });
    return () => sub.remove();
  }, [panel, closePanel]);

  useAnimatedReaction(
    () => {
      const kb = Math.abs(keyboard.height.value);
      const h = Math.min(height.value, rootHeight - kb - topReserve);
      // While the sheet is pulled down the room grows back with it.
      return rootHeight - (h + kb) * progress.value + Math.max(0, drag.value);
    },
    (top) => {
      panelTop.set(top);
    },
  );

  const style = useAnimatedStyle(() => {
    // Fully closed: collapse so nothing hangs below the screen edge (on web that
    // overflow can be scrolled into view by focus changes).
    if (progress.value === 0) return { height: 0, paddingBottom: 0, transform: [{ translateY: 0 }] };
    const kb = Math.abs(keyboard.height.value);
    const h = Math.max(160, Math.min(height.value, rootHeight - kb - topReserve));
    return {
      height: h,
      paddingBottom: kb > 0 ? 8 : bottomInset,
      transform: [{ translateY: (1 - progress.value) * (h + 30) - kb + drag.value }],
    };
  });

  // A drag that lets go past the threshold asks to close; if an editor keeps it open, settle back up.
  const dragClose = () => {
    void closePanel().then((closed) => {
      if (!closed) drag.set(withSpring(0, { damping: 18, stiffness: 220 }));
    });
  };

  const Content = shown !== 'none' ? panels[shown] : null;
  return (
    <SheetDragContext.Provider value={{ offset: drag, close: dragClose }}>
      <Animated.View style={[styles.sheet, style]} pointerEvents={panel === 'none' ? 'none' : 'box-none'}>
        <SheetHandle />
        {Content && <Content />}
      </Animated.View>
    </SheetDragContext.Provider>
  );
}

/** The grabber, with a tall-enough strip around it to catch a drag. */
function SheetHandle() {
  const styles = useStyles(makeStyles);
  const gesture = useSheetDragGesture();
  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.handle} accessibilityLabel="Drag down to close">
        <View style={styles.grabber} />
      </View>
    </GestureDetector>
  );
}

/** Title row used at the top of every panel. */
export function PanelHeader({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const closePanel = useUi((s) => s.closePanel);
  const gesture = useSheetDragGesture();
  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {onBack && <IconButton icon="chevron-back" label="Back" onPress={onBack} color={colors.text} />}
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {right}
          <IconButton icon="close" label="Close" onPress={() => void closePanel()} />
        </View>
      </View>
    </GestureDetector>
  );
}

export function EmptyState({ icon, title, body }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={colors.brand} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  // A flat white sheet with big top corners, lifted by a soft shadow.
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.xl + 4,
    borderTopRightRadius: radii.xl + 4,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
  },
  handle: { height: 20, alignItems: 'center', justifyContent: 'center' },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.lineStrong,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 16,
    height: 52,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  // The buttons keep their size; a long title (e.g. "Talk with <long name>") truncates instead.
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 },
  title: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, letterSpacing: -0.3, flexShrink: 1 },
  empty: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24, gap: 8 },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textDim, textAlign: 'center' },
});
