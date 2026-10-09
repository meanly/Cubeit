import { StyleSheet, Text, View } from 'react-native';

import { MOOD_TEXT, moodLabel } from '../character/mood';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { colors, fonts, moodColors } from '../theme/tokens';
import { IconButton, StarCount } from '../ui/primitives';
import { Wordmark } from '../ui/Wordmark';

export const HEADER_HEIGHT = 52;

/** Quiet top bar: wordmark, mood, stars, settings. */
export function Header() {
  const name = useGame((s) => s.character.name);
  const label = useGame((s) => moodLabel(s.mood));
  const stars = useGame((s) => s.progress.stars);
  const openSettings = useUi((s) => s.setSettingsOpen);
  return (
    <View style={styles.bar}>
      <Wordmark size={19} />
      <View style={styles.right}>
        <View style={styles.mood} accessibilityLabel={`${name} feels ${MOOD_TEXT[label]}`}>
          <View style={[styles.dot, { backgroundColor: moodColors[label], shadowColor: moodColors[label] }]} />
          <Text style={styles.moodText} numberOfLines={1}>
            {name} · {MOOD_TEXT[label]}
          </Text>
        </View>
        <StarCount value={stars} />
        <IconButton icon="settings-outline" label="Settings" onPress={() => openSettings(true)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: HEADER_HEIGHT,
    paddingLeft: 18,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  mood: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    flexShrink: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 5, shadowOffset: { width: 0, height: 0 } },
  moodText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDim, flexShrink: 1 },
});
