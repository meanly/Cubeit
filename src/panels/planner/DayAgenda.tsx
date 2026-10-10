import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { dayKey, diffDays, type DayKey } from '../../planner/dates';
import { habitStats, isScheduled } from '../../planner/habits';
import { eventsOn } from '../../planner/ops';
import { choreStatus } from '../../planner/recurrence';
import { usePlanner } from '../../state/plannerStore';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts } from '../../theme/tokens';
import { ChoreDoneRow, ChoreRow, EventRow, HabitPlanRow, HabitRow, JournalRow, type Open } from './rows';
import { Group, Muted } from './ui';

type Kind = 'event' | 'habit' | 'chore' | 'journal';

/** One color per kind, shared by the month-grid dots, the legend and the section labels. */
export function kindColors(colors: Colors): Record<Kind, string> {
  return { event: colors.brand, habit: colors.textDim, chore: colors.warning, journal: colors.success };
}

/** Dots for the month grid: days with events, chores due, or journal entries (habits repeat, so they'd mark every day). */
export function useCalendarMarks(): ReadonlyMap<DayKey, readonly string[]> {
  const colors = useColors();
  const { events, chores, journal } = usePlanner(useShallow((s) => ({ events: s.events, chores: s.chores, journal: s.journal })));
  return useMemo(() => {
    const c = kindColors(colors);
    const marks = new Map<DayKey, string[]>();
    const add = (day: DayKey, color: string) => {
      const list = marks.get(day) ?? [];
      if (!list.includes(color)) list.push(color);
      marks.set(day, list);
    };
    for (const e of events) add(e.day, c.event);
    for (const ch of chores) if (ch.due && !ch.completedAt) add(ch.due, c.chore);
    for (const j of journal) add(j.day, c.journal);
    return marks;
  }, [events, chores, journal, colors]);
}

export function CalendarLegend() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const c = kindColors(colors);
  return (
    <View style={styles.legend} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {(['event', 'chore', 'journal'] as const).map((k) => (
        <View key={k} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: c[k] }]} />
          <Text style={styles.legendText}>{k === 'event' ? 'Events' : k === 'chore' ? 'Chores' : 'Journal'}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Everything on one day: events, the habits scheduled for it, chores due (on
 * today, overdue ones too) and finished, and journal entries. `compact` (the
 * week list) sums habits up in one line to keep seven days readable.
 */
export function DayAgenda({ day, today, open, compact }: { day: DayKey; today: DayKey; open: Open; compact?: boolean }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { events, habits, habitLogs, chores, choreHistory, journal } = usePlanner(
    useShallow((s) => ({ events: s.events, habits: s.habits, habitLogs: s.habitLogs, chores: s.chores, choreHistory: s.choreHistory, journal: s.journal })),
  );
  const c = kindColors(colors);
  const isToday = day === today;
  const future = diffDays(today, day) > 0;

  const dayEvents = eventsOn(events, day);
  const dayHabits = habits.filter((h) => !h.archived && isScheduled(h.schedule, day) && diffDays(h.startDay, day) >= 0);
  const habitsDone = future ? 0 : dayHabits.filter((h) => habitStats(h, habitLogs, day).doneToday).length;
  const dueChores = chores
    .filter((ch) => {
      const status = choreStatus(ch, today);
      return status !== 'done' && (ch.due === day || (isToday && status === 'overdue'));
    })
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  const doneChores = choreHistory.filter((h) => dayKey(h.at) === day);
  const entries = journal.filter((j) => j.day === day).sort((a, b) => a.createdAt - b.createdAt);

  const empty = dayEvents.length + dayHabits.length + dueChores.length + doneChores.length + entries.length === 0;
  if (empty) return compact ? null : <Muted>{diffDays(today, day) < 0 ? 'Nothing on this day.' : 'Nothing planned yet.'}</Muted>;

  return (
    <View style={styles.wrap}>
      {dayEvents.length > 0 && (
        <Section color={c.event} label="Events">
          {dayEvents.map((e) => (
            <EventRow key={e.id} event={e} today={today} open={open} />
          ))}
        </Section>
      )}

      {dayHabits.length > 0 &&
        (compact ? (
          <Text style={styles.summary}>
            <Text style={{ color: c.habit }}>● </Text>
            {future ? `${dayHabits.length} habit${dayHabits.length === 1 ? '' : 's'} planned` : `Habits · ${habitsDone}/${dayHabits.length} done`}
          </Text>
        ) : (
          <Section color={c.habit} label={future ? 'Habits' : `Habits · ${habitsDone}/${dayHabits.length}`}>
            {dayHabits.map((h) => (future ? <HabitPlanRow key={h.id} habit={h} open={open} /> : <HabitRow key={h.id} habit={h} today={day} open={open} compact />))}
          </Section>
        ))}

      {dueChores.length + doneChores.length > 0 && (
        <Section color={c.chore} label="Chores">
          {dueChores.map((ch) => (
            <ChoreRow key={ch.id} chore={ch} today={today} open={open} />
          ))}
          {doneChores.map((h) => (
            <ChoreDoneRow key={`${h.choreId}-${h.at}`} record={h} today={today} open={open} />
          ))}
        </Section>
      )}

      {entries.length > 0 && (
        <Section color={c.journal} label="Journal">
          {entries.map((e) => (
            <JournalRow key={e.id} entry={e} today={today} open={open} showDay={false} />
          ))}
        </Section>
      )}
    </View>
  );
}

function Section({ color, label, children }: { color: string; label: string; children: ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <Group>{children}</Group>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: { gap: 10 },
    section: { gap: 6 },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: { fontFamily: fonts.medium, fontSize: 12, color: colors.textDim },
    dot: { width: 7, height: 7, borderRadius: 4 },
    summary: { fontFamily: fonts.medium, fontSize: 12, color: colors.textDim },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 2 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendText: { fontFamily: fonts.regular, fontSize: 11, color: colors.textFaint },
  });
