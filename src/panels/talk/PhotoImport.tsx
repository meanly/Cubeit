import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { proposeFromText, sendChatMessage } from '../../conversation/chatSession';
import { keepJournalImage } from '../../media/files';
import { discardPhotos, normalizePhoto, ocrAvailability, pickPhoto, recognizeText } from '../../media/images';
import { guessEventFromText, linesToChecklist } from '../../media/ocrText';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { Button } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';

type Step = { kind: 'pick' } | { kind: 'preview'; uri: string } | { kind: 'reading'; uri: string } | { kind: 'review'; uri: string };

/**
 * Photo → text → planner. The photo is shown first, text is read on-device
 * only when the user asks, and the recognized text is fully editable before
 * it becomes an event, a checklist, a habit or a journal entry (each still
 * needs a final tap in the chat). Temporary image files are deleted on exit.
 */
export function PhotoImport({ source, onClose }: { source: 'camera' | 'library'; onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const temps = useRef<string[]>([]);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Always clean up temporary copies when leaving.
  useEffect(() => () => discardPhotos(...temps.current), []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const picked = await pickPhoto(source);
        if (!alive) return;
        if (!picked) return closeRef.current();
        temps.current.push(picked.uri);
        const normalized = await normalizePhoto(picked.uri, picked.width);
        if (normalized !== picked.uri) temps.current.push(normalized);
        if (alive) setStep({ kind: 'preview', uri: normalized });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Couldn’t open that photo.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [source]);

  const read = async (uri: string) => {
    const available = ocrAvailability();
    if (!available.ok) return setError(available.reason);
    setError(null);
    setStep({ kind: 'reading', uri });
    try {
      const lines = await recognizeText(uri);
      if (lines.length === 0) {
        setError('No text found in that photo. You can still type it below.');
      }
      setText(lines.join('\n'));
      setStep({ kind: 'review', uri });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t read that photo.');
      setStep({ kind: 'review', uri });
    }
  };

  const finish = (fn: () => void) => {
    fn();
    onClose();
  };
  const body = text.trim();
  const firstLine = body.split('\n')[0] ?? '';

  return (
    <View style={styles.flex}>
      <PanelHeader title="From a photo" onBack={onClose} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step.kind === 'pick' && !error && <ActivityIndicator color={colors.brand} />}
        {'uri' in step && <Image source={{ uri: step.uri }} style={styles.preview} resizeMode="contain" accessibilityLabel="Selected photo" />}
        {error && <Text style={styles.error}>{error}</Text>}
        {step.kind === 'preview' && (
          <>
            <Text style={styles.note}>Read the text in this photo? It’s done on this phone — the photo isn’t uploaded anywhere.</Text>
            <Button icon="scan-outline" label="Read text" onPress={() => void read(step.uri)} />
          </>
        )}
        {step.kind === 'reading' && (
          <View style={styles.reading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.note}>Reading text…</Text>
          </View>
        )}
        {step.kind === 'review' && (
          <>
            <Text style={styles.label}>Check and fix the text</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              style={styles.input}
              placeholder="Recognized text appears here"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Recognized text"
            />
            <Text style={styles.note}>Text recognition only reads words — it doesn’t understand the picture. Each option below still asks you to confirm.</Text>
            <View style={styles.grid}>
              <Button
                compact
                tone="secondary"
                icon="calendar-outline"
                label="Event"
                disabled={!body}
                onPress={() =>
                  finish(() => {
                    const g = guessEventFromText(body, Date.now());
                    proposeFromText({ intent: 'create_event', title: g.title || firstLine, when: body }, body, `📷 Make an event from: “${(g.title || firstLine).slice(0, 60)}”`);
                  })
                }
              />
              <Button
                compact
                tone="secondary"
                icon="checkbox-outline"
                label="Checklist chore"
                disabled={!body}
                onPress={() =>
                  finish(() => {
                    const items = linesToChecklist(body);
                    const title = items.length > 1 ? items[0] : 'Checklist from photo';
                    proposeFromText({ intent: 'create_chore', title, steps: items.length > 1 ? items.slice(1) : items }, title, `📷 Make a checklist (${items.length} items)`);
                  })
                }
              />
              <Button
                compact
                tone="secondary"
                icon="leaf-outline"
                label="Habit"
                disabled={!body}
                onPress={() => finish(() => proposeFromText({ intent: 'create_habit', title: firstLine, days: body }, body, `📷 Make a habit: “${firstLine.slice(0, 60)}”`))}
              />
              <Button
                compact
                tone="secondary"
                icon="book-outline"
                label="Journal + photo"
                disabled={!body}
                onPress={() =>
                  finish(() => {
                    let kept: string[] = [];
                    try {
                      kept = [keepJournalImage(step.uri)];
                    } catch {
                      kept = [];
                    }
                    proposeFromText({ intent: 'create_journal', text: body }, body, '📷 Add this to my journal', kept);
                  })
                }
              />
            </View>
            <Button icon="chatbubble-ellipses-outline" label="Ask about this text" disabled={!body} onPress={() => finish(() => void sendChatMessage(body.slice(0, 600)))} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
    preview: { width: '100%', height: 200, borderRadius: radii.md, backgroundColor: colors.surface },
    reading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    label: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDim },
    note: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textDim },
    error: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.warning },
    input: {
      minHeight: 140,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      padding: 12,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  });
