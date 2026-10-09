# cubeit

A tiny companion that lives in a cube-shaped room on your phone. It wanders,
naps, plays with its ball, slides around when you tilt the phone, reacts when
you tap, pet or pick it up, helps you plan your days (calendar, habits,
chores, journal), talks through an optional **on-device AI model**, remembers
what you ask it to, and grows a little personality over time — all
**offline**, with everything stored **on the device**.

Built with Expo SDK 57, React Native 0.86, TypeScript, Reanimated 4 and
react-native-svg.

## Run it

```bash
npm install
```

```bash
npx expo start
```

Then scan the QR code with **Expo Go** on a phone (iOS or Android). Expo Go
runs everything except the parts that need native code it doesn't include:
the **on-device AI model** (llama.rn), **voice input** (on-device speech
recognition) and **reading text from photos** (OCR). For those, make a
development build — no Mac needed:

```bash
npx eas-cli@latest build --profile development --platform ios
```

See [docs/LOCAL_AI.md](docs/LOCAL_AI.md) for the full iPhone steps, including
the Airplane Mode test. On Windows, run `npm install` from PowerShell or cmd
(llama.rn's install step can't extract its native files under Git Bash).

For a quick look in a browser (no real tilt — arrow keys / WASD simulate it, hold Shift for a hard tilt):

```bash
npx expo start --web
```

| Script | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm test` | Unit tests (Jest, 163 tests: persistence, physics, conversation, planner, assistant actions, media) |
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
- **Talk** — chat with the character. With the optional on-device model
  (Qwen2.5 0.5B via llama.rn, downloaded once from Settings) it chats and
  turns requests like "add dentist tomorrow at 3pm", "I finished my workout"
  or "what did I write about my sister?" into validated planner actions that
  wait for your tap before anything is saved. Without the model, a rule-based
  parser handles common planner requests and the honest scripted replies do
  the rest; every reply is labeled with where it came from. **Voice input**
  (on-device speech-to-text, editable before sending) and **photo text**
  (on-device OCR → event, checklist, habit or journal entry). See
  [docs/LOCAL_AI.md](docs/LOCAL_AI.md).
- **Planner** (replaces the old Memories sheet) — **Today** at a glance;
  **Calendar** with day / week / month views, all-day and timed events,
  notes and reminders; **Habits & routines** with selected-day schedules,
  ordered routine steps, streaks that only count scheduled days, weekly
  progress, history you can correct, archive and reminders; **Chores** with
  due dates, categories, checklists, repeats (daily / weekly / monthly, every
  N) and pending / overdue / done views; **Journal** with moods, guided
  prompts, photos, search and a weekly summary (optionally written by the
  on-device model from your entries only). **Memories** live inside the
  Journal tab (create, edit, delete; only saved after you tap **Save**), and
  **Finds** and **About** are linked from Today. Completing habits and chores
  earns Stars once per day/occurrence and makes the character celebrate.
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

| Works now | Implemented, needs a device to verify | Not built |
| --- | --- | --- |
| Room, character, games, customize, planner, built-in parser — offline, in Expo Go | On-device model (llama.rn), voice input, photo OCR, local reminders — development build | Real nearby discovery (BLE / Multipeer / Nearby Connections) |
| Local persistence (SQLite) with versioned migrations and corruption backup | | Syncing with external calendars (Cubeit has its own calendar only) |

Verified so far: TypeScript, ESLint, unit tests, and the UI in a mobile web
viewport (keyboard-simulated tilt; planner and Talk with the built-in
parser). **The app has not yet been run on a physical iOS or Android
device** — including the on-device model, which has not run on an iPhone yet.
Use [docs/DEVICE_TESTING.md](docs/DEVICE_TESTING.md).

## Privacy

No account, no servers, no analytics. The character, room, memories,
planner, journal and settings live in a local SQLite database. The only
network request is the optional, user-started download of the AI model
(~490 MB, from Hugging Face); after that everything works in Airplane Mode.
Messages, voice and photos are processed on the phone and never uploaded.
Chats are never saved — only memories and planner items you confirm. Voice
recordings and photo copies are deleted after use. Motion data is used live
and never recorded. Export (Settings) gives you all your data as JSON; it
never includes the model.

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
