import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { create } from 'zustand';

import { useUi } from '../state/uiStore';
import { colors, fonts, radii } from '../theme/tokens';
import { Button } from './primitives';

interface Request {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
  scope: 'home' | 'settings';
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<{ request: Request | null; set: (r: Request | null) => void }>()((set) => ({
  request: null,
  set: (request) => set({ request }),
}));

/** Ask before anything destructive. Works the same on iOS, Android and web. */
export function confirm(opts: { title: string; message: string; confirmLabel?: string; destructive?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    useConfirmStore.getState().request?.resolve(false);
    useConfirmStore.getState().set({
      title: opts.title,
      message: opts.message,
      confirmLabel: opts.confirmLabel ?? 'OK',
      destructive: opts.destructive ?? false,
      scope: useUi.getState().settingsOpen ? 'settings' : 'home',
      resolve,
    });
  });
}

export function ConfirmHost({ scope }: { scope: 'home' | 'settings' }) {
  const request = useConfirmStore((s) => s.request);
  if (!request || request.scope !== scope) return null;
  const done = (ok: boolean) => {
    useConfirmStore.getState().set(null);
    request.resolve(ok);
  };
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={styles.scrim}>
      <Animated.View entering={ZoomIn.duration(180)} style={styles.card} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          {request.title}
        </Text>
        <Text style={styles.message}>{request.message}</Text>
        <View style={styles.actions}>
          <Button label="Cancel" tone="secondary" onPress={() => done(false)} style={styles.flex} />
          <Button label={request.confirmLabel} tone={request.destructive ? 'danger' : 'primary'} onPress={() => done(true)} style={styles.flex} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.bgRaised,
    borderRadius: radii.xl,
    padding: 22,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
  },
  title: { fontFamily: fonts.black, fontSize: 19, color: colors.text },
  message: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textDim },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  flex: { flex: 1 },
});
