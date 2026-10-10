import type { ItemId, SlotId } from '../../content/items';
import { LCD_DOTS } from '../../lcd/bitmap';
import type { RoomGeometry } from '../../physics/geometry';
import { REST_DOTS, SLOT_DOTS } from './pixelArt';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Where the character goes to use an item, and how it behaves there. */
export interface ItemAnchor {
  x: number;
  z: number;
  /** Height to perch at (rest spots), else 0. */
  y: number;
  /** Look up (wall/ceiling items) or straight ahead. */
  lookY: number;
  /** Which way to face while interacting. */
  face: -1 | 0 | 1;
}

/** Screen rectangle for an item in a slot (its art fills it, on the dot grid). */
export function slotRect(g: RoomGeometry, slot: SlotId): Rect {
  if (slot === 'toy') return { left: 0, top: 0, width: 0, height: 0 };
  const r = SLOT_DOTS[slot];
  return { left: r.x * g.dot, top: r.y * g.dot, width: r.w * g.dot, height: r.h * g.dot };
}

export function itemAnchor(slot: SlotId, item: ItemId): ItemAnchor | null {
  switch (slot) {
    case 'rest':
      // Lying on top of the rest item, which stands on the bottom edge.
      return { x: 15 / LCD_DOTS, z: 0.02, y: (REST_DOTS[item] ?? 4) / LCD_DOTS, lookY: 0, face: 0 };
    case 'corner':
      // Close enough to the lamp to reach its pull chain.
      return { x: item === 'lamp' ? 0.7 : 0.66, z: 0.1, y: 0, lookY: item === 'lamp' ? -0.6 : 0, face: 1 };
    case 'wallLeft':
      return { x: 0.23, z: 0.3, y: 0, lookY: -1, face: 0 };
    case 'wallRight':
      return { x: 0.74, z: 0.3, y: 0, lookY: -1, face: 0 };
    case 'ceiling':
      return { x: 0.5, z: 0.3, y: 0, lookY: -1, face: 0 };
    default:
      return null;
  }
}

export const pointInRect = (x: number, y: number, r: Rect, pad = 0) =>
  x >= r.left - pad && x <= r.left + r.width + pad && y >= r.top - pad && y <= r.top + r.height + pad;
