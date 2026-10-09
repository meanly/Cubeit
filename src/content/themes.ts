import type { Unlock } from './unlocks';

export type ThemeId = 'midnight' | 'meadow' | 'peach' | 'deepsea' | 'lantern';
export type LightId = 'moonlight' | 'warm' | 'aurora' | 'rose';

export interface RoomTheme {
  id: ThemeId;
  name: string;
  unlock: Unlock;
  /** Back wall gradient, top → bottom. */
  backWall: [string, string];
  /** Side walls, front edge → back edge. */
  sideWall: [string, string];
  ceiling: [string, string];
  /** Floor, front → back. */
  floor: [string, string];
  floorLine: string;
  trim: string;
  wallPattern: 'dots' | 'stripes' | 'none';
  patternColor: string;
  /** Outer cube bezel gradient. */
  frame: [string, string];
  /** Is the room bright enough that dark-on-light art needs adjusting? */
  bright: boolean;
}

export const THEMES: readonly RoomTheme[] = [
  {
    id: 'midnight',
    name: 'Plain',
    unlock: { kind: 'default' },
    backWall: ['#2D3174', '#20245A'],
    sideWall: ['#161943', '#232766'],
    ceiling: ['#101336', '#1A1E4B'],
    floor: ['#3D3685', '#2A2664'],
    floorLine: 'rgba(255,255,255,0.06)',
    trim: '#463F95',
    wallPattern: 'dots',
    patternColor: 'rgba(255,255,255,0.05)',
    frame: ['#2E3268', '#171A3E'],
    bright: false,
  },
  {
    id: 'meadow',
    name: 'Stripes',
    unlock: { kind: 'default' },
    backWall: ['#447560', '#335C4B'],
    sideWall: ['#203F33', '#2D5545'],
    ceiling: ['#1B362C', '#264A3C'],
    floor: ['#8C6B4B', '#6C5037'],
    floorLine: 'rgba(0,0,0,0.13)',
    trim: '#5F8F77',
    wallPattern: 'stripes',
    patternColor: 'rgba(255,255,255,0.05)',
    frame: ['#2F4E44', '#18302A'],
    bright: false,
  },
  {
    id: 'peach',
    name: 'Lattice',
    unlock: { kind: 'stars', cost: 40 },
    backWall: ['#C97F7B', '#A9625F'],
    sideWall: ['#7F444D', '#9C5860'],
    ceiling: ['#643546', '#7C4558'],
    floor: ['#5C3B60', '#46294A'],
    floorLine: 'rgba(255,255,255,0.06)',
    trim: '#E3A08F',
    wallPattern: 'dots',
    patternColor: 'rgba(255,255,255,0.07)',
    frame: ['#6A3B52', '#3E2132'],
    bright: false,
  },
  {
    id: 'deepsea',
    name: 'Waves',
    unlock: { kind: 'stars', cost: 60 },
    backWall: ['#21607D', '#174B64'],
    sideWall: ['#0F344A', '#185069'],
    ceiling: ['#0C2A3C', '#133A50'],
    floor: ['#C7B288', '#A38F68'],
    floorLine: 'rgba(0,0,0,0.08)',
    trim: '#3E8DA8',
    wallPattern: 'dots',
    patternColor: 'rgba(200,240,255,0.08)',
    frame: ['#1B4A60', '#0D2737'],
    bright: false,
  },
  {
    id: 'lantern',
    name: 'Panels',
    unlock: { kind: 'stars', cost: 80 },
    backWall: ['#EDE2CA', '#D9CBAE'],
    sideWall: ['#BFAE8D', '#D3C4A5'],
    ceiling: ['#B6A584', '#CBBB9B'],
    floor: ['#A07049', '#7F5537'],
    floorLine: 'rgba(60,30,10,0.14)',
    trim: '#B98F63',
    wallPattern: 'stripes',
    patternColor: 'rgba(130,95,50,0.08)',
    frame: ['#6B5338', '#3D2E1E'],
    bright: true,
  },
];

export interface LightTint {
  id: LightId;
  name: string;
  color: string;
  unlock: Unlock;
}

export const LIGHTS: readonly LightTint[] = [
  { id: 'moonlight', name: 'Moonlight', color: '#B6A6FF', unlock: { kind: 'default' } },
  { id: 'warm', name: 'Warm lamp', color: '#FFC98A', unlock: { kind: 'default' } },
  { id: 'aurora', name: 'Aurora', color: '#7FF0D0', unlock: { kind: 'stars', cost: 30 } },
  { id: 'rose', name: 'Rosy', color: '#FF9FC6', unlock: { kind: 'bond', level: 3 } },
];

export const themeById = (id: ThemeId): RoomTheme => THEMES.find((t) => t.id === id) ?? THEMES[0];
export const lightById = (id: LightId): LightTint => LIGHTS.find((l) => l.id === id) ?? LIGHTS[0];
