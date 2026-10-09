# On-device AI, voice and photos

Everything here runs on the phone. The only network request Cubeit makes is
the one-time model download, and only after the user taps **Download** in
Settings → Talking.

## Status (be precise about what's verified)

| Piece | Implemented | Verified so far |
| --- | --- | --- |
| Model download + SHA-256 verify + delete | Yes (`src/ai/modelFiles.ts`, `modelManager.ts`) | Unit tests for the hash; **not yet run on a phone** |
| LLM inference (llama.rn) | Yes (`src/ai/runtime.ts`) | Typecheck only. **Not yet run on a physical iPhone** — no Mac/iPhone in the dev environment |
| Structured actions (model → validated action → confirm → save) | Yes (`src/assistant/`) | 60+ unit tests incl. malformed model output; web preview with the built-in parser |
| Built-in parser fallback | Yes (`src/assistant/intentParser.ts`) | Unit tests + web preview |
| Voice → text (on-device Speech framework) | Yes (`src/media/voice.ts`, `panels/talk/useVoiceInput.ts`) | Error mapping unit-tested; **needs a device** |
| Photo → text (Apple Vision OCR) | Yes (`src/media/images.ts`, `panels/talk/PhotoImport.tsx`) | Text heuristics unit-tested; **needs a device** |

Nothing in this list is claimed to work on an iPhone until it has been run
there — see "Verify on an iPhone 14 Plus / Pro Max" below.

## The model

| | |
| --- | --- |
| Model | **Qwen2.5-0.5B-Instruct**, GGUF **Q4_K_M** (`qwen2.5-0.5b-instruct-q4_k_m.gguf`) |
| Source | `huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF`, pinned to commit `9217f5db79a29953eb74d5343926648285ec7e67` |
| Size / checksum | 491,400,032 bytes · SHA-256 `74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db` (from the HF API, checked 2026-10-10) |
| License | Apache-2.0 |
| Runtime | **llama.rn 0.12.9** (llama.cpp, Metal on iOS). Pinned on purpose: npm's `latest` tag points at `0.13.0-rc.7`, a release candidate |
| Limits | `n_ctx` 2048, all layers on Metal, ≤160 tokens per reply, 45 s timeout (`src/ai/modelInfo.ts`) |

Compatibility notes (checked, not assumed):

