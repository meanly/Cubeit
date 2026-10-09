import { Platform } from 'react-native';

import { fromRecognizerError, joinTranscript, VoiceError } from './voiceErrors';

/**
 * On-device speech-to-text for a recorded audio file, using Apple's Speech
 * framework (SFSpeechRecognizer) through expo-speech-recognition with
 * `requiresOnDeviceRecognition: true` — iOS refuses rather than falling back
 * to Apple's servers, so audio never leaves the phone. The recording itself
 * is made with expo-audio and deleted by the caller afterwards.
 */

type SpeechModule = typeof import('expo-speech-recognition');
let mod: SpeechModule | null | undefined;

function speech(): SpeechModule | null {
  if (mod !== undefined) return mod;
  try {
    // Loaded lazily: the native module is missing in Expo Go, and importing it eagerly would crash there.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-speech-recognition') as SpeechModule;
  } catch {
    mod = null;
  }
  return mod;
}

export function voiceAvailability(): { ok: true } | { ok: false; reason: string } {
  const m = speech();
  if (!m) return { ok: false, reason: 'Voice input needs the Cubeit app build with speech support (Expo Go can’t run it).' };
  try {
    if (!m.ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      return { ok: false, reason: 'Speech recognition is turned off on this phone (Settings → Siri / Dictation).' };
    }
    if (!m.ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()) {
      return { ok: false, reason: 'This phone can’t transcribe speech on-device, and Cubeit never sends audio to a server.' };
    }
  } catch {
    return { ok: false, reason: 'Speech recognition isn’t available in this build.' };
  }
  return { ok: true };
}

export async function ensureSpeechPermission(): Promise<void> {
  const m = speech();
  if (!m) throw new VoiceError('unsupported');
  // iOS still asks the user to allow speech recognition, even fully on-device.
  if (Platform.OS === 'ios') {
    const p = await m.ExpoSpeechRecognitionModule.requestSpeechRecognizerPermissionsAsync();
    if (!p.granted) throw new VoiceError('speech-permission');
  }
}

let active: { abort: () => void } | null = null;

/** Transcribe a local audio file on-device. Rejects with a VoiceError. */
export function transcribeFile(uri: string, lang = 'en-US', timeoutMs = 30_000): Promise<string> {
  const m = speech();
  if (!m) return Promise.reject(new VoiceError('unsupported'));
  const S = m.ExpoSpeechRecognitionModule;
  return new Promise<string>((resolve, reject) => {
    const finals: string[] = [];
    let latest = '';
    let done = false;
    const subs = [
      S.addListener('result', (e) => {
        const text = e.results[0]?.transcript ?? '';
        if (e.isFinal) finals.push(text);
        else latest = text;
      }),
      S.addListener('error', (e) => finish(new VoiceError(fromRecognizerError(e.error, e.message), e.message))),
      S.addListener('end', () => finish()),
    ];
    const timer = setTimeout(() => {
      try {
        S.stop();
      } catch {
        // ignore
      }
      finish(new VoiceError('failed', 'it took too long'));
    }, timeoutMs);
    function finish(error?: VoiceError) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      active = null;
      subs.forEach((s) => s.remove());
      const text = joinTranscript(finals.length > 0 ? finals : [latest]);
      if (error && !(error.code === 'no-speech' && text)) return reject(error);
      if (!text) return reject(new VoiceError('no-speech'));
      resolve(text);
    }
    active = {
      abort: () => {
        try {
          S.abort();
        } catch {
          // ignore
        }
        finish(new VoiceError('cancelled'));
      },
    };
    try {
      S.start({
        lang,
        interimResults: true,
        addsPunctuation: true,
        requiresOnDeviceRecognition: true,
        audioSource: { uri },
      });
    } catch (error) {
      finish(new VoiceError('failed', error instanceof Error ? error.message : undefined));
    }
  });
}

export function cancelTranscription(): void {
  active?.abort();
}
