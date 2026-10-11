# Cubeit pitch — product audit, demo run sheet, open risks

Audited on 2026-10-10 against the working tree (`main` @ `69b6a05`, plus uncommitted edits to `StarCatch.tsx`, `geometry.ts` and `worldLogic.test.ts`).

## 1. What Cubeit is (verified in code)

**Pip, the companion.** A pixel stickman drawn on a 60×60-dot LCD room.

- 20 animation states and a mood- and personality-driven behavior loop.
- Reacts to tap, long-press (pet), drag (pick up and toss) and tilt or shake. Tilt and shake come from the device's gravity sensor, simulated with the keyboard on web.
- On-screen speech bubbles. Pip listens while you type, shows thinking dots while it works, and says the reply.
- Celebrates when a habit is completed (`plannerDone` → `celebrate` in `src/character/brain/Brain.ts`).

**Planner.**

- **Calendar:** day, week and month views, with all-day and timed events.
- **Habits and routines:** streaks count only scheduled days.
- **Chores:** repeats, checklists, overdue tracking.
- **Journal:** moods, prompts, photos, search, and a weekly summary that can be written by the model.
- **Stars:** paid once per completion.
- **Reminders:** local notifications.

**Talk.** Plain-language requests become planner actions through the pipeline in §3. Every change waits for a confirm tap. Voice input and photo-to-text are implemented but need a development build.

**Also present:** Customize (themes, furniture, accessories bought with stars), two games, Friend sheet with Memories and Finds, Settings, data export. **Nearby friends is a labeled simulation**, so don't present it as real.

## 2. What's verified vs. not

| Claim | Status | How it was checked |
|---|---|---|
| Unit tests | ✅ 176 passing | `npx jest` on 2026-10-10. The README still says 163, which is out of date. |
| Demo flow (event, weekly chore, habit with celebration, schedule question, Planner) | ✅ Works in the **web build with the rule-based parser** | Scripted Playwright run against `expo start --web`. Screenshots are in `assets/`. |
| Pip celebrates after "Mark done" | ✅ Web build | Frame capture `assets/lcd-celebrate.png` |
| Past date rejected; missing time triggers a follow-up | ✅ Web build | "Add dentist yesterday at 3pm" → rejected. "Add dentist on Tuesday" → "What time…?" |
| Only network call is the model download | ✅ Code search | The only URL and download in `src/` are `src/ai/modelInfo.ts` and `modelFiles.ts` |
| Chats aren't saved | ✅ Code | `useChatSession` is a non-persisted zustand store |
| **On-device model (llama.rn) runs on a phone** | ❌ **Not verified** | No EAS build has been run. The docs say so explicitly. |
| Model routes the four demo phrases correctly | ❌ Not verified | Phrases 1, 3 and 4 closely match the prompt's few-shot examples, but they're untested on the model |
| Works in Airplane Mode | ❌ Not verified on hardware | Needs a preview build |
| Voice (on-device speech) and photo OCR | ❌ Implemented, unverified | Needs a device |
| Reminders fire | ❌ Implemented, unverified | Needs a device |
| Tilt and shake physics on a real sensor | ❌ Only the web keyboard simulation is verified | `docs/DEVICE_TESTING.md` is unchecked |
| Load time, tokens per second, memory use | ❌ **Not measured. Don't state any number.** | — |

**Multi-item messages don't work.** "I need to pay rent on Friday at 9am and clean the bathroom on Saturday and call mom tonight" returned the scripted "I don't understand that one yet" in the web build. The model router also returns a single intent per message (`ROUTER_JSON_SCHEMA`). The demo therefore uses four short messages.

**Pre-hackathon vs. hackathon work** can't be settled from the repo. See QA_PREP.md, question 9.

## 3. Local AI pipeline (as implemented)

```
message ─► safety check ─► (follow-up answer?) ─► built-in commands ("remember that…")
        ─► model installed?
             yes ─► Qwen2.5-0.5B via llama.rn, JSON-schema grammar, temp 0.1 ─► parseModelOutput / coerceRawIntent
                    ├─ valid planner intent ─► resolveIntent (dates from phone clock, past rejected,
                    │                          match habit/chore/event, ask if missing)
                    │                          ├─ write ─► confirm card ─► tap ─► executeAction ─► planner/service
                    │                          │                                   (sync SQLite write, rollback on failure)
                    │                          └─ read ─► answer now (journal: grounded answer from listed entries)
                    ├─ invalid JSON ─► rule-based parser (labeled "Built-in parser")
                    └─ "chat" ─► model chat reply (persona, saved memories, today's planner facts)
             no ─► rule-based parser, then scripted replies
```

Files: `src/assistant/assistant.ts` (`respond`), `src/ai/prompts.ts`, `src/assistant/schema.ts`, `resolve.ts`, `execute.ts`, `src/ai/runtime.ts`.

## 4. Demo run sheet

### Must do before pitch day, in order

1. **Build a release-style iOS build** with the JS bundled, so it works offline:

   ```bash
   npx eas-cli@latest build --profile preview --platform ios
   ```

   First time only: run `npx eas-cli@latest login` and register the phone with `device:create`. Full steps are in `docs/LOCAL_AI.md`.
