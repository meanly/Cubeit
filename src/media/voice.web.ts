import { VoiceError } from './voiceErrors';

/** Web preview: voice input is phone-only (browser speech APIs may use online services). */
export function voiceAvailability(): { ok: true } | { ok: false; reason: string } {
  return { ok: false, reason: 'Voice input works in the phone app only. Browser speech recognition can send audio online, so it isn’t used.' };
}

export async function ensureSpeechPermission(): Promise<void> {
  throw new VoiceError('unsupported');
}

export function transcribeFile(_uri: string): Promise<string> {
  return Promise.reject(new VoiceError('unsupported'));
}

export function cancelTranscription(): void {}
