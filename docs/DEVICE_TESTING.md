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
