import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { Memory } from '../../memory/types';
import { addDays, formatDay, formatTime, startOfWeek, type DayKey } from '../../planner/dates';
import { habitStats, isScheduled, logDays, scheduleLabel } from '../../planner/habits';
import { choreStatus, recurrenceLabel } from '../../planner/recurrence';
import * as service from '../../planner/service';
import type { CalendarEvent, Chore, Habit, JournalEntry } from '../../planner/types';
import { usePlanner } from '../../state/plannerStore';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts } from '../../theme/tokens';
import { PressableScale } from '../../ui/primitives';
import { run } from './run';
import { Check } from './ui';

/** A screen pushed over the planner tabs. */
export type Route =
  | { name: 'event'; event?: CalendarEvent; day?: DayKey }
  | { name: 'habit'; habit?: Habit; kind?: 'habit' | 'routine' }
  | { name: 'chore'; chore?: Chore; initial?: { title?: string; checklist?: string[] } }
  | { name: 'journal'; entry?: JournalEntry; initial?: { text?: string; prompt?: string; image?: string } }
  | { name: 'memories' }
  | { name: 'memory'; memory: Memory | null }
  | { name: 'finds' }
  | { name: 'about' };

export type Open = (route: Route) => void;

export function EventRow({ event, today, open, showDay }: { event: CalendarEvent; today: DayKey; open: Open; showDay?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const done = !!event.doneAt;
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={`${event.title}, ${event.allDay ? 'all day' : formatTime(event.start!)}`} onPress={() => open({ name: 'event', event })} style={styles.row}>
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
      <Check checked={done} label={done ? `Mark ${event.title} not done` : `Mark ${event.title} done`} onPress={() => run(() => service.markEventDone(event.id, !done))} />
    </PressableScale>
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
      <PressableScale accessibilityRole="button" accessibilityLabel={`${habit.title}. ${stats.streak}-day streak`} onPress={() => open({ name: 'habit', habit })} style={styles.habitHead}>
        <View style={styles.flex}>
          <Text style={[styles.title, stats.doneToday && styles.doneText]}>{habit.title}</Text>
          {(!compact || routine || stats.streak > 0) && (
            <Text style={styles.meta}>
              {[
                stats.streak > 0 ? `🔥 ${stats.streak}` : null,
                routine ? `${stats.doneToday ? habit.steps.length : ticked.size}/${habit.steps.length} steps` : null,
                compact ? null : stats.dueToday ? scheduleLabel(habit.schedule) : 'Rest day',
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
        </View>
        {routine && (
          <PressableScale accessibilityRole="button" accessibilityLabel={expanded ? 'Hide steps' : 'Show steps'} onPress={() => setExpanded((e) => !e)} hitSlop={8}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
          </PressableScale>
        )}
        <Check checked={stats.doneToday} label={stats.doneToday ? `Undo ${habit.title} for today` : `Complete ${habit.title} today`} onPress={toggle} />
      </PressableScale>
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

export function ChoreRow({ chore, today, open }: { chore: Chore; today: DayKey; open: Open }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [expanded, setExpanded] = useState(false);
  const status = choreStatus(chore, today);
  const finished = status === 'done';
  const items = chore.checklist;
  const doneItems = items.filter((i) => i.done).length;
  const dueText = chore.due
    ? `${status === 'overdue' ? 'Overdue · ' : ''}${formatDay(chore.due, today)}${chore.dueTime ? ` ${formatTime(chore.dueTime)}` : ''}`
    : 'No due date';
  return (
    <View style={styles.habit}>
      <PressableScale accessibilityRole="button" accessibilityLabel={`${chore.title}, ${dueText}`} onPress={() => open({ name: 'chore', chore })} style={styles.habitHead}>
        <View style={styles.flex}>
          <Text style={[styles.title, finished && styles.doneText]}>{chore.title}</Text>
          <Text style={[styles.meta, status === 'overdue' && { color: colors.danger }]}>
            {[dueText, chore.recurrence ? recurrenceLabel(chore.recurrence) : null, items.length ? `${doneItems}/${items.length}` : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {items.length > 0 && !finished && (
          <PressableScale accessibilityRole="button" accessibilityLabel={expanded ? 'Hide checklist' : 'Show checklist'} onPress={() => setExpanded((e) => !e)} hitSlop={8}>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
          </PressableScale>
        )}
        <Check
          checked={finished}
          label={finished ? `Reopen ${chore.title}` : `Finish ${chore.title}`}
          onPress={() => run(() => (finished ? service.reopenChore(chore.id) : service.finishChore(chore.id, chore.due ?? null)))}
        />
      </PressableScale>
      {expanded && !finished && (
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    // Rows are flat: lists wrap them in a Group.
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
    time: { width: 62 },
    timeText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
    timeEnd: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
    bar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
    title: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20, color: colors.text },
    doneText: { color: colors.textFaint, textDecorationLine: 'line-through' },
    meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint, marginTop: 2 },
    habit: {},
    habitHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
    week: { flexDirection: 'row', gap: 5, marginTop: 6 },
    weekDot: { width: 9, height: 9, borderRadius: 5 },
    steps: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 4 },
    stepText: { fontFamily: fonts.regular, fontSize: 14, color: colors.text, flex: 1 },
  });
