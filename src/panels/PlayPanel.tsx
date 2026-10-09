import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getBrain } from '../character/useCharacterBrain';
import { startGame } from '../games/session';
import { chaseBall } from '../character/brain/behaviors';
import type { GameId } from '../state/schema';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { colors, fonts, radii } from '../theme/tokens';
import { IconBadge, PressableScale, type IconName } from '../ui/primitives';
import { PanelHeader } from './PanelHost';

const GAMES: { id: GameId; title: string; blurb: string; icon: IconName; tint: string }[] = [
  {
    id: 'starCatch',
    title: 'Star Catch',
    blurb: 'Tilt your phone (or drag on the floor) to help catch falling stars.',
    icon: 'star',
    tint: colors.yellow,
  },
  {
    id: 'peekaboo',
    title: 'Peekaboo',
    blurb: 'Watch which box they hide in, follow the shuffle, then tap the right one.',
    icon: 'cube',
    tint: colors.blue,
  },
];

export function PlayPanel() {
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
            <IconBadge icon={g.icon} color={g.tint} size={44} />
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
            <IconBadge icon="basketball" color={colors.red} size={36} />
            <Text style={styles.miniTitle}>Play ball</Text>
            <Text style={styles.miniText}>{hasBall ? `${name} chases the ball` : 'Add the ball in Customize'}</Text>
          </PressableScale>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Nearby friends, simulation"
            onPress={() => useUi.getState().openPanel('nearby')}
            style={styles.mini}
          >
            <IconBadge icon="people" color={colors.teal} size={36} />
            <Text style={styles.miniTitle}>Nearby friends</Text>
            <Text style={styles.miniText}>Preview · simulation</Text>
          </PressableScale>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  best: { fontFamily: fonts.bold, fontSize: 12, color: colors.red, marginTop: 2 },
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
