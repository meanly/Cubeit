# Cubeit — AppBuildersPH Hackathon 2026 pitch

| File | What it is |
|---|---|
| `Cubeit_Pitch_AppBuildersPH2026.pptx` | The deck: 6 slides, 16:9, editable, with speaker notes on every slide |
| `SPEAKER_SCRIPT.md` | Full five-minute script with timestamps, demo actions and recovery lines |
| `QA_PREP.md` | Likely judge questions with answers backed by the repo |
| `PITCH_AUDIT.md` | Product audit, verified vs. unverified claims, demo run sheet and phone prep |
| `assets/` | Screenshots and crops used in the deck, taken from the Cubeit web build (dark mode, seeded demo data) |
| `source/` | `build-deck.cjs` and `notes.cjs`, which regenerate the deck |

The deck uses **Segoe UI** and **Consolas**, which come with Windows and Office. On a Mac, PowerPoint substitutes similar fonts, so check the deck once if you present from a Mac.

To rebuild after editing the source, run this from `presentation/source`:

```bash
npm i pptxgenjs@3.12.0 && node build-deck.cjs
```

Edits made directly in PowerPoint are lost when you rebuild, so pick one way of editing and stick to it.
