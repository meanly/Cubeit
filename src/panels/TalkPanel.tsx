import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { modelUsable, useModel } from '../ai/modelStore';
import { warmUp } from '../ai/runtime';
import type { ReplySource } from '../assistant/assistant';
import type { ActionType } from '../assistant/schema';
import { actionCard, resolveAction, resolveProposal, sendChatMessage, useChatSession, type ChatEntry } from '../conversation/chatSession';
import { emit } from '../services/bus';
import { useGame } from '../state/gameStore';
import { useUi } from '../state/uiStore';
import { fonts, radii } from '../theme/tokens';
import { Button, Chip, IconButton, PressableScale } from '../ui/primitives';
import { PanelHeader } from './PanelHost';
import { PhotoImport } from './talk/PhotoImport';
import { useVoiceInput } from './talk/useVoiceInput';
import { useColors, useStyles, type Colors } from '../theme/theme';

const STARTERS = [
  'What’s on my schedule today?',
  'Add lunch with Sam tomorrow at noon',
  'I want to read every weekday at 9pm',
  'What chores do I have?',
  'How are you?',
];

// Scripted replies carry no tag; AI replies always say so.
const SOURCE_LABEL: Record<ReplySource, string | null> = {
  ai: 'On-device AI',
  parser: 'Built-in parser',
  scripted: null,
  command: 'Built-in',
};

