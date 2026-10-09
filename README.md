# cubeit

A tiny companion that lives in a cube-shaped room on your phone. It wanders,
naps, plays with its ball, slides around when you tilt the phone, reacts when
you tap, pet or pick it up, talks (simply, and honestly), remembers what you
ask it to, and grows a little personality over time — all **offline**, with
everything stored **on the device**.

Built with Expo SDK 57, React Native 0.86, TypeScript, Reanimated 4 and
react-native-svg.

## Run it

```bash
npm install
```

```bash
npx expo start
```

Then scan the QR code with **Expo Go** on a phone (iOS or Android). Every
library used is included in Expo Go, so no development build is needed for
the current feature set.

For a quick look in a browser (no real tilt — arrow keys / WASD simulate it, hold Shift for a hard tilt):

```bash
npx expo start --web
```

| Script | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm test` | Unit tests (Jest, 50 tests: persistence, physics, conversation, progression) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`eslint-config-expo`, including React Compiler rules) |
| `npm run sounds` | Regenerate the synthesized sound effects in `assets/sounds` |

## What's in the box

- **The room** — a flat, monochrome 60×60 dot LCD (black dots on a faded
  green panel, like the old Cube World toys) inside a plain frame. The room
  is plain by default (other themes add a wallpaper), with pixel-art furniture, a window that follows the real time of day, a
  working wall clock, twinkling string lights and a bouncy ball. Night dims
  the panel; the lamp (tap it) lights it.
- **The character** — a chunky pixel stickman in the style of Radica's Cube
  World LCD toys (no face, solid head, 2-dot-thick limbs, about 25 dots
  tall), posed as a skeleton and snapped to a dot grid every frame.
  20 animation states (idle, walking, looking around, curious, happy,
  excited, thinking, listening, sleeping, surprised, sad, celebrating,
  interacting, dizzy, held, dancing, sliding, waving, love, hidden) with an
  8-frame walk cycle, breathing, idle fidgets (scratching its
  head, tapping a foot, stretching, hands on hips…), dance routines,
  jumping jacks, lying down to sleep, emotes and speech bubbles.
- **Behavior** — a mood- and personality-weighted behavior loop with quiet
  idle moments, wandering, looking around, visiting furniture, napping
  (and sleeping at night), ball play, and occasional gentle hellos.
  Unlockable habits (dance, twirl, stargazing, humming) open up with
  friendship.
- **Touch** — tap (with escalating, rate-limited reactions), long-press to
  pet, drag to pick up and toss, tap the floor to make it investigate, tap
  furniture or the ball. Haptics where supported.
- **Tilt** — device gravity streams straight into a UI-thread physics
  simulation: dead zone, low-pass filter, momentum, friction, adjustable
  sensitivity, auto or saved neutral position, and an on/off switch. The
  stickman bumps into the screen's edges with his head and body (with a
  little pixel "bonk"). Tilt hard sideways and he's knocked over and slides
  head-first into the wall; tip the screen's top edge down far enough and
  gravity flips, so he falls up and bumps the ceiling, then drops back down.
  Hard tilts also knock a napping character out of bed.
- **Talk** — chat panel with an honest offline engine (greetings, feelings,
  "remember…", recall, tricks like "dance"). It says plainly when it doesn't
  understand. The engine interface is ready for an on-device model — see
  [docs/LOCAL_AI.md](docs/LOCAL_AI.md).
- **Memories** — create, edit, filter and delete memories; the character only
  saves things after you tap **Save**, warns about sensitive-looking
  content, and only ever recalls what's actually stored. Also: daily
  **Finds** (collectibles) and an **About** page (friendship, personality).
- **Customize** — wallpaper themes, furniture per slot and accessories, with a live preview, Apply / discard, restore defaults, and
  unlocks paid with stars from games (or opened by friendship level).
- **Games** — *Star Catch* (tilt or drag to catch falling stars, 40 s) and
  *Peekaboo* (find the character after the boxes shuffle, 3 rounds). Both
  pause on backgrounding and reward stars.
- **Nearby friends (simulation)** — the full consent flow and a visiting
  character, clearly labeled as a local simulation. Real BLE discovery is
  designed but not built — see [docs/NEARBY.md](docs/NEARBY.md).
- **Settings** — motion (toggle, sensitivity, calibration with a live level),
  sound, haptics, reduce motion, character name, activity level, night
  sleep, milestone recording, export data, reset room, delete memories,
  start over, privacy notes.

## Honest status

| Works now | Needs more |
| --- | --- |
| Everything above, offline, in Expo Go | A real on-device language model (dev build + model download) |
| Local persistence (SQLite) with versioned migrations and corruption backup | Real nearby discovery (BLE / Multipeer / Nearby Connections, dev build) |
| Tilt via the device gravity sensor | **Verification on physical phones** — see below |

Verified so far: TypeScript, ESLint, unit tests, and the full UI in a mobile
web viewport (keyboard-simulated tilt). **The app has not yet been run on a
physical iOS or Android device**; tilt direction, haptics, sound, keyboard
behavior and performance on low-end phones still need a hands-on pass with
[docs/DEVICE_TESTING.md](docs/DEVICE_TESTING.md).

## Privacy

No account, no servers, no analytics, no network calls. The character, room,
memories and settings live in a local SQLite database. Chats are never
saved — only memories you approve. Motion data is used live and never
recorded.

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
