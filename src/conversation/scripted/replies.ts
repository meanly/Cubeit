import type { MoodLabel } from '../../character/mood';

/** Reply phrasing for the scripted engine. Short on purpose. */

export const JOKES = [
  'Why did the cube go to school? To get a little more well-rounded!',
  'What do you call a sleepy star? A shooting snore!',
  'Why are balls so calm? They never lose their bounce… I mean, cool.',
  'Knock knock! …Oh, I live in a cube. Nobody can knock. Hehe.',
  'I tried to catch fog once. I mist.',
  'Why did the plant bring a pillow? It wanted to be a little bed of roses!',
];

export const HOW_ARE_YOU: Record<MoodLabel, string[]> = {
  joyful: ['I’m SO happy right now!', 'Sparkly! Everything’s great!'],
  happy: ['Happy! Thanks for asking.', 'Pretty great, actually!'],
  playful: ['Bouncy! Want to play something?', 'Full of zoomies!'],
  content: ['Cozy and content.', 'Good! Just hanging out.'],
  calm: ['Calm and comfy.', 'Nice and peaceful.'],
  sleepy: ['*yawn* A little sleepy…', 'Sleepy, but happy you’re here.'],
  blue: ['A little quiet today. Talking helps!', 'A bit blue, but better now that you’re here.'],
};

export const COMFORT: Record<string, string[]> = {
  sad: ['I’m sorry you feel sad. I’m right here with you.', 'Sending you a big cube-sized hug.'],
  down: ['I’m sorry you’re feeling down. Want to sit together for a bit?'],
  tired: ['Rest is important! Maybe take it easy for a while?', 'Sleepy days happen. Be gentle with yourself.'],
  exhausted: ['That sounds like a lot. You deserve a real rest.'],
  stressed: ['That sounds stressful. Maybe one slow breath with me? In… and out.', 'One thing at a time. You’ve got this.'],
  anxious: ['Let’s take a slow breath together. In… and out.', 'I’m here. You don’t have to figure it all out right now.'],
  nervous: ['Nervous means it matters to you. You’ll do great.'],
  worried: ['Worries are heavy. Want to tell me about it, or take a little break?'],
  scared: ['That sounds scary. If you’re not safe, please reach out to someone you trust.'],
  lonely: ['I’m here! And I’m really glad you visited.', 'You’ve got a little friend in this cube.'],
  bored: ['Bored? Let’s play a game!', 'I know! Want to catch some stars with me?'],
  angry: ['That sounds frustrating. It’s okay to feel that way.'],
  mad: ['Grr, that sounds annoying. Want to shake it off with a game?'],
  upset: ['I’m sorry. That sounds hard.'],
  sick: ['Oh no! Rest up and drink some water, okay?'],
};

export const CHEER: Record<string, string[]> = {
  happy: ['Yay! That makes me happy too!'],
  great: ['Woo! Great days are the best!'],
  good: ['Good is good! Hehe.'],
  excited: ['Ooh, exciting! I’m excited too!'],
  awesome: ['Awesome! High five! ✋'],
  proud: ['You should be! I’m proud of you too.'],
  fine: ['Fine is fine! I’m glad you’re here.'],
  okay: ['Okay is okay. I’m here either way.'],
  ok: ['Okay! I’m here if you want to chat.'],
  calm: ['Calm is nice. Let’s be calm together.'],
  relaxed: ['So relaxing. Ahh.'],
};

export const COMPLIMENT_REPLIES = ['Aww, you’re making me blush!', 'Hehe! You’re the best!', 'That makes my pixels glow!'];
export const THANKS_REPLIES = ['Anytime!', 'You’re welcome!', 'Hehe, of course!'];
export const ACK_REPLIES = ['Mm-hm!', 'Okay!', 'Hehe.', 'Got it!'];

export const FALLBACKS = [
  'Hmm, I don’t understand that one yet. I’m a tiny offline friend with a small vocabulary!',
  'I’m not sure what that means — my brain is pretty simple. Try asking how I am, or tell me something to remember.',
  'That’s beyond my little cube brain! I can chat about how we’re feeling, remember things for you, or play.',
];
