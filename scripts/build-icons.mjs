// Rasterizes assets/brand/*.svg into the app icon, adaptive icon, splash and favicon PNGs.
// Needs sharp, which is not a project dependency:  npm i --no-save sharp && node scripts/build-icons.mjs
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const brand = join(root, 'assets', 'brand');
const out = join(root, 'assets');
const mark = readFileSync(join(brand, 'mark.svg'));
const bg = readFileSync(join(brand, 'background.svg'));
const markWhite = Buffer.from(
  mark
    .toString()
    .replace(/fill="url\(#[a-z]+\)"/g, 'fill="#FFFFFF"')
    .replace(/stroke="url\(#[a-z]+\)"/g, 'stroke="#FFFFFF"')
    .replace(/fill="#14123A"/g, 'fill="#000000" fill-opacity="0"')
    .replace(/stroke="#14123A"/g, 'stroke="#000000" stroke-opacity="0"')
    .replace(/fill="#(FFD36E|FFFFFF|FF9DC0|B6A6FF)"/g, 'fill="#FFFFFF"')
    .replace(/stroke="#B6A6FF"/g, 'stroke="#FFFFFF"'),
);

const markPng = (size, svg = mark) => sharp(svg, { density: 300 }).resize(size, size).png().toBuffer();

// iOS / generic icon: full-bleed background + mark at ~68%.
const icon = await sharp(bg, { density: 144 })
  .resize(1024, 1024)
  .composite([{ input: await markPng(700), left: 162, top: 150 }])
  .png()
  .toBuffer();
await sharp(icon).toFile(join(out, 'icon.png'));
await sharp(icon).resize(48, 48).toFile(join(out, 'favicon.png'));

// Android adaptive icon: mark inside the 66% safe zone on transparency.
const fg = await markPng(600);
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: fg, left: 212, top: 200 }])
  .png()
  .toFile(join(out, 'android-icon-foreground.png'));
await sharp(bg, { density: 144 }).resize(1024, 1024).png().toFile(join(out, 'android-icon-background.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await markPng(600, markWhite), left: 212, top: 200 }])
  .png()
  .toFile(join(out, 'android-icon-monochrome.png'));

// Splash: the mark alone on transparency (background color comes from app.json).
await sharp(await markPng(512)).toFile(join(out, 'splash-icon.png'));
console.log('done');
