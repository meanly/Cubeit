import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Bitmap } from '../lcd/bitmap';
import { LcdArt } from '../lcd/LcdArt';
import { projectX, projectY, WORLD, type RoomGeometry } from '../physics/geometry';
import { PhysicsEvent } from '../physics/types';
import type { World } from '../physics/World';

/** Impact lines fanning out from the wall/ceiling that was hit, and dust for hard landings. */
const WALL = ['#....', '.##..', '.....', '####.', '.....', '.##..', '#....'];
const ART = {
  left: new Bitmap(7, 9).sprite(WALL, 1, 1).outline(),
  right: new Bitmap(7, 9).sprite(WALL, 1, 1, true).outline(),
  top: new Bitmap(9, 6).sprite(['#..#..#', '.#.#.#.', '.#.#.#.', '...#...'], 1, 1).outline(),
  floor: new Bitmap(13, 4).sprite(['##.......##', '.#.......#.'], 1, 1).outline(),
};
type Kind = keyof typeof ART;

interface Fx {
  id: number;
  kind: Kind;
  /** Top-left, in dots. */
  x: number;
  y: number;
}

const SHOW_MS = 280;

/** Shows a short pixel "bonk" wherever the stickman hits the edges of the screen. */
export const BumpFx = memo(function BumpFx({ world, g }: { world: World; g: RoomGeometry }) {
  const [fx, setFx] = useState<Fx[]>([]);
  const next = useRef(0);
  const geo = useRef(g);
  useEffect(() => {
    geo.current = g;
  }, [g]);

  useEffect(
    () =>
      world.onPhysics((code, a, b) => {
        const gg = geo.current;
        const body = world.body.value;
        const col = projectX(gg, body.x, body.z) / gg.dot;
        const feet = projectY(gg, body.z, body.y) / gg.dot;
        const lying = body.fallen > 0;
        // Where the body meets the wall: the head/chest when standing, the side when lying.
        const mid = lying ? feet - 3 : feet - WORLD.charHeight * 60 * 0.75;
        let item: Omit<Fx, 'id'> | null = null;
        if (code === PhysicsEvent.Bump && b === 0) item = { kind: 'left', x: 0, y: mid - 4 };
        else if (code === PhysicsEvent.Bump && b === 1) item = { kind: 'right', x: 60 - 7, y: mid - 4 };
        else if (code === PhysicsEvent.Bump && b === 4) item = { kind: 'top', x: col - 4.5, y: 0 };
        else if (code === PhysicsEvent.Land && a > 1.4) item = { kind: 'floor', x: col - 6.5, y: feet - 3 };
        if (!item) return;
        const id = next.current++;
        const entry = { id, ...item, x: Math.round(item.x), y: Math.round(item.y) };
        setFx((list) => [...list.slice(-3), entry]);
        setTimeout(() => setFx((list) => list.filter((f) => f.id !== id)), SHOW_MS);
      }),
    [world],
  );

  return (
    <>
      {fx.map((f) => (
        <View key={f.id} pointerEvents="none" style={[styles.abs, { left: f.x * g.dot, top: f.y * g.dot }]}>
          <LcdArt bitmap={ART[f.kind]} dot={g.dot} />
        </View>
      ))}
    </>
  );
});

const styles = StyleSheet.create({ abs: { position: 'absolute' } });
