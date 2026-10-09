import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';

import { StickmanPreview } from '../character/StickmanPreview';
import { DEFAULT_NAME } from '../state/schema';
import { useGame } from '../state/gameStore';
import { fonts, radii } from '../theme/tokens';
import { PressableScale } from '../ui/primitives';
import { useColors, useStyles, type Colors } from '../theme/theme';

/** First launch: name your cubeling and learn the three basics. Shown once. */
export function Onboarding() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'name' | 'tips'>('name');
  const [name, setName] = useState(DEFAULT_NAME);
  const rename = useGame((s) => s.renameCharacter);
  const setSettings = useGame((s) => s.setSettings);
  const finalName = name.trim() || DEFAULT_NAME;
  const finish = () => {
    rename(finalName);
    setSettings({ onboarded: true });
  };

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      exiting={FadeOut.duration(300)}
      style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.art}>
          <Blocks />
        </View>
        {step === 'name' ? (
          <View style={styles.body}>
            <Text style={styles.title}>Someone just woke up in your cube.</Text>
            <Text style={styles.sub}>What would you like to call them?</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={24}
              autoFocus={Platform.OS !== 'web'}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => setStep('tips')}
              style={styles.input}
              placeholder={DEFAULT_NAME}
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Character name"
            />
            <Next label="That's the one" onPress={() => setStep('tips')} />
          </View>
        ) : (
          <View style={styles.body}>
            <Text style={styles.title}>Say hi to {finalName}!</Text>
            <Tip n={1} text={`Tap ${finalName} to say hi. Hold to pet. Drag to pick them up.`} />
            <Tip n={2} text="Tilt your phone and they slide that way. Tip it right over and they stand on that side. Shake it and things go flying! You can turn this off in Settings." />
            <Tip n={3} text="Play, decorate, talk, and plan your days in the Planner." />
            <Text style={styles.privacy}>Everything stays on this device. No account, no internet needed.</Text>
            <Next label="Let's go" onPress={finish} />
          </View>
        )}
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

/** The round ink button with a chevron. */
function Next({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.next}>
      <Ionicons name="chevron-forward" size={24} color={colors.brand} />
    </PressableScale>
  );
}

function Tip({ n, text }: { n: number; text: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.tip}>
      <View style={styles.tipNum}>
        <Text style={styles.tipNumText}>{n}</Text>
      </View>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const BLOCK = 46;
const DEPTH = 12;
/** Brand tints for the cubes, from pale to deep, with white; the extrusions are a deep navy. */
const TINT = { pale: '#D3E1EC', mid: '#8FB3CF', deep: '#1F4560', depth: '#15304A' };
/** Outline of a face plus its extrusion toward the lower left. */
const EXTRUSION = `${DEPTH},0 ${DEPTH + BLOCK},0 ${DEPTH + BLOCK},${BLOCK} ${BLOCK},${BLOCK + DEPTH} 0,${BLOCK + DEPTH} 0,${DEPTH}`;
/** A 3×3 wall of extruded blocks; the stickman lives in the middle one. */
const GRID_COLORS: (string | null)[] = [TINT.mid, TINT.deep, '#FFFFFF', TINT.pale, null, TINT.mid, TINT.deep, '#FFFFFF', TINT.pale];

function Blocks() {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.blocks} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {GRID_COLORS.map((c, i) => (
        <View key={i} style={styles.blockCell}>
          <Svg style={StyleSheet.absoluteFill} width={BLOCK + DEPTH} height={BLOCK + DEPTH}>
            <Polygon points={EXTRUSION} fill={TINT.depth} />
          </Svg>
          <View style={[styles.block, c ? { backgroundColor: c } : styles.blockLcd]}>{!c && <StickmanPreview accessory="none" size={BLOCK} />}</View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.brand, paddingHorizontal: 28 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 14, alignItems: 'center', maxWidth: 440, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.black, fontSize: 28, lineHeight: 34, color: '#FFFFFF', textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: TINT.pale, textAlign: 'center' },
  input: {
    alignSelf: 'stretch',
    height: 54,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
  },
  next: {
    marginTop: 10,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', alignSelf: 'stretch' },
  tipNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tipNumText: { fontFamily: fonts.black, fontSize: 13, color: colors.brand },
  tipText: { flex: 1, fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: '#FFFFFF' },
  privacy: { fontFamily: fonts.medium, fontSize: 13, color: TINT.pale, textAlign: 'center' },
  blocks: { width: (BLOCK + DEPTH) * 3, flexDirection: 'row', flexWrap: 'wrap' },
  blockCell: { width: BLOCK + DEPTH, height: BLOCK + DEPTH },
  block: { position: 'absolute', left: DEPTH, top: 0, width: BLOCK, height: BLOCK, overflow: 'hidden' },
  blockLcd: { backgroundColor: TINT.depth },
});
