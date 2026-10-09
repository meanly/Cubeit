import { DEFAULT_UNLOCK, type Unlock } from './unlocks';

/** The plastic around the LCD. The screen itself never changes. */
export type DeviceId = 'auto' | 'classic' | 'graphite' | 'ocean' | 'sage' | 'sand' | 'coral' | 'midnight' | 'gold';

export interface DeviceFinish {
  /** Housing gradient, lit top-left to shaded bottom-right. */
  light: string;
  dark: string;
  /** Bright rim on the lit edges, and a thin outline all around so every edge reads on any background. */
  rim: string;
  outline: string;
  screw: string;
  label: string;
  shadow: string;
  bezel: string;
}

export interface DeviceDef {
  id: DeviceId;
  name: string;
  unlock: Unlock;
  /** `null` for Auto, which follows the app's light / dark appearance. */
  finish: DeviceFinish | null;
}

const CLASSIC: DeviceFinish = {
  light: '#F1F2EC',
  dark: '#C9CBC1',
  rim: 'rgba(255,255,255,0.9)',
  outline: 'rgba(40,42,34,0.16)',
  screw: '#B7BAAE',
  label: '#8E9184',
  shadow: '#3F4236',
  bezel: '#2A2A27',
};

const GRAPHITE: DeviceFinish = {
  light: '#3B3F44',
  dark: '#1F2225',
  rim: 'rgba(255,255,255,0.14)',
  outline: 'rgba(255,255,255,0.10)',
  screw: '#55595F',
  label: '#80868D',
  shadow: '#000000',
  bezel: '#0B0C0D',
};

export const DEVICES: readonly DeviceDef[] = [
  { id: 'auto', name: 'Auto', unlock: DEFAULT_UNLOCK, finish: null },
  { id: 'classic', name: 'Classic', unlock: DEFAULT_UNLOCK, finish: CLASSIC },
  { id: 'graphite', name: 'Graphite', unlock: DEFAULT_UNLOCK, finish: GRAPHITE },
  {
    id: 'ocean',
    name: 'Ocean',
    unlock: DEFAULT_UNLOCK,
    finish: {
      light: '#5D8FB6',
      dark: '#28506F',
      rim: 'rgba(255,255,255,0.35)',
      outline: 'rgba(10,30,50,0.25)',
      screw: '#3F6E93',
      label: '#C9DCEB',
      shadow: '#13263A',
      bezel: '#0E1A26',
    },
  },
  {
    id: 'sage',
    name: 'Sage',
    unlock: DEFAULT_UNLOCK,
    finish: {
      light: '#C3D2BA',
      dark: '#83A078',
      rim: 'rgba(255,255,255,0.6)',
      outline: 'rgba(30,45,25,0.2)',
      screw: '#93AA88',
      label: '#4F6A45',
      shadow: '#2C3A27',
      bezel: '#1D241A',
    },
  },
  {
    id: 'sand',
    name: 'Sand',
    unlock: DEFAULT_UNLOCK,
    finish: {
      light: '#EFE3CB',
      dark: '#C6B08A',
      rim: 'rgba(255,255,255,0.8)',
      outline: 'rgba(60,45,20,0.18)',
      screw: '#C0AA82',
      label: '#8A7250',
      shadow: '#4A3D28',
      bezel: '#2A251D',
    },
  },
  {
    id: 'coral',
    name: 'Coral',
    unlock: { kind: 'stars', cost: 15 },
    finish: {
      light: '#F4A593',
      dark: '#C9604D',
      rim: 'rgba(255,255,255,0.55)',
      outline: 'rgba(80,25,15,0.22)',
      screw: '#D27A68',
      label: '#7E2F21',
      shadow: '#4A1F17',
      bezel: '#251512',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    unlock: { kind: 'stars', cost: 15 },
    finish: {
      light: '#33476A',
      dark: '#152238',
      rim: 'rgba(255,255,255,0.18)',
      outline: 'rgba(255,255,255,0.10)',
      screw: '#405678',
      label: '#93AACB',
      shadow: '#05080F',
      bezel: '#060A12',
    },
  },
  {
    id: 'gold',
    name: 'Gold',
    unlock: { kind: 'stars', cost: 30 },
    finish: {
      light: '#EED48A',
      dark: '#B88F35',
      rim: 'rgba(255,255,255,0.75)',
      outline: 'rgba(70,50,10,0.22)',
      screw: '#C9A552',
      label: '#7A5A17',
      shadow: '#4A3810',
      bezel: '#221A08',
    },
  },
];

export const DEVICE_IDS = DEVICES.map((d) => d.id);

/** The finish to draw: Auto is Classic in light mode and Graphite in dark mode. */
export function deviceFinish(id: DeviceId, scheme: 'light' | 'dark'): DeviceFinish {
  const def = DEVICES.find((d) => d.id === id);
  return def?.finish ?? (scheme === 'dark' ? GRAPHITE : CLASSIC);
}
