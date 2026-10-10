import { Ionicons } from '@expo/vector-icons';
import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { modelUsable, useModel } from '../../ai/modelStore';
import { summaryMessages } from '../../ai/prompts';
import { complete } from '../../ai/runtime';
import { cleanModelText } from '../../conversation/llm/localModelEngine';
import { addDays, addMonths, dayDate, dayKey, diffDays, formatDay, formatMonth, MONTH_SHORT, startOfWeek, type DayKey } from '../../planner/dates';
import { describeSummary, lastNDays, MOOD_LABEL, promptOfTheDay, searchJournal, summarizeJournal } from '../../planner/journal';
import { choreStatus } from '../../planner/recurrence';
import type { ChoreCompletion } from '../../planner/types';
import { usePlanner } from '../../state/plannerStore';
import { useUi } from '../../state/uiStore';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { Button, Chip, IconButton } from '../../ui/primitives';
import { EmptyState } from '../PanelHost';
import { CalendarLegend, DayAgenda, useCalendarMarks } from './DayAgenda';
import { ChoreDoneRow, ChoreRow, HabitRow, JournalRow, type Open } from './rows';
import { AddRow, Card, Group, MonthGridView, SectionHeader } from './ui';

// ───────────────────────── calendar ─────────────────────────

type CalMode = 'week' | 'month';

/**
 * Month grid (with the picked day's events below) or a week list. The "Today"
 * button always sits in the same spot and is only dimmed when you're already
 * on today, so nothing jumps around as you tap through days.
 */
export function CalendarTab({ today, day, setDay, open }: { today: DayKey; day: DayKey; setDay: Dispatch<SetStateAction<DayKey>>; open: Open }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [mode, setMode] = useState<CalMode>('month');
  const marks = useCalendarMarks();

  const step = (dir: -1 | 1) => setDay((c) => (mode === 'week' ? addDays(c, dir * 7) : addMonths(c, dir, 1)));
  const weekStart = startOfWeek(day);
  const title = mode === 'week' ? weekTitle(weekStart) : formatMonth(day);
  const onToday = day === today;
  const past = diffDays(today, day) < 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
      <View style={styles.nav}>
        <Text style={styles.navTitle} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to today"
          accessibilityState={{ disabled: onToday }}
          disabled={onToday}
          onPress={() => setDay(today)}
          hitSlop={8}
          style={[styles.todayBtn, onToday && styles.dim]}
        >
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
        <IconButton
          icon={mode === 'month' ? 'list-outline' : 'calendar-outline'}
          label={mode === 'month' ? 'Show the week as a list' : 'Show the month'}
          onPress={() => setMode((m) => (m === 'month' ? 'week' : 'month'))}
          size={18}
        />
        <IconButton icon="chevron-back" label={mode === 'week' ? 'Previous week' : 'Previous month'} onPress={() => step(-1)} size={18} />
        <IconButton icon="chevron-forward" label={mode === 'week' ? 'Next week' : 'Next month'} onPress={() => step(1)} size={18} />
      </View>

      {mode === 'month' && (
        <>
          <MonthGridView month={day} selected={day} today={today} marks={marks} onSelect={setDay} />
          <CalendarLegend />
          <SectionHeader title={formatDay(day, today)} />
          <DayAgenda day={day} today={today} open={open} />
          {!past && <AddRow label="Add event" onPress={() => open({ name: 'event', day })} />}
        </>
      )}

      {mode === 'week' &&
        [0, 1, 2, 3, 4, 5, 6].map((i) => {
          const d = addDays(weekStart, i);
          return (
            <View key={d} style={styles.weekDay}>
              <Text style={[styles.weekLabel, d === today && { color: colors.brand }]}>{formatDay(d, today)}</Text>
              <DayAgenda day={d} today={today} open={open} compact />
            </View>
          );
        })}
    </ScrollView>
  );
}

/** "Oct 12 – 18", or "Sep 28 – Oct 4" across a month boundary. */
function weekTitle(start: DayKey): string {
  const a = dayDate(start);
  const b = dayDate(addDays(start, 6));
  const from = `${MONTH_SHORT[a.getMonth()]} ${a.getDate()}`;
  return a.getMonth() === b.getMonth() ? `${from} – ${b.getDate()}` : `${from} – ${MONTH_SHORT[b.getMonth()]} ${b.getDate()}`;
}

