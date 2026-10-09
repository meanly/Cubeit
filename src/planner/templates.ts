import type { Weekday } from './dates';
import type { HabitDraft } from './ops';
import type { Habit, HabitSchedule } from './types';

/**
 * Ready-made habits and routines for the "new habit" picker. Picking one only
 * pre-fills the editor; nothing is saved until the user taps Save.
 */

export type TemplateGroup = 'routines' | 'health' | 'mind' | 'home';

export const TEMPLATE_GROUP_LABEL: Record<TemplateGroup, string> = {
  routines: 'Routines',
  health: 'Health',
  mind: 'Mind',
  home: 'Home',
};

export interface HabitTemplate {
  id: string;
  group: TemplateGroup;
  title: string;
  kind: 'habit' | 'routine';
  schedule: HabitSchedule;
  steps?: string[];
}

const daily: HabitSchedule = { type: 'daily' };
const days = (...d: Weekday[]): HabitSchedule => ({ type: 'days', days: d });

export const HABIT_TEMPLATES: readonly HabitTemplate[] = [
  {
    id: 'morning',
    group: 'routines',
    title: 'Morning routine',
    kind: 'routine',
    schedule: daily,
    steps: ['Drink a glass of water', 'Make the bed', 'Stretch for 5 minutes', 'Plan the day'],
  },
  {
    id: 'evening',
    group: 'routines',
    title: 'Evening wind-down',
    kind: 'routine',
    schedule: daily,
    steps: ['Tidy up for 5 minutes', 'Lay out tomorrow’s clothes', 'Screens off', 'Read a few pages'],
  },
  {
    id: 'weekly-reset',
    group: 'routines',
    title: 'Weekly reset',
    kind: 'routine',
    schedule: days(0),
    steps: ['Do the laundry', 'Clean the kitchen', 'Take out the trash', 'Plan the week'],
  },
  { id: 'water', group: 'health', title: 'Drink water', kind: 'habit', schedule: daily },
  { id: 'walk', group: 'health', title: 'Walk 20 minutes', kind: 'habit', schedule: daily },
  { id: 'stretch', group: 'health', title: 'Stretch', kind: 'habit', schedule: daily },
  { id: 'workout', group: 'health', title: 'Work out', kind: 'habit', schedule: days(1, 3, 5) },
  { id: 'vitamins', group: 'health', title: 'Take vitamins', kind: 'habit', schedule: daily },
  { id: 'bedtime', group: 'health', title: 'In bed by 11', kind: 'habit', schedule: daily },
  { id: 'read', group: 'mind', title: 'Read 20 minutes', kind: 'habit', schedule: daily },
  { id: 'meditate', group: 'mind', title: 'Meditate 5 minutes', kind: 'habit', schedule: daily },
  { id: 'gratitude', group: 'mind', title: 'Write 3 good things', kind: 'habit', schedule: daily },
  { id: 'no-phone', group: 'mind', title: 'No phone in bed', kind: 'habit', schedule: daily },
  { id: 'bed', group: 'home', title: 'Make the bed', kind: 'habit', schedule: daily },
  { id: 'tidy', group: 'home', title: 'Tidy up 10 minutes', kind: 'habit', schedule: daily },
  { id: 'plants', group: 'home', title: 'Water the plants', kind: 'habit', schedule: days(1, 4) },
];

export function templateDraft(t: HabitTemplate): HabitDraft {
  return { title: t.title, kind: t.kind, schedule: t.schedule, steps: t.steps ? [...t.steps] : [] };
}

/** Whether an active habit already has this template's name (the planner refuses duplicates). */
export function templateTaken(t: HabitTemplate, habits: readonly Habit[]): boolean {
  const title = t.title.toLowerCase();
  return habits.some((h) => !h.archived && h.title.toLowerCase() === title);
}
