# Cubeit — Q&A prep

Short answers first, then the evidence you can point to if a judge digs in. File paths are relative to the repo root.

**Ground rule:** the on-device model is **implemented but has not yet been run on a physical phone** (`docs/LOCAL_AI.md`, `docs/DEVICE_TESTING.md`). Until you've run it on the demo phone, answer performance and "does it really work on device" questions with that status. Never quote a speed or load time you haven't measured.

---

### 1. Why does Cubeit need local AI?

**Answer:** Because of what it reads. Pip works with your calendar, routines, journal and the things you asked it to remember. That's some of the most personal data on a phone. A companion should be able to help with it without sending it to anyone. Local also means it keeps working with no signal and needs no account.

**Evidence:** The only network request in `src/` is the model download (`src/ai/modelFiles.ts` → `MODEL.url` in `src/ai/modelInfo.ts`). There's no analytics SDK in `package.json`. Settings states "no account, no analytics and no servers" (`src/panels/SettingsScreen.tsx`).

### 2. Why not just call a cloud API? It would be smarter.

**Answer:** It would chat better, yes. But we'd be shipping people's journals to a server, it would stop working offline, and it would need accounts and per-request costs. So we designed around a small model. It doesn't do the hard parts. It only classifies the request and copies the user's words. Dates, validation and saving are ordinary deterministic code, which a small model can handle.

**Evidence:** The router prompt says "copy date and time words exactly … never calculate dates" (`src/ai/prompts.ts`). Date resolution is in `src/assistant/dateParse.ts`.

### 3. Which model and runtime?

**Answer:** Qwen2.5-0.5B-Instruct, quantized to Q4_K_M in GGUF format. It's a 491 MB file under the Apache-2.0 license, run with llama.rn 0.12.9, which is llama.cpp for React Native. On iOS every layer is offloaded to Metal.

**Evidence** (`src/ai/modelInfo.ts`, `src/ai/runtime.ts`):

| Item | Detail |
|---|---|
| Download | Pinned to Hugging Face commit `9217f5db…` and verified with SHA-256 before install |
| Context | `n_ctx` 2048 |
| Output limit | 160 tokens for routing, 120 for chat |
| Temperature | 0.1 for routing |
| Timeout | 45 s per completion |
| Threading | Runs on llama.rn's native threads, not the JS or UI thread |
| Concurrency | Requests are queued one at a time |
| Unloading | Released after 90 s idle or when the app goes to the background |

- **Why 0.5B?** It fits comfortably in memory on a 6 GB iPhone 14 Plus or Pro Max, the target devices, and the job is narrow: pick an intent and copy words.
- **Android?** llama.rn supports it, but the config has GPU/NPU acceleration off (`enableOpenCLAndHexagon: false` in `app.json`) and it's untested. Say "iPhone is our target and the first test platform."

### 4. What works without internet?

**Answer:** Everything, once the model is downloaded. That covers the room and Pip, the planner, Talk (model or fallback parser), voice-to-text, reading text from photos, reminders and games. The one-time model download needs internet.

**Caveats:**

- On iOS, voice uses Apple's Speech framework with `requiresOnDeviceRecognition: true` (`src/media/voice.ts`). If the phone can't do on-device recognition for the language, the app says so instead of falling back to Apple's servers.
- A *development* build loads its JavaScript from the laptop over the network. The Airplane Mode test needs a *preview* or release build (`docs/LOCAL_AI.md`).
- **Status:** Airplane Mode with the model hasn't been verified on hardware yet. If you've done it before the pitch, say so plainly.

### 5. Does any user data leave the device?

**Answer:** No. Chats aren't sent anywhere and aren't saved. Planner, journal, memories and settings live in a local SQLite database. Voice recordings and photo copies are deleted after use. The only network traffic is downloading the model file, and the only way data leaves is if you use Export yourself.

**Evidence:**

- The chat store is a plain, non-persisted zustand store (`src/conversation/chatSession.ts`).
- Storage uses `expo-sqlite/kv-store` (`docs/ARCHITECTURE.md` → Persistence).
- Temporary files are cleaned up in `src/media/files.ts`.
- Reminders are local notifications (`scheduleNotificationAsync` in `src/services/notifications.ts`), not push.

### 6. How do you turn natural language into actions?

**Answer:** In five steps.

1. The model gets a short system prompt with the 16 intents and 10 examples, and must answer in JSON. A JSON Schema is turned into a llama.cpp grammar, so it can't produce anything else.
2. The output is parsed defensively, and unknown intents or wrong types are thrown out.
3. A resolver turns the user's words into a typed action: a real date, a time, and the ID of the habit or chore they meant.
4. Anything that changes data becomes a confirm card.
5. Only after the tap does a fixed executor call the planner service. The model can't reach the database any other way.

Questions like "what's on this week" run immediately, because they only read data. For journal questions, the model answers only from the retrieved entries, which are listed under the answer.

**Evidence:**

