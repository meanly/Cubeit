import { create } from 'zustand';

import { emptyPlanner } from '../planner/ops';
import type { PlannerData } from '../planner/types';

interface PlannerStore extends PlannerData {
  hydrate(data: PlannerData): void;
  clear(): void;
}

export const usePlanner = create<PlannerStore>()((set) => ({
  ...emptyPlanner(),
  hydrate: (data) => set({ ...data }),
  clear: () => set({ ...emptyPlanner() }),
}));

export const pickPlanner = (s: PlannerData): PlannerData => ({
  events: s.events,
  habits: s.habits,
  habitLogs: s.habitLogs,
  stepChecks: s.stepChecks,
  chores: s.chores,
  choreHistory: s.choreHistory,
  journal: s.journal,
  rewards: s.rewards,
});

/** Writes the planner to disk right now; set by persistence. Throws if the write fails. */
let committer: (() => void) | null = null;
export function setPlannerCommitter(fn: (() => void) | null): void {
  committer = fn;
}

export class SaveFailedError extends Error {
  constructor() {
    super('Couldn’t save to this device’s storage. Nothing was changed.');
  }
}

/**
 * Apply a pure planner operation and save it immediately. If the save fails,
 * the change is rolled back and `SaveFailedError` is thrown — so callers only
 * ever report success for changes that are actually stored. Validation errors
 * from the operation (PlannerError) propagate unchanged and nothing is applied.
 */
export function commitPlanner<R>(op: (data: PlannerData) => { data: PlannerData; result: R }): R {
  const before = pickPlanner(usePlanner.getState());
  const { data, result } = op(before);
  if (data === before) return result;
  usePlanner.setState(data);
  if (committer) {
    try {
      committer();
    } catch {
      usePlanner.setState(before);
      throw new SaveFailedError();
    }
  }
  return result;
}
