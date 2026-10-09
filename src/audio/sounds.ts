import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/** Original synthesized effects — regenerate with `node scripts/generate-sounds.mjs`. */
const SOURCES = {
  pop: require('../../assets/sounds/pop.wav'),
  boing: require('../../assets/sounds/boing.wav'),
  bump: require('../../assets/sounds/bump.wav'),
  chime: require('../../assets/sounds/chime.wav'),
  gold: require('../../assets/sounds/gold.wav'),
  giggle: require('../../assets/sounds/giggle.wav'),
  tick: require('../../assets/sounds/tick.wav'),
  success: require('../../assets/sounds/success.wav'),
  aww: require('../../assets/sounds/aww.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  unlock: require('../../assets/sounds/unlock.wav'),
} as const;

export type SoundId = keyof typeof SOURCES;

const players: Partial<Record<SoundId, AudioPlayer>> = {};
const lastPlayed: Partial<Record<SoundId, number>> = {};
let configured = false;

function configure() {
  if (configured) return;
  configured = true;
  // Respect the silent switch and never interrupt the user's music.
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
}

/** Play a short effect. Failures are swallowed: sound is never essential. */
export function playSound(id: SoundId, volume = 0.6): void {
  const now = Date.now();
  if (now - (lastPlayed[id] ?? 0) < 50) return;
  lastPlayed[id] = now;
  try {
    configure();
    let player = players[id];
    if (!player) {
      player = createAudioPlayer(SOURCES[id]);
      players[id] = player;
    }
    player.volume = volume;
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch (error) {
    console.warn('[cubeit] sound failed', error);
  }
}
