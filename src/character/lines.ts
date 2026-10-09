/** Short things the character says on its own. Kept tiny — it's a little creature, not a narrator. */

export function pick<T>(items: readonly T[], rng: () => number = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}

export const LINES = {
  tapHi: ['Hi!', 'Hehe!', 'Oh! Hello!', 'Boop!', 'Hiya!'],
  tickle: ['That tickles!', 'Hehehe!', 'Eep! Hehe!'],
  enough: ['Okay, okay!', 'Phew! A little break?', 'Dizzy… hehe.'],
  wake: ['Mm? Oh, hi!', '*yawn* …hi!', 'Was I asleep?'],
  messy: ['Everything went everywhere!', 'Whoa — what a mess!', 'The whole room shook!'],
  rebooted: ['Huh? Where was I?', 'Fresh start!', 'Hello again!'],
  wheee: ['Wheee!', 'Whoooa!', 'Here I gooo!'],
  whoa: ['Whoa!', 'Eek!', 'Woah there!'],
  afterRide: ['That was fun!', 'Again? Again!', 'Hehe, wobbly!'],
  dizzy: ['Spinny…', 'Whoa… dizzy…', 'The room is wobbly…'],
  dropped: ['Again!', 'Whee!', 'I flew!'],
  bonk: ['Oof!', 'Bonk!'],
  floorSpot: ['What’s this?', 'Ooh, a sparkle!', 'Hmm?'],
  floorFound: ['Nothing! Hehe.', 'Just a sparkle.', 'Shiny!'],
  ball: ['Ball!', 'Catch!', 'My ball!'],
  lampOn: ['Cozy light!', 'Ooh, bright!'],
  lampOff: ['Dim and cozy.', 'Night mode!'],
  newLook: ['Ooh, new look!', 'I love it here!', 'So fancy!'],
  unlocked: ['Something new!', 'Ooh, for me?'],
  gameGreat: ['We did it!', 'Amazing!', 'Best team!'],
  gameGood: ['That was fun!', 'Nice one!'],
  gameMeh: ['Aw! Again?', 'Next time!', 'Hehe, that was tricky.'],
  initiate: ['Hi there!', 'Psst, hi!', 'Just saying hello!', '*waves*'],
  stars: ['Look, stars!', 'So many stars…'],
  window: ['Nice out there.', 'Hmm, the sky…'],
  book: ['Hmm, interesting…', 'One more page…'],
  plant: ['Smells green!', 'Grow, little sprout!'],
  finds: ['My treasures!', 'Look at my finds!'],
  frame: ['That’s us!', 'Best friends!'],
} as const;

export function greetingFor(hour: number, name: string | undefined, daysAway: number | null): string {
  const who = name ? `, ${name}` : '';
  if (daysAway !== null && daysAway >= 3) return `You’re back${who}! I kept the room cozy.`;
  if (hour < 5) return `Up late${who}? Hi!`;
  if (hour < 12) return `Good morning${who}!`;
  if (hour < 18) return `Good afternoon${who}!`;
  return `Good evening${who}!`;
}

export function clockLine(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const m = String(minute).padStart(2, '0');
  return `It’s ${h}:${m}!`;
}
