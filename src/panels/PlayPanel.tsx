import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBrain } from '../character/useCharacterBrain';
import { startGame } from '../games/session';
import { chaseBall } from '../character/brain/behaviors';
import type { GameId } from '../state/schema';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import type { IconId } from '../ui/Icons';
import { IconBadge, PressableScale } from '../ui/primitives';
import { PanelHeader } from './PanelHost';
import { useColors, useStyles, type Colors } from '../theme/theme';

const GAMES: { id: GameId; title: string; blurb: string; icon: IconId }[] = [
  {
    id: 'starCatch',
    title: 'Star Catch',
    blurb: 'Tilt your phone (or drag on the floor) to help catch falling stars.',
    icon: 'star',
  },
  {
    id: 'peekaboo',
    title: 'Peekaboo',
    blurb: 'Watch which box they hide in, follow the shuffle, then tap the right one.',
    icon: 'cube',
  },
];

export function PlayPanel() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const best = useGame((s) => s.progress.bestScores);
  const hasBall = useGame((s) => s.room.items.toy === 'ball');
  const name = useGame((s) => s.character.name);
  const start = (id: GameId) => startGame(id);
  return (
    <View style={styles.flex}>
      <PanelHeader title="Play" />
      <ScrollView contentContainerStyle={styles.list}>
        {GAMES.map((g) => (
          <PressableScale
            key={g.id}
            accessibilityRole="button"
            accessibilityLabel={`Play ${g.title}`}
            onPress={() => start(g.id)}
            style={styles.card}
          >
            <IconBadge icon={g.icon} size={44} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{g.title}</Text>
              <Text style={styles.cardText}>{g.blurb}</Text>
              {best[g.id] ? <Text style={styles.best}>Best: {best[g.id]}</Text> : null}
            </View>
            <Ionicons name="play-circle" size={30} color={colors.accent} />
          </PressableScale>
        ))}
        <View style={styles.row}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Play ball"
            disabled={!hasBall}
            onPress={() => {
              useUi.getState().closePanel();
              getBrain()?.interrupt(chaseBall(6000, true));
            }}
            style={[styles.mini, !hasBall && { opacity: 0.45 }]}
          >
            <IconBadge icon="ball" size={36} />
            <Text style={styles.miniTitle}>Play ball</Text>
            <Text style={styles.miniText}>{hasBall ? `${name} chases the ball` : 'Add the ball in Customize'}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Nearby friends, simulation"
            onPress={() => useUi.getState().openPanel('nearby')}
            style={styles.mini}
          >
            <IconBadge icon="friends" size={36} />
            <Text style={styles.miniTitle}>Nearby friends</Text>
            <Text style={styles.miniText}>Preview · simulation</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  cardText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDim },
  best: { fontFamily: fonts.bold, fontSize: 12, color: colors.brand, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10 },
  mini: {
    flex: 1,
    padding: 14,
    gap: 4,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
  },
  miniTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 4 },
  miniText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textDim },
});
