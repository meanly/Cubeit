import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { diffDays, type DayKey } from '../../planner/dates';
import { useToday } from '../../planner/hooks';
import { useGame } from '../../state/gameStore';
import { useUi } from '../../state/uiStore';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { IconButton, PressableScale, type IconName } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { ChoreEditor } from './ChoreEditor';
import { EventEditor } from './EventEditor';
import { HabitEditor } from './HabitEditor';
import { JournalEditor } from './JournalEditor';
import { About, FindsGrid, MemoryEditor, MemoryList } from './memoryViews';
import type { Route } from './rows';
import { CalendarTab, ChoresTab, HabitsTab, JournalTab } from './tabs';
import { TodayTab } from './TodayTab';
import { TabBar } from './ui';

export type PlannerTab = 'today' | 'calendar' | 'habits' | 'chores' | 'journal';

const TABS: readonly { value: PlannerTab; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'habits', label: 'Habits' },
  { value: 'chores', label: 'Chores' },
  { value: 'journal', label: 'Journal' },
];

/**
 * The Planner sheet: today at a glance, the calendar, habits & routines,
 * chores, and the journal (with long-term memories one tap away). One row of
 * tabs, one "+" in the header; editors and detail screens stack on top and
 * "back" returns to wherever you came from. Everything is stored on the device.
 */
export function PlannerPanel() {
  const styles = useStyles(makeStyles);
  const today = useToday();
  const name = useGame((s) => s.character.name);
  const tab = useUi((s) => s.plannerTab);
  const setTab = useUi((s) => s.setPlannerTab);
  const [stack, setStack] = useState<Route[]>([]);
  const [calDay, setCalDay] = useState<DayKey>(today);
  const [menuOpen, setMenuOpen] = useState(false);
  const open = (route: Route) => {
    setMenuOpen(false);
    setStack((s) => [...s, route]);
  };
  const back = () => setStack((s) => s.slice(0, -1));

  const route = stack[stack.length - 1];
  if (route) {
    switch (route.name) {
      case 'event':
        return <EventEditor event={route.event} day={route.day} onDone={back} />;
      case 'habit':
        return <HabitEditor habit={route.habit} kind={route.kind} onDone={back} />;
      case 'chore':
        return <ChoreEditor chore={route.chore} initial={route.initial} onDone={back} />;
      case 'journal':
        return <JournalEditor entry={route.entry} initial={route.initial} onDone={back} />;
      case 'memory':
        return <MemoryEditor memory={route.memory} onDone={back} />;
      case 'memories':
        return (
          <View style={styles.flex}>
            <PanelHeader title="Memories" onBack={back} right={<IconButton icon="add" label="New memory" onPress={() => open({ name: 'memory', memory: null })} />} />
            <MemoryList open={open} />
          </View>
        );
      case 'finds':
        return (
          <View style={styles.flex}>
            <PanelHeader title="Finds" onBack={back} />
            <FindsGrid />
          </View>
        );
      case 'about':
        return (
          <View style={styles.flex}>
            <PanelHeader title={`About ${name}`} onBack={back} />
            <About />
          </View>
        );
    }
  }

  const add = () => {
    switch (tab) {
      case 'today':
        setMenuOpen((o) => !o);
        return;
      case 'calendar':
        // Past days can't take new events, so those start on today instead.
        return open({ name: 'event', day: diffDays(today, calDay) < 0 ? today : calDay });
      case 'habits':
        return open({ name: 'habit' });
      case 'chores':
        return open({ name: 'chore' });
      case 'journal':
        return open({ name: 'journal' });
    }
  };
  const addLabel = { today: 'Add to planner', calendar: 'New event', habits: 'New habit', chores: 'New chore', journal: 'New journal entry' }[tab];

  return (
    <View style={styles.flex}>
      <PanelHeader title="Planner" right={<IconButton icon={menuOpen ? 'close-circle-outline' : 'add'} label={addLabel} onPress={add} />} />
      <View style={styles.tabs}>
        <TabBar
          value={tab}
          onChange={(t) => {
            setMenuOpen(false);
            setTab(t);
          }}
          options={TABS}
        />
      </View>
      <View style={styles.flex}>
        {tab === 'today' && <TodayTab today={today} open={open} />}
        {tab === 'calendar' && <CalendarTab today={today} day={calDay} setDay={setCalDay} open={open} />}
        {tab === 'habits' && <HabitsTab today={today} open={open} />}
        {tab === 'chores' && <ChoresTab today={today} open={open} />}
        {tab === 'journal' && <JournalTab today={today} open={open} />}
        {menuOpen && <AddMenu today={today} open={open} onClose={() => setMenuOpen(false)} />}
      </View>
    </View>
  );
}

/** What the "+" offers on the Today tab. */
function AddMenu({ today, open, onClose }: { today: DayKey; open: (r: Route) => void; onClose: () => void }) {
  const items: { icon: IconName; label: string; route: Route }[] = [
    { icon: 'calendar-outline', label: 'Event', route: { name: 'event', day: today } },
    { icon: 'leaf-outline', label: 'Habit or routine', route: { name: 'habit' } },
    { icon: 'checkbox-outline', label: 'Chore', route: { name: 'chore' } },
    { icon: 'create-outline', label: 'Journal entry', route: { name: 'journal' } },
  ];
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close menu" />
      <View style={styles.menu} accessibilityRole="menu">
        {items.map((it, i) => (
          <PressableScale key={it.label} accessibilityRole="menuitem" onPress={() => open(it.route)} style={[styles.menuItem, i > 0 && styles.menuDivider]}>
            <Ionicons name={it.icon} size={20} color={colors.brand} />
            <Text style={styles.menuText}>{it.label}</Text>
          </PressableScale>
        ))}
      </View>
    </>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    tabs: { paddingHorizontal: 8, paddingBottom: 4 },
    menu: {
      position: 'absolute',
      top: 0,
      right: 12,
      width: 220,
      borderRadius: radii.md,
      backgroundColor: colors.paper,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.lineStrong,
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 48 },
    menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineStrong },
    menuText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  });
