/** Web preview: llama.rn is native-only, so the model is never available here. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  maxTokens: number;
  temperature: number;
  jsonSchema?: object;
  onToken?: (textSoFar: string) => void;
}

export interface CompletionResult {
  text: string;
  tokensPerSecond: number | null;
  truncated: boolean;
}

export function runtimeStatus(): { ok: true } | { ok: false; reason: string } {
  return { ok: false, reason: 'The on-device AI runs only in the iOS / Android app, not in the web preview.' };
}

export function warmUp(): void {}

export async function release(): Promise<void> {}

export async function complete(_messages: ChatMessage[], _opts: CompletionOptions): Promise<CompletionResult> {
  throw new Error('No on-device model on the web.');
}