export function TalkPanel() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const name = useGame((s) => s.character.name);
  const entries = useChatSession((s) => s.entries);
  const busy = useChatSession((s) => s.busy);
  const pending = useChatSession((s) => s.pending);
  const model = useModel((s) => s.status);
  const [text, setText] = useState('');
  const [showInfo, setShowInfo] = useState(false);
  const [photo, setPhoto] = useState<'camera' | 'library' | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const lastTyping = useRef(0);
  const aiOn = modelUsable(model);

  const voice = useVoiceInput(
    (t) => {
      setVoiceNote('Check the text, then send.');
      setText((cur) => (cur.trim() ? `${cur.trim()} ${t}` : t));
    },
    (msg) => setVoiceNote(msg),
  );

  // Load the model in the background while the chat is open, so the first reply is quicker.
  useEffect(() => {
    if (model.state === 'installed') warmUp();
  }, [model.state]);

  const send = (value: string) => {
    if (!value.trim() || busy) return;
    setText('');
    setVoiceNote(null);
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

  const choosePhoto = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 }, (i) => {
        if (i === 0) setPhoto('camera');
        if (i === 1) setPhoto('library');
      });
    } else {
      setPhoto('library');
    }
  };

  if (photo) return <PhotoImport source={photo} onClose={() => setPhoto(null)} />;

  const pill =
    model.state === 'ready' || model.state === 'installed'
      ? 'On-device AI'
      : model.state === 'loading'
        ? 'AI loading…'
        : model.state === 'downloading' || model.state === 'verifying'
          ? 'AI downloading…'
          : null;

  const recording = voice.phase === 'recording';
  const transcribing = voice.phase === 'transcribing' || voice.phase === 'starting';

  return (
    <View style={styles.flex}>
      <PanelHeader
        title={`Talk with ${name}`}
        right={
          <PressableScale accessibilityRole="button" accessibilityLabel="About how the character talks" onPress={() => setShowInfo((v) => !v)} style={[styles.enginePill, !pill && styles.engineIconOnly]}>
            <Ionicons name={aiOn ? 'hardware-chip-outline' : 'cloud-offline-outline'} size={13} color={aiOn ? colors.brand : colors.textDim} />
            {pill && <Text style={styles.engineText}>{pill}</Text>}
          </PressableScale>
        }
      />
      {showInfo && (
        <View style={styles.info}>
          <Text style={styles.infoText}>
            {aiOn
              ? `${name} uses a small AI model (Qwen2.5 0.5B) that runs entirely on this phone — even in airplane mode. It can be wrong, so changes to your planner always wait for your tap.`
              : `No AI model is installed, so ${name} uses built-in replies and a rule-based parser that understands common planner requests (“add dentist tomorrow at 3pm”). You can download the on-device AI in Settings → Talking.`}{' '}
            Each reply says where it came from. Chats aren’t saved; only memories and planner items you confirm are kept.
          </Text>
          {!aiOn && (
            <Button compact tone="secondary" icon="settings-outline" label="Open Settings" onPress={() => useUi.getState().setSettingsOpen(true)} style={styles.infoButton} />
          )}
        </View>
      )}
      <ScrollView
        ref={scroll}
        style={styles.flex}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {entries.length === 0 && <Text style={styles.hint}>Say hi to {name}, or ask for help with your day. Chats stay on this device and aren’t saved.</Text>}
        {entries.map((e) => (
          <Message key={e.id} entry={e} />
        ))}
        {busy && !entries[entries.length - 1]?.streaming && <Text style={styles.typing}>{name} is thinking…</Text>}
      </ScrollView>
      {pending?.options && pending.options.length > 0 && !busy && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.starters} keyboardShouldPersistTaps="handled">
          {pending.options.map((o, i) => (
            <Chip key={o.id} label={o.label} onPress={() => send(String(i + 1))} />
          ))}
          <Chip label="Never mind" onPress={() => send('never mind')} />
        </ScrollView>
      )}
      {text.length === 0 && !pending && !recording && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.noGrow} contentContainerStyle={styles.starters} keyboardShouldPersistTaps="handled">
          {STARTERS.map((s) => (
            <Chip key={s} label={s} onPress={() => send(s)} />
          ))}
          <Chip label="Remember that…" icon="bookmark-outline" onPress={() => setText('Remember that ')} />
        </ScrollView>
      )}
      {voiceNote && <Text style={styles.voiceNote}>{voiceNote}</Text>}
      {recording || transcribing ? (
        <View style={styles.inputRow}>
          <View style={[styles.input, styles.recording]}>
            <View style={[styles.recDot, transcribing && { backgroundColor: colors.textFaint }]} />
            <Text style={styles.recText}>
              {transcribing ? 'Transcribing on this phone…' : `Listening… ${Math.floor(voice.durationMs / 1000)}s · tap ✓ when done`}
            </Text>
          </View>
          <IconButton icon="close" label="Cancel voice input" onPress={voice.cancel} style={styles.side} />
          {recording && <IconButton icon="checkmark" label="Stop and transcribe" onPress={voice.stop} color={colors.onAccent} style={styles.send} />}
        </View>
      ) : (
        <View style={styles.inputRow}>
          <IconButton icon="camera-outline" label="Add a photo" onPress={choosePhoto} style={styles.side} />
          <TextInput
            value={text}
            onChangeText={onType}
            placeholder={pending ? 'Your answer…' : `Message ${name}…`}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={600}
            returnKeyType="send"
            onSubmitEditing={() => send(text)}
            submitBehavior="submit"
            accessibilityLabel={`Message ${name}`}
          />
          {text.trim() ? (
            <IconButton icon="arrow-up" label="Send" onPress={() => send(text)} color={colors.onAccent} style={[styles.send, busy && { opacity: 0.4 }]} />
          ) : (
            <IconButton icon="mic-outline" label="Speak a message" onPress={() => void voice.start()} color={colors.onAccent} style={styles.send} />
          )}
        </View>
      )}
    </View>
  );
}

function Message({ entry: e }: { entry: ChatEntry }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const mine = e.from === 'user';
  return (
    <Animated.View entering={FadeInDown.duration(180)} style={mine ? styles.rowUser : styles.rowChar}>
      <View style={[styles.bubble, mine ? styles.bubbleUser : styles.bubbleChar]}>
        <Text style={[styles.bubbleText, mine && { color: colors.onAccent }]}>{e.text || '…'}</Text>
      </View>
      {!mine && e.source && SOURCE_LABEL[e.source] && !e.streaming && <Text style={styles.source}>{SOURCE_LABEL[e.source]}</Text>}
      {!mine && e.note && <Text style={styles.source}>{e.note}</Text>}
      {e.items && e.items.length > 0 && (
        <View style={styles.items}>
          {e.items.map((i) => (
            <View key={i.id} style={styles.item}>
              <Text style={styles.itemTitle}>{i.title}</Text>
              {i.detail && <Text style={styles.itemDetail}>{i.detail}</Text>}
            </View>
          ))}
        </View>
      )}
      {e.action && <ActionCard entry={e} />}
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
  );
}

