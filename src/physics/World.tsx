import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { useReduceMotion } from '../services/motion';
import { useGame } from '../state/gameStore';
import { makeGeometry, WORLD, type RoomGeometry } from './geometry';
import { stepBall, stepBody, stepTilt } from './simulation';
import {
  initialBall,
  initialBody,
  initialTilt,
  type BallState,
  type BodyState,
  type PhysicsEventCode,
  type PhysicsParams,
  type TiltState,
} from './types';

/** Animated pose channels the character rig reads (JS animates them with withTiming/withSpring). */
export interface PoseValues {
  armL: SharedValue<number>;
  armR: SharedValue<number>;
  bounce: SharedValue<number>;
  sway: SharedValue<number>;
  lower: SharedValue<number>;
  tilt: SharedValue<number>;
  wave: SharedValue<number>;
  blink: SharedValue<number>;
  lookX: SharedValue<number>;
  lookY: SharedValue<number>;
  spin: SharedValue<number>;
  visible: SharedValue<number>;
}

/** 0 free play · 1 steer (Star Catch) · 2 taps only (Peekaboo) · 3 no touch */
export type InteractionMode = 0 | 1 | 2 | 3;

export interface WorldCommands {
  walkTo(x: number, z: number, speed?: number, zMax?: number): number;
  stop(): void;
  hop(vy?: number): void;
  impulse(vx: number, vz: number, vy: number): void;
  anchor(x: number, z: number, y: number): void;
  unanchor(): void;
  chase(on: boolean, speed?: number): void;
  kickBall(vx: number, vz: number, vy: number): void;
  setBallPresent(present: boolean): void;
  teleport(x: number, z: number): void;
  freeze(on: boolean): void;
  resetZMax(): void;
}

export type PhysicsListener = (code: PhysicsEventCode, a: number, b: number) => void;

export interface World {
  geo: SharedValue<RoomGeometry>;
  body: SharedValue<BodyState>;
  ball: SharedValue<BallState>;
  tilt: SharedValue<TiltState>;
  params: SharedValue<PhysicsParams>;
  clock: SharedValue<number>;
  mode: SharedValue<InteractionMode>;
  pose: PoseValues;
  commands: WorldCommands;
  onPhysics(listener: PhysicsListener): () => void;
}

const WorldContext = createContext<World | null>(null);

export function useWorld(): World {
  const world = useContext(WorldContext);
  if (!world) throw new Error('useWorld must be used inside <WorldProvider>');
  return world;
}

/** A fresh set of pose channels (the main character's live in the World; visitors make their own). */
export function usePoseValues(visible = 1): PoseValues {
  return {
    armL: useSharedValue(0),
    armR: useSharedValue(0),
    bounce: useSharedValue(0),
    sway: useSharedValue(0),
    lower: useSharedValue(0),
    tilt: useSharedValue(0),
    wave: useSharedValue(0),
    blink: useSharedValue(1),
    lookX: useSharedValue(0),
    lookY: useSharedValue(0),
    spin: useSharedValue(0),
    visible: useSharedValue(visible),
  };
}

function clampN(v: number, lo: number, hi: number): number {
  'worklet';
  return Math.min(hi, Math.max(lo, v));
}

