import type { ConversationEngine, EngineStatus } from '../types';

/**
 * Placeholder for a genuine on-device language model.
 *
 * This build does NOT include an inference runtime or model weights, so this
 * engine always reports itself unavailable and the app uses the scripted
 * fallback. docs/LOCAL_AI.md describes exactly what's needed to enable it
 * (a development build with llama.rn or ExecuTorch, a user-approved model
 * download, and an implementation of `reply` using promptBuilder.ts).
 */
export const localModelEngine: ConversationEngine = {
  kind: 'local-model',
  label: 'On-device AI model',
  status: async (): Promise<EngineStatus> => ({
    available: false,
    detail: 'Not included in this version. No AI model is installed on this device, and nothing is downloaded.',
  }),
  reply: async () => {
    throw new Error('On-device model is not available in this build.');
  },
};