/** The confirm card's icon matches what it changes (the same icons as the Planner's add menu). */
function actionIcon(type: ActionType): React.ComponentProps<typeof Ionicons>['name'] {
  if (type.endsWith('Event') || type === 'listEvents') return 'calendar';
  if (type.endsWith('Habit') || type === 'habitProgress') return 'leaf';
  if (type.endsWith('Chore') || type === 'listChores') return 'checkbox';
  if (type.endsWith('Journal')) return 'create';
  return 'sparkles';
}

function ActionCard({ entry }: { entry: ChatEntry }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const a = entry.action!;
  const card = actionCard(a.action);
  return (
    <View style={styles.proposal}>
      <View style={styles.proposalHead}>
        <Ionicons name={actionIcon(a.action.type)} size={14} color={colors.accent} />
        <Text style={styles.proposalLabel}>{card.heading}</Text>
      </View>
      {card.lines.map((l, i) => (
        <Text key={i} style={i === 0 ? styles.proposalTitle : styles.proposalContent}>
          {l}
        </Text>
      ))}
      {a.state === 'pending' ? (
        <View style={styles.proposalActions}>
          <Button compact tone="ghost" label="Cancel" onPress={() => resolveAction(entry.id, false)} />
          <Button compact label={card.confirmLabel} icon="checkmark" onPress={() => resolveAction(entry.id, true)} />
        </View>
      ) : (
        <Text style={styles.proposalDone}>{a.state === 'done' ? 'Saved' : a.state === 'failed' ? 'Not saved' : 'Cancelled'}</Text>
      )}
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
    engineIconOnly: { width: 28, paddingHorizontal: 0, justifyContent: 'center' },
    engineText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textDim },
    info: { marginHorizontal: 16, marginBottom: 6, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface, gap: 8 },
    infoText: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, color: colors.textDim },
    infoButton: { alignSelf: 'flex-start' },
    list: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
    hint: { fontFamily: fonts.regular, fontSize: 14, color: colors.textFaint, textAlign: 'center', marginTop: 12 },
    rowUser: { alignItems: 'flex-end' },
    rowChar: { alignItems: 'flex-start' },
    bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
    bubbleUser: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
    bubbleChar: { backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
    bubbleText: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.text },
    source: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint, marginTop: 3, marginLeft: 6, maxWidth: '88%' },
    typing: { fontFamily: fonts.medium, fontSize: 13, color: colors.textFaint },
    suggestion: { marginTop: 6 },
    items: { marginTop: 6, maxWidth: '88%', gap: 6 },
    item: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm + 2, backgroundColor: colors.surface, borderLeftWidth: 3, borderLeftColor: colors.brand },
    itemTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
    itemDetail: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textDim, marginTop: 1 },
    noGrow: { flexGrow: 0 },
    starters: { paddingHorizontal: 16, gap: 8, paddingBottom: 8, alignItems: 'center' },
    voiceNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.textDim, paddingHorizontal: 18, paddingBottom: 4 },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 4 },
    input: {
      flex: 1,
      height: 46,
      borderRadius: radii.md,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 15,
    },
    recording: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
    recText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, flexShrink: 1 },
    side: { width: 40, height: 46, borderRadius: radii.md },
    send: { width: 46, height: 46, borderRadius: radii.md, backgroundColor: colors.ink },
    proposal: {
      marginTop: 6,
      maxWidth: '88%',
      minWidth: '60%',
      padding: 12,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.accentSoft,
      gap: 6,
    },
    proposalHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    proposalLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.accent },
    proposalTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, lineHeight: 20 },
    proposalContent: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, lineHeight: 20 },
    warning: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.warning },
    proposalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
    proposalDone: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint },
  });
