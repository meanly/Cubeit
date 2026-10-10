# Architecture

## Threads and data flow

```
 ┌──────────── UI thread (worklets) ────────────┐      ┌──────────── JS thread ────────────────┐
 │ gravity sensor ─► tilt filter ─┐              │      │ Brain (behavior scripts)              │
 │ gestures (drag/steer) ─────────┼► physics     │      │   ▲ physics events (bump, land,       │
 │ commands (walkTo, hop, …) ─────┘  step        │ ───► │   │  arrive, tilt start/end…)          │
 │                                    │          │      │   │ bus events (tap, pet, chat, game) │
 │ animated styles ◄── body/ball/pose shared values     │   ▼                                    │
 └──────────────────────────────────────────────┘ ◄─── │ commands + pose animations (withTiming)│
                                                        │ zustand stores ──► SQLite (debounced) │
                                                        └────────────────────────────────────────┘
```

- **Per-frame work never touches React.** Sensor samples, physics, and every
  animated style run on the UI thread from shared values
  (`src/physics/World.tsx`). React re-renders only when something
  discrete changes (expression, room config, panel).
- **The brain** (`src/character/brain/`) is JS: it chooses behaviors and
  reacts to events. Behaviors are small `async` scripts whose waits are
  cancellable, so a tap or a tilt can interrupt cleanly, and normal life
  resumes afterwards.
- **Commands** (`world.commands.*`) are the only way JS moves a body; they
  run on the UI thread via `scheduleOnUI`, so physics state has a single
  writer.

## Modules

| Folder | Responsibility |
| --- | --- |
| `physics/` | Room geometry & projection, physics step (pure worklets, unit-tested), World provider, scripted extra bodies |
| `sensors/` | Gravity sensor (native) / keyboard simulation (web), mounted only while wanted |
| `character/` | States & poses, art layers, the animated rig, overlays, mood model, brain, lines |
| `lcd/` | The LCD look: palette, a tiny 1-bit `Bitmap` raster with a 3×5 font, `LcdArt` / `LcdGlass` renderers |
| `room/` | Backdrop & night dimming, furniture pixel art & placement, ball, gestures, the `Room` composite |
| `games/` | Session store, HUD, Star Catch, Peekaboo, result recording |
| `conversation/` | Engine interface, scripted engine, on-device model engine + prompt builder, chat session (proposals, confirm cards) |
| `assistant/` | Talk → planner: action schema, model-output validation, date phrase parser, rule-based parser, resolver (validation + follow-up questions), executor |
| `ai/` | On-device model: catalog, download + SHA-256 verify, llama.rn runtime wrapper, prompts, model state |
| `planner/` | Calendar, habits & routines, chores, journal: pure ops, streaks, recurrence, journal search, document repair, reminders, service (save → reward → react) |
| `media/` | Voice transcription, photo picking / OCR, temporary file cleanup |
| `memory/` | Memory types, document repair, recall search, sensitivity check |
| `progression/` | Friendship levels, XP rules, daily discoveries, milestones, rewards |
| `nearby/` | Nearby service interface, simulation, visitor choreography |
| `state/` | Save schema, migrations, validators, stores, persistence wiring |
| `storage/` | Key-value backends (SQLite native, localStorage web) and document reader/writer |
| `panels/`, `screens/`, `ui/` | Sheets, home screen (device frame, home cards, nav), primitives, toasts, confirm dialogs |

## Persistence

- Three documents: `cubeit.save` (character, mood, room, progress, settings),
  `cubeit.memories`, and `cubeit.planner` (events, habits + logs, chores +
  history, journal, paid-reward keys), in `expo-sqlite/kv-store` (SQLite,
  atomic writes). The planner has its own `PLANNER_VERSION` and
  `PLANNER_MIGRATIONS` (`planner/plannerDoc.ts`).
- Planner changes go through `commitPlanner` (`state/plannerStore.ts`): the
  change is written synchronously and **rolled back if the write fails**, so
  the UI and the assistant only ever report saved changes.
- Writes are debounced (save 800 ms, memories 250 ms) and **flushed
  synchronously when the app leaves the foreground**.
- Loading always yields valid data: `migrateSave` runs version steps, then
  `sanitizeSave` repairs every field (clamping, enum checks, slot checks).
  Unparseable data is copied to `<key>.backup` and the app starts fresh with a
  visible notice.
- To change the save shape: bump `SAVE_VERSION`, add `MIGRATIONS[n]` in
  `state/migrations.ts`, and extend `sanitizeSave`.
- Nothing large is stored in the database. If memories gain photos, store
  files with `expo-file-system` and keep only their URIs in the memory.

## Extending

- **The screen**: everything is drawn on one 60×60 dot grid (`LCD_DOTS`),
  in two colors (`LCD_INK` on `LCD_PAPER`). The room is flat: `physics/geometry`
  keeps x/z/y world coordinates, but depth only lifts things up a 6-dot
  ground strip — there's no perspective scaling. Sprites snap to whole dots.
  The screen's edges are the room's walls, floor and ceiling: the body
  collides with them (`WORLD.xMin/xMax`, `ceilingY`), the rig crops anything
  that would pass through, and tilt can knock the stickman over
  (`BodyState.fallen`) or flip gravity toward the ceiling (`gUp`).
