import { AppState, TurboModuleRegistry } from 'react-native';

import { LIMITS, STOP_WORDS } from './modelInfo';
import { modelUri } from './modelFiles';
import { useModel } from './modelStore';

/**
 * Thin wrapper around llama.rn (llama.cpp). Inference runs on llama.rn's
 * native threads with Metal offload — never on the JS or UI thread — so the
 * room keeps animating while the model thinks. The model is loaded on demand,
 * requests are serialized, and it's released after a minute idle or when the
 * app goes to the background.
 */

type LlamaModule = typeof import('llama.rn');
type LlamaContext = Awaited<ReturnType<LlamaModule['initLlama']>>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  maxTokens: number;
  temperature: number;
  /** Constrain output to this JSON Schema (llama.cpp grammar). */
  jsonSchema?: object;
  onToken?: (textSoFar: string) => void;
}

export interface CompletionResult {
  text: string;
  tokensPerSecond: number | null;
  truncated: boolean;
}

let lib: LlamaModule | null | undefined;

/** Whether this build includes the native runtime (false in Expo Go and on the web). */
export function runtimeStatus(): { ok: true } | { ok: false; reason: string } {
  try {
    if (!TurboModuleRegistry.get('RNLlama')) {
      return { ok: false, reason: 'This build doesn’t include the on-device AI runtime. Install the Cubeit development or release build (Expo Go can’t run it).' };
    }
    // Loaded lazily: the native module is missing in Expo Go, and importing it eagerly would crash there.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (lib === undefined) lib = require('llama.rn') as LlamaModule;
    return lib ? { ok: true } : { ok: false, reason: 'The on-device AI runtime failed to load.' };
  } catch {
    lib = null;
    return { ok: false, reason: 'The on-device AI runtime failed to load.' };
  }
}

let context: LlamaContext | null = null;
let loading: Promise<LlamaContext> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let queue: Promise<unknown> = Promise.resolve();

function armIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => void release(), LIMITS.idleUnloadMs);
}

AppState.addEventListener('change', (s) => {
  if (s === 'background') void release();
});

async function ensureContext(): Promise<LlamaContext> {
  if (context) return context;
  if (loading) return loading;
  const rt = runtimeStatus();
  if (!rt.ok || !lib) throw new Error(rt.ok ? 'Runtime unavailable.' : rt.reason);
  const llama = lib;
  const store = useModel.getState();
  store.setStatus({ state: 'loading', progress: 0 });
  loading = (async () => {
    try {
      const ctx = await llama.initLlama(
        {
          model: modelUri(),
          n_ctx: LIMITS.nCtx,
          n_batch: LIMITS.nBatch,
          n_gpu_layers: LIMITS.nGpuLayers,
          use_mlock: false,
        },
        (p: number) => useModel.getState().setStatus({ state: 'loading', progress: Math.max(0, Math.min(1, p / 100)) }),
      );
      context = ctx;
      useModel.getState().setStatus({ state: 'ready' });
      return ctx;
    } catch (error) {
      useModel.getState().setStatus({
        state: 'error',
        message: `The model couldn’t be loaded (${error instanceof Error ? error.message : 'unknown error'}). Try again, or delete and re-download it in Settings.`,
        canRetry: true,
      });
      throw error;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

/** Preload the model (e.g. when the Talk panel opens) so the first reply is quicker. */
export function warmUp(): void {
  void ensureContext()
    .then(armIdle)
    .catch(() => {});
}

export async function release(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = null;
  const ctx = context;
  context = null;
  if (!ctx) return;
  try {
    await ctx.release();
  } catch {
    // Already gone.
  }
  const s = useModel.getState().status;
  if (s.state === 'ready' || s.state === 'loading') useModel.getState().setStatus({ state: 'installed' });
}

/** Run one chat completion. Calls are queued so only one runs at a time. */
export function complete(messages: ChatMessage[], opts: CompletionOptions): Promise<CompletionResult> {
  const run = async (): Promise<CompletionResult> => {
    const ctx = await ensureContext();
    if (idleTimer) clearTimeout(idleTimer);
    useModel.getState().setBusy(true);
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      let text = '';
      const work = ctx.completion(
        {
          messages,
          n_predict: opts.maxTokens,
          temperature: opts.temperature,
          top_p: 0.9,
          top_k: 40,
          penalty_repeat: 1.1,
          stop: STOP_WORDS,
          ...(opts.jsonSchema ? { response_format: { type: 'json_schema' as const, json_schema: { strict: true, schema: opts.jsonSchema } } } : {}),
        },
        (data: { token: string }) => {
          text += data.token;
          opts.onToken?.(text);
        },
      );
      const timer = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          void ctx.stopCompletion().catch(() => {});
          reject(new Error('The model took too long to answer.'));
        }, LIMITS.timeoutMs);
      });
      const result = await Promise.race([work, timer]);
      const tps = result.timings?.predicted_per_second ?? null;
      if (tps) useModel.getState().setSpeed(Math.round(tps * 10) / 10);
      return { text: (result.content || result.text || text).trim(), tokensPerSecond: tps, truncated: !!result.truncated || result.stopped_limit > 0 };
    } finally {
      if (timeout) clearTimeout(timeout);
      useModel.getState().setBusy(false);
      armIdle();
    }
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
