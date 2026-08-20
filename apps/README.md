# Example apps

Two tiers, and the folder an example sits in is a claim about it.

- **[`quickstart/`](./quickstart)** — the smallest correct integration for one stack. Copy it
  and start.
- **[`demo/`](./demo)** — showcases. Bigger, worth reading even if you never run them.

Each example is **standalone**: its own README, its own run command, and no imports from a
sibling. One can be copied out of this repo and still work.

## `quickstart/`

| Example | Stack | Shows |
| --- | --- | --- |
| [`nextjs-app-router`](./quickstart/nextjs-app-router) | Next.js App Router | The smallest real integration — a route handler and a call button |
| [`python-fastapi`](./quickstart/python-fastapi) | FastAPI + httpx | The same split from Python, plus verifying the signed session history (transcript + tool calls) |
| [`canvas-tools`](./quickstart/canvas-tools) | Node + browser | The client tool plane end to end: `clientTools: true` server-side, `attachAvatarTools` in the page, four tools closing over a live canvas — and the return-now pattern for a tool that takes six seconds when it has two and a half |

## `demo/`

| Example | Stack | Shows |
| --- | --- | --- |
| [`coding-companion`](./demo/coding-companion) | Node + browser | Two models in one call: she decides to build via a client tool, a cheaper model writes the code — the build outlives the 2.5s tool deadline, so `write_program` returns a receipt and she polls with `check_program` |
| [`livestream`](./demo/livestream) | Node + browser | An audience is not a new primitive: a TikTok-Live room of comments, gifts and hearts all ride the one `lk.chat` topic, and she performs to a crowd she can't see |
| [`math-studio`](./demo/math-studio) | Node + browser | Keeping the tool plane a fixed size as the app grows: a tool per thing on screen fails to register at the eleventh, so six generic verbs act on a curriculum registered in the page, and adding a manipulative costs no tool and no brief |

> This repository is **private**. A link to an example only opens for someone who already has
> repo access — so anywhere one of these is offered as "clone the code", say so. The packages
> the examples import are the published ones; it is the example folders that are gated.

## Adding one

### 0. Pick the folder first

The folder is a promise. One question, answered in this order:

- **Is it the smallest correct way to do one thing on one stack?** → `quickstart/`. One folder
  per stack. A second Next.js quickstart *replaces* the first; it does not join it.
- **Does it only make sense once you see it running, and would we put it in front of a
  customer?** → `demo/`. That is a shortlist, not an inbox — adding one is the right moment to
  name which existing demo it retires.
- **Neither?** Then it does not go in `apps/`.

There is deliberately no third folder for examples that have been superseded. When one stops
being the best answer, **delete it** — the history still has it, and a folder of examples
nobody maintains is worse than no folder, because coding agents copy from whatever is in front
of them regardless of the label on it. If it was carrying a fact the docs lean on, move the
fact into the docs before the folder goes.

Moving or removing an app is not done until every reference is repathed. `grep -rIn
--exclude-dir=node_modules "apps/" .` is the whole check, and `apps/README.md`, `README.md`,
`llms.txt`, `AGENTS.md` and `libs/client/README.md` are where the hits live. The website's
example gallery is configured outside this repository and is not covered by that grep.

### Then, whichever folder

1. **A README with a one-sentence "what this shows"** at the top, then setup, then run.
2. **A single `.env.example`** naming every variable it needs. No hidden config.
3. **No shared local imports.** Depend on the published SDK, not on `../../libs`. An example
   that only works inside this repo teaches the wrong thing. Every app here obeys this.
4. **The policy decided server-side.** An example that forwards a request body into
   `startCall` is teaching a security bug, and agents copy examples verbatim.
5. **A stated cost** if it starts a call — minutes are billed, and someone running an example
   should know that before they run it.
6. **Its own default port**, so two examples can run side by side. Taken today: 4192
   coding-companion, 4193 canvas-tools, 4198 livestream, 4199 math-studio.

Keep them small. An example is read far more often than it is run.