// ───────────────────────── habits ─────────────────────────

export function HabitsTab({ today, open }: { today: DayKey; open: Open }) {
  const styles = useStyles(makeStyles);
  const habits = usePlanner((s) => s.habits);
  const [showArchived, setShowArchived] = useState(false);
  const active = habits.filter((h) => !h.archived);
  const archived = habits.filter((h) => h.archived);
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list}>
      {active.length === 0 ? (
        <EmptyState icon="leaf-outline" title="No habits yet" body="Start small: one thing, a few days a week. Routines are habits made of steps, like a morning routine." />
      ) : (
        <Group style={styles.top}>
          {active.map((h) => (
            <HabitRow key={h.id} habit={h} today={today} open={open} />
          ))}
        </Group>
      )}
      <AddRow
        label={active.length === 0 ? 'Add your first habit' : 'Add another habit'}
        onPress={() => open({ name: 'habit' })}
      />
      {archived.length > 0 && (
        <>
          <Button compact tone="ghost" label={showArchived ? 'Hide archived' : `Show archived (${archived.length})`} onPress={() => setShowArchived((v) => !v)} />
          {showArchived && (
            <Group>
              {archived.map((h) => (
                <Card key={h.id} flat onPress={() => open({ name: 'habit', habit: h })} label={h.title}>
                  <Ionicons name="archive-outline" size={18} color={styles.faint.color} />
                  <Text style={styles.archived}>{h.title}</Text>
                </Card>
              ))}
            </Group>
          )}
        </>
      )}
    </ScrollView>
  );
}

// ───────────────────────── chores ─────────────────────────

/**
 * Chores by day: overdue first, then today (to do and done), then each later
 * day with its chores locked until that day, then undated ones. Earlier days'
 * finished chores are one tap away.
 */
