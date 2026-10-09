import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { bondLevel } from '../progression/progression';
import { useGame } from '../state/gameStore';
import { useUi, type PanelId } from '../state/uiStore';
import { colors, fonts, radii } from '../theme/tokens';
import { IconBadge, PressableScale, type IconName } from '../ui/primitives';

/** Height of everything below the room: stats row, section title and the two tiles. */
export const HOME_CARDS_HEIGHT = 196;

const TILES: { panel: PanelId; title: string; sub: string; icon: IconName; color: string }[] = [
  { panel: 'play', title: 'Play', sub: 'Games & ball', icon: 'game-controller', color: colors.red },
  { panel: 'customize', title: 'Customize', sub: 'Room & looks', icon: 'color-palette', color: colors.blue },
];

/** Under the room: stars and friendship, then Play and Customize. */
export function HomeCards({ disabled }: { disabled?: boolean }) {
  const stars = useGame((s) => s.progress.stars);
  const level = useGame((s) => bondLevel(s.progress.bondXp));
  const openPanel = useUi((s) => s.openPanel);
  return (
    <View style={[styles.wrap, disabled && styles.disabled]} pointerEvents={disabled ? 'none' : 'box-none'}>
      <View style={styles.row} accessibilityLabel={`${stars} stars, friendship level ${level}`}>
        <Ionicons name="star" size={18} color={colors.star} />
        <Text style={styles.rowTitle}>Stars</Text>
        <Text style={styles.rowSub}>Friendship Lv {level}</Text>
        <Text style={styles.rowValue}>{stars}</Text>
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section} accessibilityRole="header">
          Things to do
        </Text>
        <PressableScale accessibilityRole="button" hitSlop={8} onPress={() => openPanel('nearby')}>
          <Text style={styles.link}>Nearby</Text>
        </PressableScale>
      </View>

      <View style={styles.tiles}>
        {TILES.map((t) => (
          <PressableScale
            key={t.panel}
            accessibilityRole="button"
            accessibilityLabel={t.title}
            onPress={() => openPanel(t.panel)}
            style={styles.tile}
          >
            <IconBadge icon={t.icon} color={t.color} size={38} />
            <View style={styles.tileText}>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <Text style={styles.tileSub}>{t.sub}</Text>
            </View>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HOME_CARDS_HEIGHT, width: '100%', maxWidth: 592, paddingHorizontal: 16, paddingTop: 12 },
  disabled: { opacity: 0.45 },
  row: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  rowTitle: { fontFamily: fonts.black, fontSize: 16, color: colors.text },
  rowSub: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textDim, marginLeft: 6 },
  rowValue: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  section: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  link: { fontFamily: fonts.medium, fontSize: 14, color: colors.textDim },
  tiles: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    height: 84,
    borderRadius: radii.lg,
    backgroundColor: colors.paper,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileText: { flex: 1, gap: 2 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  tileSub: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
});