- llama.rn ≥ 0.10 requires the **New Architecture** — Expo SDK 57 / RN 0.86 is New-Architecture-only, so that's satisfied.
- llama.rn ships a prebuilt `rnllama.xcframework` (iOS ≥ 13) and compiles its JSI bindings from source against the app's React Native. Its example app targets **RN 0.82**; this project is on **RN 0.86**. No incompatibility is known, but it hasn't been compiled here (Windows, no Xcode). **The first EAS iOS build is the real check.** If it fails in the JSI layer, try `llama.rn@0.13.0-rc.7`.
- The llama.rn config plugin is used with `enableEntitlements: false` (the increased-memory-limit entitlement isn't needed for a 0.5B model on a 6 GB iPhone 14 Plus / Pro Max, and leaving it off avoids a provisioning capability).
- Its `postinstall` downloads the native binaries from GitHub (SHA-256 checked). **On Windows run `npm install` from PowerShell or cmd, not Git Bash** — Git Bash's `tar` can't extract `C:\…` paths. EAS build machines are unaffected.
- Expo Go doesn't contain llama.rn, the speech module or the OCR module. The app detects that and says so; it needs a **development build**.

Inference happens on llama.rn's native threads, never the JS or UI thread, so
the room keeps animating. The model loads when the Talk panel opens (if
installed), requests are queued one at a time, and it's released after 90 s
idle or when the app goes to the background.

## How a message is handled (`src/assistant/assistant.ts`)

1. **Safety** lines (self-harm phrases) always get the fixed, careful reply.
2. **Follow-up answers**: if the assistant asked "What day is it?", the reply fills that slot.
3. **Built-in commands**: "remember that…" (memory proposal) and tricks ("dance") keep their existing consent-based flow.
4. **Model installed** →
   - The model classifies the message into one of 16 intents and copies the user's own words into slots, with output **constrained to a JSON Schema** (llama.cpp grammar). It never computes dates.
   - `parseModelOutput` → `coerceRawIntent` reject anything malformed, unknown or wrongly typed.
   - `resolveIntent` validates everything: resolves date words against the phone's clock (`dateParse.ts`), checks times, finds the referenced habit/chore/event, rejects past dates, and asks a follow-up question when something essential is missing.
   - Changes (create/edit/complete) become a **confirm card**; nothing is written until the user taps it. Then `executeAction` runs a fixed mapping onto `planner/service.ts`, which validates again, **writes to SQLite synchronously and rolls back if the write fails**, and only then reports success, pays Stars and lets the character react.
   - Read-only questions ("what's on tomorrow?", "how's my streak?") run immediately from stored data. Journal questions are answered by the model **only from the retrieved entries**, which are listed under the answer.
   - Anything else gets a chat reply from the model (persona prompt, saved memories, a few facts about today from the planner).
   - If the model's output can't be validated, the built-in parser tries; if the model errors, built-in replies answer and the chat says so.
5. **No model** → the built-in parser (`intentParser.ts`, rule-based, not AI) handles planner requests; everything else gets the scripted replies.

Every reply in the chat is labeled **On-device AI**, **Built-in parser**,
**Simple reply** or **Built-in**, so a rule-based answer is never presented as
the model's.

## Voice input

Tap the mic in Talk → `expo-audio` records mono 16 kHz AAC → tap ✓ →
`expo-speech-recognition` transcribes the file with
`requiresOnDeviceRecognition: true` (Apple's Speech framework; iOS refuses
rather than falling back to Apple's servers) → the text goes into the input
box to **review and correct** before sending → the recording is deleted.
Handles: mic/speech permission denied, too-short recordings, no speech,
interruptions, cancel, 60 s auto-stop, and phones without on-device support
for the language (it says so instead of using the network). Default language
is `en-US`.

## Photos

Camera icon in Talk → take or choose a photo (`expo-image-picker`) → preview →
**Read text** → `expo-image-manipulator` makes an upright ≤2000 px copy (Apple
Vision ignores EXIF rotation) → `expo-text-extractor` runs **Apple Vision OCR**
(on-device) → the text is editable → turn it into an **event**, a **checklist
chore**, a **habit**, or a **journal entry with the photo attached**; each still
shows a confirm card. Temporary copies are deleted when the flow closes.
This is text recognition only: Cubeit does not claim to understand images and
ships no vision model.

## Verify on an iPhone 14 Plus / Pro Max

1. Build a development client in the cloud (no Mac needed):

   ```bash
   npx eas-cli@latest build --profile development --platform ios
   ```

   (First time: `npx eas-cli@latest login` and register the iPhone with `npx eas-cli@latest device:create`.)
2. Install it on the iPhone from the link EAS prints, then start Metro: `npx expo start --dev-client` and open the app.
3. Settings → Talking → **Download** (Wi-Fi). Wait for "Checking the file (SHA-256)" to finish → "Installed and verified".
4. Open Talk; the pill should read **On-device AI**. Send "How are you?" — the reply must be labeled **On-device AI**; Settings then shows a tokens/s figure.
5. **Offline test.** A development build loads its JavaScript from Metro over the network, so for Airplane Mode use a release-style build with the JS bundled in:

   ```bash
   npx eas-cli@latest build --profile preview --platform ios
   ```

   Install it, download the model once (step 3), then **turn on Airplane Mode** (Wi-Fi off too), force-quit and reopen. Send "Add dentist tomorrow at 3pm" → confirm card → **Add event** → check Planner → Calendar. Send "What's on my schedule tomorrow?" and "How are you?" — the replies must arrive, labeled **On-device AI**.
6. Voice: still in Airplane Mode, tap the mic, say "remind me to call mom on Friday at 6pm", ✓ → the text appears for review.
7. Photo: photograph a printed flyer → Read text → Event.
8. Record results (model load time, tokens/s, memory warnings) in `docs/DEVICE_TESTING.md`.

Until steps 4–7 have been done, on-device inference, voice and OCR are
**implemented but unverified on hardware**.
