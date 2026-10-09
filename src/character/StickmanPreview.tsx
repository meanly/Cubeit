import { memo, useMemo } from 'react';

import type { AccessoryId } from '../content/appearance';
import { Bitmap, INK } from '../lcd/bitmap';
import { LcdTile } from '../lcd/LcdArt';
import { accessoryCode, GRID, IDLE_INPUT, rasterStickman } from './pixel/stickman';

/** Static, standing stickman on a square of LCD panel, for option tiles and avatars. */
export const StickmanPreview = memo(function StickmanPreview({ accessory, size }: { accessory: AccessoryId; size: number }) {
  const bitmap = useMemo(() => {
    const { grid } = rasterStickman({ ...IDLE_INPUT, accessory: accessoryCode(accessory) });
    const b = new Bitmap(GRID, GRID);
    grid.forEach((v, i) => {
      if (v !== 0) b.set(i % GRID, Math.floor(i / GRID), INK);
    });
    return b;
  }, [accessory]);
  return <LcdTile bitmap={bitmap} size={size} />;
});
