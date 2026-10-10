import { withSequence, withTiming } from 'react-native-reanimated';

import type { CharacterAction, ExpressionHint } from '../../conversation/types';
import { WORLD } from '../../physics/geometry';
import { PhysicsEvent, type PhysicsEventCode } from '../../physics/types';
import type { World } from '../../physics/World';
import type { WorldEvent } from '../../services/bus';
import { feedback } from '../../services/feedback';
import { useGame } from '../../state/gameStore';
import { useCharacterView } from '../../state/uiStore';
import { LINES, pick } from '../lines';
import { canBlink, EXPRESSIONS, POSES, type CharacterState, type EmoteId } from '../states';
import * as B from './behaviors';
import { Cancelled, Token } from './token';

export type BrainMode = 'free' | 'talk' | 'game' | 'visit';

export interface BrainEnv {
  world: World;
  rng(): number;
  now(): number;
  hour(): number;
  reduceMotion(): boolean;
}

/** Helpers handed to a running behavior; every wait rejects with Cancelled on interrupt. */
export interface Ctx {
  brain: Brain;
  token: Token;
  wait(ms: number): Promise<void>;
  waitRange(minMs: number, maxMs: number): Promise<void>;
  walkTo(x: number, z: number, speed?: number, zMax?: number): Promise<boolean>;
  /** Resolves when `signal` fires or after the timeout (false). */
  until(signal: Set<() => void>, timeoutMs: number): Promise<boolean>;
}

export interface Behavior {
  name: string;
  run(ctx: Ctx): Promise<void>;
}

const HINT_STATE: Record<ExpressionHint, CharacterState> = {
  happy: 'happy',
  excited: 'excited',
  love: 'love',
  thinking: 'thinking',
  sad: 'sad',
  surprised: 'surprised',
  curious: 'curious',
  sleepy: 'idle',
  calm: 'idle',
  celebrating: 'celebrating',
};

/**
 * The character's behavior brain. A loop picks weighted, mood-aware behaviors
 * (async scripts with natural pauses); events from touch, physics, chat and
 * games interrupt the current script with a reaction, after which normal
 * life resumes. All movement goes through world commands to the UI thread.
 */
export class Brain {
  mode: BrainMode = 'free';
  state: CharacterState = 'idle';
  lastBehavior = '';
  lastInitiateAt = 0;
  awakeUntil = 0;
  held = false;
  tiltActive = false;

  readonly signals = {
    released: new Set<() => void>(),
    landed: new Set<() => void>(),
    tiltEnded: new Set<() => void>(),
    modeChanged: new Set<() => void>(),
  };

  private token = new Token();
  private pending: Behavior | null = null;
  private running = false;
  private arrivals = new Map<number, () => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private tapTimes: number[] = [];
  private bumpTimes: number[] = [];
  private ignoreTapsUntil = 0;
  private ballHits = 0;

  constructor(readonly env: BrainEnv) {}

  get world(): World {
    return this.env.world;
  }

  // ───────────────────────── lifecycle ─────────────────────────

  start(): void {
    if (this.running) return;
    this.running = true;
    this.scheduleBlink();
    void this.loop();
  }

  stop(): void {
    this.running = false;
    this.token.cancel();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
  }

  setMode(mode: BrainMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    fire(this.signals.modeChanged);
    this.token.cancel();
  }

  /** Replace whatever is happening with `behavior`, then resume normal life. */
  interrupt(behavior: Behavior): void {
    this.pending = behavior;
    this.token.cancel();
  }

