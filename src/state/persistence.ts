import { AppState } from 'react-native';

import { emptyMemoryDoc, migrateMemories } from '../memory/memoryDoc';
import { MEMORIES_KEY, MEMORIES_VERSION, type MemoryDoc } from '../memory/types';
import { emptyPlannerDoc, migratePlanner } from '../planner/plannerDoc';
import { PLANNER_KEY, PLANNER_VERSION, type PlannerDoc } from '../planner/types';
import { DocumentWriter, loadDocument, type LoadStatus } from '../storage/documents';
import { kv } from '../storage/kv';
import { pickSave, useGame } from './gameStore';
import { migrateSave } from './migrations';
import { useMemories } from './memoryStore';
import { pickPlanner, setPlannerCommitter, usePlanner } from './plannerStore';
import { createDefaultSave, SAVE_KEY, type SaveData } from './schema';
import { useUi } from './uiStore';

let writers: {
  save: DocumentWriter<SaveData>;
  memories: DocumentWriter<MemoryDoc>;
  planner: DocumentWriter<PlannerDoc>;
} | null = null;

export interface BootResult {
  save: LoadStatus;
  memories: LoadStatus;
  planner: LoadStatus;
}

const plannerDoc = (): PlannerDoc => ({ version: PLANNER_VERSION, ...pickPlanner(usePlanner.getState()) });

/**
 * Load everything from disk into the stores, then keep disk in sync:
 * changes are written shortly after they happen and flushed immediately
 * when the app leaves the foreground. Planner changes made through
 * `commitPlanner` are written synchronously so they can be confirmed.
 */
export function bootstrapPersistence(): BootResult {
  if (writers) return { save: 'loaded', memories: 'loaded', planner: 'loaded' };

  const save = loadDocument(kv, SAVE_KEY, (raw) => migrateSave(raw).data, () => createDefaultSave());
  const memories = loadDocument(kv, MEMORIES_KEY, migrateMemories, emptyMemoryDoc);
  const planner = loadDocument(kv, PLANNER_KEY, migratePlanner, emptyPlannerDoc);

  useGame.getState().hydrate(save.data);
  useMemories.getState().hydrate(memories.data.items);
  usePlanner.getState().hydrate(pickPlanner(planner.data));

  if (save.status === 'recovered' || memories.status === 'recovered' || planner.status === 'recovered') {
    useUi
      .getState()
      .setStorageProblem(
        "Some saved data couldn't be read, so Cubeit started fresh where needed. The unreadable copy was kept on this device.",
      );
  }

  const onError = (error: unknown) => {
    console.warn('[cubeit] save failed', error);
    useUi.getState().setStorageProblem("Cubeit couldn't save just now. Your device storage may be full.");
  };
  writers = {
    save: new DocumentWriter<SaveData>(kv, SAVE_KEY, 800, onError),
    memories: new DocumentWriter<MemoryDoc>(kv, MEMORIES_KEY, 250, onError),
    planner: new DocumentWriter<PlannerDoc>(kv, PLANNER_KEY, 300, onError),
  };

  useGame.subscribe((state) => writers?.save.schedule(pickSave(state)));
  useMemories.subscribe((state) => writers?.memories.schedule({ version: MEMORIES_VERSION, items: state.items }));
  usePlanner.subscribe(() => writers?.planner.schedule(plannerDoc()));
  setPlannerCommitter(() => writers?.planner.writeNow(plannerDoc()));

  // Persist a brand-new world right away so its birth date is stable.
  if (save.status !== 'loaded') writers.save.schedule(pickSave(useGame.getState()));

  AppState.addEventListener('change', (next) => {
    if (next !== 'active') flushPersistence();
  });

  return { save: save.status, memories: memories.status, planner: planner.status };
}

export function flushPersistence(): void {
  writers?.save.flush();
  writers?.memories.flush();
  writers?.planner.flush();
}
