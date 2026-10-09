import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import { deleteLocalFile } from '../../media/files';
import { cancelTranscription, ensureSpeechPermission, transcribeFile, voiceAvailability } from '../../media/voice';
import { VoiceError } from '../../media/voiceErrors';

export type VoicePhase = 'idle' | 'starting' | 'recording' | 'transcribing';

const MAX_MS = 60_000;
const MIN_MS = 700;

/** Mono 16 kHz AAC: small files, and what speech recognition works with best. */
const OPTIONS = { ...RecordingPresets.HIGH_QUALITY, sampleRate: 16_000, numberOfChannels: 1, bitRate: 64_000 };

const restoreAudio = () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});

/**
 * Hold-free voice input: tap to record, tap to stop. The recording is
 * transcribed on-device and then deleted; the text is handed back for the
 * user to review before sending.
 */
export function useVoiceInput(onText: (text: string) => void, onError: (message: string) => void) {
  const recorder = useAudioRecorder(OPTIONS);
  const state = useAudioRecorderState(recorder, 200);
  const [phase, setPhaseState] = useState<VoicePhase>('idle');
  // Mirrors `phase` for callbacks that outlive a render (the auto-stop timer).
  const phaseRef = useRef<VoicePhase>('idle');
  const cancelled = useRef(false);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);
  const setPhase = (p: VoicePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  const fail = (error: unknown) => {
    const msg = error instanceof VoiceError ? error.message : error instanceof Error ? error.message : 'Voice input failed.';
    if (!(error instanceof VoiceError && error.code === 'cancelled')) onError(msg);
  };

  const start = async () => {
    if (phaseRef.current !== 'idle') return;
    const available = voiceAvailability();
    if (!available.ok) return onError(available.reason);
    setPhase('starting');
    cancelled.current = false;
    try {
      const mic = await requestRecordingPermissionsAsync();
      if (!mic.granted) throw new VoiceError('mic-permission');
      await ensureSpeechPermission();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setPhase('recording');
      // Stop automatically after a minute.
      autoStop.current = setTimeout(() => void finish(true), MAX_MS);
    } catch (error) {
      await restoreAudio();
      setPhase('idle');
      fail(error);
    }
  };

  async function finish(keep: boolean) {
    if (phaseRef.current !== 'recording') return;
    if (autoStop.current) clearTimeout(autoStop.current);
    autoStop.current = null;
    setPhase('transcribing');
    const duration = Date.now() - startedAt.current;
    let uri: string | null = null;
    try {
      await recorder.stop();
      uri = recorder.uri;
    } catch (error) {
      fail(error);
    }
    await restoreAudio();
    if (!keep || !uri) {
      deleteLocalFile(uri);
      setPhase('idle');
      return;
    }
    if (duration < MIN_MS) {
      deleteLocalFile(uri);
      setPhase('idle');
      return fail(new VoiceError('too-short'));
    }
    try {
      const text = await transcribeFile(uri);
      if (!cancelled.current) onText(text);
    } catch (error) {
      if (!cancelled.current) fail(error);
    } finally {
      deleteLocalFile(uri);
      setPhase('idle');
    }
  }

  const cancel = () => {
    cancelled.current = true;
    if (phaseRef.current === 'recording') void finish(false);
    else if (phaseRef.current === 'transcribing') cancelTranscription();
  };

  // Never leave the microphone running if the panel closes mid-recording.
  const recorderRef = useRef(recorder);
  useEffect(() => {
    const r = recorderRef.current;
    const timer = autoStop;
    return () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        if (r.isRecording) {
          void r.stop().then(() => deleteLocalFile(r.uri));
          void restoreAudio();
        }
      } catch {
        // Already released.
      }
      cancelTranscription();
    };
  }, []);

  return { phase, durationMs: state.durationMillis, start, stop: () => void finish(true), cancel };
}
