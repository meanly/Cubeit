import { StyleSheet, Text, View } from 'react-native';

import { StickmanPreview } from '../character/StickmanPreview';
import { MOOD_TEXT, moodLabel } from '../character/mood';
import { useGame } from '../state/gameStore';
import { colors, fonts, moodColors } from '../theme/tokens';

export const HEADER_HEIGHT = 72;

/** "Welcome back" greeting with the character's mood, and a round avatar tinted by that mood. */
export function Header() {
  const name = useGame((s) => s.character.name);
  const label = useGame((s) => moodLabel(s.mood));
  const accessory = useGame((s) => s.character.appearance.accessory);
  return (
    <View style={styles.bar} pointerEvents="box-none">
      <View style={styles.greeting} accessibilityRole="header">
        <Text style={styles.title} numberOfLines={1}>
          Welcome back,
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {name} is {MOOD_TEXT[label].toLowerCase()}!
        </Text>
      </View>
      <View
        style={[styles.avatar, { backgroundColor: moodColors[label] }]}
        accessibilityLabel={`${name} feels ${MOOD_TEXT[label]}`}
      >
        <View style={styles.avatarInner}>
          <StickmanPreview accessory={accessory} size={30} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: HEADER_HEIGHT,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  greeting: { flexShrink: 1 },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26, color: colors.text, letterSpacing: -0.3 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatarInner: { width: 30, height: 30, borderRadius: 6, overflow: 'hidden' },
});
