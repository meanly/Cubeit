import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatDay, type DayKey, type TimeOfDay } from '../../planner/dates';
import { useToday } from '../../planner/hooks';
import { upcomingOccurrences } from '../../planner/recurrence';
import * as service from '../../planner/service';
import { CHORE_CATEGORIES, type Chore, type ChoreCategory, type Recurrence } from '../../planner/types';
import { ensureNotificationPermission } from '../../services/notifications';
import { useStyles, type Colors } from '../../theme/theme';
import { fonts } from '../../theme/tokens';
import { confirm } from '../../ui/Confirm';
import { Button, Chip, IconButton, Toggle } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { notice, run } from './run';
import { DateField, Field, Label, Muted, TimeField } from './ui';

export const CATEGORY_LABEL: Record<ChoreCategory, string> = {
  home: 'Home',
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  outdoor: 'Outdoor',
  errand: 'Errand',
  pets: 'Pets',
  other: 'Other',
};

type RepeatUnit = 'none' | Recurrence['unit'];

export function ChoreEditor({ chore, initial, onDone }: { chore?: Chore; initial?: { title?: string; checklist?: string[] }; onDone: () => void }) {
  const styles = useStyles(makeStyles);
  const today = useToday();
  const [title, setTitle] = useState(chore?.title ?? initial?.title ?? '');
  const [notes, setNotes] = useState(chore?.notes ?? '');
  const [category, setCategory] = useState<ChoreCategory>(chore?.category ?? 'other');
  // New chores start on today; clear the date for an "anytime" chore.
  const [due, setDue] = useState<DayKey | null>(chore ? (chore.due ?? null) : today);
  const [dueTime, setDueTime] = useState<TimeOfDay | null>(chore?.dueTime ?? null);
  const [timeValid, setTimeValid] = useState(true);
  const [unit, setUnit] = useState<RepeatUnit>(chore?.recurrence?.unit ?? 'none');
  const [every, setEvery] = useState(chore?.recurrence?.every ?? 1);
  const [items, setItems] = useState<string[]>(chore?.checklist.map((c) => c.title) ?? initial?.checklist ?? []);
  const [reminder, setReminder] = useState(chore?.reminder ?? false);

  const recurrence: Recurrence | null = unit === 'none' ? null : { every, unit };
  const canSave = title.trim().length > 0 && timeValid;

  const save = () => {
    const effectiveDue = due ?? (recurrence ? today : null);
    const patch = {
      title,
      notes,
      category,
      checklist: items.filter((i) => i.trim()),
      reminder: reminder && !!effectiveDue,
    };
    const ok = chore
      ? run(() => service.editChore(chore.id, { ...patch, due: effectiveDue, dueTime: effectiveDue ? dueTime : null, recurrence }))
      : run(() =>
          service.createChore({
            ...patch,
            due: effectiveDue ?? undefined,
            dueTime: effectiveDue && dueTime ? dueTime : undefined,
            recurrence: recurrence ?? undefined,
          }),
        );
    if (ok) onDone();
  };

  const remove = async () => {
    if (!chore) return;
    const message = chore.recurrence ? 'This deletes the whole repeating chore (past completions stay in history).' : 'It will be removed from this device.';
    if (await confirm({ title: `Delete “${chore.title}”?`, message, confirmLabel: 'Delete', destructive: true })) {
      if (
        run(() => {
          service.removeChore(chore.id);
          return true;
        })
      )
        onDone();
    }
  };

  const toggleReminder = async (on: boolean) => {
    setReminder(on);
    if (on && !(await ensureNotificationPermission())) notice('Notifications are off for Cubeit, so this reminder won’t appear. You can turn them on in the Settings app.');
  };

  const preview = recurrence ? upcomingOccurrences(due ?? today, recurrence, 4, Number((due ?? today).slice(8, 10))) : [];

  return (
    <View style={styles.flex}>
      <PanelHeader title={chore ? 'Edit chore' : 'New chore'} onBack={onDone} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Chore" value={title} onChangeText={setTitle} placeholder="Vacuum the living room…" maxLength={120} autoFocus={!chore && !initial?.title} />
        <Label>Category</Label>
        <View style={styles.chips}>
          {CHORE_CATEGORIES.map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>
        <DateField label="Due" value={due} today={today} onChange={setDue} onClear={() => setDue(null)} />
        {due && <TimeField label="Time (optional)" value={dueTime} onChange={(t, valid) => {
          setDueTime(t);
          setTimeValid(valid);
        }} placeholder="optional" />}
        <Label>Repeat</Label>
        <View style={styles.chips}>
          {(['none', 'day', 'week', 'month'] as const).map((u) => (
            <Chip key={u} label={u === 'none' ? 'Never' : u === 'day' ? 'Daily' : u === 'week' ? 'Weekly' : 'Monthly'} selected={unit === u} onPress={() => setUnit(u)} />
          ))}
        </View>
        {recurrence && (
          <>
            <View style={styles.everyRow}>
              <Text style={styles.rowLabel}>Every</Text>
              <IconButton icon="remove" label="Less often" onPress={() => setEvery((n) => Math.max(1, n - 1))} />
              <Text style={styles.every}>{every}</Text>
              <IconButton icon="add" label="More apart" onPress={() => setEvery((n) => Math.min(365, n + 1))} />
              <Text style={styles.rowLabel}>{`${unit}${every === 1 ? '' : 's'}`}</Text>
            </View>
            <Muted>Next: {preview.map((d) => formatDay(d, today)).join(' · ')}. Finishing one moves it to the next — later ones stay open.</Muted>
          </>
        )}
        <Label>Checklist (optional)</Label>
        {items.map((item, i) => (
          <View key={i} style={styles.itemRow}>
            <View style={styles.flex}>
              <Field value={item} onChangeText={(t) => setItems((cur) => cur.map((x, j) => (j === i ? t : x)))} placeholder="Step" maxLength={120} />
            </View>
            <IconButton icon="close" label={`Remove item ${i + 1}`} onPress={() => setItems((cur) => cur.filter((_, j) => j !== i))} />
          </View>
        ))}
        {items.length < 30 && <Button compact tone="secondary" icon="add" label="Add checklist item" onPress={() => setItems((cur) => [...cur, ''])} />}
        {(due || recurrence) && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Remind me on the due day</Text>
            <Toggle label="Reminder" value={reminder} onChange={(v) => void toggleReminder(v)} />
          </View>
        )}
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline maxLength={1000} />
        <View style={styles.actions}>
          {chore && <Button label="Delete" tone="danger" icon="trash-outline" onPress={() => void remove()} />}
          <Button label="Save" icon="checkmark" disabled={!canSave} onPress={save} style={styles.flex} />
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    rowLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    everyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    every: { fontFamily: fonts.black, fontSize: 18, color: colors.text, minWidth: 28, textAlign: 'center' },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  });
