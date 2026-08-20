# Math Studio

**What this shows:** the tool plane staying the same size as the app grows — she gets six generic
verbs, the things on screen register with a curriculum in the page, and adding one costs zero
tools and zero characters of her brief.

## Setup

From the repo root, once, so the published SDK this example imports is present and built:

```bash
npm install && npm run build
```

Then, in this folder:

```bash
cp .env.example .env      # add your key; the AVATAR_ID_* are optional
node --env-file=.env server.mjs
```

Open <http://localhost:4199>, pick a level, and press **Start the lesson**. She opens, sets a
task, and the workspace under her question is the thing you answer with.

Set `AVATAR_ID_LIN` / `AVATAR_ID_WANG` / `AVATAR_ID_WUKONG` to get all three characters in the
picker. Set none and it resolves a single avatar the way the other examples do, and the picker
collapses to one.

## What to look at

- **Six verbs, and the list never grows.** `next_task` · `show` · `demonstrate` · `answer` ·
  `progress` · `celebrate`. None of them names a thing on screen. A tool per manipulative is the
  obvious design and it dies on arithmetic: `MAX_TOOLS` is 32, so at three actions apiece you
  fail to register at the eleventh. Long before that you run out of the thing that actually
  binds — `instructions` caps at 4,000 characters and every tool needs a sentence saying when to
  reach for it.
- **So the manipulatives register with the curriculum, not with the avatar.** Two plain objects
  in `index.html`: a plug point with five methods, and a level that names one by id. Adding a
  Bézier curve is a key in one table and an id in the other. `server.mjs` does not change and
  neither does her brief.
- **What she is looking at reaches her through the RESULT, not the tool name.** `demonstrate`
  tells the model less than `show_bezier_control_points` would; every result carries an `explain`
  field in the words she should use, which buys the difference back.
- **Every call is full duplex, and `mode` only picks the renderer.** Her microphone is open the
  whole time she is speaking, so a learner mid-drag can cut in and she stops — that is how calls
  work, not a setting to spend. So there is no trade here between her face and being able to
  interrupt her: the call is `mode: "avatar"` and the brief tells her plainly that they will cut
  in and that she should follow them when they do.
- **The voice is deliberately not sent.** Voice ids are not discoverable — no catalogue endpoint,
  `defaultVoiceId: null` on every avatar, and a well-shaped spec with a nonexistent id returns
  **200** and then simply sounds like someone else. So a preset earns its way into the mint only
  after a human confirms it by ear. Pinning an unproven one is what turned Ms. Lin male; sending
  nothing lets the platform choose, and with nothing pinned the **persona line is the only thing
  left that can decide**, which is why it is composed first rather than appended last.
- **The page cannot talk to her.** There is no push channel — the tool plane has exactly two RPCs
  and neither goes page → agent. So everything the learner does rides home on her next tool call
  in `since_last_call`, gated so she is never handed a hand that is still moving.

## What it does not show

The curriculum here is four levels of geometry, trigonometry and signals. The registry is the
point, and it is easier to see with four manipulatives than with forty — the number that matters
is that the tool count is six either way.

## Cost

A real call, billed by the second. `MAX_CALL_SECONDS` defaults to **420**, so one full run of ten
tasks is roughly **35¢** at ~$5/hour. The page shows calls, seconds on air and credits spent, and
`End` releases the session immediately.
