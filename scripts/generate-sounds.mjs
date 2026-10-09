// Synthesizes Cubeit's small, original sound effects as 16-bit mono WAV files.
// Run with: node scripts/generate-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'sounds');
mkdirSync(outDir, { recursive: true });

/** Sample generator helpers. */
const env = (t, dur, attack = 0.005, release = 0.6) => {
  if (t < attack) return t / attack;
  const r = dur * release;
  return t > dur - r ? Math.max(0, (dur - t) / r) : 1;
};
const tri = (phase) => 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));

function render(duration, fn) {
  const n = Math.floor(duration * RATE);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) data[i] = fn(i / RATE, i);
  return data;
}

/** A pitched note with a frequency sweep. */
function tone({ from, to = from, dur, wave = 'sine', vol = 0.5, attack = 0.004, release = 0.7, vibrato = 0 }) {
  let phase = 0;
  return render(dur, (t) => {
    const k = t / dur;
    const f = from * Math.pow(to / from, k) * (1 + vibrato * Math.sin(t * 2 * Math.PI * 18));
    phase += f / RATE;
    const s = wave === 'tri' ? tri(phase) : Math.sin(2 * Math.PI * phase);
    return s * vol * env(t, dur, attack, release);
  });
}

function concat(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function mix(...parts) {
  const len = Math.max(...parts.map((p) => p.length));
  const out = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.length; i++) out[i] += p[i];
  return out;
}

const silence = (dur) => new Float32Array(Math.floor(dur * RATE));

function noise({ dur, vol = 0.3, lowpass = 0.15 }) {
  let last = 0;
  return render(dur, (t) => {
    last += (Math.random() * 2 - 1 - last) * lowpass;
    return last * vol * env(t, dur, 0.01, 0.8);
  });
}

function writeWav(name, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  writeFileSync(join(outDir, `${name}.wav`), buf);
  console.log(`wrote ${name}.wav (${(buf.length / 1024).toFixed(1)} KB)`);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

writeWav('pop', tone({ from: 520, to: 980, dur: 0.09, vol: 0.45 }));
writeWav('boing', tone({ from: 600, to: 240, dur: 0.18, wave: 'tri', vol: 0.4, vibrato: 0.04 }));
writeWav('bump', mix(tone({ from: 160, to: 90, dur: 0.09, vol: 0.55 }), noise({ dur: 0.06, vol: 0.25 })));
writeWav('chime', concat(tone({ from: 1318, dur: 0.07, vol: 0.32 }), tone({ from: 1760, dur: 0.16, vol: 0.32 })));
writeWav(
  'gold',
  concat(tone({ from: C6, dur: 0.06, vol: 0.3 }), tone({ from: 1318, dur: 0.06, vol: 0.3 }), tone({ from: 1568, dur: 0.18, vol: 0.32 })),
);
writeWav(
  'giggle',
  concat(
    tone({ from: 900, to: 1150, dur: 0.06, wave: 'tri', vol: 0.32 }),
    silence(0.025),
    tone({ from: 980, to: 1250, dur: 0.06, wave: 'tri', vol: 0.32 }),
    silence(0.025),
    tone({ from: 1050, to: 1400, dur: 0.09, wave: 'tri', vol: 0.32 }),
  ),
);
writeWav('tick', tone({ from: 1800, to: 1500, dur: 0.025, vol: 0.25 }));
writeWav(
  'success',
  concat(
    tone({ from: C5, dur: 0.09, wave: 'tri', vol: 0.35 }),
    tone({ from: E5, dur: 0.09, wave: 'tri', vol: 0.35 }),
    tone({ from: G5, dur: 0.09, wave: 'tri', vol: 0.35 }),
    tone({ from: C6, dur: 0.28, wave: 'tri', vol: 0.38 }),
  ),
);
writeWav('aww', concat(tone({ from: 520, to: 500, dur: 0.14, wave: 'tri', vol: 0.32 }), tone({ from: 440, to: 330, dur: 0.26, wave: 'tri', vol: 0.32 })));
writeWav('whoosh', noise({ dur: 0.22, vol: 0.35, lowpass: 0.08 }));
writeWav('unlock', concat(tone({ from: 880, dur: 0.07, vol: 0.3 }), tone({ from: 1318, dur: 0.2, vol: 0.32 })));
