# Coding companion

**What this shows:** two models in one call — she is the conversation, a cheaper model is the
editor, and she drives the editor herself through the client tool plane: `write_program` starts
a build, `check_program` is how she learns what it did. The code runs in the browser, so a
failure comes back as something she can look up rather than guess at.

## Setup

From the repo root, once, so the published SDK this example imports is present and built:

```bash
npm install && npm run build
```

Then, in this folder:

```bash
cp .env.example .env      # add both keys; AVATAR_ID is optional
node --env-file=.env server.mjs
```

Open <http://localhost:4192>, press **Call**, and say *"write a debounce function"*. The code
streams into the panel, runs, and prints. Then say *"add a cancel method"* — the file is edited,
not rewritten from nothing.

## What to look at

- **The split.** The avatar platform never sees the coding model, its key, or the code. Holding
  a conversation and writing code are different jobs; paying conversation prices for both is
  how a demo becomes a bill.
- **"Never read code aloud"** is the load-bearing line in `instructions`. Without it she
  dictates function signatures, and a character spelling out `(func: T, delay: number)` is
  unlistenable. The panel is where code goes; her job is the one sentence next to it.
- **The run output goes back in.** `/api/code` takes `runOutput` and folds it in as another
  turn. Without it, "fix it" is answered from scratch and the model re-invents the bug. That
  leg is the difference between a code generator and a companion.
- **The sandbox is a Web Worker with a 3.5s timeout.** No DOM, no `window`, and a hard stop —
  the first program a model writes for "an infinite sequence" is an infinite loop, and a
  `while (true)` on the page thread takes the call down with it.
- **It waits for the async tail.** Reporting as soon as the synchronous part returned showed
  "(no output)" for working code whose only `console.log` was inside a `setTimeout`, and she
  said so out loud. `setTimeout` is counted and the result posts a tick after the last one has
  run, which picks up `await sleep(…)` and promise callbacks too; anything still going at 3.5s
  reports what it printed up to then. `setInterval` is not tracked — a program that only prints
  on an interval still reports whatever it had when the budget ended.
- **She decides when to build.** There is no keyword router in the page: a request reaches her
  as a normal turn, and calling `write_program` is her model's decision — follow-ups included.
  The server's whole part in that is one field on the mint, `clientTools: true`; without the
  grant, registration fails and not one tool is reachable.
- **Receipt + poll against the 2.5s deadline.** A tool call is abandoned after 2.5 seconds, and
  a build with retries is tens of seconds — so `write_program` returns `{job, status:"started"}`
  immediately and the work runs on in the page. `check_program` reports the status and what the
  program printed, and she is told never to announce a result she has not polled for: a build
  she started reads, to a language model, a lot like a build that worked.
- **`sentByUs`.** Turns the page sends come back as transcriptions of ourselves. They are
  logged at the keystroke, so the echo is skipped — without that, every typed turn appears in
  the log twice.
- **`sanitize()` on the server.** The browser owns the conversation; the server owns the system
  prompt. A `system` turn arriving in a request body would sit beside `CODE_SYSTEM` and quietly
  outrank it.
- **`mode: "avatar"`** picks the renderer, not the turn-taking. She is listening the whole
  time she speaks either way, so you can cut her off mid-sentence — which is what makes a
  tool that takes seconds to answer bearable. Drop `mode` to save the GPU and lose the video.
- **`AVATAR_ID`** is read first so a host platform can launch this with an avatar the user
  chose. With nothing set, the app picks the first `ready` avatar whose `sourceKind` is
  `video` — an image-sourced avatar reaches `ready` and then publishes an all-black track.

## Cost

Two meters. The call bills by the second while it is live (under $5/hour) and is capped at
`MAX_CALL_SECONDS` (300 by default). Every build **and every automatic retry** is a separate
completion on your `OPENAI_API_KEY`; a program that keeps throwing costs three of them.

A call that is never joined still holds its slot until the join timeout notices, so the page
says goodbye: on `pagehide` it beacons `/api/end`, and the server ends the call with
`endCall` — the slot frees the moment the user leaves, even if the tab closes before the
room exists. The server keeps the ids it minted and only ends those; an id it does not
recognise is ignored, so the route cannot be used to hang up someone else's call.