2. Install it. Then go to **Settings → Talking → Download** on Wi-Fi and wait for "Installed and verified".
3. **Turn on Airplane Mode** (Wi-Fi off too), force-quit and reopen.
4. Open Talk and confirm the header pill reads **On-device AI**.
5. Send the four demo messages **10 times in a row**. For each run, note whether the reply is labeled **On-device AI** or **Built-in parser**, and whether the card is correct.
6. Record load time and the tokens/s shown in Settings in `docs/DEVICE_TESTING.md`.
7. Decide from the results:
   - **All good:** use the script as written.
   - **The model misroutes a phrase:** rephrase it closer to the examples in `src/ai/prompts.ts`, but keep a phrasing the rule-based parser also handles, so the fallback still produces the right card. All four current phrases pass the parser. Test again on the phone.
   - **The model doesn't load at all:** use the Plan B wording in SPEAKER_SCRIPT.md and demo with the fallback parser, labeled as such.
8. **Record a backup screen recording** of one clean run on the phone.

### Demo phone data, set up the day before

- Create a daily habit called **"Evening walk"**. Make sure it is **not** marked done on pitch day. If you rehearse on the same day, untick it in Planner → Habits.
- Delete any **"Pay rent"** events and **"Clean the bathroom"** chores left from rehearsals. Duplicate events aren't blocked.
- Add a few real-looking events, habits and journal entries so the Planner looks lived-in.
- Pick a day word that **isn't the pitch day**. "On Friday" said on a Friday resolves to *today*. If the pitch is on a Friday, say "on Monday" instead.
- Settings: sound on (low), haptics on, and turn off Reduce Motion so Pip's celebration plays fully.

### On the day

- **Model warm-up:** the model loads when Talk opens and unloads after 90 s idle or whenever the app goes to the background. If your measured load time is noticeable, open Talk during slide 3. Don't switch apps on the phone after that.
- **Typing speed:** four sentences typed live can eat 30–40 s. Set up iOS Text Replacements (Settings → General → Keyboard → Text Replacement), for example `rr1` → "Remind me to pay rent on Friday at 9am". It's still real typed input, just faster.
- **Mirroring:** test the venue's mirroring setup (cable, AirPlay receiver or document camera) with this exact phone. Mirroring shouldn't background the app, but check.
- **Brightness** at maximum and Do Not Disturb on.

### Verified flow (web build, rule-based parser)

| Step | Message | Card / result |
|---|---|---|
| 1 | Remind me to pay rent on Friday at 9am | *Add to calendar · Pay rent · Fri, Oct 16 · 9 AM · Reminder at the start time* → **Add event** → "Added 'Pay rent' — Fri, Oct 16 9 AM." |
| 2 | Add clean the bathroom to my chores every Saturday | *New chore · Clean the bathroom · Due today · Every week* → **Add chore**. (Due "today" because the test ran on a Saturday.) |
| 3 | I finished my evening walk | *Complete habit · Evening walk · Today* → **Mark done** → "'Evening walk' done — 2 scheduled days in a row!" Pip jumps with "EVENING WALK – DONE!" and stars go 85 → 87. |
| 4 | What is on my schedule this week? | "You have 3 things this week." plus a list (read-only, no card) |
| 5 | Planner tab | Calendar, Chores and Habits all show the new items |

## 5. Claims in the deck and where they come from

| Slide claim | Source | Note |
|---|---|---|
| Naps, dances, waves; reacts to tap, pet, pick up, tilt | `src/character/`, `README.md` | Tilt verified only in the web simulation |
| Calendar day/week/month, reminders | `src/panels/planner/`, `src/planner/reminders.ts` | Reminders unverified on device |
| Streaks count only planned days | `src/planner/habits.ts`, README | Unit-tested |
| Finish a habit or chore → Pip celebrates, stars | `src/planner/service.ts` `reward()` → Brain | Habit verified on web. Chores use the same `reward()` path. |
| Qwen2.5 0.5B on llama.rn (llama.cpp), 16 intents, JSON schema | `src/ai/modelInfo.ts`, `runtime.ts`, `src/assistant/schema.ts` | Code-verified, **not run on a device** |
| Dates from the phone's clock, past dates rejected, follow-up questions | `src/assistant/dateParse.ts`, `resolve.ts` | Verified on web |
| SQLite on the phone, rolled back on failure | `src/state/plannerStore.ts`, `docs/ARCHITECTURE.md` | Code-verified |
| Speech-to-text runs on the phone | `src/media/voice.ts` (`requiresOnDeviceRecognition: true`) | **Unverified on device** |
| One-time 491 MB download, SHA-256, no other network calls | `src/ai/modelInfo.ts`, `modelFiles.ts`, code search | Code-verified |
| Replies labeled by source | `src/panels/TalkPanel.tsx` `SOURCE_LABEL` | Seen in the web build ("Built-in parser") |

**Screenshots** are from the web build (dark mode, seeded demo data from `cubeit-video/recorder/seed.mjs`), not from an iPhone. The UI is the same React Native code. Once the device build works, you could swap in device screenshots, especially one showing the **On-device AI** label.
