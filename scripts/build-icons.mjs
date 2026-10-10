// Rasterizes assets/brand/cube.svg (the cube gadget with its LCD screen) into the app icon,
// adaptive icon, splash, favicon, the transparent master and the header mark.
// Needs sharp, which is not a project dependency:  npm i --no-save sharp && node scripts/build-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');
const cube = readFileSync(join(out, 'brand', 'cube.svg'));
// The app's light background (lightColors.bg in src/theme/tokens.ts). iOS icons can't be transparent.
const BG = '#EAEBE6';
const cubeWhite = Buffer.from(
  cube
    .toString()
    .replace(/fill="(#[0-9A-Fa-f]{6}|url\([^)]*\))"/g, 'fill="#FFFFFF"')
    .replace(/stroke="#[0-9A-Fa-f]{6}"/g, 'stroke="#FFFFFF"'),
);

const cubePng = (size, svg = cube) => sharp(svg, { density: 300 }).resize(size, size).png().toBuffer();
const square = (size, background) => sharp({ create: { width: size, height: size, channels: 4, background } });
const clear = { r: 0, g: 0, b: 0, alpha: 0 };

// Transparent masters: full size, and the small mark the header shows (src/ui/Logo.tsx).
await sharp(await cubePng(1024)).toFile(join(out, 'brand', 'cube-1024.png'));
await sharp(await cubePng(96)).toFile(join(out, 'brand', 'cube-mark.png'));

// iOS / generic icon: the cube at ~80% on the light background.
await square(1024, BG)
  .composite([{ input: await cubePng(820), left: 102, top: 102 }])
  .flatten({ background: BG })
  .png()
  .toFile(join(out, 'icon.png'));
await sharp(await cubePng(48)).toFile(join(out, 'favicon.png'));

// Android adaptive icon: the cube inside the 66% safe zone on transparency, over a solid background.
await square(1024, clear).composite([{ input: await cubePng(640), left: 192, top: 192 }]).png().toFile(join(out, 'android-icon-foreground.png'));
await square(1024, BG).png().toFile(join(out, 'android-icon-background.png'));
await square(1024, clear).composite([{ input: await cubePng(640, cubeWhite), left: 192, top: 192 }]).png().toFile(join(out, 'android-icon-monochrome.png'));

// Splash: the cube alone on transparency (background color comes from app.json).
await sharp(await cubePng(512)).toFile(join(out, 'splash-icon.png'));
console.log('done');
