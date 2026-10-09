import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { addDays, dayDate, diffDays, formatDay, startOfWeek, WEEKDAY_SHORT, type TimeOfDay, type Weekday } from '../../planner/dates';
import { habitStats, isScheduled, logDays, scheduleLabel } from '../../planner/habits';
import { useToday } from '../../planner/hooks';
import * as service from '../../planner/service';
import { HABIT_TEMPLATES, TEMPLATE_GROUP_LABEL, templateTaken, type HabitTemplate, type TemplateGroup } from '../../planner/templates';
import type { Habit, HabitSchedule } from '../../planner/types';
import { ensureNotificationPermission } from '../../services/notifications';
import { usePlanner } from '../../state/plannerStore';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { confirm } from '../../ui/Confirm';
import { Button, Chip, IconButton, PressableScale, Toggle, type IconName } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { notice, run } from './run';
import { Card, Field, Group, Label, LinkRow, Muted, SectionHeader, TimeField } from './ui';

const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** What a new habit form starts with: blank, or filled in from a template. */
interface Seed {
  kind: 'habit' | 'routine';
  title: string;
  days: Weekday[];
  steps: string[];
}

const blank = (kind: 'habit' | 'routine'): Seed => ({ kind, title: '', days: EVERY_DAY, steps: [] });
const fromTemplate = (t: HabitTemplate): Seed => ({
  kind: t.kind,
  title: t.title,
  days: t.schedule.type === 'days' ? t.schedule.days : EVERY_DAY,
  steps: t.steps ?? [],
});

/** Editing opens the form; a new habit starts at the template picker unless a kind was given. */
export function HabitEditor({ habit, kind, onDone }: { habit?: Habit; kind?: 'habit' | 'routine'; onDone: () => void }) {
  const [seed, setSeed] = useState<Seed | null>(!habit && kind ? blank(kind) : null);
  if (habit) return <HabitForm habit={habit} onBack={onDone} onDone={onDone} />;
  if (!seed) return <TemplatePicker onPick={setSeed} onBack={onDone} />;
  return <HabitForm seed={seed} onBack={kind ? onDone : () => setSeed(null)} onDone={onDone} />;
}

const GROUP_ICON: Record<TemplateGroup, IconName> = {
  routines: 'list-outline',
  health: 'fitness-outline',
  mind: 'happy-outline',
  home: 'home-outline',
};

function TemplatePicker({ onPick, onBack }: { onPick: (seed: Seed) => void; onBack: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const habits = usePlanner((s) => s.habits);
  const groups = Object.keys(TEMPLATE_GROUP_LABEL) as TemplateGroup[];
  return (
    <View style={styles.flex}>
      <PanelHeader title="New habit" onBack={onBack} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.picker}>
        <Group>
          <LinkRow icon="create-outline" title="Start from scratch" detail="A simple daily or weekly habit" onPress={() => onPick(blank('habit'))} />
          <LinkRow icon="list-outline" title="Build a routine" detail="A habit made of steps, done in order" onPress={() => onPick(blank('routine'))} />
        </Group>
        {groups.map((g) => (
          <View key={g} style={styles.pickerGroup}>
            <SectionHeader title={TEMPLATE_GROUP_LABEL[g]} />
            <Group>
              {HABIT_TEMPLATES.filter((t) => t.group === g).map((t) => {
                const taken = templateTaken(t, habits);
                const detail = [t.steps ? `${t.steps.length} steps` : null, scheduleLabel(t.schedule)].filter(Boolean).join(' · ');
                return (
                  <Card key={t.id} flat onPress={taken ? undefined : () => onPick(fromTemplate(t))} label={taken ? `${t.title}, already added` : `${t.title}, ${detail}`}>
                    <Ionicons name={GROUP_ICON[g]} size={20} color={taken ? colors.textFaint : colors.brand} />
                    <View style={styles.flex}>
                      <Text style={[styles.tplTitle, taken && { color: colors.textFaint }]}>{t.title}</Text>
                      <Text style={styles.tplMeta}>{taken ? 'Already added' : detail}</Text>
                    </View>
                    <Ionicons name={taken ? 'checkmark' : 'chevron-forward'} size={taken ? 18 : 16} color={taken ? colors.success : colors.textFaint} />
                  </Card>
                );
              })}
            </Group>
          </View>
        ))}
        <Muted>Templates only fill in the form. Change anything you like before saving.</Muted>
      </ScrollView>
    </View>
  );
}

