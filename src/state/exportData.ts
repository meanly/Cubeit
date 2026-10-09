import type { Memory } from '../memory/types';
import type { PlannerData } from '../planner/types';
import { PLANNER_VERSION } from '../planner/types';
import { pickPlanner } from './plannerStore';
import type { SaveData } from './schema';

export const EXPORT_FORMAT = 'cubeit-export';
export const EXPORT_VERSION = 2;

/**
 * Everything the user created, as one JSON document they can keep. The AI
 * model is not user data and is never included; journal photos are listed by
 * their on-device path only (the image files themselves stay on the phone).
 */
export function buildExport(save: SaveData, memories: readonly Memory[], planner: PlannerData, now: number = Date.now()) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date(now).toISOString(),
    save,
    memories,
    planner: { version: PLANNER_VERSION, ...pickPlanner(planner) },
    notes: 'The on-device AI model is not part of your data and is not included. Journal photos are referenced by path only.',
  };
}
