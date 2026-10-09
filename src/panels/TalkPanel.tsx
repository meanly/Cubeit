import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { resolveProposal, sendChatMessage, useChatSession } from '../conversation/chatSession';
import { getEngine } from '../conversation/engine';
import type { EngineKind } from '../conversation/types';
import { emit } from '../services/bus';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import { Button, Chip, IconButton, PressableScale } from '../ui/primitives';
import { PanelHeader } from './PanelHost';
import { useColors, useStyles, type Colors } from '../theme/theme';

const STARTERS = ['How are you?', 'What have you been up to?', 'Tell me a joke', 'Can you dance?', 'What do you remember?'];

export function TalkPanel() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const name = useGame((s) => s.character.name);
  const entries = useChatSession((s) => s.entries);
  const busy = useChatSession((s) => s.busy);
  const [text, setText] = useState('');
  const [engineKind, setEngineKind] = useState<EngineKind>('scripted');
  const [showInfo, setShowInfo] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const lastTyping = useRef(0);

  useEffect(() => {
    void getEngine().then((e) => setEngineKind(e.kind));
  }, []);

  const send = (value: string) => {
    if (!value.trim() || busy) return;
    setText('');
    void sendChatMessage(value);
  };

  const onType = (value: string) => {
    setText(value);
    const now = Date.now();
    if (value.length > 0 && now - lastTyping.current > 1500) {
      lastTyping.current = now;
      emit({ type: 'chatTyping' });
    }
  };

  return (
    <View style={styles.flex}>
      <PanelHeader
        title={`Talk with ${name}`}
        right={
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="About how the character talks"
            onPress={() => setShowInfo((v) => !v)}
            style={styles.enginePill}
          >
            <Ionicons name="cloud-offline-outline" size={13} color={colors.textDim} />
            <Text style={styles.engineText}>{engineKind === 'local-model' ? 'On-device AI' : 'Simple replies'}</Text>
          </PressableScale>
        }
      />
      {showInfo && (
        <View style={styles.info}>
          <Text style={styles.infoText}>
            {engineKind === 'local-model'
              ? `${name} is using an AI model that runs entirely on this device.`
              : `${name} uses simple built-in replies that work offline. It understands a handful of things — greetings, feelings, “remember…”, and tricks — not open conversation. No AI model is installed.`}{' '}
            Chats aren’t saved; only memories you approve are kept.
          </Text>
        </View>
      )}
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {entries.length === 0 && (
          <Text style={styles.hint}>Say hi to {name}! Chats stay on this device and aren’t saved.</Text>
        )}
        {entries.map((e) => (
          <Animated.View key={e.id} entering={FadeInDown.duration(180)} style={e.from === 'user' ? styles.rowUser : styles.rowChar}>
            <View style={[styles.bubble, e.from === 'user' ? styles.bubbleUser : styles.bubbleChar]}>
              <Text style={[styles.bubbleText, e.from === 'user' && { color: colors.onAccent }]}>{e.text}</Text>
            </View>
            {e.reply?.proposal && (
              <ProposalCard
                content={e.reply.proposal.draft.content}
                reasons={e.reply.proposal.sensitiveReasons}
                state={e.proposalState ?? 'pending'}
                onSave={() => resolveProposal(e.id, true)}
                onDismiss={() => resolveProposal(e.id, false)}
              />
            )}
            {e.reply?.suggestion && (
              <Button
                compact
                tone="secondary"
                icon="game-controller-outline"
                label={e.reply.suggestion.label}
                onPress={() => useUi.getState().openPanel(e.reply!.suggestion!.panel)}
                style={styles.suggestion}
              />
            )}
          </Animated.View>
        ))}
        {busy && <Text style={styles.typing}>{name} is thinking…</Text>}
      </ScrollView>
      {text.length === 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.noGrow}
          contentContainerStyle={styles.starters}
          keyboardShouldPersistTaps="handled"
        >
          {STARTERS.map((s) => (
            <Chip key={s} label={s} onPress={() => send(s)} />
          ))}
          <Chip label="Remember that…" icon="bookmark-outline" onPress={() => setText('Remember that ')} />
        </ScrollView>
      )}
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={onType}
          placeholder={`Message ${name}…`}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          maxLength={300}
          returnKeyType="send"
          onSubmitEditing={() => send(text)}
          submitBehavior="submit"
          accessibilityLabel={`Message ${name}`}
        />
        <IconButton
          icon="arrow-up"
          label="Send"
          onPress={() => send(text)}
          color={colors.onAccent}
          style={[styles.send, (!text.trim() || busy) && { opacity: 0.4 }]}
        />
      </View>
    </View>
  );
}

function ProposalCard({
  content,
  reasons,
  state,
  onSave,
  onDismiss,
}: {
  content: string;
  reasons: string[];
  state: 'pending' | 'saved' | 'dismissed';
  onSave: () => void;
  onDismiss: () => void;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.proposal}>
      <View style={styles.proposalHead}>
        <Ionicons name="bookmark" size={14} color={colors.accent} />
        <Text style={styles.proposalLabel}>Save as a memory?</Text>
      </View>
      <Text style={styles.proposalContent}>“{content}”</Text>
      {reasons.length > 0 && state === 'pending' && (
        <Text style={styles.warning}>
          This looks like it might include {reasons.join(', ')}. Memories stay on this device, but only save it if you’re comfortable.
        </Text>
      )}
      {state === 'pending' ? (
        <View style={styles.proposalActions}>
          <Button compact tone="ghost" label="Not now" onPress={onDismiss} />
          <Button compact label={reasons.length > 0 ? 'Save anyway' : 'Save'} icon="checkmark" onPress={onSave} />
        </View>
      ) : (
        <Text style={styles.proposalDone}>{state === 'saved' ? 'Saved to Memories' : 'Not saved'}</Text>
      )}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
  flex: { flex: 1 },
  enginePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  engineText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textDim },
  info: { marginHorizontal: 16, marginBottom: 6, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface },
  infoText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textDim },
  list: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textFaint, textAlign: 'center', marginTop: 12 },
  rowUser: { alignItems: 'flex-end' },
  rowChar: { alignItems: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
  bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  bubbleChar: { backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
  typing: { fontFamily: fonts.medium, fontSize: 13, color: colors.textFaint },
  suggestion: { marginTop: 6 },
  noGrow: { flexGrow: 0 },
  starters: { paddingHorizontal: 16, gap: 8, paddingBottom: 8, alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 4 },
  input: {
    flex: 1,
    height: 46,
    borderRadius: radii.md,
    paddingHorizontal: 18,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 15,
  },
  send: { width: 46, height: 46, borderRadius: radii.md, backgroundColor: colors.ink },
  proposal: {
    marginTop: 6,
    maxWidth: '88%',
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentSoft,
    gap: 6,
  },
  proposalHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  proposalLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
  proposalContent: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
  warning: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.warning },
  proposalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  proposalDone: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint },
});
