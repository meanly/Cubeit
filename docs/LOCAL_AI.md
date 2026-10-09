# On-device AI: status and plan

## What ships today

Cubeit talks through `scriptedEngine` (`src/conversation/scripted/`): a
small, honest set of intents — greetings, feelings, "remember…", recall of
saved memories, tricks, and a clear "I don't understand that yet" for
everything else. The UI labels it **Simple replies**, and asking "are you an
AI?" gets a truthful answer.

`localModelEngine` (`src/conversation/llm/localModelEngine.ts`) exists but
always reports **unavailable**: this build contains no inference runtime and
no model weights, and downloads nothing. Settings → Talking shows both
engines and which one is in use.

Already in place for a real model:

- `ConversationEngine` interface + engine registry (first available wins).
- `buildCompanionPrompt()` — persona, mood, rules (short replies, never invent
  memories, can't browse, safety), the most relevant **saved** memories and
  recent turns. Unit-tested.
- Memory saving stays consent-based: a model reply can include a proposal,
  but nothing is stored until the user taps **Save**.

## Realistic options (verify versions and licenses before adopting)

| Route | Runs on | Needs | Notes |
| --- | --- | --- | --- |
| **llama.rn** (llama.cpp) + GGUF model | iOS + Android | Dev build, model download | Most flexible; Metal / CPU. Good default. |
| **react-native-executorch** (Software Mansion) | iOS + Android | Dev build, model download | `useLLM` hook; ships tested small models (Llama 3.2 1B, Qwen 3 0.6B/1.7B…). |
| **Apple Foundation Models** (iOS 26+) via a bridge such as `@react-native-ai/apple` | Apple Intelligence iPhones only | Dev build, no download | System ~3B model, zero app size cost; unavailable on older devices. |
| **Gemini Nano** via ML Kit GenAI / AICore | Some recent Android flagships | Dev build | Device-gated; availability changes, check current support. |

Candidate models (4-bit quantized, rough figures):

| Model | Size | License | Fit |
| --- | --- | --- | --- |
| Qwen2.5-0.5B-Instruct / Qwen3-0.6B | ~0.4–0.5 GB | Apache-2.0 | Low-end friendly; simple chat. |
| SmolLM2-360M/1.7B-Instruct | ~0.25 / ~1.0 GB | Apache-2.0 | Very small option. |
| Llama 3.2 1B Instruct | ~0.8 GB | Llama 3.2 Community License | Good quality for size; license terms apply. |
| Gemma 3 1B IT | ~0.8 GB | Gemma Terms of Use | Good quality; terms apply. |
| Qwen2.5-1.5B / Qwen3-1.7B | ~1.0–1.2 GB | Apache-2.0 | Better replies; mid/high-end phones. |

Constraints to respect:

- **Memory**: model + KV cache must fit with headroom. On 3–4 GB RAM phones
  stay at ≤0.6B, or 1B with a 1–2k context. Check free memory before
  loading; fall back to the scripted engine on failure.
- **Latency**: expect very roughly 5–30 tokens/s depending on device. Keep
  replies to ~60 tokens; show the existing "thinking" state; stream tokens.
- **Battery / heat**: load the model only while the Talk panel is open,
  unload after a minute idle, never run in the background.
- **Size**: never bundle weights in the app binary.

## Steps to enable (llama.rn route)

1. Add the runtime and switch to a development build (Expo Go can't load it):

   ```bash
   npx expo install llama.rn
   ```

   ```bash
   npx expo prebuild
   ```

   ```bash
   npx expo run:android
   ```

   (or `eas build --profile development`).
2. **Model download with consent**: add Settings → Talking → "Download
   on-device AI (beta)" showing model name, size, license and a Wi-Fi
   recommendation. Download with `expo-file-system` into the app's document
   directory, verify a SHA-256 checksum, allow deleting it again. Never
   download silently and never make it required.
3. Implement `localModelEngine`:
   - `status()`: model file present + runtime loads + enough memory.
   - `reply()`: `buildCompanionPrompt(input, context, history)` → completion
     with `n_predict ≈ 80`, temperature ~0.7, stop sequences; map the result
     to a `CompanionReply`. Derive `expression` with a tiny keyword pass or a
     constrained JSON tail; detect "remember…" requests with the same rules
     as the scripted engine so memory saving keeps asking first.
   - Sketch (check the library's current API):

     ```ts
     const ctx = await initLlama({ model: modelUri, n_ctx: 2048, n_gpu_layers: 99 });
     const out = await ctx.completion({ messages: buildCompanionPrompt(input, context, history), n_predict: 80 });
     ```
4. Keep the scripted engine as the fallback for unsupported devices, load
   failures and low memory.
5. Update the in-app labels ("On-device AI") and privacy text, and test on a
   low-end Android phone and an older iPhone.

## Optional online AI (not implemented)

If ever added, it must be off by default, clearly labeled, opt-in per user,
and never required. Memories would only be sent with explicit permission.