function HabitForm({ habit, seed, onBack, onDone }: { habit?: Habit; seed?: Seed; onBack: () => void; onDone: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const kind = habit?.kind ?? seed?.kind ?? 'habit';
  const [title, setTitle] = useState(habit?.title ?? seed?.title ?? '');
  const [days, setDays] = useState<Weekday[]>(habit ? (habit.schedule.type === 'days' ? habit.schedule.days : EVERY_DAY) : (seed?.days ?? EVERY_DAY));
  const [remind, setRemind] = useState(!!habit?.reminder);
  const [reminder, setReminder] = useState<TimeOfDay | null>(habit?.reminder ?? '09:00');
  const [reminderValid, setReminderValid] = useState(true);
  const [steps, setSteps] = useState<{ id?: string; title: string }[]>(
    habit?.steps.length ? habit.steps : seed?.steps.length ? seed.steps.map((t) => ({ title: t })) : [{ title: '' }],
  );

  const schedule: HabitSchedule = days.length === 7 ? { type: 'daily' } : { type: 'days', days };
  const cleanSteps = steps.filter((s) => s.title.trim());
  const canSave = title.trim().length > 0 && days.length > 0 && (!remind || (reminderValid && !!reminder)) && (kind === 'habit' || cleanSteps.length > 0);

  const toggleDay = (d: Weekday) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  const moveStep = (i: number, dir: -1 | 1) =>
    setSteps((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const setReminderOn = async (on: boolean) => {
    setRemind(on);
    if (on && !(await ensureNotificationPermission())) notice('Notifications are off for Cubeit, so reminders won’t appear. You can turn them on in the Settings app.');
  };

  const save = () => {
    const rem = remind && reminder ? reminder : undefined;
    const ok = habit
      ? run(() => service.editHabit(habit.id, { title, schedule, reminder: rem ?? null, ...(habit.kind === 'routine' ? { steps: cleanSteps } : {}) }))
      : run(() => service.createHabit({ title, kind, schedule, reminder: rem, steps: cleanSteps.map((s) => s.title) }));
    if (ok) onDone();
  };

  const remove = async () => {
    if (!habit) return;
    if (await confirm({ title: `Delete “${habit.title}”?`, message: 'Its whole history goes too. Archive it instead to keep the history.', confirmLabel: 'Delete', destructive: true })) {
      if (
        run(() => {
          service.removeHabit(habit.id);
          return true;
        })
      )
        onDone();
    }
  };

  return (
    <View style={styles.flex}>
      <PanelHeader title={`${habit ? 'Edit' : 'New'} ${kind === 'routine' ? 'routine' : 'habit'}`} onBack={onBack} />
      <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field
          label="Name"
          value={title}
          onChangeText={setTitle}
          placeholder={kind === 'routine' ? 'Morning routine' : 'Drink water, read 20 minutes…'}
          maxLength={120}
          autoFocus={!habit && !seed?.title}
        />
        <Label>Days</Label>
        <View style={styles.chips}>
          <Chip label="Every day" selected={days.length === 7} onPress={() => setDays(EVERY_DAY)} />
          <Chip label="Weekdays" selected={days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d as Weekday))} onPress={() => setDays([1, 2, 3, 4, 5])} />
        </View>
        <View style={styles.weekRow}>
          {ORDER.map((d) => (
            <PressableScale
              key={d}
              accessibilityRole="checkbox"
              accessibilityLabel={WEEKDAY_SHORT[d]}
              accessibilityState={{ checked: days.includes(d) }}
              onPress={() => toggleDay(d)}
              style={[styles.dayChip, days.includes(d) && { backgroundColor: colors.brand }]}
            >
              <Text style={[styles.dayChipText, days.includes(d) && { color: colors.onAccent }]}>{WEEKDAY_SHORT[d].slice(0, 2)}</Text>
            </PressableScale>
          ))}
        </View>
        {days.length === 0 && <Text style={styles.error}>Pick at least one day.</Text>}

        {kind === 'routine' && (
          <>
            <Label>Steps, in order</Label>
            {steps.map((s, i) => (
              <View key={s.id ?? `new-${i}`} style={styles.stepRow}>
                <Text style={styles.stepNum}>{i + 1}</Text>
                <View style={styles.flex}>
                  <Field value={s.title} onChangeText={(t) => setSteps((cur) => cur.map((x, j) => (j === i ? { ...x, title: t } : x)))} placeholder="Step" maxLength={120} />
                </View>
                <IconButton icon="arrow-up" label={`Move step ${i + 1} up`} onPress={() => moveStep(i, -1)} />
                <IconButton icon="arrow-down" label={`Move step ${i + 1} down`} onPress={() => moveStep(i, 1)} />
                <IconButton icon="close" label={`Remove step ${i + 1}`} onPress={() => setSteps((cur) => (cur.length > 1 ? cur.filter((_, j) => j !== i) : [{ title: '' }]))} />
              </View>
            ))}
            {steps.length < 20 && <Button compact tone="secondary" icon="add" label="Add step" onPress={() => setSteps((cur) => [...cur, { title: '' }])} />}
          </>
        )}

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Daily reminder</Text>
          <Toggle label="Daily reminder" value={remind} onChange={(v) => void setReminderOn(v)} />
        </View>
        {remind && <TimeField label="Remind me at" value={reminder} onChange={(t, valid) => {
          setReminder(t);
          setReminderValid(valid);
        }} />}

        {habit && <History habit={habit} />}

        <View style={styles.actions}>
          {habit && <Button label="Delete" tone="danger" icon="trash-outline" onPress={() => void remove()} />}
          <Button label="Save" icon="checkmark" disabled={!canSave} onPress={save} style={styles.flex} />
        </View>
        {habit && (
          <Button
            tone="secondary"
            icon={habit.archived ? 'archive' : 'archive-outline'}
            label={habit.archived ? 'Unarchive' : 'Archive (keeps history)'}
            onPress={() => {
              if (
                run(() => {
                  service.archiveHabit(habit.id, !habit.archived);
                  return true;
                })
              )
                onDone();
            }}
          />
        )}
        {!habit && <Muted>Streaks count only the days you pick, so rest days never break them.</Muted>}
      </ScrollView>
    </View>
  );
}

/** Last five weeks; tap a past scheduled day to correct it (e.g. you forgot to log it). */
function History({ habit }: { habit: Habit }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const today = useToday();
  const logs = usePlanner((s) => s.habitLogs);
  const live = usePlanner((s) => s.habits.find((h) => h.id === habit.id)) ?? habit;
  const done = logDays(logs, habit.id);
  const stats = habitStats(live, logs, today);
  const start = addDays(startOfWeek(today), -28);
  const weeks = [0, 1, 2, 3, 4].map((w) => [0, 1, 2, 3, 4, 5, 6].map((d) => addDays(start, w * 7 + d)));

  const toggle = (day: string) => {
    if (diffDays(day, today) < 0) return;
    if (done.has(day)) run(() => service.uncompleteHabit(habit.id, day));
    else run(() => service.completeHabit(habit.id, day));
  };

  return (
    <View style={styles.history}>
      <Text style={styles.rowLabel}>History</Text>
      <Text style={styles.stats}>
        {stats.streak}-day streak · best {stats.best} · {stats.week.done}/{stats.week.scheduled} this week{stats.rate28 !== null ? ` · ${Math.round(stats.rate28 * 100)}% last 4 weeks` : ''}
      </Text>
      {weeks.map((week) => (
        <View key={week[0]} style={styles.weekRow}>
          {week.map((day) => {
            const future = diffDays(day, today) < 0;
            const sched = isScheduled(live.schedule, day) && diffDays(live.startDay, day) >= 0;
            const isDone = done.has(day);
            return (
              <PressableScale
                key={day}
                haptic={false}
                disabled={future}
                accessibilityRole="checkbox"
                accessibilityLabel={`${formatDay(day, today)}${sched ? '' : ', not scheduled'}`}
                accessibilityState={{ checked: isDone, disabled: future }}
                onPress={() => toggle(day)}
                style={[
                  styles.histCell,
                  isDone && { backgroundColor: colors.success },
                  !isDone && sched && !future && { borderColor: colors.lineStrong, borderWidth: 1.5 },
                  future && { opacity: 0.3 },
                ]}
              >
                <Text style={[styles.histText, isDone && { color: colors.onAccent }]}>{dayDate(day).getDate()}</Text>
              </PressableScale>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <Ionicons name="information-circle-outline" size={14} color={colors.textFaint} />
        <Text style={styles.legendText}>Outlined days were scheduled. Tap a past day to fix it.</Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    body: { paddingHorizontal: 16, paddingBottom: 24, gap: 14 },
    picker: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24, gap: 8 },
    pickerGroup: { gap: 8 },
    tplTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
    tplMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, marginTop: 2 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
    dayChip: { flex: 1, height: 38, borderRadius: radii.sm, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
    dayChipText: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDim },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepNum: { width: 18, fontFamily: fonts.bold, fontSize: 14, color: colors.textFaint, textAlign: 'center' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    error: { fontFamily: fonts.regular, fontSize: 12, color: colors.danger },
    history: { gap: 8, padding: 12, borderRadius: radii.md, backgroundColor: colors.surface },
    stats: { fontFamily: fonts.regular, fontSize: 13, color: colors.textDim },
    histCell: { flex: 1, aspectRatio: 1, maxHeight: 40, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
    histText: { fontFamily: fonts.medium, fontSize: 12, color: colors.textDim },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
  });
