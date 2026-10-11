// Builds presentation/Cubeit_Pitch_AppBuildersPH2026.pptx
// Usage (from this folder):  node build-deck.cjs
// Needs pptxgenjs (npm i pptxgenjs@3.12.0). Images are read from ../assets.
const path = require('path');
const pptxgen = require('pptxgenjs');
const NOTES = require('./notes.cjs');

const ASSETS = path.join(__dirname, '..', 'assets');
const img = (n) => path.join(ASSETS, n);
const OUT = path.join(__dirname, '..', 'Cubeit_Pitch_AppBuildersPH2026.pptx');

// ── Theme ────────────────────────────────────────────────────────────────
// Navy and blue from the app's dark palette (src/theme/tokens.ts: brand #306085 / #4F8DBE),
// plus the LCD green of the room, used sparingly.
const THEME = {
  name: 'Cubeit Night',
  headFontFace: 'Segoe UI Semibold',
  bodyFontFace: 'Segoe UI',
  colors: {
    dk1: '0B1524', // slide background
    lt1: 'EEF3F8', // main text
    dk2: '13233A', // card surface
    lt2: '9FB0C4', // muted text
    accent1: '4F8DBE', // brand blue (dark mode)
    accent2: '9CC6E8', // ice blue
    accent3: '306085', // brand blue (light mode)
    accent4: 'A9B59A', // LCD green
    accent5: 'F2A83B', // star
    accent6: '25395A', // hairline
    hlink: '9CC6E8',
    folHlink: '9CC6E8',
  },
};
const HEX = {
  bg: '0B1524', surf: '13233A', surf2: '1A2E4A', line: '25395A',
  text: 'EEF3F8', muted: '9FB0C4', faint: '6F829A',
  blue: '4F8DBE', ice: '9CC6E8', brand: '306085', lcd: 'A9B59A', star: 'F2A83B',
};
const MONO = 'Consolas';

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5 in
pres.title = 'Cubeit — You’ve got a companion';
pres.author = 'Cubeit team';
pres.subject = 'AppBuildersPH Hackathon 2026 — Local AI';
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;

// ── Layouts ──────────────────────────────────────────────────────────────
const footer = [
  { image: { x: 0.6, y: 6.93, w: 0.24, h: 0.24, path: img('cube-1024.png') } },
  { text: { text: 'cubeit', options: { x: 0.9, y: 6.9, w: 1.2, h: 0.3, fontFace: 'Segoe UI Semibold', fontSize: 11, color: C.background2, margin: 0, valign: 'middle' } } },
];
pres.defineSlideMaster({
  title: 'CUBEIT_CONTENT',
  background: { color: HEX.bg },
  objects: [
    ...footer,
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.6, y: 0.45, w: 9, h: 0.32, fontFace: MONO, fontSize: 12, color: C.accent2, charSpacing: 2, margin: 0, valign: 'middle' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.8, w: 12.1, h: 0.85, fontFace: 'Segoe UI Semibold', fontSize: 34, color: C.background1, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  ],
  slideNumber: { x: 12.2, y: 6.9, w: 0.55, h: 0.3, fontFace: MONO, fontSize: 10, color: C.background2, align: 'right' },
});
pres.defineSlideMaster({
  title: 'CUBEIT_BLANK',
  background: { color: HEX.bg },
  objects: [],
});

// ── Helpers ──────────────────────────────────────────────────────────────
const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, fontFace: 'Segoe UI', color: C.background1, ...o });
const box = (slide, o) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { rectRadius: 0.12, fill: { color: C.text2 }, line: { color: C.text2, width: 0 }, ...o });
/** A 2×2 block of LCD-style dots, the deck's pixel bullet. */
function pixel(slide, x, y, s = 0.07, color = HEX.blue, name = 'pixel') {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    slide.addShape(pres.shapes.RECTANGLE, { x: x + i * (s + 0.02), y: y + j * (s + 0.02), w: s, h: s, fill: { color }, line: { color, width: 0 }, objectName: `${name}-${i}${j}` });
  }
}
/** A chat bubble that looks like the user's message in Talk. */
function bubble(slide, text, x, y, w, h, name) {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: `${name}-bg` });
  T(slide, text, { x: x + 0.2, y, w: w - 0.4, h, fontSize: 15, color: 'FFFFFF', valign: 'middle', objectName: `${name}-text` });
}
const PHONE_RATIO = 2584 / 1222; // height / width of the framed screenshots

