// Speaker notes for each slide (kept in sync with ../SPEAKER_SCRIPT.md).
module.exports = [
  // 1 — Hook
  `[0:00–0:30] HOOK

Rent's due Friday. The bathroom needs cleaning on Saturday. Did I actually go for my walk today? And what did I write last week, when things were rough?

None of this is hard. There's just a lot of it, and most of it lives in our heads.

We built Cubeit for those little things. It's a companion that helps you keep track of them, and it does that on your phone, without sending your life to a server.

→ Click to slide 2.`,

  // 2 — Meet Pip
  `[0:30–1:10] MEET PIP

This is Pip. Pip lives in this little LCD room on your phone. It wanders around, naps, waves, plays with its ball. You can tap it, pet it, pick it up, and if you tilt the phone, it slides.

That's the companion. Underneath it is the useful part: a calendar, habits and routines, chores, and a journal.

And the two are connected. When you finish a habit or a chore, Pip celebrates and you earn stars.

So our idea is simple: the companion makes you want to open the app, and the assistant makes it worth opening.

→ Click to slide 3.`,

  // 3 — What it helps with
  `[1:10–1:40] WHAT IT HELPS WITH

So what can you actually do with it? Four everyday jobs.

The calendar remembers what's coming and reminds you on the phone. Habits keep your routines going, and streaks only count the days you planned, so a rest day doesn't break them. Chores get due dates, repeats and checklists. And the journal lets you look back, with moods, prompts and search.

You can do all of that by hand. But the faster way is to just tell Pip. Let me show you.

→ Click to slide 4, then switch to the phone mirror.`,

  // 4 — Live demo
  `[1:40–3:15] LIVE DEMO (phone mirrored; this slide is the backup)

PRE-CHECK: preview build with the model installed; Airplane Mode ON; habit "Evening walk" exists and is NOT done today; Talk opened less than 90 s ago (the model unloads after 90 s idle and when the app is backgrounded).

1. Home screen, Pip visible. Tap Talk. Point at the pill: "On-device AI." SAY: "This phone is in Airplane Mode."
   Send: "Remind me to pay rent on Friday at 9am"
   SAY: "I'll just tell it like I'd tell a friend." (while Pip shows the thinking dots) "That's the model running on the phone."
   Card appears. SAY: "It hasn't saved anything. It shows me what it understood: Pay rent, Friday, 9 AM, with a reminder. The date comes from the phone's clock, not from the model." Tap Add event.

2. Send: "Add clean the bathroom to my chores every Saturday"
   SAY: "A weekly chore." Tap Add chore.

3. Send: "I finished my evening walk" → tap Mark done.
   Point at the room. SAY: "And there, Pip celebrates. My streak goes up and I get stars. That small moment is why people come back."

4. Send: "What's on my schedule this week?"
   SAY: "Questions don't need a confirm. It just reads my planner."

5. Tap Planner. Calendar: Friday has a dot. Chores tab: Clean the bathroom. Habits tab: Evening walk ticked.
   SAY: "Everything's there, in the normal planner."

IF THE MODEL STALLS (more than ~10 s): keep talking. If a reply is labeled "Built-in parser", say so: "That one was handled by our rule-based fallback, and the app tells you that." If a wrong card appears, tap Cancel: "This is exactly why nothing saves without a tap." Then rephrase.

→ Switch back to slides, click to slide 5.`,

  // 5 — Local AI
  `[3:15–4:25] WHY LOCAL

Why local? Because of what Cubeit reads: your calendar, your routines, your journal. A companion you trust with that shouldn't have to send it to someone else's server.

Here's what happens on the phone. You type, or speak, and speech-to-text runs on the device too. A small language model, Qwen 2.5 with half a billion parameters, runs through llama.cpp using llama.rn.

It doesn't answer freely. It picks one of sixteen intents and copies your words into JSON, and a schema locks the format. Then our code checks everything: it works out the date from the phone's clock, rejects dates in the past, finds the habit you meant, and asks if something's missing. Only after you tap does it save, into SQLite on the phone.

So the model proposes, the app checks, and you decide.

The internet is used once, to download the model, about 490 megabytes, checked with SHA-256. There's no account and no server. And every reply is labeled, so you always know whether the model or our rule-based fallback answered.

→ Click to slide 6.`,

  // 6 — Closing
  `[4:25–4:50] CLOSING

Most apps either help you or keep you company. Cubeit tries to do both. It keeps track of the little things, notices when you get them done, and keeps all of it on your phone.

Cubeit. You've got a companion.

Thank you. We're happy to take questions.`,
];
