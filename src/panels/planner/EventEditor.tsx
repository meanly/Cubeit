import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { minutesOf, type DayKey, type TimeOfDay } from '../../planner/dates';
import { useToday } from '../../planner/hooks';
import * as service from '../../planner/service';
import type { CalendarEvent } from '../../planner/types';
import { ensureNotificationPermission } from '../../services/notifications';
import { useStyles, type Colors } from '../../theme/theme';
import { fonts } from '../../theme/tokens';
import { confirm } from '../../ui/Confirm';
import { Button, Chip, Toggle } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { notice, run } from './run';
import { DateField, Field, Label, TimeField } from './ui';

const REMINDERS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: 'At start', value: 0 },
  { label: '10 min', value: 10 },
  { label: '1 hour', value: 60 },
  { label: '1 day', value: 1440 },
];

export function EventEditor({ event, day, onDone }: { event?: CalendarEvent; day?: DayKey; onDone: () => void }) {
  const styles = useStyles(makeStyles);
  const today = useToday();
  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState<DayKey>(event?.day ?? day ?? today);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [start, setStart] = useState<TimeOfDay | null>(event?.start ?? null);
  const [end, setEnd] = useState<TimeOfDay | null>(event?.end ?? null);
  const [timesValid, setTimesValid] = useState({ start: true, end: true });
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [reminder, setReminder] = useState<number | null>(event?.reminderMin ?? null);

  const endBeforeStart = !allDay && !!start && !!end && minutesOf(end) <= minutesOf(start);
  const canSave = title.trim().length > 0 && (allDay || (!!start && timesValid.start)) && timesValid.end && !endBeforeStart;

  const pickReminder = async (value: number | null) => {
    setReminder(value);
    if (value !== null && !(await ensureNotificationPermission())) {
      notice('Notifications are off for Cubeit, so this reminder won’t appear. You can turn them on in the Settings app.');
    }
  };

  const save = () => {
    const draft = {
      title,
      day: date,
      allDay,
      start: allDay ? undefined : (start ?? undefined),
      end: allDay ? undefined : (end ?? undefined),
      notes,
      reminderMin: reminder ?? undefined,
    };
    const ok = run(() => (event ? service.editEvent(event.id, draft) : service.createEvent(draft)));
    if (ok) onDone();
  };

  const remove = async () => {
    if (!event) return;
    if (await confirm({ title: 'Delete this event?', message: `“${event.title}” will be removed from this device.`, confirmLabel: 'Delete', destructive: true })) {
      if (
        run(() => {
          service.removeEvent(event.id);
          return true;
        })
      )
        onDone();
    }
  };

  return (
    <View style={styles.flex}>
      <PanelHeader title={event ? 'Edit event' : 'New event'} onBack={onDone} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Dentist, lunch with Sam…" maxLength={120} autoFocus={!event} />
        <DateField label="Date" value={date} today={today} onChange={setDate} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>All day</Text>
          <Toggle label="All day" value={allDay} onChange={setAllDay} />
        </View>
        {!allDay && (
          <View style={styles.times}>
            <View style={styles.flex}>
              <TimeField label="Starts" value={start} onChange={(t, valid) => {
                  setStart(t);
                  setTimesValid((v) => ({ ...v, start: valid }));
                }} />
            </View>
            <View style={styles.flex}>
              <TimeField label="Ends (optional)" value={end} onChange={(t, valid) => {
                  setEnd(t);
                  setTimesValid((v) => ({ ...v, end: valid }));
                }} placeholder="optional" />
            </View>
          </View>
        )}
        {endBeforeStart && <Text style={styles.error}>The end time has to be after the start time.</Text>}
        <Label>Reminder</Label>
        <View style={styles.chips}>
          {REMINDERS.map((r) => (
            <Chip key={r.label} label={r.label} selected={reminder === r.value} onPress={() => void pickReminder(r.value)} />
          ))}
        </View>
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional" multiline maxLength={1000} />
        <View style={styles.actions}>
          {event && <Button label="Delete" tone="danger" icon="trash-outline" onPress={() => void remove()} />}
          <Button label="Save" icon="checkmark" disabled={!canSave} onPress={save} style={styles.flex} />
        </View>
        {event && (
          <Button
            tone="secondary"
            icon={event.doneAt ? 'arrow-undo-outline' : 'checkmark-done-outline'}
            label={event.doneAt ? 'Mark as not done' : 'Mark as done'}
            onPress={() => {
              if (run(() => service.markEventDone(event.id, !event.doneAt))) onDone();
            }}
          />
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
    times: { flexDirection: 'row', gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    error: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger },
  });
