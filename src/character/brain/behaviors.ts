import { itemById, type ItemId, type SlotId } from '../../content/items';
import type { CharacterAction } from '../../conversation/types';
import { rememberedUserName } from '../../memory/recall';
import { WORLD } from '../../physics/geometry';
import { bondLevel, idleUnlocked } from '../../progression/progression';
import { itemAnchor } from '../../room/items/placement';
import { skyPhase } from '../../room/items/pixelArt';
import type { ActivityKind } from '../../state/schema';
import { useGame } from '../../state/gameStore';
import { useMemories } from '../../state/memoryStore';
import { clockLine, LINES, pick } from '../lines';
import type { CharacterState } from '../states';
import type { Behavior, Brain, Ctx } from './Brain';

export { grantXp } from '../../progression/rewards';

const FRONT = { x: 0.5, z: 0.12 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const behavior = (name: string, run: (ctx: Ctx) => Promise<void>): Behavior => ({ name, run });

function activity() {
  const level = useGame.getState().settings.activityLevel;
  return {
    idle: level === 'calm' ? 1.6 : level === 'lively' ? 0.6 : 1,
    move: level === 'calm' ? 0.6 : level === 'lively' ? 1.45 : 1,
  };
}

/** Log a real activity for "what have you been up to?" — deduplicated so it doesn't spam. */
function logOnce(kind: ActivityKind, text: string): void {
  const { progress, logActivity } = useGame.getState();
  const recent = [...progress.activities].reverse().find((a) => a.text === text);
  if (recent && Date.now() - recent.at < 30 * 60_000) return;
  logActivity(kind, text);
}

function isNight(brain: Brain): boolean {
  const h = brain.env.hour();
  return h >= 22 || h < 7;
}

// ───────────────────────── autonomous life ─────────────────────────

const idle = behavior('idle', async (ctx) => {
  const { brain } = ctx;
  brain.setState('idle');
  const a = activity();
  await ctx.waitRange(2500 * a.idle, 7000 * a.idle);
  if (brain.env.rng() < 0.4) {
    brain.look(brain.env.rng() < 0.5 ? -0.7 : 0.7, brain.env.rng() < 0.3 ? -0.4 : 0);
    await ctx.waitRange(700, 1400);
    brain.look(0, 0);
    await ctx.waitRange(500, 1500);
  }
});

const wander = behavior('wander', async (ctx) => {
  const { brain } = ctx;
  const body = brain.world.body.value;
  let x = 0.5;
  let z = 0.3;
  for (let i = 0; i < 6; i++) {
    x = 0.15 + brain.env.rng() * 0.7;
    z = 0.08 + brain.env.rng() * 0.55;
    if (Math.hypot(x - body.x, z - body.z) > 0.22) break;
  }
  brain.setState('walking');
  const energy = useGame.getState().mood.energy;
  await ctx.walkTo(x, z, 0.22 + energy * 0.14);
  brain.setState('idle');
  await ctx.waitRange(500, 1600);
});

const lookAround = behavior('lookAround', async (ctx) => {
  const { brain } = ctx;
  brain.setState('lookingAround');
  brain.look(-0.8, 0, 380);
  await ctx.waitRange(700, 1000);
  brain.look(0.8, 0, 480);
  await ctx.waitRange(800, 1100);
  if (brain.env.rng() < 0.5) {
    brain.look(0, -0.8);
    await ctx.wait(700);
  }
  brain.look(0, 0);
  brain.setState('idle');
  await ctx.wait(500);
});

const visitRandomItem = behavior('visitItem', async (ctx) => {
  const { room } = useGame.getState();
  const slots = (['corner', 'wallLeft', 'wallRight', 'ceiling'] as SlotId[]).filter((s) => room.items[s]);
  if (slots.length === 0) return idle.run(ctx);
  const slot = pick(slots, ctx.brain.env.rng);
  return reactToItem(slot, room.items[slot]!, false).run(ctx);
});

export const nap = behavior('nap', async (ctx) => {
  const { brain } = ctx;
  const { room } = useGame.getState();
  const rest = room.items.rest ?? 'cushion';
  const anchor = itemAnchor('rest', rest)!;
  brain.setState('walking');
  await ctx.walkTo(anchor.x, anchor.z - 0.03, 0.22, WORLD.zMaxInteract);
  brain.world.commands.anchor(anchor.x, anchor.z, anchor.y);
  brain.setState('sleeping');
  logOnce('nap', `took a nap on my ${itemById(rest)?.name.toLowerCase() ?? 'cushion'}`);
  const night = isNight(brain) && useGame.getState().settings.nightSleep;
  const total = night ? 150_000 + brain.env.rng() * 150_000 : 25_000 + brain.env.rng() * 35_000;
  try {
    for (let slept = 0; slept < total; slept += 6000) {
      brain.emote('zzz', 3500);
      useGame.getState().nudgeMood(0, 0.025);
      await ctx.wait(6000);
    }
  } finally {
    brain.world.commands.unanchor();
  }
  brain.setState('happy');
  await ctx.wait(900);
  brain.setState('idle');
});

export function chaseBall(ms: number, excited: boolean): Behavior {
  return behavior('playBall', async (ctx) => {
    const { brain } = ctx;
    if (brain.world.ball.value.present !== 1) return idle.run(ctx);
    brain.setState('excited');
    if (excited || brain.env.rng() < 0.4) brain.say(pick(LINES.ball), 1400);
    brain.takeBallHits();
    brain.world.commands.chase(true, 0.5);
    try {
      await ctx.wait(ms);
    } finally {
      brain.world.commands.chase(false);
    }
    const hits = brain.takeBallHits();
    brain.setState('happy');
    if (hits >= 2) logOnce('play', 'played with my ball');
    useGame.getState().nudgeMood(0.05, -0.04);
    await ctx.wait(900);
  });
}

const playBall = behavior('playBall', (ctx) => chaseBall(5000 + ctx.brain.env.rng() * 5000, false).run(ctx));

const dance = behavior('dance', async (ctx) => {
  const { brain } = ctx;
  brain.setState('walking');
  await ctx.walkTo(0.35 + brain.env.rng() * 0.3, 0.25 + brain.env.rng() * 0.2, 0.3);
  brain.setState('dancing');
  brain.emote('note', 3000);
  await ctx.waitRange(3500, 5500);
  brain.setState('happy');
  logOnce('dance', 'did a little dance');
  useGame.getState().nudgeMood(0.04, -0.03);
  await ctx.wait(700);
});

const twirl = behavior('twirl', async (ctx) => {
  const { brain } = ctx;
  brain.setState('happy');
  brain.world.commands.hop(1.2);
  brain.spin();
  await ctx.wait(1200);
  brain.setState('idle');
  await ctx.wait(600);
});

const hum = behavior('hum', async (ctx) => {
  const { brain } = ctx;
  brain.setState('listening');
  brain.look(0, -0.4);
  brain.emote('note', 3200);
  await ctx.waitRange(3000, 4000);
  brain.look(0, 0);
  brain.setState('idle');
});

/** Occasionally comes to say hi — gently, without asking for anything. */
const initiate = behavior('initiate', async (ctx) => {
  const { brain } = ctx;
  brain.lastInitiateAt = brain.env.now();
  brain.setState('walking');
  await ctx.walkTo(FRONT.x, FRONT.z, 0.3);
  brain.setState('waving');
  brain.say(memoryAwareHello(brain.env.rng) ?? pick(LINES.initiate), 3000);
  await ctx.wait(2600);
  brain.setState('happy');
  await ctx.wait(800);
});

/** Uses a saved memory only if one exists — never invents shared history. */
function memoryAwareHello(rng: () => number): string | null {
  if (rng() > 0.4) return null;
  const memories = useMemories.getState().items;
  const name = rememberedUserName(memories);
  const favorites = memories.filter((m) => m.type === 'favorite' && m.value);
  if (favorites.length > 0 && rng() < 0.5) {
    const fav = pick(favorites, rng);
    const what = fav.key?.replace('favorite.', '') ?? 'thing';
    return `I was thinking about ${fav.value} — your favorite ${what}!`;
  }
  return name ? `Hi, ${name}!` : null;
}

const suspended = behavior('suspended', async (ctx) => {
  // Games and visits drive the character directly; the brain just waits.
  for (;;) await ctx.until(ctx.brain.signals.modeChanged, 600_000);
});

const talkIdle = behavior('talkIdle', async (ctx) => {
  const { brain } = ctx;
  const body = brain.world.body.value;
  if (Math.hypot(body.x - FRONT.x, body.z - 0.16) > 0.08) {
    brain.setState('walking');
    await ctx.walkTo(FRONT.x, 0.16, 0.34);
  }
  if (brain.state !== 'thinking') brain.setState('listening');
  for (;;) {
    await ctx.waitRange(3000, 6000);
    if (brain.state === 'listening' || brain.state === 'idle') {
      brain.look((brain.env.rng() - 0.5) * 0.6, 0);
      await ctx.wait(900);
      brain.look(0, 0);
    }
  }
});

/** Weighted, mood- and personality-aware choice of what to do next. */
export function choose(brain: Brain): Behavior {
  if (brain.mode === 'game' || brain.mode === 'visit') return suspended;
  if (brain.mode === 'talk') return talkIdle;

  const { character, mood, settings, room, progress } = useGame.getState();
  const p = character.personality;
  const a = activity();
  const level = bondLevel(progress.bondXp);
  const now = brain.env.now();
  const night = settings.nightSleep && isNight(brain) && now > brain.awakeUntil;
  const hasBall = room.items.toy === 'ball';
  const sleepy = night ? 40 : mood.energy < 0.28 ? 3 : mood.energy < 0.45 ? 0.6 : 0.08;

  const options: [number, Behavior][] = [
    [3 * (0.6 + p.calm) * a.idle, idle],
    [2.2 * a.move * (0.6 + p.playfulness * 0.6) * (0.5 + mood.energy), wander],
    [1.3 * (0.5 + p.curiosity), lookAround],
    [1.5 * (0.4 + p.curiosity) * a.move, visitRandomItem],
    [hasBall ? 1.6 * a.move * (0.3 + p.playfulness) * mood.energy : 0, playBall],
    [idleUnlocked('dance', level) ? 0.7 * (0.4 + p.playfulness) * (0.6 + mood.valence) : 0, dance],
    [idleUnlocked('twirl', level) ? 0.45 : 0, twirl],
    [idleUnlocked('hum', level) ? 0.45 * (0.5 + p.calm) : 0, hum],
    [now - brain.lastInitiateAt > 180_000 && !night ? 0.5 : 0, initiate],
    [sleepy, nap],
  ];
  // Avoid doing the exact same non-idle thing twice in a row.
  const weighted = options.map(([w, b]) => [b.name === brain.lastBehavior && b !== idle && b !== nap ? w * 0.3 : w, b] as const);
  const total = weighted.reduce((sum, [w]) => sum + Math.max(0, w), 0);
  let r = brain.env.rng() * total;
  for (const [w, b] of weighted) {
    r -= Math.max(0, w);
    if (r <= 0) return b;
  }
  return idle;
}

// ───────────────────────── reactions ─────────────────────────

export const reactTap = behavior('reactTap', async (ctx) => {
  const { brain } = ctx;
  brain.world.commands.stop();
  brain.setState('happy');
  brain.world.commands.hop(1.15);
  if (brain.env.rng() < 0.5) brain.say(pick(LINES.tapHi), 1300);
  await ctx.wait(1000);
  brain.setState('idle');
  await ctx.wait(400);
});

export const reactTickle = behavior('reactTickle', async (ctx) => {
  const { brain } = ctx;
  brain.world.commands.stop();
  brain.setState('excited');
  brain.emote('sparkle', 1200);
  if (brain.env.rng() < 0.6) brain.say(pick(LINES.tickle), 1300);
  brain.world.commands.hop(1.45);
  await ctx.wait(1200);
  brain.setState('happy');
  await ctx.wait(500);
});

export const reactLove = behavior('reactLove', async (ctx) => {
  const { brain } = ctx;
  brain.world.commands.stop();
  brain.setState('love');
  brain.emote('heart', 2000);
  await ctx.wait(2300);
  brain.setState('happy');
  await ctx.wait(600);
});

export const wakeUp = behavior('wakeUp', async (ctx) => {
  const { brain } = ctx;
  brain.world.commands.unanchor();
  brain.setState('surprised');
  brain.emote('exclaim', 800);
  await ctx.wait(600);
  brain.setState('idle');
  brain.say(pick(LINES.wake), 2000);
  await ctx.wait(1800);
});

export const beingHeld = behavior('beingHeld', async (ctx) => {
  const { brain } = ctx;
  brain.setState('held');
  brain.emote('exclaim', 800);
  await ctx.until(brain.signals.released, 20_000);
  brain.setState('surprised');
  await ctx.until(brain.signals.landed, 1500);
  brain.setState('happy');
  if (brain.env.rng() < 0.45) brain.say(pick(LINES.dropped), 1200);
  await ctx.wait(900);
});

export function reactDizzy(lines: readonly string[]): Behavior {
  return behavior('dizzy', async (ctx) => {
    const { brain } = ctx;
    brain.world.commands.stop();
    brain.setState('dizzy');
    brain.emote('swirl', 1700);
    brain.say(pick(lines), 1800);
    await ctx.wait(1900);
    brain.setState('idle');
    await ctx.wait(400);
  });
}

/** After the device's reset button: everything is back in place and he starts afresh. */
export const rebooted = behavior('rebooted', async (ctx) => {
  const { brain } = ctx;
  brain.world.commands.stop();
  brain.setState('surprised');
  await ctx.wait(900);
  brain.setState('idle');
  if (brain.env.rng() < 0.7) brain.say(pick(LINES.rebooted), 1600);
  await ctx.wait(1200);
});

export const slide = behavior('slide', async (ctx) => {
  const { brain } = ctx;
  const { character, mood } = useGame.getState();
  const thrillSeeker = character.personality.playfulness > 0.55 || mood.valence > 0.5;
  brain.world.commands.stop();
  brain.setState(thrillSeeker ? 'excited' : 'sliding');
  brain.say(pick(thrillSeeker ? LINES.wheee : LINES.whoa), 1400);
  let rides = 0;
  while (brain.tiltActive && rides < 20) {
    await ctx.until(brain.signals.tiltEnded, 3000);
    rides += 1;
  }
  useGame.getState().nudgeMood(thrillSeeker ? 0.04 : -0.01, -0.01);
  brain.setState(thrillSeeker ? 'happy' : 'idle');
  if (brain.env.rng() < 0.5) brain.say(pick(LINES.afterRide), 1400);
  await ctx.wait(900);
});

export function investigate(x: number, z: number): Behavior {
  return behavior('investigate', async (ctx) => {
    const { brain } = ctx;
    brain.setState('curious');
    brain.emote('question', 1200);
    if (brain.env.rng() < 0.4) brain.say(pick(LINES.floorSpot), 1200);
    brain.setState('walking');
    await ctx.walkTo(x, clamp(z, WORLD.zMin, WORLD.zMax), 0.36);
    brain.setState('curious');
    brain.look(0, 0.8);
    await ctx.wait(900);
    brain.look(0, 0);
    brain.setState('happy');
    brain.emote('sparkle', 1100);
    if (brain.env.rng() < 0.3) brain.say(pick(LINES.floorFound), 1300);
    await ctx.wait(900);
  });
}

export function greet(text: string): Behavior {
  return behavior('greet', async (ctx) => {
    const { brain } = ctx;
    brain.world.commands.unanchor();
    brain.setState('walking');
    await ctx.walkTo(FRONT.x, FRONT.z, 0.34);
    brain.setState('waving');
    brain.say(text, 3600);
    await ctx.wait(3000);
    brain.setState('happy');
    await ctx.wait(700);
  });
}

export function celebrate(text: string): Behavior {
  return behavior('celebrate', async (ctx) => {
    const { brain } = ctx;
    brain.world.commands.stop();
    brain.world.commands.unanchor();
    brain.setState('celebrating');
    brain.emote('star', 2200);
    brain.say(text, 2600);
    brain.world.commands.hop(1.6);
    await ctx.wait(800);
    brain.world.commands.hop(1.6);
    await ctx.wait(1000);
    brain.setState('happy');
    await ctx.wait(500);
  });
}

export function reactSurprise(lines: readonly string[], state: CharacterState): Behavior {
  return behavior('reactSurprise', async (ctx) => {
    const { brain } = ctx;
    brain.world.commands.stop();
    brain.setState(state);
    brain.say(pick(lines), 1800);
    if (state === 'excited') brain.world.commands.hop(1.3);
    await ctx.wait(1800);
    brain.setState('idle');
    await ctx.wait(300);
  });
}

/** Walk over to a piece of furniture and use it. */
export function reactToItem(slot: SlotId, item: ItemId, userInitiated: boolean): Behavior {
  return behavior('visitItem', async (ctx) => {
    const { brain } = ctx;
    const def = itemById(item);
    const anchor = itemAnchor(slot, item);
    if (!def || !anchor) return;
    const game = useGame.getState();

    if (def.interaction === 'play') return chaseBall(4000, true).run(ctx);

    if (def.interaction === 'toggleLight' && userInitiated) {
      // The tap already flipped the lamp; the character just notices.
      brain.world.commands.stop();
      brain.setState('curious');
      brain.look(0.8, -0.3);
      brain.say(pick(useGame.getState().room.lampOn ? LINES.lampOn : LINES.lampOff), 1600);
      await ctx.wait(1500);
      brain.look(0, 0);
      brain.setState('idle');
      return;
    }

    if (def.interaction === 'rest') {
      if (!userInitiated && game.mood.energy < 0.45) return nap.run(ctx);
      brain.setState('walking');
      await ctx.walkTo(anchor.x, anchor.z - 0.03, 0.3, WORLD.zMaxInteract);
      brain.world.commands.anchor(anchor.x, anchor.z, anchor.y);
      brain.setState('happy');
      try {
        await ctx.wait(2500);
      } finally {
        brain.world.commands.unanchor();
      }
      return;
    }

    brain.setState('walking');
    await ctx.walkTo(anchor.x, anchor.z, 0.3, WORLD.zMaxInteract);
    brain.look(anchor.face * 0.5, anchor.lookY);
    const night = skyPhase(brain.env.hour()) === 'night';
    const level = bondLevel(game.progress.bondXp);

    switch (def.interaction) {
      case 'toggleLight':
        if (night && !game.room.lampOn) {
          game.setLamp(true);
          brain.setState('happy');
          brain.say(pick(LINES.lampOn), 1600);
        } else {
          brain.setState('interacting');
        }
        await ctx.wait(1600);
        break;
      case 'sniff':
        brain.setState('interacting');
        brain.emote('sparkle', 1500);
        if (brain.env.rng() < 0.4) brain.say(pick(LINES.plant), 1500);
        await ctx.wait(2400);
        logOnce('item', 'sniffed my little sprout');
        break;
      case 'read':
        brain.setState('thinking');
        brain.emote('book', 3500);
        await ctx.waitRange(3800, 5500);
        if (brain.env.rng() < 0.4) brain.say(pick(LINES.book), 1500);
        logOnce('item', 'read a book from my shelf');
        break;
      case 'lookOut':
        if (night && idleUnlocked('stargaze', level)) {
          brain.setState('love');
          brain.emote('star', 2500);
          brain.say(pick(LINES.stars), 2000);
          logOnce('item', 'watched the stars from my window');
        } else {
          brain.setState('curious');
          if (brain.env.rng() < 0.35) brain.say(pick(LINES.window), 1500);
          logOnce('item', 'looked out the window');
        }
        await ctx.wait(2800);
        break;
      case 'admire':
        brain.setState(item === 'photoFrame' ? 'love' : 'curious');
        brain.emote(item === 'photoFrame' ? 'heart' : 'sparkle', 1800);
        if (item === 'photoFrame') brain.say(pick(LINES.frame), 1500);
        await ctx.wait(2200);
        break;
      case 'checkTime': {
        const d = new Date();
        brain.setState('curious');
        brain.say(clockLine(d.getHours(), d.getMinutes()), 1800);
        await ctx.wait(2200);
        break;
      }
      case 'showFinds':
        brain.setState('happy');
        brain.emote('sparkle', 1500);
        brain.say(pick(LINES.finds), 1500);
        await ctx.wait(2200);
        break;
      case 'swing':
      case 'twinkle':
        brain.setState('curious');
        await ctx.wait(900);
        brain.setState('happy');
        brain.emote('sparkle', 1200);
        await ctx.wait(1200);
        break;
      default:
        brain.setState('interacting');
        await ctx.wait(1500);
    }
    brain.look(0, 0);
    brain.setState('idle');
    await ctx.wait(500);
  });
}

/** Physical actions requested in conversation ("can you dance?"). */
export function chatAction(action: CharacterAction): Behavior {
  return behavior(`chat:${action}`, async (ctx) => {
    const { brain } = ctx;
    switch (action) {
      case 'dance':
        brain.setState('dancing');
        brain.emote('note', 3000);
        await ctx.wait(3500);
        break;
      case 'jump':
        brain.setState('excited');
        brain.world.commands.hop(1.6);
        await ctx.wait(800);
        brain.world.commands.hop(1.6);
        await ctx.wait(900);
        break;
      case 'twirl':
        brain.setState('happy');
        brain.world.commands.hop(1.2);
        brain.spin();
        await ctx.wait(1200);
        break;
      case 'wave':
        brain.setState('waving');
        await ctx.wait(2200);
        break;
      case 'comeHere':
        brain.setState('walking');
        await ctx.walkTo(FRONT.x, 0.08, 0.36);
        brain.setState('happy');
        await ctx.wait(800);
        break;
      case 'playBall':
        return chaseBall(5000, true).run(ctx);
      case 'sleep':
        return nap.run(ctx);
      case 'wake':
        return wakeUp.run(ctx);
    }
    brain.setState('happy');
    await ctx.wait(500);
  });
}
