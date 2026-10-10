import { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LcdArt } from '../lcd/LcdArt';
import type { RoomGeometry } from '../physics/geometry';
import { composeFx, FX_FRAME_MS, FX_FRAMES, useItemFx } from './itemFx';

/** Plays the furniture's pixel effects (`playItemFx`) over the room, a frame every 100 ms. */
export const ItemFx = memo(function ItemFx({ g, reduceMotion }: { g: RoomGeometry; reduceMotion: boolean }) {
  const fx = useItemFx((s) => s.fx);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (fx.length === 0) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      for (const f of fx) if (t - f.at >= FX_FRAMES[f.kind] * FX_FRAME_MS) useItemFx.getState().clear(f.id);
    }, FX_FRAME_MS);
    return () => clearInterval(id);
  }, [fx]);

  const bitmap = composeFx(fx, Math.max(now, ...fx.map((f) => f.at)), reduceMotion);
  if (!bitmap) return null;
  return (
    <View pointerEvents="none" style={styles.layer}>
      <LcdArt bitmap={bitmap} dot={g.dot} />
    </View>
  );
});

const styles = StyleSheet.create({ layer: { position: 'absolute', left: 0, top: 0 } });