// ══ 1. Hook ═══════════════════════════════════════════════════════════════
{
  pres.addSection({ title: 'Hook' });
  const s = pres.addSlide({ masterName: 'CUBEIT_BLANK', sectionTitle: 'Hook' });
  s.addImage({ path: img('dither-up.png'), x: 0, y: 6.1, w: 13.333, h: 1.4, transparency: 82, objectName: 'pixel-texture' });

  T(s, 'APPBUILDERSPH HACKATHON 2026  ·  LOCAL AI', { x: 0.7, y: 0.65, w: 7, h: 0.3, fontFace: MONO, fontSize: 12, color: C.accent2, charSpacing: 2, objectName: 'kicker' });
  T(s, 'Most of life is\nlittle things.', { x: 0.7, y: 1.35, w: 6.6, h: 2.2, fontFace: 'Segoe UI Semibold', fontSize: 54, valign: 'top', paraSpaceAfter: 0, lineSpacingMultiple: 0.95, objectName: 'title' });
  T(s, 'Plans, routines, chores, and the thoughts in between. None of it is hard. There’s just a lot of it, and most of it lives in your head.', { x: 0.7, y: 3.55, w: 5.0, h: 1.3, fontSize: 18, color: C.background2, valign: 'top', objectName: 'subtitle' });

  // Brand lockup: the real app icon + tagline.
  s.addImage({ path: img('cube-1024.png'), x: 0.7, y: 5.15, w: 0.75, h: 0.75, objectName: 'cube-logo' });
  T(s, 'cubeit', { x: 1.6, y: 5.12, w: 3, h: 0.45, fontFace: 'Segoe UI Semibold', fontSize: 26, objectName: 'wordmark' });
  T(s, 'You’ve got a companion.', { x: 1.6, y: 5.55, w: 4, h: 0.35, fontSize: 16, color: C.accent2, objectName: 'tagline' });

  // The room, with the little things floating around it.
  const dw = 3.7, dh = dw * 986 / 912;
  const dx = 8.6, dy = 1.5;
  s.addImage({ path: img('lcd-home.png'), x: dx, y: dy, w: dw, h: dh, objectName: 'pip-room' });
  const chips = [
    ['pay rent · fri 9am', 6.9, 1.2],
    ['dentist · tue 3pm', 10.6, 0.95],
    ['clean the bathroom · sat', 5.95, 3.9],
    ['did I walk today?', 10.65, 5.68],
    ['what did I write last week?', 7.2, 6.15],
  ];
  chips.forEach(([t, x, y], i) => {
    const w = 0.35 + t.length * 0.105;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.42, rectRadius: 0.08, fill: { color: C.text2 }, line: { color: C.accent6, width: 1 }, objectName: `chip-${i}-bg` });
    T(s, t, { x: x + 0.17, y, w: w - 0.2, h: 0.42, fontFace: MONO, fontSize: 13, color: C.background2, valign: 'middle', objectName: `chip-${i}-text` });
  });

  s.addNotes(NOTES[0]);
}

// ══ 2. Meet Cubeit ═══════════════════════════════════════════════════════
{
  pres.addSection({ title: 'Meet Cubeit' });
  const s = pres.addSlide({ masterName: 'CUBEIT_CONTENT', sectionTitle: 'Meet Cubeit' });
  s.addText('01  MEET PIP', { placeholder: 'kicker' });
  s.addText('The companion makes it personal.\nThe assistant makes it useful.', { placeholder: 'title' });

  const pw = 2.95, ph = pw * PHONE_RATIO * 0.897; // top 89.7% of the phone, so it ends at the slide's bottom edge
  s.addImage({ path: img('phone-home-top.png'), x: 9.35, y: 7.5 - ph, w: pw, h: ph, objectName: 'phone-home' });

  const rows = [
    ['Pip, the companion', 'A pixel stickman in a little LCD room. It naps, dances and waves, and reacts when you tap it, pet it, pick it up or tilt the phone.', HEX.lcd],
    ['The assistant', 'Calendar, habits and routines, chores and a journal. Tell Pip what you need in plain words. It proposes, you confirm.', HEX.blue],
    ['Where they meet', 'Finish a habit or a chore and Pip celebrates. You earn stars, and your friendship level grows.', HEX.ice],
  ];
  rows.forEach(([h, b, col], i) => {
    const y = 2.4 + i * 1.45;
    pixel(s, 0.6, y + 0.12, 0.08, col, `row${i}-pixel`);
    T(s, h, { x: 1.0, y, w: 7.4, h: 0.4, fontFace: 'Segoe UI Semibold', fontSize: 20, objectName: `row${i}-head` });
    T(s, b, { x: 1.0, y: y + 0.45, w: 7.4, h: 0.85, fontSize: 16, color: C.background2, valign: 'top', objectName: `row${i}-body` });
  });
  s.addNotes(NOTES[1]);
}

