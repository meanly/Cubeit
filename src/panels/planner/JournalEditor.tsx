import { useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { checkSensitive } from '../../memory/sensitive';
import { discardPhotos, pickPhoto } from '../../media/images';
import { deleteLocalFile, keepJournalImage } from '../../media/files';
import { type DayKey } from '../../planner/dates';
import { useToday } from '../../planner/hooks';
import { MOOD_LABEL, promptOfTheDay, JOURNAL_PROMPTS } from '../../planner/journal';
import * as service from '../../planner/service';
import { LIMITS, MOODS, type JournalEntry, type Mood } from '../../planner/types';
import { useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { confirm } from '../../ui/Confirm';
import { Button, Chip, IconButton } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { notice, run } from './run';
import { DateField, Field, Label, Muted } from './ui';

export function JournalEditor({ entry, initial, onDone }: { entry?: JournalEntry; initial?: { text?: string; prompt?: string; image?: string }; onDone: () => void }) {
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
  const sensitive = checkSensitive(text);

  const addPhoto = async (source: 'camera' | 'library') => {
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

  const discard = () => {
    added.forEach(deleteLocalFile);
    onDone();
  };

  const save = () => {
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

  const suggestion = promptOfTheDay(day);

  return (
    <View style={styles.flex}>
      <PanelHeader title={entry ? 'Edit entry' : 'New entry'} onBack={discard} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <DateField label="Day" value={day} today={today} onChange={setDay} />
        <Label>Mood (optional)</Label>
        <View style={styles.chips}>
          {MOODS.map((m) => (
            <Chip key={m} label={MOOD_LABEL[m]} selected={mood === m} onPress={() => setMood(mood === m ? null : m)} />
          ))}
        </View>
        {!entry && (
          <>
            <Label>Need a prompt?</Label>
            <View style={styles.chips}>
              {[suggestion, ...JOURNAL_PROMPTS.filter((p) => p !== suggestion).slice(0, 2)].map((p) => (
                <Chip key={p} label={p} selected={prompt === p} onPress={() => setPrompt(prompt === p ? undefined : p)} />
              ))}
            </View>
          </>
        )}
        <Field label="Title (optional)" value={title} onChangeText={setTitle} maxLength={120} />
        <Field
          label={prompt ?? 'Write'}
          value={text}
          onChangeText={setText}
          placeholder="Whatever’s on your mind…"
          multiline
          maxLength={LIMITS.journal}
          autoFocus={!entry && !initial?.text}
        />
        {sensitive.sensitive && (
          <Muted>This looks like it may include {sensitive.reasons.join(', ')}. Your journal stays on this device, but only keep it if you’re comfortable.</Muted>
        )}
        <Label>Photos</Label>
        <View style={styles.photos}>
          {images.map((uri) => (
            <View key={uri} style={styles.photoWrap}>
              <Image source={{ uri }} style={styles.photo} accessibilityLabel="Attached photo" />
              <IconButton icon="close" label="Remove photo" onPress={() => removePhoto(uri)} style={styles.photoRemove} />
            </View>
          ))}
        </View>
        {images.length < LIMITS.images && (
          <View style={styles.chips}>
            <Button compact tone="secondary" icon="camera-outline" label="Take photo" onPress={() => void addPhoto('camera')} />
            <Button compact tone="secondary" icon="image-outline" label="Choose photo" onPress={() => void addPhoto('library')} />
          </View>
        )}
        <View style={styles.actions}>
          {entry && <Button label="Delete" tone="danger" icon="trash-outline" onPress={() => void remove()} />}
          <Button label="Save" icon="checkmark" disabled={!text.trim()} onPress={save} style={styles.flex} />
        </View>
        <Muted>Your journal stays on this device. It’s never used to train anything or sent anywhere.</Muted>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    photoWrap: { width: 96, height: 96 },
    photo: { width: 96, height: 96, borderRadius: radii.md, backgroundColor: colors.surface },
    photoRemove: { position: 'absolute', top: 4, right: 4 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    label: { fontFamily: fonts.medium },
  });
