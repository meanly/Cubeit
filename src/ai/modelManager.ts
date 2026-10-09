import {
  cancelDownload,
  deleteModel,
  DownloadCancelled,
  downloadModel,
  freeSpaceOk,
  hasCompletePart,
  isModelInstalled,
  verifyAndInstall,
} from './modelFiles';
import { formatBytes, MODEL } from './modelInfo';
import { useModel } from './modelStore';
import { release, runtimeStatus } from './runtime';

/** Work out the model's state at launch. Nothing is downloaded here. */
export function initModelStatus(): void {
  const set = useModel.getState().setStatus;
  const rt = runtimeStatus();
  if (!rt.ok) return set({ state: 'unsupported', reason: rt.reason });
  if (isModelInstalled()) return set({ state: 'installed' });
  if (hasCompletePart()) {
    // A download finished while the app was away: verify it before use.
    void verify();
    return;
  }
  set({ state: 'absent' });
}

async function verify(): Promise<void> {
  const set = useModel.getState().setStatus;
  set({ state: 'verifying', progress: 0 });
  try {
    await verifyAndInstall((p) => set({ state: 'verifying', progress: p }));
    set({ state: 'installed' });
  } catch (error) {
    set({ state: 'error', message: error instanceof Error ? error.message : 'Verification failed.', canRetry: true });
  }
}

/** Download, verify and install the model. Only ever called from an explicit user action. */
export async function installModel(): Promise<void> {
  const store = useModel.getState();
  const s = store.status.state;
  if (s === 'downloading' || s === 'verifying' || s === 'installed' || s === 'ready' || s === 'loading' || s === 'unsupported') return;
  if (!freeSpaceOk()) {
    store.setStatus({ state: 'error', message: `Not enough free space. The model needs about ${formatBytes(MODEL.sizeBytes + 300_000_000)} free.`, canRetry: true });
    return;
  }
  store.setStatus({ state: 'downloading', received: 0, total: MODEL.sizeBytes });
  let last = 0;
  try {
    await downloadModel((received, total) => {
      const now = Date.now();
      if (now - last < 250 && received < total) return;
      last = now;
      useModel.getState().setStatus({ state: 'downloading', received, total });
    });
  } catch (error) {
    if (error instanceof DownloadCancelled) {
      useModel.getState().setStatus({ state: 'absent' });
      deleteModel();
      return;
    }
    useModel.getState().setStatus({
      state: 'error',
      message: `The download failed (${error instanceof Error ? error.message : 'network error'}). Check your connection and try again.`,
      canRetry: true,
    });
    return;
  }
  await verify();
}

export function cancelModelDownload(): void {
  cancelDownload();
}

export async function removeModel(): Promise<void> {
  await release();
  deleteModel();
  const rt = runtimeStatus();
  useModel.getState().setStatus(rt.ok ? { state: 'absent' } : { state: 'unsupported', reason: rt.reason });
  useModel.getState().setSpeed(null);
}

/** After an error: go back to the right resting state. */
export function resetModelError(): void {
  initModelStatus();
}
