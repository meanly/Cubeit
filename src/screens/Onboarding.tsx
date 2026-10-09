import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { DEFAULT_NAME } from '../state/schema';
import { useGame } from '../state/gameStore';
import { colors, fonts, radii } from '../theme/tokens';
import { Button } from '../ui/primitives';
import { Wordmark } from '../ui/Wordmark';

/** First launch: name your cubeling and learn the three basics. Shown once. */
export function Onboarding() {
  const [step, setStep] = useState<'name' | 'tips'>('name');
  const [name, setName] = useState(DEFAULT_NAME);
  const rename = useGame((s) => s.renameCharacter);
  const setSettings = useGame((s) => s.setSettings);
  const finalName = name.trim() || DEFAULT_NAME;

  return (
    <Animated.View entering={FadeIn.duration(400)} exiting={FadeOut.duration(300)} style={styles.scrim}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.center}>
        <View style={styles.card}>
          <Wordmark size={22} />
          {step === 'name' ? (
            <>
              <Text style={styles.title}>Someone just woke up in your cube.</Text>
              <Text style={styles.body}>What would you like to call them?</Text>
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
              <Button label="That's the one" onPress={() => setStep('tips')} />
            </>
          ) : (
            <>
              <Text style={styles.title}>Say hi to {finalName}!</Text>
              <Tip n={1} text={`Tap ${finalName} to say hi. Hold to pet. Drag to pick them up.`} />
              <Tip n={2} text="Tilt your phone and they'll slide around the room. You can turn this off in Settings." />
              <Tip n={3} text="Talk, play, decorate and keep memories with the buttons below." />
              <Text style={styles.privacy}>Everything stays on this device. No account, no internet needed.</Text>
              <Button
                label="Let's go"
                onPress={() => {
                  rename(finalName);
                  setSettings({ onboarded: true });
                }}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

function Tip({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipNum}>
        <Text style={styles.tipNumText}>{n}</Text>
      </View>
      <Text style={styles.tipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  center: { flex: 1, justifyContent: 'flex-end', padding: 16 },
  card: {
    backgroundColor: colors.bgRaised,
    borderRadius: radii.xl,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    marginBottom: 24,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontFamily: fonts.black, fontSize: 22, color: colors.text, lineHeight: 28 },
  body: { fontFamily: fonts.regular, fontSize: 15, color: colors.textDim },
  input: {
    height: 50,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 16,
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.text,
  },
  tip: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tipNumText: { fontFamily: fonts.black, fontSize: 13, color: colors.glow },
  tipText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.textDim },
  privacy: { fontFamily: fonts.medium, fontSize: 13, color: colors.textFaint },
});
