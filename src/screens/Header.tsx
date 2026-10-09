import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { MOOD_TEXT, moodLabel } from '../character/mood';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { colors, fonts, moodColors } from '../theme/tokens';
import { Glass } from '../ui/Glass';
import { PressableScale, StarCount } from '../ui/primitives';
import { Wordmark } from '../ui/Wordmark';

export const HEADER_HEIGHT = 56;

/** Floating top bar: wordmark, then a glass capsule with mood and stars, and a round glass settings button. */
export function Header() {
  const name = useGame((s) => s.character.name);
  const label = useGame((s) => moodLabel(s.mood));
  const stars = useGame((s) => s.progress.stars);
  const openSettings = useUi((s) => s.setSettingsOpen);
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <Wordmark size={19} />
      <View style={styles.right}>
        <Glass radius={19} style={styles.capsule}>
          <View style={styles.mood} accessibilityLabel={`${name} feels ${MOOD_TEXT[label]}`}>
            <View style={[styles.dot, { backgroundColor: moodColors[label], shadowColor: moodColors[label] }]} />
            <Text style={styles.moodText} numberOfLines={1}>
              {name} · {MOOD_TEXT[label]}
            </Text>
          </View>
          <View style={styles.divider} />
          <StarCount value={stars} />
        </Glass>
        <PressableScale accessibilityRole="button" accessibilityLabel="Settings" hitSlop={6} onPress={() => openSettings(true)}>
          <Glass radius={19} interactive style={styles.round}>
            <Ionicons name="settings-outline" size={19} color={colors.text} />
          </Glass>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  capsule: { flexDirection: 'row', alignItems: 'center', height: 38, paddingHorizontal: 14, gap: 10, flexShrink: 1 },
  mood: { flexDirection: 'row', alignItems: 'center', gap: 7, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  moodText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, flexShrink: 1 },
  divider: { width: StyleSheet.hairlineWidth * 2, height: 16, backgroundColor: colors.lineStrong },
  round: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
