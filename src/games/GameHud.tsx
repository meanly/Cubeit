import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import { Button, IconButton, StarCount } from '../ui/primitives';
import { useGameSession } from './session';
import { useColors, useStyles, type Colors } from '../theme/theme';

const INFO = {
  starCatch: {
    title: 'Star Catch',
    how: (name: string, tilt: boolean) =>
      `Stars are falling! ${tilt ? 'Tilt your phone or drag' : 'Drag'} on the floor to move ${name} under them. Gold stars are worth 3. You have 40 seconds.`,
  },
  peekaboo: {
    title: 'Peekaboo',
    how: (name: string) => `${name} hides in a box and the boxes shuffle. Keep your eye on the right one, then tap it. Three rounds!`,
  },
} as const;

/**
 * Game overlay drawn above the room (outside its touch area, so buttons are
 * never mistaken for room gestures): intro, score/time, pause, results.
 */
export function GameHud() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const s = useGameSession();
  const name = useGame((st) => st.character.name);
  const tilt = useGame((st) => st.settings.motionEnabled);
  if (!s.game) return null;
  const info = INFO[s.game];
  const exit = () => useUi.getState().setActiveGame(null);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {(s.phase === 'playing' || s.phase === 'paused') && (
        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.pill}>
            <Ionicons name="star" size={14} color={colors.star} />
            <Text style={styles.pillText}>{s.score}</Text>
          </View>
          {s.timeLeft !== null && (
            <View style={styles.pill}>
              <Ionicons name="time-outline" size={14} color={colors.onInk} />
              <Text style={styles.pillText}>{Math.ceil(s.timeLeft)}s</Text>
            </View>
          )}
          {s.round && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{s.round}</Text>
            </View>
          )}
          <IconButton icon="pause" label="Pause game" onPress={() => s.actions?.pause()} color={colors.onInk} style={styles.pause} />
        </View>
      )}

      {s.phase === 'playing' && s.message && (
        <Animated.View key={s.message} entering={FadeIn.duration(160)} exiting={FadeOut.duration(160)} style={styles.message} pointerEvents="none">
          <Text style={styles.messageText}>{s.message}</Text>
        </Animated.View>
      )}

      {s.phase === 'intro' && (
        <Card>
          <Text style={styles.title}>{info.title}</Text>
          <Text style={styles.body}>{info.how(name, tilt)}</Text>
          <View style={styles.actions}>
            <Button label="Not now" tone="secondary" onPress={exit} style={styles.flex} />
            <Button label="Start" icon="play" onPress={() => s.actions?.start()} style={styles.flex} />
          </View>
        </Card>
      )}

      {s.phase === 'paused' && (
        <Card>
          <Text style={styles.title}>Paused</Text>
          <Text style={styles.body}>Take your time. Quitting won’t cost anything.</Text>
          <View style={styles.actions}>
            <Button label="Quit" tone="secondary" onPress={exit} style={styles.flex} />
            <Button label="Resume" icon="play" onPress={() => s.actions?.resume()} style={styles.flex} />
          </View>
        </Card>
      )}

      {s.phase === 'results' && s.result && (
        <Card>
          <Text style={styles.title}>{s.result.newBest ? 'New best!' : 'Nice playing!'}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.score}>
              {s.result.score}
              {s.result.outOf ? <Text style={styles.outOf}> / {s.result.outOf}</Text> : null}
            </Text>
            <Text style={styles.best}>Best {s.result.best}</Text>
          </View>
          <View style={styles.earned}>
            <Text style={styles.body}>You earned</Text>
            <StarCount value={s.result.starsEarned} size={16} />
          </View>
          <View style={styles.actions}>
            <Button label="Done" tone="secondary" onPress={exit} style={styles.flex} />
            <Button label="Play again" icon="refresh" onPress={() => s.actions?.start()} style={styles.flex} />
          </View>
        </Card>
      )}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.cardWrap} pointerEvents="box-none">
      <Animated.View entering={ZoomIn.duration(200)} style={styles.card}>
        {children}
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  top: { position: 'absolute', top: 18, left: 18, right: 18, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 11,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
  },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onInk },
  pause: { marginLeft: 'auto', backgroundColor: colors.ink, width: 36, height: 36, borderRadius: radii.sm },
  message: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.sm,
    backgroundColor: colors.ink,
  },
  messageText: { fontFamily: fonts.bold, fontSize: 15, color: colors.onInk },
  cardWrap: { ...StyleSheet.absoluteFill, justifyContent: 'center', padding: 22 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radii.xl,
    padding: 18,
    gap: 10,
  },
  title: { fontFamily: fonts.bold, fontSize: 21, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textDim },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  score: { fontFamily: fonts.black, fontSize: 44, color: colors.star },
  outOf: { fontFamily: fonts.bold, fontSize: 20, color: colors.textDim },
  best: { fontFamily: fonts.bold, fontSize: 14, color: colors.textDim },
  earned: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
