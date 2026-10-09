import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { syncReminders } from '../services/notifications';
import { useGame } from '../state/gameStore';
import { usePlanner } from '../state/plannerStore';
import { addDays, dayKey, toTimestamp, type DayKey } from './dates';
import { computeReminders } from './reminders';

/** The local day, re-read at midnight and whenever the app comes back to the foreground. */
export function useToday(): DayKey {
  const [today, setToday] = useState(() => dayKey(Date.now()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const now = Date.now();
      const next = toTimestamp(addDays(dayKey(now), 1)) - now + 500;
      timer = setTimeout(() => {
        setToday(dayKey(Date.now()));
        arm();
      }, next);
    };
    arm();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(dayKey(Date.now()));
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  return today;
}

/** Keeps scheduled local notifications in step with the planner (debounced; also on resume). */
export function useReminderSync(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const run = () => {
      timer = null;
      const name = useGame.getState().character.name;
      void syncReminders(computeReminders(usePlanner.getState(), Date.now(), name));
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 1200);
    };
    schedule();
    const off = usePlanner.subscribe(schedule);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') schedule();
    });
    return () => {
      off();
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);
}