// ══ 3. What it helps you do ══════════════════════════════════════════════
{
  pres.addSection({ title: 'Features' });
  const s = pres.addSlide({ masterName: 'CUBEIT_CONTENT', sectionTitle: 'Features' });
  s.addText('02  WHAT IT HELPS WITH', { placeholder: 'kicker' });
  s.addText('Four everyday jobs, one place', { placeholder: 'title' });

  const cols = [
    ['phone-planner.png', 'Remember what’s coming', 'Day, week and month views. Reminders on the phone.'],
    ['phone-planner-habits.png', 'Keep routines going', 'Streaks count only the days you planned.'],
    ['phone-planner-chores.png', 'Keep the house running', 'Due dates, repeats and checklists.'],
    ['phone-planner-journal.png', 'Look back', 'Moods, prompts, search and a weekly summary.'],
  ];
  const pw = 1.85, ph = pw * PHONE_RATIO; // 3.91
  cols.forEach(([file, h, b], i) => {
    const x = 0.75 + i * 3.1;
    s.addImage({ path: img(file), x, y: 1.8, w: pw, h: ph, objectName: `phone-${i}` });
    T(s, h, { x, y: 1.8 + ph + 0.15, w: 2.85, h: 0.38, fontFace: 'Segoe UI Semibold', fontSize: 17, objectName: `col${i}-head` });
    T(s, b, { x, y: 1.8 + ph + 0.53, w: 2.75, h: 0.6, fontSize: 13, color: C.background2, valign: 'top', objectName: `col${i}-body` });
  });
  s.addNotes(NOTES[2]);
}

// ══ 4. Live demo ═════════════════════════════════════════════════════════
{
  pres.addSection({ title: 'Live demo' });
  const s = pres.addSlide({ masterName: 'CUBEIT_CONTENT', sectionTitle: 'Live demo' });
  s.addText('03  LIVE DEMO', { placeholder: 'kicker' });
  s.addText('Four messages, no forms', { placeholder: 'title' });

  const steps = [
    ['Remind me to pay rent on Friday at 9am', 'Calendar event with a reminder, after one tap'],
    ['Add clean the bathroom to my chores every Saturday', 'A weekly chore'],
    ['I finished my evening walk', 'Habit logged. Pip celebrates. Stars earned.'],
    ['What’s on my schedule this week?', 'Answered from your planner, nothing to confirm'],
  ];
  steps.forEach(([msg, res], i) => {
    const y = 1.95 + i * 1.1;
    T(s, String(i + 1), { x: 0.6, y, w: 0.4, h: 0.5, fontFace: MONO, fontSize: 18, color: C.accent2, valign: 'middle', objectName: `step${i}-num` });
    const w = Math.min(6.9, 0.55 + msg.length * 0.118);
    bubble(s, msg, 1.05, y, w, 0.5, `step${i}-msg`);
    T(s, '→  ' + res, { x: 1.25, y: y + 0.55, w: 6.6, h: 0.35, fontSize: 14, color: C.background2, objectName: `step${i}-result` });
  });
  T(s, 'Then open Planner: everything is in the calendar, chores and habits.', { x: 1.05, y: 6.32, w: 6.8, h: 0.35, fontSize: 14, color: C.accent2, objectName: 'then-planner' });

  // Real screens from the build: the confirm card, and Pip celebrating.
  const cw = 3.3, ch = cw * 498 / 720;
  s.addImage({ path: img('card-event.png'), x: 8.75, y: 1.9, w: cw, h: ch, objectName: 'confirm-card' });
  T(s, 'Nothing is saved until you tap.', { x: 8.8, y: 1.9 + ch + 0.1, w: 3.8, h: 0.3, fontSize: 12, color: C.background2, objectName: 'confirm-caption' });
  const lw = 2.05, lh = lw * 739 / 684;
  s.addImage({ path: img('lcd-celebrate.png'), x: 9.4, y: 4.72, w: lw, h: lh, objectName: 'pip-celebrates' });
  s.addNotes(NOTES[3]);
}