- `routerMessages` and `ROUTER_SYSTEM` in `src/ai/prompts.ts`
- `ROUTER_JSON_SCHEMA`, `parseModelOutput` and `coerceRawIntent` in `src/assistant/schema.ts`
- `resolveIntent` in `src/assistant/resolve.ts`
- `executeAction` in `src/assistant/execute.ts`
- `groundedAnswer` in `src/assistant/assistant.ts`

### 7. How do you stop wrong dates or unintended actions?

**Answer:** Several layers:

- **The model never does date math.** It copies "Friday at 9am", and `dateParse.ts` resolves it against the phone's clock.
- **Past dates are rejected:** "That date is in the past."
- **Missing details trigger a question,** for example "What time is 'Dentist'?"
- **Ambiguous matches ask "Which one do you mean?"** and offer up to four options.
- **Every change needs a tap on a card** showing exactly what will be saved, and Cancel is right there.
- **The planner service validates again,** writes synchronously and rolls back if the write fails. Pip only reacts after the save succeeds.
- **Stars can't be farmed.** Each reward has a claim key, so undoing and redoing a habit doesn't pay twice.
- **If the model's JSON doesn't validate,** the rule-based parser tries instead and the reply says so.

**Evidence:** `resolve.ts` (reject and ask paths), `src/state/plannerStore.ts` (`commitPlanner`), `claimReward` in `src/planner/ops.ts`. There are 176 unit tests passing, including assistant tests for malformed model output (`src/__tests__/assistant.test.ts`). I checked the past-date rejection and the missing-time question in the web build.

### 8. How is this different from a to-do app, a chatbot, or a virtual pet?

**Answer:**

- **A to-do app** stores tasks. Cubeit adds someone who notices: Pip celebrates when you finish things, and you build a relationship over time.
- **A chatbot** gives you text. Cubeit turns what you say into checked, structured items you approve, and it labels whether the model or the fallback answered.
- **A virtual pet** has its own care loop, often with guilt. Pip's "care" is you getting your own life done. Skipping days costs nothing (`docs/DEVICE_TESTING.md`: "skipping days costs nothing").
- **All of it is local.**

### 9. What did you build during the hackathon versus before?

**Answer (fill in from your own knowledge; the repo can't settle it):**

- **What git shows:** all nine commits are on 2026-10-10, between 01:51 and 08:41 (+08:00). The first commit (`6e636db "initial"`) already contained:
  - the room
  - the stickman rig and physics
  - games
  - the scripted conversation

  In that commit, the local model was an **explicit placeholder** that always reported "not available" (`src/conversation/llm/localModelEngine.ts` at `6e636db`).
- **The `planner` commit** (`4ddbbc3`, 06:33) added:
  - the real on-device model (`src/ai/`)
  - the whole assistant pipeline (`src/assistant/`)
  - the planner, voice and photo OCR
- **What git can't show:** whether the work in the first commit was done before the hackathon window. If the room and Pip existed beforehand, say so: "Pip and the room existed before. During the hackathon we built the local AI assistant and the planner it acts on."

### 10. What are the limitations, and what's next?

**Answer, honestly:**

- **One request per message.** "Rent Friday and bathroom Saturday" in one sentence isn't split. I checked: the parser can't handle it and the router returns a single intent. *Next:* split compound requests into several confirm cards.
- **Device testing.** The on-device model, voice, OCR and reminders are implemented but not yet verified on hardware (`docs/DEVICE_TESTING.md`). *Next:* benchmark load time and tokens per second on iPhone 14-class devices.
- **The small model chats simply.** That's why the important work is in validated code.
- **English only, and iPhone-first.** Voice defaults to `en-US`. Android is untested.
- **Nearby friends is a labeled simulation.** Real Bluetooth discovery is designed but not built (`docs/NEARBY.md`). Don't demo it as real.
- **No sync with external calendars.**

---

## Quick facts card

| | |
|---|---|
| Model | Qwen2.5-0.5B-Instruct · Q4_K_M GGUF · 491,400,032 bytes · Apache-2.0 |
| Runtime | llama.rn 0.12.9 (llama.cpp), Metal on iOS |
| App | Expo SDK 57 · React Native 0.86 · TypeScript · Reanimated 4 |
| Intents | 16: 15 planner and memory intents, plus `chat` |
| Storage | SQLite (`expo-sqlite/kv-store`), versioned migrations, corrupt-data backup |
| Network | One user-started download from Hugging Face, SHA-256 checked |
| Tests | 176 passing (run 2026-10-10) |
| Not measured | Load time, tokens/s, memory on device. **Don't quote numbers.** |

## Questions to deflect gracefully

- **"How fast is it?"** If you've measured it on the phone, give the number and the device. If not: "We haven't benchmarked it on hardware yet. Settings shows tokens per second once it runs, and that's the next thing we're recording."
- **"Is the parser AI?"** No. It's a rule-based fallback for when the model isn't installed or its output fails validation, and the app labels those replies "Built-in parser."
- **"Can it see my photos?"** It only reads the *text* in a photo you pick, using Apple Vision OCR on the phone. There's no image-understanding model.