export function ChoresTab({ today, open }: { today: DayKey; open: Open }) {
  const styles = useStyles(makeStyles);
  const chores = usePlanner((s) => s.chores);
  const history = usePlanner((s) => s.choreHistory);
  const [showEarlier, setShowEarlier] = useState(false);
  // The earlier days open below the fold; once they're laid out, scroll them into view.
  const scroll = useRef<ScrollView>(null);
  const earlierY = useRef(0);
  const revealEarlier = useRef(false);
  const toggleEarlier = () => {
    revealEarlier.current = !showEarlier;
    setShowEarlier((v) => !v);
  };

  const pending = chores
    .filter((c) => choreStatus(c, today) !== 'done')
    .sort((a, b) => (a.due ?? '9999-99-99').localeCompare(b.due ?? '9999-99-99') || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99'));
  const overdue = pending.filter((c) => choreStatus(c, today) === 'overdue');
  const dueToday = pending.filter((c) => c.due === today);
  const anytime = pending.filter((c) => !c.due);
  const laterDays = [...new Set(pending.filter((c) => c.due && diffDays(today, c.due) > 0).map((c) => c.due!))];
  const doneToday = history.filter((h) => dayKey(h.at) === today).sort((a, b) => b.at - a.at);
  const earlier = groupByDay(history.filter((h) => diffDays(dayKey(h.at), today) > 0 && diffDays(dayKey(h.at), today) <= 14));

  const todayTotal = dueToday.length + doneToday.length;
  const nothing = pending.length === 0 && doneToday.length === 0;

  return (
    <ScrollView
      ref={scroll}
      style={styles.flex}
      contentContainerStyle={styles.list}
      onContentSizeChange={() => {
        if (!revealEarlier.current) return;
        revealEarlier.current = false;
        scroll.current?.scrollTo({ y: Math.max(0, earlierY.current - 8), animated: true });
      }}
    >
      {nothing && <EmptyState icon="sparkles-outline" title="All clear" body="No chores waiting. Add one below, or say “add laundry every Sunday” in Talk." />}

      {overdue.length > 0 && (
        <>
          <SectionHeader title={`Overdue · ${overdue.length}`} />
          <Group>
            {overdue.map((c) => (
              <ChoreRow key={c.id} chore={c} today={today} open={open} />
            ))}
          </Group>
        </>
      )}

      {todayTotal > 0 && (
        <>
          <SectionHeader title="Today" right={<Text style={styles.count}>{`${doneToday.length}/${todayTotal} done`}</Text>} />
          {dueToday.length > 0 ? (
            <>
              <Text style={styles.subLabel}>{`To do · ${dueToday.length}`}</Text>
              <Group>
                {dueToday.map((c) => (
                  <ChoreRow key={c.id} chore={c} today={today} open={open} showDue={false} />
                ))}
              </Group>
            </>
          ) : (
            <Text style={styles.allDone}>Everything for today is done. Nice!</Text>
          )}
          {doneToday.length > 0 && (
            <>
              <Text style={styles.subLabel}>{`Done · ${doneToday.length}`}</Text>
              <Group>
                {doneToday.map((h) => (
                  <ChoreDoneRow key={`${h.choreId}-${h.at}`} record={h} today={today} open={open} />
                ))}
              </Group>
            </>
          )}
        </>
      )}

      <AddRow label={nothing ? 'Add a chore' : 'Add another chore'} onPress={() => open({ name: 'chore' })} />

      {laterDays.map((d) => (
        <View key={d} style={styles.daySection}>
          <SectionHeader title={formatDay(d, today)} />
          <Group>
            {pending
              .filter((c) => c.due === d)
              .map((c) => (
                <ChoreRow key={c.id} chore={c} today={today} open={open} showDue={false} />
              ))}
          </Group>
        </View>
      ))}

      {anytime.length > 0 && (
        <>
          <SectionHeader title="Anytime" />
          <Group>
            {anytime.map((c) => (
              <ChoreRow key={c.id} chore={c} today={today} open={open} showDue={false} />
            ))}
          </Group>
        </>
      )}

      {earlier.length > 0 && (
        <>
          <View
            onLayout={(e) => {
              earlierY.current = e.nativeEvent.layout.y;
            }}
          >
            <Button compact tone="ghost" label={showEarlier ? 'Hide earlier days' : 'Show earlier days'} onPress={toggleEarlier} />
          </View>
          {showEarlier &&
            earlier.map(([d, records]) => (
              <View key={d} style={styles.daySection}>
                <SectionHeader title={formatDay(d, today)} right={<Text style={styles.count}>{`${records.length} done`}</Text>} />
                <Group>
                  {records.map((h) => (
                    <ChoreDoneRow key={`${h.choreId}-${h.at}`} record={h} today={today} open={open} />
                  ))}
                </Group>
              </View>
            ))}
        </>
      )}
    </ScrollView>
  );
}

/** Completions grouped by the day they were done, newest day (and newest first) at the top. */
function groupByDay(records: readonly ChoreCompletion[]): [DayKey, ChoreCompletion[]][] {
  const byDay = new Map<DayKey, ChoreCompletion[]>();
  for (const h of [...records].sort((a, b) => b.at - a.at)) {
    const d = dayKey(h.at);
    byDay.set(d, [...(byDay.get(d) ?? []), h]);
  }
  return [...byDay.entries()];
}

// ───────────────────────── journal ─────────────────────────

export function JournalTab({ today, open }: { today: DayKey; open: Open }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const journal = usePlanner((s) => s.journal);
  const [query, setQuery] = useState('');
  const model = useModel((s) => s.status);
  const [aiSummary, setAiSummary] = useState<{ text: string; error?: boolean } | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  const week = lastNDays(today, 7);
  const summary = summarizeJournal(journal, week.from, week.to);
  const wroteToday = journal.some((j) => j.day === today);
  const prompt = promptOfTheDay(today);
  const list = query.trim()
    ? searchJournal(journal, query, { limit: 50 }).map((h) => h.entry)
    : [...journal].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt - a.createdAt);

  const summarize = async () => {
    const entries = journal.filter((e) => diffDays(week.from, e.day) >= 0 && diffDays(e.day, week.to) >= 0).slice(-12);
    if (entries.length === 0) return;
    setSummarizing(true);
    try {
      const r = await complete(
        summaryMessages(
          entries.map((e) => ({ label: formatDay(e.day, today), text: `${e.mood ? `[${MOOD_LABEL[e.mood]}] ` : ''}${e.text}` })),
          'the last 7 days',
        ),
        { maxTokens: 200, temperature: 0.3 },
      );
      setAiSummary({ text: cleanModelText(r.text) || 'The model didn’t return a summary.' });
    } catch (error) {
      setAiSummary({ text: `The on-device AI couldn’t summarize right now (${error instanceof Error ? error.message : 'error'}).`, error: true });
    } finally {
      setSummarizing(false);
    }
  };

  const canOfferAi = !modelUsable(model) && model.state !== 'unsupported' && model.state !== 'checking';

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
      <View style={styles.top} />
      {!query && (
        <AddRow
          label={wroteToday ? 'Write another entry' : 'New entry'}
          detail={wroteToday ? undefined : `Today’s prompt: ${prompt}`}
          onPress={() => open(wroteToday ? { name: 'journal' } : { name: 'journal', initial: { prompt } })}
        />
      )}

      {journal.length > 0 && (
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your journal"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            accessibilityLabel="Search your journal"
            autoCorrect={false}
          />
          {query.length > 0 && <IconButton icon="close" label="Clear search" onPress={() => setQuery('')} size={16} />}
        </View>
      )}

      {!query && summary.count > 0 && (
        <View style={styles.summary}>
          <Text style={styles.cardTitle}>This week</Text>
          <Text style={styles.cardMeta}>{describeSummary(summary, 'this week')}</Text>
          {aiSummary && (
            <View style={styles.aiBox}>
              <Text style={styles.aiLabel}>{aiSummary.error ? 'On-device AI' : 'Summary by on-device AI · from your entries only'}</Text>
              <Text style={styles.aiText}>{aiSummary.text}</Text>
            </View>
          )}
          {modelUsable(model) && (
            <View style={styles.rowButtons}>
              {summarizing ? (
                <ActivityIndicator color={colors.brand} />
              ) : (
                <Chip label={aiSummary ? 'Summarize again' : 'Summarize with on-device AI'} icon="sparkles-outline" onPress={() => void summarize()} />
              )}
            </View>
          )}
          {canOfferAi && (
            <Pressable accessibilityRole="button" onPress={() => useUi.getState().setSettingsOpen(true)} hitSlop={6}>
              <Text style={styles.aiLink}>
                {model.state === 'downloading' ? 'Downloading the on-device AI model…' : 'Get private summaries: download the on-device AI in Settings → Talking'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {list.length === 0 ? (
        query ? (
          <EmptyState icon="search-outline" title="Nothing found" body="Try another word." />
        ) : (
          <EmptyState icon="book-outline" title="Your journal is empty" body="Write a few lines about your day, add a photo or two. Only you can see it, and it never leaves this phone." />
        )
      ) : (
        <>
          <SectionHeader title={query ? `Results · ${list.length}` : 'Entries'} />
          <Group>
            {list.map((e) => (
              <JournalRow key={e.id} entry={e} today={today} open={open} />
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
    list: { paddingHorizontal: 16, paddingBottom: 24, gap: 8 },
    top: { marginTop: 12 },
    nav: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 4 },
    navTitle: { flex: 1, fontFamily: fonts.black, fontSize: 18, color: colors.text, letterSpacing: -0.2 },
    todayBtn: { paddingHorizontal: 10, minHeight: 32, justifyContent: 'center', borderRadius: radii.pill },
    todayText: { fontFamily: fonts.bold, fontSize: 13, color: colors.brand },
    dim: { opacity: 0.35 },
    weekDay: { gap: 6, marginTop: 6 },
    weekLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.textDim },
    rowButtons: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    archived: { fontFamily: fonts.medium, fontSize: 14, color: colors.textDim },
    faint: { color: colors.textFaint },
    count: { fontFamily: fonts.medium, fontSize: 12, color: colors.textFaint },
    subLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textDim, marginTop: 2 },
    allDone: { fontFamily: fonts.medium, fontSize: 13, color: colors.success, paddingVertical: 4 },
    daySection: { gap: 8 },
    cardTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
    cardMeta: { fontFamily: fonts.regular, fontSize: 12, color: colors.textFaint },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, minHeight: 44, borderRadius: radii.md, backgroundColor: colors.surface },
    searchInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 8 },
    summary: { gap: 6, padding: 12, borderRadius: radii.md, backgroundColor: colors.brandSoft },
    aiBox: { gap: 4, marginTop: 4 },
    aiLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.brand, letterSpacing: 0.3 },
    aiText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.text },
    aiLink: { fontFamily: fonts.medium, fontSize: 12, color: colors.brand },
  });
