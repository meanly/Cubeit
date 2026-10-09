import { feedback } from '../../services/feedback';
import { useUi } from '../../state/uiStore';

/**
 * Run a planner change from the UI. Validation and storage errors are shown
 * as a toast (nothing was changed); returns undefined on failure.
 */
export function run<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (error) {
    feedback('warn');
    useUi.getState().toast({ text: error instanceof Error ? error.message : 'That didn’t work. Nothing was changed.', tone: 'warning' });
    return undefined;
  }
}

export function notice(text: string): void {
  useUi.getState().toast({ text, tone: 'info' });
}
