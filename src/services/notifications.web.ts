import type { ReminderSpec } from '../planner/reminders';

/** Web preview: no local notifications. Reminders are saved and work on the phone. */
export async function notificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  return 'denied';
}

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

export async function syncReminders(_desired: ReminderSpec[]): Promise<void> {}
