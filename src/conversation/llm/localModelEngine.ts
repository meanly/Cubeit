import { MODEL } from '../../ai/modelInfo';
import { modelUsable, useModel } from '../../ai/modelStore';
import { complete, runtimeStatus } from '../../ai/runtime';
import type { CompanionReply, ConversationEngine, EngineStatus, ExpressionHint } from '../types';
import { buildCompanionPrompt } from './promptBuilder';

/** Pick a face for a model reply with a tiny keyword pass (the model only writes text). */
export function expressionFor(text: string): ExpressionHint {
  const t = text.toLowerCase();
  if (/\b(sorry|sad|miss|hard|tough)\b/.test(t)) return 'sad';
  if (/\b(love|hug|❤|care about)\b/.test(t)) return 'love';
  if (/\b(yay|woo|amazing|awesome|congrat|great job|well done)\b|!{2,}/.test(t)) return 'excited';
  if (/\b(hmm|let me think|not sure|i wonder)\b/.test(t)) return 'thinking';
  if (/\?\s*$/.test(t)) return 'curious';
  return 'happy';
}

/** Strip anything a small model sometimes adds: role tags, markdown, surrounding quotes. */
export function cleanModelText(text: string): string {
  return text
    .replace(/<\|[^|]*\|>/g, '')
    .replace(/^(assistant|pip|ai)\s*:\s*/i, '')
    .replace(/[*_#`]+/g, '')
    .replace(/^["“]|["”]$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genuine on-device inference with Qwen2.5-0.5B-Instruct through llama.rn.
 * Available once the model has been downloaded and verified in a build that
 * includes the native runtime (not Expo Go, not web).
 */
export const localModelEngine: ConversationEngine = {
  kind: 'local-model',
  label: 'On-device AI model',
  status: async (): Promise<EngineStatus> => {
    const rt = runtimeStatus();
    if (!rt.ok) return { available: false, detail: rt.reason };
    const s = useModel.getState().status;
    if (modelUsable(s)) {
      return { available: true, detail: `${MODEL.name} (${MODEL.quantization}) runs entirely on this phone, offline. Nothing you say is sent anywhere.` };
    }
    return { available: false, detail: `Not installed. Download ${MODEL.name} below to chat with a real on-device model (works offline afterwards).` };
  },
  reply: async (input, context, history, opts): Promise<CompanionReply> => {
    const messages = buildCompanionPrompt(input, context, history, 6, opts?.today ?? []);
    const result = await complete(messages, {
      maxTokens: 120,
      temperature: 0.7,
      onToken: opts?.onPartial ? (t) => opts.onPartial!(cleanModelText(t)) : undefined,
    });
    const text = cleanModelText(result.text);
    if (!text) throw new Error('The model returned an empty reply.');
    return { text, expression: expressionFor(text), understood: true };
  },
};
