import { findByKey, highlights, rememberedUserName, searchMemories } from '../../memory/recall';
import { checkSensitive } from '../../memory/sensitive';
import type { MemoryDraft } from '../../memory/types';
import type { CompanionReply, ConversationContext, ConversationEngine, EngineStatus } from '../types';
import { ACK_REPLIES, CHEER, COMFORT, COMPLIMENT_REPLIES, FALLBACKS, HOW_ARE_YOU, JOKES, THANKS_REPLIES } from './replies';

/**
 * Honest offline fallback: a small set of recognized intents with varied,
 * personality-flavored replies. It does not pretend to understand arbitrary
 * input — unknown messages get a clear "I don't understand that yet".
 */

type Rng = () => number;
const pick = <T>(items: readonly T[], rng: Rng): T => items[Math.floor(rng() * items.length)];

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Capitalize a name the user typed in lowercase. */
const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** "Remember that I like tea." → "I like tea" (kept in the user's own words). */
function cleanMemoryText(raw: string): string {
  return raw
    .trim()
    .replace(/^that\s+/i, '')
    .replace(/[.!?\s]+$/, '')
    .slice(0, 300);
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function flavor(text: string, ctx: ConversationContext, rng: Rng): string {
  // Playful characters get a little extra sparkle; sleepy ones yawn sometimes.
  if (ctx.mood === 'sleepy' && rng() < 0.3) return `*yawn* ${text}`;
  if (ctx.personality.playfulness > 0.65 && rng() < 0.3 && !text.endsWith('!')) return `${text.replace(/\.$/, '')}!`;
  return text;
}

function proposal(draft: MemoryDraft): CompanionReply['proposal'] {
  return { draft, sensitiveReasons: checkSensitive(draft.content).reasons };
}

export function scriptedReply(input: string, ctx: ConversationContext, rng: Rng = Math.random): CompanionReply {
  const raw = input.trim();
  const t = normalize(raw);
  const name = ctx.characterName;
  const userName = rememberedUserName(ctx.memories);
  const reply = (text: string, expression: CompanionReply['expression'], extra: Partial<CompanionReply> = {}): CompanionReply => ({
    text: flavor(text, ctx, rng),
    expression,
    understood: true,
    ...extra,
  });

  if (!t) return reply('…?', 'curious');

  // Safety first: never answer distress with a joke or a shrug.
  if (/\b(kill myself|suicid\w*|end my life|self ?harm|hurt myself|want to die|don'?t want to (?:live|be here))\b/.test(t)) {
    return reply(
      'I’m really glad you told me. I’m just a tiny offline friend, but you matter a lot. Please reach out to someone you trust, or a local crisis line or emergency number, right now.',
      'calm',
    );
  }

  // ── Recall (only from saved memories) ──
  if (/\b(what'?s|what is) my name\b|\bdo you know my name\b|\bwho am i\b/.test(t)) {
    const m = findByKey(ctx.memories, 'user.name');
    return m
      ? reply(`You’re ${m.value}! I remember.`, 'happy', { usedMemoryIds: [m.id] })
      : reply('I don’t know your name yet! You can tell me: “My name is…”', 'curious');
  }
  const favQ = t.match(/\b(?:what'?s|what is) my fav(?:ou?rite)? ([a-z ]{2,20})$/);
  if (favQ) {
    const thing = favQ[1].trim();
    const m = findByKey(ctx.memories, `favorite.${thing}`) ?? searchMemories(`favorite ${thing}`, ctx.memories, 1)[0]?.memory;
    return m
      ? reply(m.value ? `Your favorite ${thing} is ${m.value}!` : `You told me: “${m.content}”`, 'happy', { usedMemoryIds: [m.id] })
      : reply(`I don’t have your favorite ${thing} saved. Tell me and I can remember it!`, 'curious');
  }
  if (/\bwhat (?:do|did) you (?:remember|know)(?: about me)?\b|\bwhat have you remembered\b/.test(t)) {
    const top = highlights(ctx.memories, 3);
    if (top.length === 0) return reply('Nothing yet! If you want, ask me to remember something.', 'curious');
    return reply(`I remember: ${list(top.map((m) => `“${m.content}”`))}`, 'love', { usedMemoryIds: top.map((m) => m.id) });
  }
  const doYouRemember = t.match(/\b(?:do|did) you remember (.+)/);
  if (doYouRemember) {
    const hits = searchMemories(doYouRemember[1], ctx.memories, 2);
    if (hits.length === 0) return reply('Hmm, I don’t have a memory about that saved. Want me to remember something now?', 'thinking');
    return reply(`Yes! ${list(hits.map((h) => `“${h.memory.content}”`))}`, 'happy', { usedMemoryIds: hits.map((h) => h.memory.id) });
  }

  // ── Things to remember (always asks first) ──
  const rememberMatch = raw.match(/^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+)?(?:remember|don'?t forget|note down|keep in mind)\s+(?:that\s+)?(.{3,})/i);
  if (rememberMatch) {
    const content = cleanMemoryText(rememberMatch[1]);
    return reply('Want me to keep that as a memory?', 'curious', {
      proposal: proposal({ type: 'fact', content, tags: [], importance: 2, source: 'conversation', related: { kind: 'conversation' } }),
    });
  }
  const nameMatch = raw.match(/\b(?:my name is|call me|i'?m called)\s+([A-Za-z][\w'-]{0,23})/i);
  if (nameMatch) {
    const value = titleCase(nameMatch[1]);
    return reply(`Nice to meet you, ${value}! Should I remember your name?`, 'happy', {
      proposal: proposal({
        type: 'fact',
        content: `Your name is ${value}`,
        tags: ['name'],
        importance: 3,
        source: 'conversation',
        key: 'user.name',
        value,
      }),
    });
  }
  const favMatch = raw.match(/\bmy fav(?:ou?rite)\s+([a-z ]{2,20}?)\s+is\s+(.{1,60})/i);
  if (favMatch) {
    const thing = favMatch[1].trim().toLowerCase();
    const value = cleanMemoryText(favMatch[2]);
    return reply(`Ooh, ${value}! Want me to remember that?`, 'excited', {
      proposal: proposal({
        type: 'favorite',
        content: `Your favorite ${thing} is ${value}`,
        tags: [thing],
        importance: 2,
        source: 'conversation',
        key: `favorite.${thing}`,
        value,
      }),
    });
  }

  // ── Honesty about what I am ──
  if (/\b(are you (?:an? )?(?:ai|robot|real|alive|bot|chat ?gpt|chatbot|language model|llm|person|human)|what are you)\b/.test(t)) {
    return reply(
      `I’m ${name}, a little digital creature. Right now I talk with simple built-in replies — not a real AI model — so I only understand a few things.`,
      'calm',
    );
  }
  if (/\b(what can you do|what can i say|how does this work|help me|^help$|commands)\b/.test(t)) {
    return reply(
      'I can tell you how I feel, remember things you ask me to, and do tricks — try “dance”, “jump” or “come here”. Or let’s play a game!',
      'happy',
      { suggestion: { label: 'Play a game', panel: 'play' } },
    );
  }

  // ── Physical requests ──
  if (/\b(dance|dancing|boogie)\b/.test(t)) {
    return ctx.unlockedDance
      ? reply('Dance party!', 'excited', { action: 'dance' })
      : reply('I’m still learning to dance! Maybe when we’re better friends.', 'happy', { action: 'jump' });
  }
  if (/\b(jump|hop|bounce)\b/.test(t)) return reply('Boing boing!', 'excited', { action: 'jump' });
  if (/\b(spin|twirl|turn around)\b/.test(t)) return reply('Wheee!', 'happy', { action: 'twirl' });
  if (/\bwave\b/.test(t)) return reply('Hiii!', 'happy', { action: 'wave' });
  if (/\b(come here|come closer|come to me|over here)\b/.test(t)) return reply('Coming!', 'happy', { action: 'comeHere' });
  if (/\b(wake up)\b/.test(t)) return reply('I’m up, I’m up!', 'surprised', { action: 'wake' });
  if (/\b(play ball|fetch|get the ball|play with (?:the |your )?ball)\b/.test(t)) return reply('Ball time!', 'excited', { action: 'playBall' });
  if (/\b(go to sleep|go to bed|take a nap|nap time|sleep)\b/.test(t)) return reply('Okay… nap time.', 'sleepy', { action: 'sleep' });

  // ── Feelings ──
  const bad = t.match(
    /\bi(?:'m|m| am)?(?:\s+(?:feeling|feel))?\s+(?:so |really |very |a bit |a little |kind of |kinda |pretty )?(sad|down|tired|exhausted|stressed|anxious|nervous|lonely|bored|angry|mad|upset|sick|worried|scared)\b/,
  );
  if (bad) {
    const feeling = bad[1];
    return reply(pick(COMFORT[feeling] ?? COMFORT.sad, rng), feeling === 'bored' ? 'excited' : 'love', {
      suggestion: feeling === 'bored' || feeling === 'lonely' ? { label: 'Play together', panel: 'play' } : undefined,
    });
  }
  const good = t.match(/\bi(?:'m|m| am)?(?:\s+(?:feeling|feel))?\s+(?:so |really |very |pretty )?(happy|great|good|excited|awesome|fine|okay|ok|proud|calm|relaxed)\b/);
  if (good) return reply(pick(CHEER[good[1]] ?? CHEER.happy, rng), good[1] === 'calm' || good[1] === 'relaxed' ? 'calm' : 'celebrating');

  // ── Small talk ──
  if (/^(hi|hello|hey|hiya|heya|yo|howdy|sup|good (?:morning|afternoon|evening)|greetings)\b/.test(t)) {
    return reply(userName ? `Hi, ${userName}!` : pick(['Hi hi!', 'Hello!', 'Hey there!'], rng), 'happy', { action: rng() < 0.4 ? 'wave' : undefined });
  }
  if (/\bgood ?night\b/.test(t)) {
    const late = ctx.hour >= 21 || ctx.hour < 5;
    return reply(late ? 'Good night! Sweet dreams.' : 'Good night? It’s still early! But okay, sweet dreams.', 'sleepy', {
      action: late ? 'sleep' : undefined,
    });
  }
  if (/\b(bye|goodbye|see you|see ya|gotta go|later|cya)\b/.test(t)) return reply('Bye for now! I’ll be right here.', 'happy', { action: 'wave' });
  if (/\bhow (?:are|r) (?:you|u)\b|\bhow do you feel\b|\bhow'?s it going\b|\bhow are things\b|\byou ok(?:ay)?\b/.test(t)) {
    return reply(pick(HOW_ARE_YOU[ctx.mood], rng), ctx.mood === 'blue' ? 'sad' : ctx.mood === 'sleepy' ? 'sleepy' : 'happy');
  }
  if (/\bwhat (?:have you been|are you|were you|did you) (?:doing|up to)\b|\bwhat'?s up\b|\bwhat did you do\b/.test(t)) {
    const recent = ctx.activities.slice(-3).map((a) => a.text);
    if (recent.length === 0) return reply('Just hanging out in my room!', 'happy');
    return reply(`Earlier I ${list(recent)}.`, 'happy');
  }
  if (/\b(what'?s|what is) your name\b|\bwho are you\b/.test(t)) return reply(`I’m ${name}! I live in this little cube.`, 'happy');
  if (/\bhow old are you\b|\bwhen were you born\b|\byour birthday\b/.test(t)) {
    const d = ctx.daysTogether;
    return reply(d < 1 ? 'I just woke up today!' : `I woke up ${d} day${d === 1 ? '' : 's'} ago!`, 'happy');
  }
  if (/\b(what time is it|what'?s the time)\b/.test(t)) {
    const now = new Date();
    const h = now.getHours() % 12 || 12;
    return reply(`My clock says ${h}:${String(now.getMinutes()).padStart(2, '0')}!`, 'curious');
  }
  if (/\b(weather|news|stock|search|google|look up|internet)\b/.test(t)) {
    return reply('I can’t see outside my cube — there’s no internet in here! I only know what’s in our room.', 'calm');
  }
  if (/\b(you'?re|you are)\s+(?:so |really |very )?(cute|cool|awesome|great|the best|adorable|sweet|funny|smart|nice|lovely|amazing)\b|\b(i )?love you\b|\bbest friend\b|\bgood (job|boy|girl)\b/.test(t)) {
    return reply(pick(COMPLIMENT_REPLIES, rng), 'love');
  }
  if (/\b(thanks|thank you|thx|ty)\b/.test(t)) return reply(pick(THANKS_REPLIES, rng), 'happy');
  if (/\b(joke|make me laugh|something funny)\b/.test(t)) return reply(pick(JOKES, rng), 'excited');
  if (/\b(play|game|games)\b/.test(t)) return reply('Yes! Let’s play!', 'excited', { suggestion: { label: 'Open games', panel: 'play' } });
  if (/^(yes|yeah|yep|yup|no|nope|ok|okay|cool|nice|lol|haha|hehe|hmm|wow|oh)\b/.test(t)) return reply(pick(ACK_REPLIES, rng), 'happy');

  return { text: pick(FALLBACKS, rng), expression: 'thinking', understood: false };
}

export const scriptedEngine: ConversationEngine = {
  kind: 'scripted',
  label: 'Simple offline replies',
  status: async (): Promise<EngineStatus> => ({
    available: true,
    detail: 'Built-in replies that work offline. Understands greetings, feelings, requests to remember things, and a few tricks — not open conversation.',
  }),
  reply: async (input, context) => scriptedReply(input, context),
};
