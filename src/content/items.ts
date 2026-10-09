import type { Unlock } from './unlocks';

/** Furniture slots in the room. Each slot holds at most one item. */
export type SlotId = 'rest' | 'corner' | 'wallLeft' | 'wallRight' | 'rug' | 'ceiling' | 'toy';

export type ItemId =
  | 'cushion'
  | 'bed'
  | 'beanbag'
  | 'plant'
  | 'lamp'
  | 'bookshelf'
  | 'window'
  | 'findsShelf'
  | 'poster'
  | 'clock'
  | 'photoFrame'
  | 'roundRug'
  | 'stripedRug'
  | 'stringLights'
  | 'moonMobile'
  | 'ball';

/** What the character does when it visits (or the user taps) an item. */
export type InteractionKind =
  | 'rest'
  | 'sniff'
  | 'toggleLight'
  | 'read'
  | 'lookOut'
  | 'admire'
  | 'checkTime'
  | 'showFinds'
  | 'swing'
  | 'twinkle'
  | 'play'
  | 'none';

export interface ItemDef {
  id: ItemId;
  name: string;
  slot: SlotId;
  unlock: Unlock;
  interaction: InteractionKind;
}

export interface SlotDef {
  id: SlotId;
  name: string;
  /** Whether the slot can be left empty. */
  allowEmpty: boolean;
}

export const SLOTS: readonly SlotDef[] = [
  { id: 'rest', name: 'Rest spot', allowEmpty: false },
  { id: 'corner', name: 'Corner', allowEmpty: true },
  { id: 'wallLeft', name: 'Left wall', allowEmpty: true },
  { id: 'wallRight', name: 'Right wall', allowEmpty: true },
  { id: 'rug', name: 'Rug', allowEmpty: true },
  { id: 'ceiling', name: 'Ceiling', allowEmpty: true },
  { id: 'toy', name: 'Toy', allowEmpty: true },
];

export const ITEMS: readonly ItemDef[] = [
  { id: 'cushion', name: 'Cloud cushion', slot: 'rest', unlock: { kind: 'default' }, interaction: 'rest' },
  { id: 'bed', name: 'Tiny bed', slot: 'rest', unlock: { kind: 'stars', cost: 30 }, interaction: 'rest' },
  { id: 'beanbag', name: 'Beanbag', slot: 'rest', unlock: { kind: 'stars', cost: 50 }, interaction: 'rest' },
  { id: 'plant', name: 'Sprout pot', slot: 'corner', unlock: { kind: 'default' }, interaction: 'sniff' },
  { id: 'lamp', name: 'Floor lamp', slot: 'corner', unlock: { kind: 'default' }, interaction: 'toggleLight' },
  { id: 'bookshelf', name: 'Bookshelf', slot: 'corner', unlock: { kind: 'stars', cost: 40 }, interaction: 'read' },
  { id: 'window', name: 'Window', slot: 'wallLeft', unlock: { kind: 'default' }, interaction: 'lookOut' },
  { id: 'findsShelf', name: 'Finds shelf', slot: 'wallLeft', unlock: { kind: 'bond', level: 2 }, interaction: 'showFinds' },
  { id: 'poster', name: 'Star poster', slot: 'wallRight', unlock: { kind: 'default' }, interaction: 'admire' },
  { id: 'clock', name: 'Wall clock', slot: 'wallRight', unlock: { kind: 'stars', cost: 25 }, interaction: 'checkTime' },
  { id: 'photoFrame', name: 'Heart frame', slot: 'wallRight', unlock: { kind: 'bond', level: 3 }, interaction: 'admire' },
  { id: 'roundRug', name: 'Round rug', slot: 'rug', unlock: { kind: 'default' }, interaction: 'none' },
  { id: 'stripedRug', name: 'Striped rug', slot: 'rug', unlock: { kind: 'stars', cost: 20 }, interaction: 'none' },
  { id: 'stringLights', name: 'String lights', slot: 'ceiling', unlock: { kind: 'default' }, interaction: 'twinkle' },
  { id: 'moonMobile', name: 'Moon mobile', slot: 'ceiling', unlock: { kind: 'stars', cost: 45 }, interaction: 'swing' },
  { id: 'ball', name: 'Bouncy ball', slot: 'toy', unlock: { kind: 'default' }, interaction: 'play' },
];

export const itemById = (id: ItemId): ItemDef | undefined => ITEMS.find((i) => i.id === id);
export const itemsForSlot = (slot: SlotId): ItemDef[] => ITEMS.filter((i) => i.slot === slot);

export type RoomItems = Record<SlotId, ItemId | null>;

export const DEFAULT_ITEMS: RoomItems = {
  rest: 'cushion',
  corner: 'plant',
  wallLeft: 'window',
  wallRight: 'poster',
  rug: 'roundRug',
  ceiling: 'stringLights',
  toy: 'ball',
};