- **Furniture**: add an `ItemDef` in `content/items.ts` and a draw function in
  `ITEM_DRAW` (`room/items/pixelArt.ts`), drawing into its slot's bitmap
  (`SLOT_DOTS`). Placement and interaction come from the slot and
  `interaction` kind. Using an item is a routine in `reactToItem`
  (`brain/behaviors.ts`) with its own stickman state (watering the sprout,
  reading, tugging the lamp's chain, peeking out of the window, sitting…;
  props like the can and the book are stamped at his hand in `stickman.ts`)
  and a pixel effect on the furniture (`playItemFx`, `room/itemFx.ts`: the
  lamp's rays, a flower, a bird, hearts…). There is no real lighting, only dots.
- **Themes / accessories**: data in `content/*`; each theme's wallpaper is a
  pattern in `wallpaper()` (`room/items/pixelArt.ts`). Light tints and body
  colors are still saved but have no effect on the monochrome screen.
  Accessories are dot lists around the stickman's head (`ACCESSORY_CELLS` in
  `character/pixel/stickman.ts`).
- **Character look**: a Cube World–style pixel stickman. Poses and
  per-state animations (walk cycle, idle fidgets, dances, jumping jacks,
  lying down to sleep…) live in `character/pixel/stickman.ts`, a pure
  worklet that stamps a skeleton onto a 32×32 dot sprite each frame;
  `CharacterRig` only feeds it shared values and places the sprite.
  The rest pose is the toy's 21-dot figure, dot for dot (a test pins it).
- **Gravity & tilt**: a tilt slides the stickman toward the low side like a
  marble (leaning back against it, his walking overpowered) and rolls the
  ball. Tilted far enough, `stepTilt` snaps his "down" to that side of the
  phone (`TiltState.side`: floor, left, top, right, with hysteresis) and eases
  `TiltState.angle` toward it: gravity carries him there and he stands on that
  wall (feet on the border) — or on the top edge when the phone is upside
  down. Furniture never moves or turns with the tilt: it stays on its base and
  only leans a little (`TiltState.lean`, up to `PHYS.itemLean`); standing
  pieces rock on their bottom edge, hung ones swing from the top (`LEAN` in
  `RoomItems`). Games keep "down" on the floor (`params.orientLocked`).
- **Shaking**: accelerometer jolts — sharp swings between two readings,
  measured in g against the gravity sensor (X in the web preview) — build up
  `TiltState.shake`; past 1 everything is knocked out of place (`scatter`):
  furniture gets offsets and twists (`MessState`) that ease home after a few
  seconds, the ball and stickman are flung by their own physics.
- **Device restart**: the orange LED on the device (with a reload icon) powers
  the screen down like an old LCD and back up; while it's dark everything
  inside the device goes back to its start (`commands.resetAll`). The app
  around it is untouched.
  Knocks read through the whole body: the physics keeps a `recoil` spring
  (driven by every velocity change, kicked by wall hits) and a decaying
  `flail`, which the sprite spreads across hips, chest, head, arms and knees.
- **UI chrome**: flat. A soft gray-green screen (`ui/Backdrop`), white cards
  and sheets, warm near-black ink for text and the floating nav pill (Home /
  Talk / Memories / Settings), and one brand blue (`colors.brand`) for
  highlights. Icons are platform-standard: SF Symbols on iOS, Material Symbols
  on Android and web (`ui/Symbol`, via `expo-symbols`), with our own vector
  icons (`ui/Icons`) as the fallback. The top bar is the
  logo plus a notifications bell (the activity log, unread since
  `progress.notificationsSeenAt`). The LCD sits in a little gadget
  (`screens/DeviceFrame.tsx`) whose color is a room setting
  (`room.device`, catalog in `content/devices.ts`; Auto follows light / dark);
  stats and Play / Customize / Friends live
  under it (`screens/HomeCards.tsx`).
- **Light / dark**: `theme/tokens.ts` holds `lightColors` and `darkColors`;
  `ThemeProvider` (`theme/theme.tsx`) picks one from `settings.appearance`
  (System / Light / Dark). UI never imports a palette: components call
  `useColors()`, and styles are module-level factories
  (`const makeStyles = (colors: Colors) => StyleSheet.create({...})`) read with
  `useStyles(makeStyles)`, rebuilt only when the palette changes. The LCD and
  its pixel art use their own palette and look the same in both modes.
- **New behavior**: add a `Behavior` in `brain/behaviors.ts` and a weight in
  `choose()`. Use `ctx.wait` / `ctx.walkTo` so it stays interruptible.
- **New game**: a scene component (reads `useWorld()`), registered in
  `games/GameHost.tsx`, that sets `actions` on the game session and calls
  `finishGame()`. The shared HUD handles intro / pause / results.
- **Conversation engine**: implement `ConversationEngine` and put it first
  in `ENGINES` (`conversation/engine.ts`). See `docs/LOCAL_AI.md`.
- **New assistant action**: add the intent to `INTENTS` (and the router
  examples in `ai/prompts.ts`), resolve and validate it in
  `assistant/resolve.ts`, add the typed action to `AssistantAction`, and map
  it to a planner service call in `assistant/execute.ts`. The model can only
  ever reach the planner through that fixed mapping.
- **Planner data**: change `planner/types.ts`, bump `PLANNER_VERSION`, add a
  step to `PLANNER_MIGRATIONS` and repair the field in `migratePlanner`.
- **Nearby transport**: implement `NearbyService` (`nearby/types.ts`). See
  `docs/NEARBY.md`.

## Accessibility & edge cases handled

Reduce motion (system or in-app), labeled controls and adjustable slider,
missing motion sensor (explained in Settings; drag still works), background /
resume (sensor unmounted, physics paused, games paused, saves flushed),
storage failures (notice, no crash), corrupt data (backup + fresh start),
empty states, interrupted games (pause card, quitting restores the room),
Android back button closes panels, small screens (room scales to the space
above any open panel and the keyboard).
