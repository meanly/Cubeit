import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';

import { useUi, type Toast } from '../state/uiStore';
import { colors, fonts, radii } from '../theme/tokens';
import { PressableScale } from './primitives';

/** Small, non-blocking notices (rewards, milestones, problems). */
export function Toasts({ top }: { top: number }) {
  const toasts = useUi((s) => s.toasts);
  const storageProblem = useUi((s) => s.storageProblem);
  const setStorageProblem = useUi((s) => s.setStorageProblem);
  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      {storageProblem && (
        <ToastView
          toast={{ id: -1, text: storageProblem, tone: 'warning', durationMs: 9000 }}
          onDone={() => setStorageProblem(null)}
        />
      )}
      {toasts.map((t) => (
        <ToastView key={t.id} toast={t} onDone={() => useUi.getState().dismissToast(t.id)} />
      ))}
    </View>
  );
}

function ToastView({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, toast.durationMs ?? (toast.action ? 7000 : 3200));
    return () => clearTimeout(id);
    // onDone identity may change each render; the timer is per toast
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);
  const icon = toast.tone === 'reward' ? 'sparkles' : toast.tone === 'warning' ? 'alert-circle' : 'information-circle';
  const tint = toast.tone === 'reward' ? colors.star : toast.tone === 'warning' ? colors.yellow : colors.onInk;
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)} layout={LinearTransition} style={styles.shadow}>
      <View style={styles.toast}>
      <Ionicons name={icon} size={18} color={tint} />
      <Text style={styles.text} accessibilityLiveRegion="polite">
        {toast.text}
      </Text>
      {toast.action && (
        <PressableScale
          accessibilityRole="button"
          onPress={() => {
            toast.action?.onPress();
            onDone();
          }}
          style={styles.action}
        >
          <Text style={styles.actionText}>{toast.action.label}</Text>
        </PressableScale>
      )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.ink,
  },
  shadow: {
    maxWidth: 460,
    borderRadius: radii.lg,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  text: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.onInk, paddingVertical: 10 },
  action: { paddingHorizontal: 14, height: 32, borderRadius: radii.sm, backgroundColor: colors.yellow, justifyContent: 'center' },
  actionText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
});
