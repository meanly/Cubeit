import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { bondProgress } from '../progression/progression';
import { useGame } from '../state/gameStore';
import { useUi, type PanelId } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import type { IconId } from '../ui/Icons';
import { PressableScale } from '../ui/primitives';
import { AppSymbol } from '../ui/Symbol';
import { useColors, useStyles, type Colors } from '../theme/theme';

const STATS_H = 62;
const TITLE_GAP_TOP = 18;
const TITLE_H = 20;
const TITLE_GAP_BOTTOM = 10;
const TILE_H = 76;
/** Height of everything below the device: two stat cards, the section title and the tiles. */
export const HOME_CARDS_HEIGHT = STATS_H + TITLE_GAP_TOP + TITLE_H + TITLE_GAP_BOTTOM + TILE_H;

const TILES: { panel: PanelId; title: string; icon: IconId }[] = [
  { panel: 'play', title: 'Play', icon: 'play' },
  { panel: 'customize', title: 'Customize', icon: 'customize' },
  { panel: 'nearby', title: 'Friends', icon: 'friends' },
];

/**
 * Under the device, and exactly as wide as it: the star balance and
 * friendship level, then Play, Customize and Friends.
 */
export function HomeCards({ width, disabled }: { width: number; disabled?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const stars = useGame((s) => s.progress.stars);
  const bond = useGame(useShallow((s) => bondProgress(s.progress.bondXp)));
  const openPanel = useUi((s) => s.openPanel);
  const maxed = bond.toNext === null;
  return (
    <View style={[styles.wrap, { width }, disabled && styles.disabled]} pointerEvents={disabled ? 'none' : 'box-none'}>
      <View style={styles.stats}>
        <View style={styles.stat} accessibilityLabel={`${stars} stars`}>
          <Text style={styles.caption}>STARS</Text>
          <View style={styles.valueRow}>
            <AppSymbol name="star" size={16} color={colors.star} />
            <Text style={styles.value}>{stars.toLocaleString()}</Text>
          </View>
        </View>

        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Friendship level ${bond.level}${maxed ? ', maxed' : `, ${bond.toNext} XP to the next level`}`}
          accessibilityHint="Opens your friend's profile, memories and finds"
          onPress={() => openPanel('friend')}
          style={styles.stat}
        >
          <View style={styles.captionRow}>
            <Text style={styles.caption}>FRIENDSHIP</Text>
            <Ionicons name="chevron-forward" size={11} color={colors.textFaint} />
          </View>
          <View style={styles.valueRow}>
            <AppSymbol name="heart" size={16} color={colors.brand} />
            <Text style={styles.value}>
              <Text style={styles.unit}>Lv </Text>
              {bond.level}
            </Text>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, bond.fraction)) * 100)}%` }]} />
            </View>
          </View>
        </PressableScale>
      </View>

      <Text style={styles.section} accessibilityRole="header">
        Things to do
      </Text>

      <View style={styles.tiles}>
        {TILES.map((t) => (
          <PressableScale
            key={t.panel}
            accessibilityRole="button"
            accessibilityLabel={t.title}
            onPress={() => openPanel(t.panel)}
            style={styles.tile}
          >
            <AppSymbol name={t.icon} size={20} color={colors.brand} />
            <Text style={styles.tileTitle}>{t.title}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  wrap: { height: HOME_CARDS_HEIGHT },
  disabled: { opacity: 0.45 },
  stats: { flexDirection: 'row', gap: 10, height: STATS_H },
  stat: { flex: 1, borderRadius: radii.md, backgroundColor: colors.paper, paddingHorizontal: 14, justifyContent: 'center', gap: 4 },
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8, color: colors.textFaint },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  value: { fontFamily: fonts.black, fontSize: 20, lineHeight: 24, color: colors.text, letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  unit: { fontFamily: fonts.bold, fontSize: 13, color: colors.textFaint, letterSpacing: 0 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.brandSoft, overflow: 'hidden', marginLeft: 4 },
  fill: { height: 5, borderRadius: 3, backgroundColor: colors.brand },
  section: {
    height: TITLE_H,
    marginTop: TITLE_GAP_TOP,
    marginBottom: TITLE_GAP_BOTTOM,
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: TITLE_H,
    color: colors.text,
    letterSpacing: -0.2,
  },
  tiles: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, height: TILE_H, borderRadius: radii.md, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: 7 },
  tileTitle: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
});
