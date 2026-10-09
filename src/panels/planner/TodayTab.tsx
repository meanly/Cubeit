import { ScrollView, StyleSheet, Text } from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { addDays, formatDay, type DayKey } from '../../planner/dates';
import { habitStats, isScheduled } from '../../planner/habits';
import { eventsBetween, eventsOn } from '../../planner/ops';
import { choreStatus } from '../../planner/recurrence';
import { useGame } from '../../state/gameStore';
import { usePlanner } from '../../state/plannerStore';
import { useStyles, type Colors } from '../../theme/theme';
import { fonts } from '../../theme/tokens';
import { EmptyState } from '../PanelHost';
import { ChoreRow, EventRow, HabitRow, type Open } from './rows';
import { Group, SectionHeader } from './ui';

/** Only what's due today (plus the next few events). Writing lives in the Journal tab. */
export function TodayTab({ today, open }: { today: DayKey; open: Open }) {
  const styles = useStyles(makeStyles);
  const name = useGame((s) => s.character.name);
  const { events, habits, habitLogs, chores } = usePlanner(
    useShallow((s) => ({ events: s.events, habits: s.habits, habitLogs: s.habitLogs, chores: s.chores })),
  );

  const todays = eventsOn(events, today);
  const upcoming = eventsBetween(events, addDays(today, 1), addDays(today, 7)).filter((e) => !e.doneAt).slice(0, 3);
  const dueHabits = habits.filter((h) => !h.archived && isScheduled(h.schedule, today));
  const habitsDone = dueHabits.filter((h) => habitStats(h, habitLogs, today).doneToday).length;
  const dueChores = chores
    .filter((c) => ['today', 'overdue'].includes(choreStatus(c, today)))
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));

  const total = todays.length + dueHabits.length + dueChores.length;
  const left = todays.filter((e) => !e.doneAt).length + (dueHabits.length - habitsDone) + dueChores.length;
  const status = total === 0 ? null : left === 0 ? 'All done for today' : `${left} of ${total} left`;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
      <Text style={styles.date}>{formatDay(today, today, { relative: false })}</Text>
      {status && <Text style={styles.status}>{status}</Text>}

      {total === 0 && upcoming.length === 0 && (
        <EmptyState icon="sunny-outline" title="A clear day" body={`Tap + to add an event, habit or chore — or tell ${name} in Talk, like “add yoga every Monday at 7pm”.`} />
      )}

      {todays.length > 0 && (
        <>
          <SectionHeader title="Events" />
          <Group>
            {todays.map((e) => (
              <EventRow key={e.id} event={e} today={today} open={open} />
            ))}
          </Group>
        </>
      )}

      {dueHabits.length > 0 && (
        <>
          <SectionHeader title={`Habits · ${habitsDone}/${dueHabits.length}`} />
          <Group>
            {dueHabits.map((h) => (
              <HabitRow key={h.id} habit={h} today={today} open={open} compact />
            ))}
          </Group>
        </>
      )}

      {dueChores.length > 0 && (
        <>
          <SectionHeader title="Chores" />
          <Group>
            {dueChores.map((c) => (
              <ChoreRow key={c.id} chore={c} today={today} open={open} />
            ))}
          </Group>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <SectionHeader title="Coming up" />
          <Group>
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} today={today} open={open} showDay />
            ))}
          </Group>
        </>
      )}
    </ScrollView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 8 },
    date: { fontFamily: fonts.black, fontSize: 22, color: colors.text, letterSpacing: -0.3 },
    status: { fontFamily: fonts.medium, fontSize: 13, color: colors.textDim, marginTop: -4 },
  });
