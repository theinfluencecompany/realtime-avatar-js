# Dating rehearsal

**What this shows:** a live first date you can practice on — and four client tools that are all
*his* decision, made in character. He rates his own interest (`rate_interest` drives a live meter),
pins the beats that turned it (`mark_moment`), walks out if it dies (`end_date`), and writes the
after-the-date debrief (`write_debrief`). Nobody in the page asks him for a tool; the same model
being charming is the one deciding how it's going.

## Setup

From the repo root, once, so the published SDK this example imports is present and built:

```bash
npm install && npm run build
```

Then, in this folder:

```bash
cp .env.example .env      # add your key; AVATAR_ID is optional
node --env-file=.env server.mjs
```

Open <http://localhost:4195>, tap **go on the date**, and just talk. Your silences are silences he
actually sits through; the meter and the debrief are earned, not scripted.

## What to look at

- **Nobody scores the date but him.** There is no sentiment pass and no keyword list. The
  `instructions` tell him to call `rate_interest` / `mark_moment` when the vibe *genuinely* moves,
  so the RIZZ meter and the moment reel are his live read of the conversation — not the page's
  guess about it.
- **State rides tool calls, never the transcript.** His speech reaches the page through speech
  recognition, which re-spells contractions and drops punctuation — a meter driven off matching a
  sentence would twitch at random. A tool call arrives exactly once, exactly as sent; each `execute`
  returns a short string that grounds his next spoken turn (e.g. after `end_date` he knows to say a
  brief goodbye and then write the debrief).
- **`clientTools: true` is decided at the mint.** The worker only exposes tool registration for a
  session granted the capability, and a browser cannot grant it to itself. Without it, all four
  tools are unreachable and the date still works — you just lose the HUD.
- **The date's personality is chosen server-side.** Who Theo is lives entirely in `instructions`,
  which is policy. A client that could pass its own brief could hand him any personality at all.
- **`{ grant }`.** The mint returns `call.raw` byte-for-byte. A key added *inside* the grant makes
  the browser client reject the whole payload, so this date ships nothing beside it.
- **`AVATAR_ID`** is read first so a host platform can launch this with an avatar the user chose.
  With nothing set, the app picks the first `ready` avatar whose `sourceKind` is `video` — an
  image-sourced avatar reaches `ready` and then publishes an all-black track.

## Cost

Starting a date bills by the second while it is live (under $5/hour). Every call this app starts is
capped at `MAX_CALL_SECONDS` (300 by default), so a date you walk away from cannot run up a bill.

A date that is never joined still holds its slot until the join timeout notices, so the page says
goodbye: on `pagehide` it beacons `/api/end`, and the server ends the call with `endCall` — the slot
frees the moment you leave, even if the tab closes before the room exists. The server keeps the ids
it minted and only ends those; an id it does not recognise is ignored, so the route cannot be used to
hang up someone else's call.
