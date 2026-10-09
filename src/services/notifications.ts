import * as Notifications from 'expo-notifications';

import { planReminderSync, reminderSignature, type ReminderSpec } from '../planner/reminders';

/**
 * Local reminders via expo-notifications. Nothing is sent to a server: these
 * are scheduled on the phone. Permission is only asked when the user turns a
 * reminder on, never at launch.
 */

let handlerSet = false;
function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  try {
    const p = await Notifications.getPermissionsAsync();
    if (p.granted) return 'granted';
    return p.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Ask for permission if it hasn't been decided yet. Returns whether reminders can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  ensureHandler();
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
    return next.granted;
  } catch {
    return false;
  }
}

function toTrigger(spec: ReminderSpec): Notifications.NotificationTriggerInput {
  const t = spec.trigger;
  switch (t.kind) {
    case 'date':
      return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: t.at };
    case 'daily':
      return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: t.hour, minute: t.minute };
    case 'weekly':
      return { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: t.weekday, hour: t.hour, minute: t.minute };
  }
}

let running: Promise<void> | null = null;
let queued: ReminderSpec[] | null = null;

/**
 * Make the scheduled notifications match `desired`: cancel ours that are gone
 * or changed, schedule the missing ones. Safe to call often; calls are serialized.
 */
export function syncReminders(desired: ReminderSpec[]): Promise<void> {
  queued = desired;
  if (running) return running;
  running = (async () => {
    try {
      while (queued) {
        const next = queued;
        queued = null;
        await syncOnce(next);
      }
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(desired: ReminderSpec[]): Promise<void> {
  ensureHandler();
  try {
    if ((await notificationPermission()) !== 'granted') return;
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const map = new Map<string, string | undefined>(
      pending.map((n) => [n.identifier, typeof n.content.data?.sig === 'string' ? (n.content.data.sig as string) : undefined]),
    );
    const plan = planReminderSync(desired, map);
    for (const id of plan.cancel) await Notifications.cancelScheduledNotificationAsync(id);
    for (const spec of plan.schedule) {
      await Notifications.scheduleNotificationAsync({
        identifier: spec.id,
        content: { title: spec.title, body: spec.body, data: { sig: reminderSignature(spec) } },
        trigger: toTrigger(spec),
      });
    }
  } catch (error) {
    console.warn('[cubeit] reminder sync failed', error);
  }
}