  private async loop(): Promise<void> {
    while (this.running) {
      this.token = new Token();
      const behavior = this.pending ?? B.choose(this);
      this.pending = null;
      this.lastBehavior = behavior.name;
      try {
        await behavior.run(this.makeCtx(this.token));
      } catch (error) {
        if (!(error instanceof Cancelled)) console.warn('[cubeit] behavior failed', behavior.name, error);
      }
      if (!this.running) break;
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  private makeCtx(token: Token): Ctx {
    const wait = (ms: number) =>
      new Promise<void>((resolve, reject) => {
        if (token.cancelled) return reject(new Cancelled());
        const t = setTimeout(() => {
          off();
          resolve();
        }, ms);
        const off = token.onCancel(() => {
          clearTimeout(t);
          reject(new Cancelled());
        });
      });
    return {
      brain: this,
      token,
      wait,
      waitRange: (lo, hi) => wait(lo + this.env.rng() * (hi - lo)),
      walkTo: (x, z, speed = 0.3, zMax) =>
        new Promise<boolean>((resolve, reject) => {
          if (token.cancelled) return reject(new Cancelled());
          const body = this.world.body.value;
          const dist = Math.hypot(x - body.x, z - body.z);
          const id = this.world.commands.walkTo(x, z, speed, zMax);
          const done = (arrived: boolean) => {
            clearTimeout(timeout);
            this.arrivals.delete(id);
            off();
            resolve(arrived);
          };
          // Generous: he eases in near the target and can be nudged by the ball on the way.
          const timeout = setTimeout(() => done(false), (dist / Math.max(0.05, speed)) * 3500 + 2000);
          this.arrivals.set(id, () => done(true));
          const off = token.onCancel(() => {
            clearTimeout(timeout);
            this.arrivals.delete(id);
            this.world.commands.stop();
            reject(new Cancelled());
          });
        }),
      until: (signal, timeoutMs) =>
        new Promise<boolean>((resolve, reject) => {
          if (token.cancelled) return reject(new Cancelled());
          const handler = () => finish(true);
          const finish = (ok: boolean) => {
            clearTimeout(t);
            signal.delete(handler);
            off();
            resolve(ok);
          };
          const t = setTimeout(() => finish(false), timeoutMs);
          signal.add(handler);
          const off = token.onCancel(() => {
            clearTimeout(t);
            signal.delete(handler);
            reject(new Cancelled());
          });
        }),
    };
  }

  // ───────────────────────── view helpers ─────────────────────────

  setState(state: CharacterState): void {
    this.state = state;
    useCharacterView.getState().setState(state);
    const pose = POSES[state];
    const d = { duration: this.env.reduceMotion() ? 140 : 280 };
    const p = this.world.pose;
    p.armL.set(withTiming(pose.armL, d));
    p.armR.set(withTiming(pose.armR, d));
    p.bounce.set(withTiming(pose.bounce, d));
    p.sway.set(withTiming(pose.sway, d));
    p.lower.set(withTiming(pose.lower, d));
    p.tilt.set(withTiming(pose.tilt, d));
    p.wave.set(withTiming(state === 'waving' ? 1 : 0, d));
    if (state !== 'lookingAround' && state !== 'thinking') this.look(0, 0);
    if (state === 'thinking') this.look(0.3, -0.6);
  }

  say(text: string, ms = 2600): void {
    const view = useCharacterView.getState();
    view.setSpeech(text.length > 70 ? `${text.slice(0, 67).trimEnd()}…` : text);
    const key = useCharacterView.getState().speech?.key;
    this.after(ms, () => {
      if (useCharacterView.getState().speech?.key === key) useCharacterView.getState().setSpeech(null);
    });
  }

  emote(id: EmoteId, ms = 1800): void {
    useCharacterView.getState().setEmote(id);
    const key = useCharacterView.getState().emote?.key;
    this.after(ms, () => {
      if (useCharacterView.getState().emote?.key === key) useCharacterView.getState().setEmote(null);
    });
  }

  look(x: number, y: number, duration = 320): void {
    this.world.pose.lookX.set(withTiming(x, { duration }));
    this.world.pose.lookY.set(withTiming(y, { duration }));
  }

  spin(): void {
    const p = this.world.pose;
    p.spin.set(0);
    p.spin.set(withTiming(1, { duration: this.env.reduceMotion() ? 300 : 900 }));
  }

  private after(ms: number, fn: () => void): void {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
  }

  private scheduleBlink(): void {
    this.after(2200 + this.env.rng() * 4200, () => {
      if (!this.running) return;
      if (canBlink(EXPRESSIONS[this.state].eyes)) {
        const close = withTiming(0.08, { duration: 70 });
        const open = withTiming(1, { duration: 120 });
        this.world.pose.blink.value =
          this.env.rng() < 0.2 ? withSequence(close, open, withTiming(0.08, { duration: 70 }), withTiming(1, { duration: 120 })) : withSequence(close, open);
      }
      this.scheduleBlink();
    });
  }

  // ───────────────────────── physics events ─────────────────────────

  onPhysics(code: PhysicsEventCode, a: number, b: number): void {
    switch (code) {
      case PhysicsEvent.Arrive: {
        this.arrivals.get(a)?.();
        return;
      }
      case PhysicsEvent.Land: {
        fire(this.signals.landed);
        feedback('land');
        if (!this.isFree()) return;
        if (a > 2.6) this.interrupt(B.reactDizzy(LINES.dizzy));
        return;
      }
      case PhysicsEvent.Bump: {
        feedback('bump');
        const now = this.env.now();
        this.bumpTimes = [...this.bumpTimes.filter((t) => now - t < 3000), now];
        if (!this.isFree() || this.held) return;
        if (this.bumpTimes.length >= 3 && this.state !== 'dizzy') {
          this.bumpTimes = [];
          useGame.getState().nudgeMood(-0.03, 0);
          this.interrupt(B.reactDizzy(LINES.dizzy));
        } else if (a > 0.9 && !this.tiltActive) {
          this.emote('exclaim', 900);
        }
        void b;
        return;
      }
      case PhysicsEvent.TiltStart: {
        // Tilted: he stops what he's doing and gets carried along (onto a wall if it's tilted far enough).
        const was = this.tiltActive;
        this.tiltActive = true;
        if (was || !this.isFree() || this.held) return;
        if (this.state === 'sleeping') return; // sleepers stay tucked in
        this.interrupt(B.slide);
        return;
      }
      case PhysicsEvent.TiltEnd: {
        this.tiltActive = false;
        fire(this.signals.tiltEnded);
        return;
      }
      case PhysicsEvent.MessUp: {
        // Shaken too hard: everything's knocked about, including him (and out of bed).
        feedback('bump');
        this.awakeUntil = this.env.now() + 120_000;
        useGame.getState().nudgeMood(-0.02, 0.02);
        if (this.isFree()) this.interrupt(B.reactDizzy(LINES.messy));
        return;
      }
      case PhysicsEvent.BallHit: {
        this.ballHits += 1;
        if (this.mode === 'free') feedback('hop');
        return;
      }
    }
  }

  takeBallHits(): number {
    const n = this.ballHits;
    this.ballHits = 0;
    return n;
  }

  private isFree(): boolean {
    return this.mode === 'free' || this.mode === 'talk';
  }

  // ───────────────────────── world events ─────────────────────────

  onEvent(event: WorldEvent): void {
    const game = useGame.getState();
    switch (event.type) {
      case 'characterTapped':
        return this.onTap();
      case 'characterPetted':
        if (!this.isFree()) return;
        game.bumpStat('pets');
        game.nudgeMood(0.06, 0);
        game.nudgePersonality('calm', 0.003);
        void B.grantXp('pet');
        return this.interrupt(B.reactLove);
      case 'characterHeld':
        this.held = event.held;
        if (event.held) {
          if (this.isFree()) this.interrupt(B.beingHeld);
        } else {
          fire(this.signals.released);
        }
        return;
      case 'floorTapped':
        if (this.mode !== 'free' || this.held) return;
        return this.interrupt(B.investigate(event.x, event.z));
      case 'ballTapped':
        if (this.mode !== 'free') return;
        return this.interrupt(B.chaseBall(4500, true));
      case 'itemTapped':
        if (this.mode !== 'free') {
          // Busy (talking, a game…): the lamp still switches, without the walk over.
          if (event.item === 'lamp') game.setLamp(!game.room.lampOn);
          return;
        }
        void B.grantXp('item');
        return this.interrupt(B.reactToItem(event.slot, event.item, true));
      case 'greet':
        if (this.mode !== 'free') return;
        return this.interrupt(B.greet(event.text));
      case 'levelUp':
        return this.interrupt(B.celebrate(`Friendship level ${event.level}!`));
      case 'plannerDone':
        if (!this.isFree() || this.held) return;
        if (event.kind === 'habit') return this.interrupt(B.celebrate(event.text));
        if (event.kind === 'journal') return this.interrupt(B.acknowledge(event.text));
        return this.interrupt(B.reactSurprise([event.text], 'happy'));
      case 'customizeApplied':
        if (this.mode !== 'free') return;
        return this.interrupt(B.reactSurprise(LINES.newLook, 'excited'));
      case 'unlocked':
        if (this.mode !== 'free') return;
        return this.interrupt(B.reactSurprise(LINES.unlocked, 'excited'));
      case 'chatTyping':
        if (this.mode === 'talk' && this.state !== 'listening' && this.state !== 'thinking') this.setState('listening');
        return;
      case 'chatThinking':
        if (this.mode !== 'talk') return;
        this.setState('thinking');
        this.emote('dots', 1400);
        return;
      case 'chatReply':
        if (this.mode !== 'talk') return;
        this.say(event.text, Math.min(7000, 2200 + event.text.length * 45));
        if (event.action) return this.interrupt(B.chatAction(event.action as CharacterAction));
        this.setState(HINT_STATE[event.expression]);
        if (event.expression === 'love') this.emote('heart');
        if (event.expression === 'sleepy') this.emote('zzz');
        if (event.expression === 'celebrating') this.emote('star');
        return;
      case 'gameEnded':
        this.setMode('free');
        if (event.quit) return;
        return this.interrupt(
          event.outcome === 'great'
            ? B.celebrate(pick(LINES.gameGreat))
            : event.outcome === 'good'
              ? B.reactSurprise(LINES.gameGood, 'happy')
              : B.reactSurprise(LINES.gameMeh, 'sad'),
        );
      default:
        return;
    }
  }

  private onTap(): void {
    if (!this.isFree() || this.held) return;
    const now = this.env.now();
    const game = useGame.getState();
    game.bumpStat('taps');
    void B.grantXp('tap');
    if (this.state === 'sleeping') {
      this.awakeUntil = now + 150_000;
      feedback('tap');
      return this.interrupt(B.wakeUp);
    }
    if (now < this.ignoreTapsUntil) {
      this.emote('swirl', 700);
      return;
    }
    this.tapTimes = [...this.tapTimes.filter((t) => now - t < 4000), now];
    const n = this.tapTimes.length;
    game.nudgeMood(0.02, 0);
    if (n >= 8) {
      this.tapTimes = [];
      this.ignoreTapsUntil = now + 3000;
      this.interrupt(B.reactSurprise(LINES.enough, 'dizzy'));
    } else if (n >= 4) {
      feedback('giggle');
      this.interrupt(B.reactTickle);
    } else {
      feedback('tap');
      this.interrupt(B.reactTap);
    }
  }
}

function fire(signal: Set<() => void>): void {
  [...signal].forEach((fn) => fn());
}

export const FRONT_CENTER = { x: 0.5, z: 0.12 } as const;
export const isOpenFloor = (z: number) => z <= WORLD.zMax;
