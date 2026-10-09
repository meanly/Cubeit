/** Voice input failures, mapped to plain messages. Pure so it can be tested without native modules. */
export type VoiceErrorCode =
  | 'unsupported'
  | 'offline-unavailable'
  | 'mic-permission'
  | 'speech-permission'
  | 'too-short'
  | 'no-speech'
  | 'interrupted'
  | 'busy'
  | 'cancelled'
  | 'failed';

export class VoiceError extends Error {
  constructor(
    readonly code: VoiceErrorCode,
    detail?: string,
  ) {
    super(describeVoiceError(code, detail));
  }
}

export function describeVoiceError(code: VoiceErrorCode, detail?: string): string {
  switch (code) {
    case 'unsupported':
      return detail ?? 'Voice input needs the Cubeit app build with speech support (not Expo Go or the web preview).';
    case 'offline-unavailable':
      return 'This phone can’t transcribe speech on-device for your language, and Cubeit never sends audio to a server. Try typing instead.';
    case 'mic-permission':
      return 'Cubeit needs microphone access for voice input. You can allow it in the Settings app.';
    case 'speech-permission':
      return 'Speech recognition permission was denied. You can allow it in the Settings app.';
    case 'too-short':
      return 'That was too short to hear anything. Hold on a little longer and try again.';
    case 'no-speech':
      return 'I didn’t catch any words. Try again a bit closer to the phone?';
    case 'interrupted':
      return 'Recording was interrupted (a call or another app took the microphone).';
    case 'busy':
      return 'Speech recognition is busy. Try again in a moment.';
    case 'cancelled':
      return 'Cancelled.';
    case 'failed':
      return detail ? `Couldn’t transcribe that: ${detail}` : 'Couldn’t transcribe that. Please try again.';
  }
}

/** Map expo-speech-recognition's error codes to ours. */
export function fromRecognizerError(error: string, message?: string): VoiceErrorCode {
  switch (error) {
    case 'not-allowed':
      return 'speech-permission';
    case 'no-speech':
    case 'speech-timeout':
    case 'nomatch':
      return 'no-speech';
    case 'interrupted':
    case 'audio-capture':
      return 'interrupted';
    case 'busy':
      return 'busy';
    case 'aborted':
      return 'cancelled';
    case 'language-not-supported':
    case 'service-not-allowed':
    case 'network':
      // With on-device recognition required, "network" means the on-device model isn't available.
      return 'offline-unavailable';
    default:
      return message && /on-?device/i.test(message) ? 'offline-unavailable' : 'failed';
  }
}

/** Join final result chunks into one clean transcript. */
export function joinTranscript(parts: readonly string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
