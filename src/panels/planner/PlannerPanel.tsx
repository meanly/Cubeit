import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { diffDays, formatDay, type DayKey } from '../../planner/dates';
import { useToday } from '../../planner/hooks';
import { useUi } from '../../state/uiStore';
import { useColors, useStyles, type Colors } from '../../theme/theme';
import { fonts, radii } from '../../theme/tokens';
import { IconButton, PressableScale, type IconName } from '../../ui/primitives';
import { PanelHeader } from '../PanelHost';
import { ChoreEditor } from './ChoreEditor';
import { EventEditor } from './EventEditor';
import { HabitEditor } from './HabitEditor';
import { JournalEditor } from './JournalEditor';
import type { Route } from './rows';
import { CalendarTab, ChoresTab, HabitsTab, JournalTab } from './tabs';
import { TabBar } from './ui';

export type PlannerTab = 'calendar' | 'journal' | 'habits' | 'chores';

const TABS: readonly { value: PlannerTab; label: string }[] = [
  { value: 'calendar', label: 'Calendar' },
  { value: 'journal', label: 'Journal' },
  { value: 'habits', label: 'Habits' },
  { value: 'chores', label: 'Chores' },
];

/**
 * The Planner sheet: calendar, journal, habits & routines, and chores. Each
 * tab has its own "Add …" row in the list; the "+" in the header opens a menu
 * to add anything from anywhere. Editors stack on top of the tabs and "back"
 * returns to where you were. Everything is stored on the device.
 */
export function PlannerPanel() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const today = useToday();
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
    }
  }

  // New events start on the day picked in the calendar while it's showing (today otherwise, or for past days).
  const eventDay = tab === 'calendar' && diffDays(today, calDay) >= 0 ? calDay : today;

  return (
    <View style={styles.flex}>
      <PanelHeader
        title="Planner"
        right={
          <IconButton
            icon="add"
            label={menuOpen ? 'Close the add menu' : 'Add to planner'}
            onPress={() => setMenuOpen((o) => !o)}
            color={menuOpen ? colors.onAccent : undefined}
            style={menuOpen && styles.plusOn}
          />
        }
      />
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
        {tab === 'calendar' && <CalendarTab today={today} day={calDay} setDay={setCalDay} open={open} />}
        {tab === 'journal' && <JournalTab today={today} open={open} />}
        {tab === 'habits' && <HabitsTab today={today} open={open} />}
        {tab === 'chores' && <ChoresTab today={today} open={open} />}
      </View>
      {menuOpen && <AddMenu eventDay={eventDay} today={today} open={open} onClose={() => setMenuOpen(false)} />}
    </View>
  );
}

/** Drop-down under the header "+": add anything without switching tabs. */
function AddMenu({ eventDay, today, open, onClose }: { eventDay: DayKey; today: DayKey; open: (r: Route) => void; onClose: () => void }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const items: { icon: IconName; label: string; route: Route }[] = [
    // Say which day when it isn't today (it follows the day picked in the calendar).
    { icon: 'calendar-outline', label: eventDay === today ? 'Event' : `Event on ${formatDay(eventDay, today)}`, route: { name: 'event', day: eventDay } },
    { icon: 'create-outline', label: 'Journal entry', route: { name: 'journal' } },
    { icon: 'leaf-outline', label: 'Habit or routine', route: { name: 'habit' } },
    { icon: 'checkbox-outline', label: 'Chore', route: { name: 'chore' } },
  ];
  return (
    <>
      {/* Below the header row, so the "+" (now an ×) still closes it. */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
      <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(90)} style={styles.menu} accessibilityRole="menu">
        <View style={styles.caret} />
        <Text style={styles.menuTitle}>Add to planner</Text>
        {items.map((it) => (
          <PressableScale key={it.label} accessibilityRole="menuitem" onPress={() => open(it.route)} style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <Ionicons name={it.icon} size={18} color={colors.brand} />
            </View>
            <Text style={styles.menuText}>{it.label}</Text>
          </PressableScale>
        ))}
      </Animated.View>
    </>
  );
}

/** PanelHeader is 52 high with the close button at the far right; the "+" sits just left of it. */
const HEADER_H = 52;
const PLUS_CENTER_FROM_RIGHT = 16 + 32 + 6 + 16;
const MENU_RIGHT = 12;

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1 },
    tabs: { paddingHorizontal: 8, paddingBottom: 4 },
    plusOn: { backgroundColor: colors.brand },
    backdrop: { position: 'absolute', left: 0, right: 0, bottom: 0, top: HEADER_H, backgroundColor: colors.scrim, opacity: 0.35 },
    menu: {
      position: 'absolute',
      top: HEADER_H - 2,
      right: MENU_RIGHT,
      width: 230,
      paddingVertical: 6,
      borderRadius: radii.md,
      backgroundColor: colors.paper,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.lineStrong,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    caret: {
      position: 'absolute',
      top: -6,
      right: PLUS_CENTER_FROM_RIGHT - MENU_RIGHT - 6,
      width: 12,
      height: 12,
      backgroundColor: colors.paper,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: colors.lineStrong,
      transform: [{ rotate: '45deg' }],
    },
    menuTitle: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.6, color: colors.textFaint, textTransform: 'uppercase', paddingHorizontal: 14, paddingVertical: 6 },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, minHeight: 46 },
    menuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
    menuText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  });