// ══ 5. Why local AI ══════════════════════════════════════════════════════
{
  pres.addSection({ title: 'Local AI' });
  const s = pres.addSlide({ masterName: 'CUBEIT_CONTENT', sectionTitle: 'Local AI' });
  s.addText('04  LOCAL AI', { placeholder: 'kicker' });
  s.addText('Why it runs on the phone', { placeholder: 'title' });
  T(s, 'Pip reads your calendar, routines and journal. That shouldn’t have to leave your phone.', { x: 0.6, y: 1.55, w: 11.5, h: 0.4, fontSize: 18, color: C.background2, objectName: 'subtitle' });

  const stages = [
    ['You say it', 'Type it, or speak it. Speech-to-text runs on the phone.'],
    ['Model reads it', 'Qwen2.5 0.5B on llama.rn (llama.cpp). Picks 1 of 16 intents and copies your words into a fixed JSON schema.'],
    ['App checks it', 'Dates come from the phone’s clock. Past dates are rejected. Missing details get a question.'],
    ['You confirm', 'A card shows exactly what will change.'],
    ['Saved locally', 'SQLite on the phone. Rolled back if the write fails.'],
  ];
  const bw = 2.18, gap = 0.3, y = 2.3, bh = 2.42;
  stages.forEach(([h, b], i) => {
    const x = 0.6 + i * (bw + gap);
    const hot = i === 1;
    box(s, { x, y, w: bw, h: bh, fill: { color: hot ? C.accent3 : C.text2 }, line: { color: hot ? C.accent1 : C.accent6, width: 1 }, objectName: `stage${i}-box` });
    T(s, String(i + 1).padStart(2, '0'), { x: x + 0.2, y: y + 0.18, w: 1, h: 0.3, fontFace: MONO, fontSize: 12, color: hot ? 'FFFFFF' : C.accent2, objectName: `stage${i}-num` });
    T(s, h, { x: x + 0.2, y: y + 0.5, w: bw - 0.35, h: 0.4, fontFace: 'Segoe UI Semibold', fontSize: 16, objectName: `stage${i}-head` });
    T(s, b, { x: x + 0.2, y: y + 0.92, w: bw - 0.35, h: bh - 1.0, fontSize: 12.5, color: hot ? 'E4ECF2' : C.background2, valign: 'top', objectName: `stage${i}-body` });
    if (i < stages.length - 1) {
      s.addShape(pres.shapes.CHEVRON, { x: x + bw + 0.08, y: y + bh / 2 - 0.1, w: 0.14, h: 0.2, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: `arrow${i}` });
    }
  });
  T(s, 'The model proposes. The app checks. You decide.', { x: 0.6, y: 4.95, w: 12, h: 0.45, fontFace: 'Segoe UI Semibold', fontSize: 20, color: C.accent2, objectName: 'principle' });

  const facts = [
    ['Internet: once', 'A one-time 491 MB model download, checked with SHA-256. The app makes no other network calls.'],
    ['No account, no server', 'No analytics. Chats aren’t saved, only the items you confirm.'],
    ['Honest labels', 'Each reply says whether the on-device model or the rule-based fallback answered.'],
  ];
  facts.forEach(([h, b], i) => {
    const x = 0.6 + i * 4.1;
    pixel(s, x, 5.67, 0.06, HEX.lcd, `fact${i}-pixel`);
    T(s, h, { x: x + 0.3, y: 5.55, w: 3.6, h: 0.35, fontFace: 'Segoe UI Semibold', fontSize: 14, objectName: `fact${i}-head` });
    T(s, b, { x: x + 0.3, y: 5.92, w: 3.6, h: 0.8, fontSize: 12.5, color: C.background2, valign: 'top', objectName: `fact${i}-body` });
  });
  s.addNotes(NOTES[4]);
}

// ══ 6. Closing ═══════════════════════════════════════════════════════════
{
  pres.addSection({ title: 'Closing' });
  const s = pres.addSlide({ masterName: 'CUBEIT_BLANK', sectionTitle: 'Closing' });
  s.addImage({ path: img('dither-up.png'), x: 0, y: 6.1, w: 13.333, h: 1.4, transparency: 82, objectName: 'pixel-texture' });
  const lw = 4.6, lh = lw * 739 / 684;
  s.addImage({ path: img('lcd-celebrate.png'), x: 0.9, y: 1.0, w: lw, h: lh, objectName: 'pip-celebrates' });

  s.addImage({ path: img('cube-1024.png'), x: 6.6, y: 1.55, w: 1.0, h: 1.0, objectName: 'cube-logo' });
  T(s, 'cubeit', { x: 7.75, y: 1.6, w: 4, h: 0.9, fontFace: 'Segoe UI Semibold', fontSize: 44, valign: 'middle', objectName: 'wordmark' });
  T(s, 'You’ve got a companion.', { x: 6.6, y: 2.95, w: 6.3, h: 0.9, fontFace: 'Segoe UI Semibold', fontSize: 38, color: C.accent2, objectName: 'tagline' });
  T(s, 'It keeps track of the little things, notices when you get them done, and keeps all of it on your phone.', { x: 6.6, y: 4.0, w: 5.9, h: 1.1, fontSize: 18, color: C.background2, valign: 'top', objectName: 'closing-line' });
  T(s, 'Thank you  ·  Questions?', { x: 6.6, y: 5.45, w: 5, h: 0.4, fontFace: MONO, fontSize: 14, color: C.accent2, charSpacing: 1, objectName: 'thanks' });
  s.addNotes(NOTES[5]);
}

// ── Write ────────────────────────────────────────────────────────────────
(async () => {
  await pres.writeFile({ fileName: OUT });
  // pptxgenjs writes Office's stock palette; this writes the Cubeit colors into the theme.
  const { applyTheme } = require('./apply_theme.cjs');
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
