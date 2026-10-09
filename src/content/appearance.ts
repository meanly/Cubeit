import type { Unlock } from './unlocks';

export type BodyColorId = 'lilac' | 'mint' | 'peach' | 'sky' | 'lemon' | 'cocoa';
export type AccessoryId = 'none' | 'sprout' | 'bow' | 'beanie' | 'headphones' | 'scarf' | 'crown';

export interface BodyPalette {
  id: BodyColorId;
  name: string;
  unlock: Unlock;
  top: string;
  bottom: string;
  belly: string;
  shade: string;
  cheek: string;
  foot: string;
  ink: string;
}

export const BODY_COLORS: readonly BodyPalette[] = [
  {
    id: 'lilac',
    name: 'Lilac',
    unlock: { kind: 'default' },
    top: '#C9BCFF',
    bottom: '#9C8BF2',
    belly: '#E4DCFF',
    shade: '#7F6DD8',
    cheek: '#FF9DC0',
    foot: '#7562CC',
    ink: '#241C4A',
  },
  {
    id: 'mint',
    name: 'Mint',
    unlock: { kind: 'default' },
    top: '#B5F2D8',
    bottom: '#73D2AE',
    belly: '#DDFBEF',
    shade: '#4FB08C',
    cheek: '#FF9DB0',
    foot: '#3F9878',
    ink: '#163A2E',
  },
  {
    id: 'peach',
    name: 'Peach',
    unlock: { kind: 'default' },
    top: '#FFD2BA',
    bottom: '#F6A486',
    belly: '#FFE9DD',
    shade: '#DB8567',
    cheek: '#FF7F98',
    foot: '#C76F53',
    ink: '#4A2518',
  },
  {
    id: 'sky',
    name: 'Sky',
    unlock: { kind: 'stars', cost: 25 },
    top: '#BFE0FF',
    bottom: '#7DB5F5',
    belly: '#E2F0FF',
    shade: '#5A92D6',
    cheek: '#FF9DC0',
    foot: '#4C80C2',
    ink: '#16304F',
  },
  {
    id: 'lemon',
    name: 'Lemon',
    unlock: { kind: 'stars', cost: 35 },
    top: '#FFF0A6',
    bottom: '#F5CF5E',
    belly: '#FFF8D6',
    shade: '#D8AE3C',
    cheek: '#FF9A86',
    foot: '#C49A2E',
    ink: '#463812',
  },
  {
    id: 'cocoa',
    name: 'Cocoa',
    unlock: { kind: 'bond', level: 4 },
    top: '#C69C82',
    bottom: '#956A55',
    belly: '#E3CBB9',
    shade: '#7A5442',
    cheek: '#FF9DA8',
    foot: '#684536',
    ink: '#2C1A12',
  },
];

export interface AccessoryDef {
  id: AccessoryId;
  name: string;
  unlock: Unlock;
}

export const ACCESSORIES: readonly AccessoryDef[] = [
  { id: 'none', name: 'None', unlock: { kind: 'default' } },
  { id: 'sprout', name: 'Sprout', unlock: { kind: 'default' } },
  { id: 'bow', name: 'Bow', unlock: { kind: 'stars', cost: 20 } },
  { id: 'scarf', name: 'Scarf', unlock: { kind: 'stars', cost: 25 } },
  { id: 'beanie', name: 'Beanie', unlock: { kind: 'stars', cost: 35 } },
  { id: 'headphones', name: 'Headphones', unlock: { kind: 'bond', level: 2 } },
  { id: 'crown', name: 'Paper crown', unlock: { kind: 'bond', level: 5 } },
];

export interface Appearance {
  bodyColor: BodyColorId;
  accessory: AccessoryId;
}

export const DEFAULT_APPEARANCE: Appearance = { bodyColor: 'lilac', accessory: 'none' };

export const paletteById = (id: BodyColorId): BodyPalette =>
  BODY_COLORS.find((c) => c.id === id) ?? BODY_COLORS[0];
