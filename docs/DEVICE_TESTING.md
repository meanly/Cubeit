# Physical device checklist

These need a real phone; none of them have been verified on hardware yet.
Run with Expo Go (`npx expo start`, scan the QR code) on at least one iPhone
and one Android phone, ideally including a low-end Android device.

## Motion
- [ ] Lowering the **left** edge slides the character **left**; right → right.
- [ ] Tilting the top of the phone away (flatter) moves it toward the back of
      the room; tilting it toward you brings it forward.
- [ ] Holding still at a normal angle → the character stays still (auto neutral).
- [ ] Small hand tremor doesn't move it; returning to neutral slows it naturally.
- [ ] Settings → Set neutral position, then hold at a new angle: stays still.
- [ ] Sensitivity slider changes the response; Tilt off → no movement at all.
- [ ] A hard tilt while it naps on the cushion knocks it out of bed.
- [ ] Phone flat on a table with tilt on → no drift after auto-calibration.
- [ ] A device/emulator without a gravity sensor shows the "no motion sensor" note.

## Touch
- [ ] Tap → hop and hello; rapid taps → giggles, then "Okay, okay!".
- [ ] Long-press → hearts. Drag → picked up; release → falls, squashes, lands.
- [ ] Tap floor → walks over to investigate. Tap lamp → light toggles.
- [ ] Tap ball → it rolls and the character chases it.
- [ ] Panel buttons and game HUD buttons never move the character by accident.

## Feel & performance
- [ ] Smooth animation on a low-end Android phone (character, ball, panels).
- [ ] Haptics fire on taps, catches and toggles; off when disabled.
- [ ] Sounds play; respect the iOS silent switch; never stop your music.
- [ ] Reduce Motion (OS setting, or Settings → Reduce motion → On) calms bounces.

## Lifecycle & storage
- [ ] Background the app mid-game → returns paused; Resume works.
- [ ] Kill and reopen → name, room, stars, memories and position all restored.
- [ ] Airplane mode → everything still works.
- [ ] Next calendar day → greeting + one new Find; skipping days costs nothing.

## Layout
- [ ] Small phone (e.g. iPhone SE) and tall phone: room fills the space; no clipped controls.
- [ ] Talk panel with the keyboard open: input visible, room shrinks above it.
- [ ] Android back button closes panels before leaving the app.

## Planner, on-device AI, voice and photos (development / preview build)

These need the EAS build (Expo Go can't load llama.rn, speech or OCR). Steps
and build commands: [LOCAL_AI.md → Verify on an iPhone](LOCAL_AI.md#verify-on-an-iphone-14-plus--pro-max).
Target: iPhone 14 Plus and iPhone 14 Pro Max.

- [ ] Settings → Talking → Download: progress shows, cancel works, "Checking the file (SHA-256)" completes, "Installed and verified".
- [ ] Talk pill reads **On-device AI**; first reply after opening Talk arrives (record load time: ____ s, speed: ____ tok/s).
- [ ] Airplane Mode (preview build, Wi-Fi off): chat reply, "add … tomorrow at 3pm" → confirm → saved, "what's on my schedule tomorrow?" all work.
- [ ] A wrong model answer never saves anything without tapping the confirm card.
- [ ] Room animation stays smooth while the model is generating.
- [ ] Backgrounding the app releases the model (no crash on return; next reply reloads it).
- [ ] Delete model → Talk falls back to "Simple replies" / "Built-in parser" labels.
- [ ] Voice: permission prompts appear once; transcript appears for editing; cancel works; a 0.3 s tap says "too short"; recording files are gone afterwards.
- [ ] Voice in Airplane Mode still transcribes (on-device), or clearly says on-device recognition isn't available.
- [ ] Photo: camera and library both work; upright text from a rotated photo is read; Event / Checklist / Habit / Journal each show a confirm card.
- [ ] Reminders: an event with "10 min" reminder notifies on time; a daily habit reminder fires; editing or deleting the item removes the old notification; denying notification permission shows the note.
- [ ] Habits: completing twice, or undo + redo, pays Stars only once; streak survives a skipped *unscheduled* day.
- [ ] Recurring chore: finishing it moves the due date to the next occurrence; relaunching the app doesn't add copies.
- [ ] Kill and reopen → events, habits, chores, journal (with photos) all restored.
- [ ] Settings → Export my data includes `planner`; Start over clears planner + journal photos but keeps the AI model.
