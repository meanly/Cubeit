import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { addDays, dayKey, formatDay, formatDayInline, formatTime, nowTime, startOfWeek, type DayKey } from '../../planner/dates';
import { habitStats, isScheduled, logDays, scheduleLabel } from '../../planner/habits';
import { MOOD_EMOJI, MOOD_LABEL } from '../../planner/journal';
import { canUndoCompletion, choreStatus, recurrenceLabel } from '../../planner/recurrence';
import * as service from '../../planner/service';
import type { CalendarEvent, Chore, ChoreCompletion, Habit, JournalEntry } from '../../planner/types';
import { usePlanner } from '../../state/plannerStore';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { PressableScale } from '../../ui/primitives';
import { run } from './run';
import { Check } from './ui';

/** A screen pushed over the planner tabs. */
export type Route =
  | { name: 'event'; event?: CalendarEvent; day?: DayKey }
  | { name: 'habit'; habit?: Habit; kind?: 'habit' | 'routine' }
  | { name: 'chore'; chore?: Chore; initial?: { title?: string; checklist?: string[] } }
  | { name: 'journal'; entry?: JournalEntry; initial?: { text?: string; prompt?: string; image?: string } };

export type Open = (route: Route) => void;

export function EventRow({ event, today, open, showDay }: { event: CalendarEvent; today: DayKey; open: Open; showDay?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const done = !!event.doneAt;
  // The check sits beside the tappable row, not inside it (a button can't contain a button).
  return (
    <View style={styles.line}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${event.title}, ${event.allDay ? 'all day' : formatTime(event.start!)}`} onPress={() => open({ name: 'event', event })} style={styles.eventMain}>
        <View style={styles.time}>
          <Text style={styles.timeText}>{event.allDay ? 'All day' : formatTime(event.start!)}</Text>
          {event.end && <Text style={styles.timeEnd}>{formatTime(event.end)}</Text>}
        </View>
        <View style={[styles.bar, { backgroundColor: done ? colors.lineStrong : colors.brand }]} />
        <View style={styles.flex}>
          <Text style={[styles.title, done && styles.doneText]} numberOfLines={2}>
            {event.title}
          </Text>
          {(showDay || event.reminderMin !== undefined || event.notes) && (
            <Text style={styles.meta} numberOfLines={1}>
              {[showDay ? formatDay(event.day, today) : null, event.reminderMin !== undefined ? '🔔' : null, event.notes ?? null].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>
      </PressableScale>
      <Check checked={done} label={done ? `Mark ${event.title} not done` : `Mark ${event.title} done`} onPress={() => run(() => service.markEventDone(event.id, !done))} />
    </View>
  );
}

/** `compact` (used on Today) leaves out the week dots and the schedule. */
export function HabitRow({ habit, today, open, compact }: { habit: Habit; today: DayKey; open: Open; compact?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const logs = usePlanner((s) => s.habitLogs);
  const checks = usePlanner((s) => s.stepChecks[`${habit.id}|${today}`]);
  const [expanded, setExpanded] = useState(false);
  const stats = habitStats(habit, logs, today);
  const done = logDays(logs, habit.id);
  const weekStart = startOfWeek(today);
  const routine = habit.kind === 'routine';
  const ticked = new Set(checks ?? []);

  const toggle = () => {
    if (routine && !stats.doneToday) {
      setExpanded(true);
      return;
    }
    if (stats.doneToday) run(() => service.uncompleteHabit(habit.id, today));
    else run(() => service.completeHabit(habit.id, today));
  };

  return (
    <View style={styles.habit}>
      <View style={styles.line}>
        <PressableScale accessibilityRole="button" accessibilityLabel={`${habit.title}. ${stats.streak}-day streak`} onPress={() => open({ name: 'habit', habit })} style={styles.lineMain}>
          <Text style={[styles.title, stats.doneToday && styles.doneText]}>{habit.title}</Text>
          {(!compact || routine || stats.streak > 0) && (
            <Text style={styles.meta}>
              {[
                stats.streak > 0 ? `🔥 ${stats.streak}` : null,
                routine ? `${stats.doneToday ? habit.steps.length : ticked.size}/${habit.steps.length} steps` : null,
                compact ? null : stats.dueToday ? scheduleLabel(habit.schedule) : `Rest day · ${scheduleLabel(habit.schedule)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
          {!compact && <View style={styles.week}>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const day = addDays(weekStart, i);
              const sched = isScheduled(habit.schedule, day);
              return (
                <View
                  key={day}
                  style={[
                    styles.weekDot,
                    done.has(day) ? { backgroundColor: colors.success } : sched ? { borderWidth: 1.5, borderColor: colors.lineStrong } : { backgroundColor: colors.surfacePressed, opacity: 0.5 },
                    day === today && { transform: [{ scale: 1.25 }] },
                  ]}
                />
              );
            })}
          </View>}
        </PressableScale>
        {routine && (
          <PressableScale accessibilityRole="button" accessibilityLabel={expanded ? 'Hide steps' : 'Show steps'} onPress={() => setExpanded((e) => !e)} hitSlop={8}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
          </PressableScale>
        )}
        <Check checked={stats.doneToday} label={stats.doneToday ? `Undo ${habit.title} for today` : `Complete ${habit.title} today`} onPress={toggle} />
      </View>
      {routine && expanded && (
        <View style={styles.steps}>
          {habit.steps.map((s, i) => {
            const on = stats.doneToday || ticked.has(s.id);
            return (
              <View key={s.id} style={styles.step}>
                <Check size={22} checked={on} label={`Step ${i + 1}: ${s.title}`} onPress={() => run(() => service.tickRoutineStep(habit.id, today, s.id, !on))} />
                <Text style={[styles.stepText, on && styles.doneText]}>{`${i + 1}. ${s.title}`}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** A habit on a day you can't tick yet (a future day in the calendar): just what's planned. */
export function HabitPlanRow({ habit, open }: { habit: Habit; open: Open }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${habit.title}, planned`} onPress={() => open({ name: 'habit', habit })} style={styles.habitHead}>
      <View style={styles.flex}>
        <Text style={styles.title}>{habit.title}</Text>
        <Text style={styles.meta}>{habit.kind === 'routine' ? `${habit.steps.length} steps · planned` : 'Planned'}</Text>
      </View>
      <Ionicons name="time-outline" size={20} color={colors.textFaint} />
    </PressableScale>
  );
}

/** A journal entry preview: day and mood, title or first lines, first photo. */
export function JournalRow({ entry, today, open, showDay = true }: { entry: JournalEntry; today: DayKey; open: Open; showDay?: boolean }) {
  const styles = useStyles(makeStyles);
  const meta = [
    showDay ? formatDay(entry.day, today) : null,
    entry.mood ? `${MOOD_EMOJI[entry.mood]} ${MOOD_LABEL[entry.mood]}` : null,
    entry.images.length > 1 ? `${entry.images.length} photos` : null,
  ].filter(Boolean);
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`Journal entry, ${formatDay(entry.day, today)}`} onPress={() => open({ name: 'journal', entry })} style={[styles.habitHead, styles.top]}>
      <View style={styles.flex}>
        {meta.length > 0 && <Text style={styles.metaTop}>{meta.join(' · ')}</Text>}
        {entry.title ? <Text style={styles.title}>{entry.title}</Text> : null}
        <Text style={styles.preview} numberOfLines={entry.title ? 2 : 3}>
          {entry.text}
        </Text>
      </View>
      {entry.images[0] && <Image source={{ uri: entry.images[0] }} style={styles.thumb} accessibilityLabel="Attached photo" />}
    </PressableScale>
  );
}

/**
 * An open chore. `showDue: false` (inside a day's section) leaves the day out
 * of the meta line. A one-off chore can be done early; a recurring chore's
 * next occurrence can't be checked off before its day.
 */
export function ChoreRow({ chore, today, open, showDue = true }: { chore: Chore; today: DayKey; open: Open; showDue?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [expanded, setExpanded] = useState(false);
  const status = choreStatus(chore, today);
  const finished = status === 'done';
  const later = status === 'upcoming' && !!chore.recurrence;
  const items = chore.checklist;
  const doneItems = items.filter((i) => i.done).length;
  const time = chore.dueTime ? formatTime(chore.dueTime) : null;
  const dueText = chore.due
    ? showDue
      ? `${status === 'overdue' ? 'Overdue · ' : ''}${formatDay(chore.due, today)}${time ? ` ${time}` : ''}`
      : time
    : showDue
      ? 'No due date'
      : null;
  const meta = [dueText, chore.recurrence ? recurrenceLabel(chore.recurrence) : null, items.length ? `${doneItems}/${items.length}` : null].filter(Boolean).join(' · ');
  return (
    <View style={styles.habit}>
      <View style={styles.line}>
        <PressableScale accessibilityRole="button" accessibilityLabel={`${chore.title}${meta ? `, ${meta}` : ''}`} onPress={() => open({ name: 'chore', chore })} style={styles.lineMain}>
          <Text style={[styles.title, finished && styles.doneText, later && styles.laterText]}>{chore.title}</Text>
          {meta ? <Text style={[styles.meta, status === 'overdue' && { color: colors.danger }]}>{meta}</Text> : null}
        </PressableScale>
        {items.length > 0 && !finished && !later && (
          <PressableScale accessibilityRole="button" accessibilityLabel={expanded ? 'Hide checklist' : 'Show checklist'} onPress={() => setExpanded((e) => !e)} hitSlop={8}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
          </PressableScale>
        )}
        <Check
          checked={finished}
          disabled={later}
          label={later ? `${chore.title} isn’t due until ${formatDayInline(chore.due!, today)}` : finished ? `Reopen ${chore.title}` : `Finish ${chore.title}`}
          onPress={() => run(() => (finished ? service.reopenChore(chore.id) : service.finishChore(chore.id, chore.due ?? null)))}
        />
      </View>
      {expanded && !finished && !later && (
        <View style={styles.steps}>
          {items.map((item) => (
            <View key={item.id} style={styles.step}>
              <Check size={22} checked={item.done} label={item.title} onPress={() => run(() => service.toggleChoreItem(chore.id, item.id))} />
              <Text style={[styles.stepText, item.done && styles.doneText]}>{item.title}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * A finished chore occurrence from history. Tapping the check undoes it while
 * that's still possible (the chore's latest completion, series not moved on).
 */
export function ChoreDoneRow({ record, today, open, showDay }: { record: ChoreCompletion; today: DayKey; open: Open; showDay?: boolean }) {
  const styles = useStyles(makeStyles);
  const chore = usePlanner((s) => s.chores.find((c) => c.id === record.choreId));
  const history = usePlanner((s) => s.choreHistory);
  const undoable = !!chore && canUndoCompletion(chore, history, record);
  const doneDay = dayKey(record.at);
  const meta = [
    `Done ${showDay ? `${formatDayInline(doneDay, today)} ` : ''}${formatTime(nowTime(record.at))}`,
    record.due && record.due !== doneDay ? `was due ${formatDayInline(record.due, today)}` : null,
    chore?.recurrence ? recurrenceLabel(chore.recurrence) : null,
  ].filter(Boolean).join(' · ');
  return (
    <View style={styles.line}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${record.title}, ${meta}`}
        disabled={!chore}
        onPress={chore ? () => open({ name: 'chore', chore }) : undefined}
        style={styles.lineMain}
      >
        <Text style={[styles.title, styles.doneText]}>{record.title}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </PressableScale>
      <Check checked disabled={!undoable} label={`Mark ${record.title} not done`} onPress={() => run(() => service.undoChore(record.choreId, record.at))} />
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    // Rows are flat: lists wrap them in a Group.
    time: { width: 62 },
    timeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
    timeEnd: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
    bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
    title: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
    doneText: { color: colors.textFaint, textDecorationLine: 'line-through' },
    laterText: { color: colors.textDim },
    meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, marginTop: 2 },
    habit: {},
    habitHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    // A row with its own buttons: the tappable main part, then the chevron / check beside it.
    line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 12 },
    lineMain: { flex: 1, paddingVertical: 12, paddingLeft: 12 },
    eventMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingLeft: 12 },
    week: { flexDirection: 'row', gap: 5, marginTop: 6 },
    weekDot: { width: 9, height: 9, borderRadius: 5 },
    steps: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4 },
    stepText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, flex: 1 },
    top: { alignItems: 'flex-start' },
    metaTop: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, marginBottom: 2 },
    preview: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 1 },
    thumb: { width: 52, height: 52, borderRadius: radii.sm, backgroundColor: colors.surfacePressed },
  });
