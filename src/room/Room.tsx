import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';

import { CharacterOverlay } from '../character/CharacterOverlay';
import { CharacterRig } from '../character/CharacterRig';
import { GRID } from '../character/pixel/stickman';
import type { SlotId } from '../content/items';
import { LCD_PAPER } from '../lcd/bitmap';
import { LcdGlass } from '../lcd/LcdArt';
import { characterRect, makeGeometry, projectX, projectY, unprojectFloor, WORLD } from '../physics/geometry';
import { useWorld } from '../physics/World';
import { emit } from '../services/bus';
import { feedback } from '../services/feedback';
import { useReduceMotion } from '../services/motion';
import { useClockTime } from '../services/useClockTime';
import { useGame } from '../state/gameStore';
import { useCharacterView, useUi } from '../state/uiStore';
import { BallView } from './BallView';
import { BumpFx } from './BumpFx';
import { pointInRect, slotRect } from './items/placement';
import { LcdBackdrop, LcdNight } from './LcdScreen';
import { RoomItems } from './RoomItems';
import { useRoomGesture } from './useRoomGesture';
import { useGameSession } from '../games/session';

const BACK_SLOTS: readonly SlotId[] = ['wallLeft', 'wallRight', 'rug', 'rest', 'corner', 'ceiling'];
/** Tap priority: front-most first. */
const TAP_ORDER: readonly SlotId[] = ['ceiling', 'corner', 'rest', 'wallRight', 'wallLeft'];

interface Props {
  width: number;
  height: number;
  /** Extra layers drawn in the room above the character (games, visitors). */
  children?: ReactNode;
  /** Drawn above the room but outside its touch handling (game HUD), so its buttons always work. */
  overlay?: ReactNode;
}

/** The room as a flat 60×60 dot LCD: wallpaper, furniture, ball and the character. */
export function Room({ width, height, children, overlay }: Props) {
  const world = useWorld();
  const g = useMemo(() => makeGeometry(width, height), [width, height]);
  useEffect(() => {
    world.geo.set(g);
  }, [g, world.geo]);

  const savedRoom = useGame((s) => s.room);
  const savedLook = useGame((s) => s.character.appearance);
  const finds = useGame((s) => s.progress.finds);
  const draft = useUi((s) => s.draft);
  const activeGame = useUi((s) => s.activeGame);
  const room = draft?.room ?? savedRoom;
  const look = draft?.appearance ?? savedLook;
  const state = useCharacterView((s) => s.state);
  const reduceMotion = useReduceMotion();
  const { hour, minute } = useClockTime();

  const pokes = {
    rest: useSharedValue(0),
    corner: useSharedValue(0),
    wallLeft: useSharedValue(0),
    wallRight: useSharedValue(0),
    rug: useSharedValue(0),
    ceiling: useSharedValue(0),
    toy: useSharedValue(0),
  } satisfies Record<SlotId, unknown>;

  useEffect(() => {
    world.commands.setBallPresent(room.items.toy === 'ball');
  }, [room.items.toy, world.commands]);

  const onTap = useCallback(
    (x: number, y: number) => {
      // A running game (Peekaboo) may claim taps first.
      if (useGameSession.getState().tapHandler?.(x, y)) return;
      if (world.mode.value !== 0) return;
      const b = world.body.value;
      const r = characterRect(g, b.x, b.z, b.y);
      if (x >= r.left - 10 && x <= r.left + r.width + 10 && y >= r.top - 10 && y <= r.bottom + 10) {
        emit({ type: 'characterTapped' });
        return;
      }
      const ball = world.ball.value;
      if (ball.present === 1) {
        const bx = projectX(g, ball.x, ball.z);
        const by = projectY(g, ball.z, ball.y + WORLD.ballR);
        if (Math.hypot(x - bx, y - by) < WORLD.ballR * g.unit + 16) {
          const dir = Math.sign(ball.x - 0.5) || 1;
          world.commands.kickBall(-dir * (0.6 + Math.random() * 0.6), (Math.random() - 0.4) * 0.8, 1.4);
          feedback('bump');
          emit({ type: 'ballTapped' });
          return;
        }
      }
      const roomNow = useUi.getState().draft?.room ?? useGame.getState().room;
      for (const slot of TAP_ORDER) {
        const item = roomNow.items[slot];
        if (!item) continue;
        if (pointInRect(x, y, slotRect(g, slot), 4)) {
          pokes[slot].set((v) => v + 1);
          if (item === 'lamp') useGame.getState().setLamp(!roomNow.lampOn);
          feedback('tap');
          emit({ type: 'itemTapped', slot, item });
          return;
        }
      }
      const p = unprojectFloor(g, x, y);
      if (p.x >= 0 && p.x <= 1 && p.z >= 0 && p.z <= 1) emit({ type: 'floorTapped', x: p.x, z: p.z });
    },
    // pokes are stable shared values
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g, world],
  );

  const onTapRef = useRef(onTap);
  useLayoutEffect(() => {
    onTapRef.current = onTap;
  }, [onTap]);
  const handlers = useMemo(
    () => ({
      onTap: (x: number, y: number) => onTapRef.current(x, y),
      onPet: () => emit({ type: 'characterPetted' }),
      onHeld: (held: boolean) => emit({ type: 'characterHeld', held }),
    }),
    [],
  );
  const gesture = useRoomGesture(world, handlers, activeGame === 'starCatch');

  const spriteSize = GRID * g.dot;

  return (
    <View style={[styles.room, { width, height }]}>
      <GestureDetector gesture={gesture}>
        <View style={[StyleSheet.absoluteFill, styles.screen, { borderRadius: g.dot * 1.5 }]} collapsable={false}>
          <LcdBackdrop g={g} theme={room.theme} />
          <RoomItems
            g={g}
            room={room}
            slots={BACK_SLOTS}
            hour={hour}
            minute={minute}
            finds={finds}
            pokes={pokes}
            reduceMotion={reduceMotion}
            tilt={world.tilt}
            mess={world.mess}
          />
          <BallView ball={world.ball} body={world.body} geo={world.geo} dot={g.dot} layer="behind" />
          <CharacterRig
            body={world.body}
            pose={world.pose}
            clock={world.clock}
            geo={world.geo}
            size={spriteSize}
            accessory={look.accessory}
            state={state}
            reduceMotion={reduceMotion}
          />
          <BallView ball={world.ball} body={world.body} geo={world.geo} dot={g.dot} layer="front" />
          <BumpFx world={world} g={g} />
          {children}
          <LcdNight hour={hour} lampLit={room.lampOn && room.items.corner === 'lamp'} />
          <LcdGlass size={width} />
          {/* Speech and emotes sit above the glass so they stay crisp and readable. */}
          <CharacterOverlay body={world.body} geo={world.geo} visible={world.pose.visible} dot={g.dot} reduceMotion={reduceMotion} />
        </View>
      </GestureDetector>
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { position: 'relative' },
  screen: { overflow: 'hidden', backgroundColor: LCD_PAPER },
});
