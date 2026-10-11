# Cubeit pitch — speaker script (5:00)

Deck: `Cubeit_Pitch_AppBuildersPH2026.pptx` (the same text is in each slide's speaker notes).
Target length is about 4:50, which leaves roughly 10 seconds of slack. Spoken text is about 560 words (about 3:20 at 145 words per minute) plus the 95-second demo, where most of the time goes to typing, loading and tapping.

| # | Slide | Time | Length |
|---|---|---|---|
| 1 | Most of life is little things | 0:00–0:30 | 30 s |
| 2 | Meet Pip | 0:30–1:10 | 40 s |
| 3 | Four everyday jobs, one place | 1:10–1:40 | 30 s |
| 4 | **Live demo** | 1:40–3:15 | 95 s |
| 5 | Why it runs on the phone | 3:15–4:25 | 70 s |
| 6 | You've got a companion | 4:25–4:50 | 25 s |

---

## 1 · Hook — 0:00–0:30

> Rent's due Friday. The bathroom needs cleaning on Saturday. Did I actually go for my walk today? And what did I write last week, when things were rough?
>
> None of this is hard. There's just a lot of it, and most of it lives in our heads.
>
> We built Cubeit for those little things. It's a companion that helps you keep track of them, and it does that on your phone, without sending your life to a server.

*Click.*

## 2 · Meet Pip — 0:30–1:10

> This is Pip. Pip lives in this little LCD room on your phone. It wanders around, naps, waves, plays with its ball. You can tap it, pet it, pick it up, and if you tilt the phone, it slides.
>
> That's the companion. Underneath it is the useful part: a calendar, habits and routines, chores, and a journal.
>
> And the two are connected. When you finish a habit or a chore, Pip celebrates and you earn stars.
>
> So our idea is simple: the companion makes you want to open the app, and the assistant makes it worth opening.

*Click.*

## 3 · What it helps with — 1:10–1:40

> So what can you actually do with it? Four everyday jobs.
>
> The calendar remembers what's coming and reminds you on the phone. Habits keep your routines going, and streaks only count the days you planned, so a rest day doesn't break them. Chores get due dates, repeats and checklists. And the journal lets you look back, with moods, prompts and search.
>
> You can do all of that by hand. But the faster way is to just tell Pip. Let me show you.

*Click to slide 4, then switch the screen to the phone mirror.*
*(If the model takes a while to load, open Talk on the phone during this slide. See the run sheet.)*

## 4 · Live demo — 1:40–3:15

The slide stays up as a backup if the mirror fails. Speak while things load; never wait in silence.

| Step | On the phone | Say |
|---|---|---|
| 0 | Home screen, Pip visible. Tap **Talk**. Point at the header pill: **On-device AI**. | "This phone is in Airplane Mode." |
| 1 | Send **"Remind me to pay rent on Friday at 9am"** | "I'll just tell it like I'd tell a friend." While Pip shows the thinking dots: "That's the model running on the phone." |
| 1b | Confirm card appears: *Add to calendar · Pay rent · Fri · 9 AM · Reminder at the start time*. Tap **Add event**. | "It hasn't saved anything. It shows me what it understood. The date comes from the phone's clock, not from the model." |
| 2 | Send **"Add clean the bathroom to my chores every Saturday"** → card *New chore · Every week* → tap **Add chore**. | "A weekly chore." |
| 3 | Send **"I finished my evening walk"** → card *Complete habit* → tap **Mark done**. **Point at the room.** | "And there, Pip celebrates. My streak goes up and I get stars. That small moment is why people come back." |
| 4 | Send **"What's on my schedule this week?"** → a list, no card. | "Questions don't need a confirm. It just reads my planner." |
| 5 | Tap **Planner**. Calendar shows a dot on Friday; **Chores** tab shows *Clean the bathroom*; **Habits** tab shows *Evening walk* ticked. | "Everything's there, in the normal planner." |

*Switch back to the slides. Click to slide 5.*

**If something goes wrong**

- **The model is slow** (more than about 10 s): keep talking. "It's a half-billion-parameter model on a phone. It's working through the request and checking the format."
- **A reply is labeled "Built-in parser"** (the model's output failed validation, or the model errored): say so. "That one was handled by our rule-based fallback, and the app tells you that." The confirm card and saving work the same way.
- **A wrong card appears:** tap **Cancel**. "And this is exactly why nothing saves without a tap." Then rephrase and send again. This works in your favor; don't hide it.
- **The phone or mirror dies:** stay on slide 4 and narrate the four steps from the slide. Play the backup screen recording if you have one.

## 5 · Why it runs on the phone — 3:15–4:25

> Why local? Because of what Cubeit reads: your calendar, your routines, your journal. A companion you trust with that shouldn't have to send it to someone else's server.
>
> Here's what happens on the phone. You type, or speak, and speech-to-text runs on the device too. A small language model, Qwen 2.5 with half a billion parameters, runs through llama.cpp using llama.rn.
>
> It doesn't answer freely. It picks one of sixteen intents and copies your words into JSON, and a schema locks the format. Then our code checks everything: it works out the date from the phone's clock, rejects dates in the past, finds the habit you meant, and asks if something's missing. Only after you tap does it save, into SQLite on the phone.
>
> So the model proposes, the app checks, and you decide.
>
> The internet is used once, to download the model, about 490 megabytes, checked with SHA-256. There's no account and no server. And every reply is labeled, so you always know whether the model or our rule-based fallback answered.

*Click.*

## 6 · Closing — 4:25–4:50

> Most apps either help you or keep you company. Cubeit tries to do both. It keeps track of the little things, notices when you get them done, and keeps all of it on your phone.
>
> Cubeit. You've got a companion.
>
> Thank you. We're happy to take questions.

---

## Lines to adjust after testing on a device

Two lines in this script are only true once you've run the model on the actual demo phone (see `PITCH_AUDIT.md`):

- *"This phone is in Airplane Mode."* Say this only if the four demo messages have worked on the demo phone in Airplane Mode.
- *"That's the model running on the phone."* Say this only if the reply is labeled **On-device AI**.

If the model can't be made to run on the phone before the pitch, use this replacement for the start of slide 5:

> "The on-device model is built in: Qwen 2.5 on llama.rn, with the pipeline you see here. On today's build the demo ran on our rule-based fallback, and the app labels it that way. Everything after the model, from the checks to the confirm card to local storage, is exactly what you just saw."
