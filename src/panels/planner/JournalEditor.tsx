import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from 'react-native';

import { checkSensitive } from '../../memory/sensitive';
import { discardPhotos, pickPhoto } from '../../media/images';
import { deleteLocalFile, keepJournalImage } from '../../media/files';
import { addMonths, formatMonth, type DayKey } from '../../planner/dates';
import { useToday } from '../../planner/hooks';
import { JOURNAL_PROMPTS, MOOD_EMOJI, MOOD_LABEL, promptOfTheDay } from '../../planner/journal';
import * as service from '../../planner/service';
import { useUi } from '../../state/uiStore';
import { LIMITS, MOODS, type JournalEntry, type Mood } from '../../planner/types';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { confirm } from '../../ui/Confirm';
import { Button, IconButton, PressableScale, type IconName } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { notice, run } from './run';
import { dayText, MonthGridView } from './ui';

/** The browser's focus ring makes the page look like a form; it isn't drawn on phones anyway. */
const NO_RING = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/**
 * A blank page: the date at the top, an optional title, then just writing.
 * Photos sit under the text; mood, prompts and photos live in the toolbar at
 * the bottom so the page itself stays clean.
 */
export function JournalEditor({ entry, initial, onDone }: { entry?: JournalEntry; initial?: { text?: string; prompt?: string; image?: string }; onDone: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const today = useToday();
  const [day, setDay] = useState<DayKey>(entry?.day ?? today);
  const [prompt, setPrompt] = useState<string | undefined>(entry?.prompt ?? initial?.prompt);
  const [text, setText] = useState(entry?.text ?? initial?.text ?? '');
  const [title, setTitle] = useState(entry?.title ?? '');
  const [mood, setMood] = useState<Mood | null>(entry?.mood ?? null);
  const [images, setImages] = useState<string[]>(entry?.images ?? (initial?.image ? [initial.image] : []));
  // Photos added in this session (deleted again if the entry is discarded).
  const [added, setAdded] = useState<string[]>(initial?.image ? [initial.image] : []);
  const [picker, setPicker] = useState<'none' | 'date' | 'mood'>('none');
  const [month, setMonth] = useState<DayKey>(day);
  const sensitive = checkSensitive(text);

  const dirty = entry
    ? text !== entry.text || title !== (entry.title ?? '') || mood !== (entry.mood ?? null) || day !== entry.day || images.join() !== entry.images.join()
    : text.trim().length > 0 || title.trim().length > 0 || images.length > 0;
  const canSave = text.trim().length > 0;

  const addPhoto = async (source: 'camera' | 'library') => {
    if (images.length >= LIMITS.images) return notice(`Up to ${LIMITS.images} photos per entry.`);
    try {
      const picked = await pickPhoto(source);
      if (!picked) return;
      const kept = keepJournalImage(picked.uri);
      if (kept !== picked.uri) discardPhotos(picked.uri);
      setImages((cur) => [...cur, kept]);
      setAdded((cur) => [...cur, kept]);
    } catch (error) {
      notice(error instanceof Error ? error.message : 'Couldn’t add that photo.');
    }
  };

  const removePhoto = (uri: string) => {
    setImages((cur) => cur.filter((u) => u !== uri));
    // A photo that was only just added can go right away; saved ones go when the entry is saved.
    if (added.includes(uri)) {
      deleteLocalFile(uri);
      setAdded((cur) => cur.filter((u) => u !== uri));
    }
  };

  const askDiscard = async () => {
    if (!(await confirm({ title: entry ? 'Discard your changes?' : 'Discard this entry?', message: 'What you wrote here won’t be saved.', confirmLabel: 'Discard', destructive: true }))) return false;
    added.forEach(deleteLocalFile);
    return true;
  };

  // Closing the sheet or switching tabs asks too, not just the back arrow.
  const setLeaveGuard = useUi((s) => s.setLeaveGuard);
  useEffect(() => {
    if (!dirty) return;
    setLeaveGuard(askDiscard);
    return () => setLeaveGuard(null);
  });

  const leave = async () => {
    if (dirty && !(await askDiscard())) return;
    if (!dirty) added.forEach(deleteLocalFile);
    onDone();
  };

  const save = () => {
    if (!canSave) return notice('Write a little something first.');
    const draft = { day, text, title, mood: mood ?? undefined, prompt, images };
    const ok = entry ? run(() => service.editJournalEntry(entry.id, { ...draft, mood: mood ?? null })) : run(() => service.createJournalEntry(draft));
    if (ok) onDone();
  };

  const remove = async () => {
    if (!entry) return;
    if (await confirm({ title: 'Delete this entry?', message: 'The entry and its photos are removed from this device for good.', confirmLabel: 'Delete', destructive: true })) {
      if (
        run(() => {
          service.removeJournalEntry(entry.id);
          return true;
        })
      ) {
        added.forEach(deleteLocalFile);
        onDone();
      }
    }
  };

  // Tapping the bulb suggests today's prompt, then cycles through the others.
  const nextPrompt = () => {
    if (!prompt) return setPrompt(promptOfTheDay(day));
    const i = JOURNAL_PROMPTS.indexOf(prompt as (typeof JOURNAL_PROMPTS)[number]);
    setPrompt(JOURNAL_PROMPTS[(i + 1) % JOURNAL_PROMPTS.length]);
  };

  const toggle = (p: 'date' | 'mood') => {
    if (p === 'date') setMonth(day);
    setPicker((cur) => (cur === p ? 'none' : p));
  };

  return (
    <View style={styles.flex}>
      <PanelHeader title={entry ? 'Journal entry' : 'New entry'} onBack={() => void leave()} right={<Button compact label="Done" disabled={!canSave} onPress={save} />} />

      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.page}>
          <View style={styles.metaRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Date: ${dayText(day, today)}. Change`} onPress={() => toggle('date')} hitSlop={6} style={styles.dateBtn}>
              <Text style={styles.date}>{dayText(day, today)}</Text>
              <Ionicons name={picker === 'date' ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textFaint} />
            </Pressable>
            {mood && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Mood: ${MOOD_LABEL[mood]}. Change`} onPress={() => toggle('mood')} hitSlop={6} style={styles.moodBadge}>
                <Text style={styles.moodBadgeText}>
                  {MOOD_EMOJI[mood]} {MOOD_LABEL[mood]}
                </Text>
              </Pressable>
            )}
          </View>

          {picker === 'date' && (
            <View style={styles.calendar}>
              <View style={styles.monthNav}>
                <IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth((m) => addMonths(m, -1, 1))} size={18} />
                <Text style={styles.monthTitle}>{formatMonth(month)}</Text>
                <IconButton icon="chevron-forward" label="Next month" onPress={() => setMonth((m) => addMonths(m, 1, 1))} size={18} />
              </View>
              <MonthGridView
                compact
                month={month}
                selected={day}
                today={today}
                onSelect={(d) => {
                  setDay(d);
                  setPicker('none');
                }}
              />
            </View>
          )}

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Title"
            placeholderTextColor={colors.textFaint}
            maxLength={LIMITS.title}
            style={[styles.title, NO_RING]}
            accessibilityLabel="Title (optional)"
            returnKeyType="next"
          />

          {prompt && (
            <View style={styles.prompt}>
              <Ionicons name="bulb-outline" size={15} color={colors.brand} />
              <Text style={styles.promptText}>{prompt}</Text>
              <IconButton icon="close" label="Remove the prompt" onPress={() => setPrompt(undefined)} size={14} style={styles.promptClose} />
            </View>
          )}

          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={prompt ? 'Start writing…' : 'What’s on your mind today?'}
            placeholderTextColor={colors.textFaint}
            multiline
            maxLength={LIMITS.journal}
            autoFocus={!entry && !initial?.text}
            style={[styles.body, NO_RING]}
            accessibilityLabel="Journal text"
          />

          {sensitive.sensitive && (
            <Text style={styles.hint}>This looks like it may include {sensitive.reasons.join(', ')}. Your journal stays on this device, but only keep it if you’re comfortable.</Text>
          )}

          {images.length > 0 && (
            <View style={styles.photos}>
              {images.map((uri) => (
                <View key={uri} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} accessibilityLabel="Attached photo" />
                  <IconButton icon="close" label="Remove photo" onPress={() => removePhoto(uri)} size={14} style={styles.photoRemove} />
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.footer}>Private · stays on this device</Text>
      </ScrollView>

      {picker === 'mood' && (
        <View style={styles.moodBar} accessibilityRole="radiogroup">
          {MOODS.map((m) => (
            <PressableScale
              key={m}
              accessibilityRole="radio"
              accessibilityLabel={MOOD_LABEL[m]}
              accessibilityState={{ checked: mood === m }}
              onPress={() => {
                setMood(mood === m ? null : m);
                setPicker('none');
              }}
              style={[styles.moodOption, mood === m && styles.moodOn]}
            >
              <Text style={styles.moodEmoji}>{MOOD_EMOJI[m]}</Text>
              <Text style={styles.moodLabel}>{MOOD_LABEL[m]}</Text>
            </PressableScale>
          ))}
        </View>
      )}

      <View style={styles.toolbar}>
        <Tool icon="camera-outline" label="Take a photo" onPress={() => void addPhoto('camera')} />
        <Tool icon="image-outline" label="Add a photo" onPress={() => void addPhoto('library')} />
        <Tool icon="happy-outline" label="Mood" active={picker === 'mood' || !!mood} onPress={() => toggle('mood')} />
        <Tool icon="bulb-outline" label={prompt ? 'Another prompt' : 'Give me a prompt'} active={!!prompt} onPress={nextPrompt} />
        <View style={styles.flex} />
        {entry && <Tool icon="trash-outline" label="Delete entry" danger onPress={() => void remove()} />}
      </View>
    </View>
  );
}

function Tool({ icon, label, onPress, active, danger }: { icon: IconName; label: string; onPress: () => void; active?: boolean; danger?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4} style={[styles.tool, active && styles.toolOn]}>
      <Ionicons name={icon} size={22} color={danger ? colors.danger : active ? colors.brand : colors.textDim} />
    </PressableScale>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    scroll: { paddingHorizontal: 12, paddingBottom: 16, flexGrow: 1 },
    page: { flexGrow: 1, minHeight: 280, padding: 16, paddingTop: 12, borderRadius: radii.lg, backgroundColor: colors.surface, gap: 6 },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
    date: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDim },
    moodBadge: { paddingHorizontal: 10, minHeight: 28, justifyContent: 'center', borderRadius: radii.pill, backgroundColor: colors.paper },
    moodBadgeText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
    calendar: { padding: 8, borderRadius: radii.md, backgroundColor: colors.paper, marginBottom: 4 },
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
    monthTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
    title: { fontFamily: fonts.black, fontSize: 22, color: colors.text, paddingVertical: 6, letterSpacing: -0.3 },
    prompt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingLeft: 10, paddingRight: 4, borderRadius: radii.sm, backgroundColor: colors.brandSoft },
    promptText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19, color: colors.text },
    promptClose: { width: 26, height: 26, backgroundColor: 'transparent' },
    body: { flexGrow: 1, minHeight: 200, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.text, textAlignVertical: 'top', paddingTop: 4 },
    hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.textFaint },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
    photoWrap: { width: 92, height: 92 },
    photo: { width: 92, height: 92, borderRadius: radii.md, backgroundColor: colors.surfacePressed },
    photoRemove: { position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12 },
    footer: { fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint, textAlign: 'center', marginTop: 10 },
    moodBar: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineStrong },
    moodOption: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: radii.md },
    moodOn: { backgroundColor: colors.brandSoft },
    moodEmoji: { fontSize: 22 },
    moodLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.textDim },
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineStrong },
    tool: { width: 44, height: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
    toolOn: { backgroundColor: colors.brandSoft },
  });