export function WorldProvider({ children }: { children: ReactNode }) {
  const start = useGame.getState().character.lastPosition;
  const geo = useSharedValue<RoomGeometry>(makeGeometry(360, 420));
  const body = useSharedValue<BodyState>(
    initialBody(clampN(start.x, WORLD.xMin, WORLD.xMax), clampN(start.z, WORLD.zMin, WORLD.zMax)),
  );
  const ball = useSharedValue<BallState>(initialBall());
  const tilt = useSharedValue<TiltState>(initialTilt());
  const clock = useSharedValue(0);
  const mode = useSharedValue<InteractionMode>(0);
  const params = useSharedValue<PhysicsParams>({
    tiltEnabled: 1,
    sensitivity: 1,
    calValid: 0,
    calX: 0,
    calY: 0,
    calZ: 0,
    reduceMotion: 0,
    speedBoost: 1,
  });
  const pose = usePoseValues();

  // Physics → JS event fan-out.
  const listeners = useRef(new Set<PhysicsListener>()).current;
  const dispatch = useRef((code: number, a: number, b: number) => {
    listeners.forEach((l) => l(code as PhysicsEventCode, a, b));
  }).current;

  const frame = useFrameCallback((info) => {
    'worklet';
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    const now = clock.value + dt;
    clock.value = now;
    const events: number[] = [];
    const p = params.value;
    tilt.modify((t) => {
      'worklet';
      stepTilt(t, p, dt, events);
      return t;
    });
    const t = tilt.value;
    const bl = ball.value;
    body.modify((b) => {
      'worklet';
      if (b.chase === 1 && bl.present === 1) {
        b.tx = bl.x;
        b.tz = clampN(bl.z, WORLD.zMin, WORLD.zMax);
      }
      stepBody(b, t, p, geo.value, dt, now, events);
      return b;
    });
    const bd = body.value;
    ball.modify((x) => {
      'worklet';
      stepBall(x, bd, t, dt, now, events);
      return x;
    });
    for (let i = 0; i < events.length; i += 3) {
      scheduleOnRN(dispatch, events[i], events[i + 1], events[i + 2]);
    }
  }, true);

  // Pause the simulation while the app is in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => frame.setActive(state === 'active'));
    return () => sub.remove();
  }, [frame]);

  // Keep physics parameters in sync with settings.
  const settings = useGame((s) => s.settings);
  const reduceMotion = useReduceMotion();
  useEffect(() => {
    const cal = settings.calibration;
    params.set({
      ...params.get(),
      tiltEnabled: settings.motionEnabled ? 1 : 0,
      sensitivity: settings.tiltSensitivity,
      calValid: cal ? 1 : 0,
      calX: cal?.x ?? 0,
      calY: cal?.y ?? 0,
      calZ: cal?.z ?? 0,
      reduceMotion: reduceMotion ? 1 : 0,
    });
  }, [settings.motionEnabled, settings.tiltSensitivity, settings.calibration, reduceMotion, params]);

  const cmdCounter = useRef(0);
  const world = useMemo<World>(() => {
    const commands: WorldCommands = {
      walkTo(x, z, speed = 0.3, zMax = WORLD.zMax) {
        cmdCounter.current += 1;
        const id = cmdCounter.current;
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            // Never shrink the limit below where the character stands (no snapping).
            b.zMax = Math.max(WORLD.zMax, Math.min(WORLD.zMaxInteract, Math.max(zMax, b.z)));
            b.tx = clampN(x, WORLD.xMin, WORLD.xMax);
            b.tz = clampN(z, WORLD.zMin, b.zMax);
            b.walkSpeed = speed;
            b.cmdId = id;
            b.hasTarget = 1;
            b.chase = 0;
            b.anchored = 0;
            return b;
          });
        });
        return id;
      },
      stop() {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.hasTarget = 0;
            b.chase = 0;
            return b;
          });
        });
      },
      hop(vy = 1.5) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            if (b.y < 0.02 && b.held === 0 && b.anchored === 0) {
              b.vy = vy;
              b.y = 0.001;
              b.squashV -= 2.5;
            }
            return b;
          });
        });
      },
      impulse(vx, vz, vy) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.vx += vx;
            b.vz += vz;
            if (vy > 0) {
              b.vy += vy;
              b.y = Math.max(b.y, 0.001);
            }
            return b;
          });
        });
      },
      anchor(x, z, y) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.anchored = 1;
            b.anchorX = x;
            b.anchorZ = z;
            b.anchorY = y;
            b.zMax = Math.max(b.zMax, z);
            b.hasTarget = 0;
            b.chase = 0;
            return b;
          });
        });
      },
      unanchor() {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            if (b.anchored === 1) {
              b.anchored = 0;
              b.vy = 0.9;
              b.y = Math.max(b.y, 0.001);
            }
            return b;
          });
        });
      },
      chase(on, speed = 0.55) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.chase = on ? 1 : 0;
            b.walkSpeed = speed;
            b.hasTarget = 0;
            b.anchored = 0;
            return b;
          });
        });
      },
      kickBall(vx, vz, vy) {
        scheduleOnUI(() => {
          'worklet';
          ball.modify((x) => {
            'worklet';
            x.vx += vx;
            x.vz += vz;
            x.vy += vy;
            x.y = Math.max(x.y, 0.001);
            return x;
          });
        });
      },
      setBallPresent(present) {
        scheduleOnUI(() => {
          'worklet';
          ball.modify((x) => {
            'worklet';
            x.present = present ? 1 : 0;
            return x;
          });
        });
      },
      teleport(x, z) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.x = clampN(x, WORLD.xMin, WORLD.xMax);
            b.z = clampN(z, WORLD.zMin, WORLD.zMax);
            b.y = 0;
            b.vx = 0;
            b.vz = 0;
            b.vy = 0;
            b.fallen = 0;
            b.rot = 0;
            b.rotV = 0;
            b.hasTarget = 0;
            b.chase = 0;
            b.anchored = 0;
            return b;
          });
        });
      },
      freeze(on) {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.frozen = on ? 1 : 0;
            if (on) {
              b.hasTarget = 0;
              b.chase = 0;
            }
            return b;
          });
        });
      },
      resetZMax() {
        scheduleOnUI(() => {
          'worklet';
          body.modify((b) => {
            'worklet';
            b.zMax = WORLD.zMax;
            return b;
          });
        });
      },
    };
    return {
      geo,
      body,
      ball,
      tilt,
      params,
      clock,
      mode,
      pose,
      commands,
      onPhysics(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    };
    // Shared values are stable for the provider's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <WorldContext.Provider value={world}>{children}</WorldContext.Provider>;
}
