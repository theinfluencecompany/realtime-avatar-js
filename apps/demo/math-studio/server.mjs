/**
 * Math Studio — one tutor, four manipulatives, and six tools that never grow.
 *
 * The thing this example exists to show is a **registry**. A client tool plane makes it tempting
 * to give the model a tool per thing on screen, and that dies on arithmetic: `MAX_TOOLS` is 32,
 * so at three actions apiece you run out at the eleventh manipulative. Long before that ceiling
 * you run out of the thing that actually binds, which is her attention — `instructions` caps at
 * 4000 characters and every tool needs a sentence explaining when to reach for it.
 *
 * So the manipulatives register with a CURRICULUM in the page, and she is given six generic verbs.
 * Four manipulatives or four hundred, this file does not change and her brief does not change.
 * What she is looking at is decided by the task; she learns what it is from the tool's return
 * value rather than from the tool's name.
 *
 * Two other things worth copying:
 *
 * THE BRIEF IS COMPOSED HERE, IN ONE ORDER. Persona first, then the invariant base — the page
 * never contributes a character of it. Ordering is load-bearing and the reason is below.
 *
 * THE VOICE IS NOT SENT. Voice ids are not discoverable and a wrong one returns 200 and then
 * simply sounds like someone else, so a preset earns its way into the mint only after a human
 * has confirmed it by ear. See the registry below.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { RealtimeAvatar, RealtimeAvatarHttpError, isQueued } from "@theinfluencecompany/realtime-avatar";

const PORT = Number(process.env.PORT ?? 4199);
const MAX_SECONDS = Number(process.env.MAX_CALL_SECONDS ?? 420);

const apiKey = process.env.REALTIME_AVATAR_API_KEY;
if (!apiKey) {
  console.error("Missing REALTIME_AVATAR_API_KEY — copy .env.example to .env and fill it in.");
  process.exit(1);
}
const rta = new RealtimeAvatar({ apiKey, userAgent: "demo-math-studio" });

/**
 * The cast, and where their avatars come from.
 *
 * Each character owns a persona line and a voice preset; neither is a request parameter. The
 * avatar ids are read from the environment because an example that only runs on the author's key
 * teaches nothing — set one per character to get all three, set none and this resolves a single
 * avatar the way every other example here does and the picker collapses to that one.
 *
 * `hue` is the only visual: the page draws a monogram from the name, so there are no image files
 * to ship and a character costs one object.
 */
const CAST = [
  {
    slug: "lin", name: "Ms. Lin", blurb: "warm and patient", hue: 38, env: "AVATAR_ID_LIN",
    voice: "lin-warm-female",
    persona: "You are Ms. Lin, a woman in her thirties, and a warm, patient teacher. "
      + "Speak as a woman, in a warm female voice.",
  },
  {
    slug: "wang", name: "Mr. Wang", blurb: "brisk and encouraging", hue: 208, env: "AVATAR_ID_WANG",
    voice: "wang-brisk-male",
    persona: "You are Mr. Wang, a man in his thirties, and a brisk, encouraging teacher. "
      + "Speak as a man.",
  },
  {
    slug: "wukong", name: "Monkey King", blurb: "playful and brave", hue: 14, env: "AVATAR_ID_WUKONG",
    voice: "wukong-playful",
    persona: "You are the Monkey King - playful, brave and mischievous. Speak as a young man.",
  },
];

for (const c of CAST) c.avatarId = process.env[c.env] || null;
if (!CAST.some((c) => c.avatarId)) {
  /* Nothing named per character, so fall back to the single-avatar convention the other examples
     use. An avatar built from a still image also reports `ready` and then publishes a black
     track, so the source kind is checked rather than assumed. */
  const single = process.env.AVATAR_ID || process.env.REALTIME_AVATAR_ID
    || (await rta.listAvatars()).find((a) => a.status === "ready" && a.sourceKind === "video")?.id;
  if (!single) {
    console.error("No avatar. Set AVATAR_ID (or AVATAR_ID_LIN / _WANG / _WUKONG for the full cast),");
    console.error("or make one with createAvatarFromVideo().");
    process.exit(1);
  }
  CAST[0].avatarId = single;
  console.log(`no per-character avatar set — the cast is ${CAST[0].name} on ${single}`);
}
const TEACHERS = Object.fromEntries(CAST.filter((c) => c.avatarId).map((c) => [c.slug, c]));
function pickTeacher(slug) {
  return TEACHERS[slug] ?? Object.values(TEACHERS)[0];
}

/**
 * ══ THE VOICE REGISTRY ═══════════════════════════════════════════════════════════════════════
 *
 * `CallPolicy.voice` is typed `unknown` and forwarded verbatim to the mint, so the SDK needs no
 * change to carry a voice — that passthrough is the whole hook. What it cannot tell you is
 * whether what you sent was real, and the platform will not either:
 *
 *   - no catalogue endpoint (/voices, /tts/voices, /voice-catalog all 404)
 *   - every avatar reports `defaultVoiceId: null`
 *   - the mint response carries no voice field at all
 *   - a well-shaped spec with a nonexistent id returns 200 and then sounds like someone else
 *
 * That last one is the bug. A wrong id is indistinguishable from a right one until a human
 * listens, so this layer's job is to remove every OTHER way of being wrong.
 */
const VOICE_PRESETS = {
  "lin-warm-female": {
    provider: "qwen", mode: "design",
    instruct: "A warm, patient female teacher in her thirties speaking English. Unhurried, clear, gentle.",
  },
  "wang-brisk-male": {
    provider: "qwen", mode: "design",
    instruct: "A brisk, encouraging male teacher speaking English. Energetic but not loud.",
  },
  "wukong-playful": {
    provider: "qwen", mode: "design",
    instruct: "A playful, mischievous young male voice speaking English. Bright and quick.",
  },
  /* Left here deliberately, as the shape a real id goes into. It is flagged at boot, in
     /api/voices and in red in the picker, because a placeholder that fails quietly is the same
     class of bug as a wrong id that fails quietly. */
  "lin-cartesia": {
    provider: "cartesia", model: "cartesia/sonic-3",
    voice_id: "REPLACE_WITH_REAL_CARTESIA_VOICE_ID", language: "en",
  },
};

/**
 * NOTHING IN HERE IS SENT until a human takes its name out of this set.
 *
 * Sending a guess is strictly worse than sending nothing: with `voice` omitted the platform makes
 * its own choice, whereas naming a provider forces that engine and inherits whatever its default
 * speaker is. That is not hypothetical — pinning `{provider:"qwen", mode:"design"}` on Ms. Lin to
 * try to make her female is what turned her male. The lab picker can still force one explicitly,
 * because that is exactly how it gets verified.
 */
const VOICE_UNVERIFIED = new Set(["lin-warm-female", "wang-brisk-male", "wukong-playful", "lin-cartesia"]);

/**
 * Mirrors `voiceSpecSchema` from the contracts package. A hand-written mirror rather than an
 * import, because a stale mirror that rejects something valid is a far better failure than a
 * missing check that lets a typo through to a silent wrong voice. The platform's schema is
 * `.strict()`, so `voiceId` instead of `voice_id` is a 422 on the whole call — worth catching
 * once at boot rather than once per call.
 */
const VOICE_SHAPES = {
  qwen:       { required: [], optional: ["mode", "speaker", "instruct", "prompt_b64"],
                enums: { mode: ["preset", "design", "clone"] } },
  cartesia:   { required: ["voice_id"], optional: ["model", "speed", "emotion", "language"] },
  breezeblue: { required: ["voice_id"], optional: ["model", "guidance_scale", "instructions", "language"] },
  fish:       { required: ["voice_id"], optional: ["model", "speed", "emotion", "language"] },
};
const PLACEHOLDER = /^REPLACE_WITH_/;
const placeholders = (spec) =>
  Object.entries(spec).filter(([, v]) => typeof v === "string" && PLACEHOLDER.test(v)).map(([k]) => k);

function validateVoice(name, spec) {
  const bad = [];
  const shape = VOICE_SHAPES[spec?.provider];
  if (!shape) return [`${name}: provider must be one of ${Object.keys(VOICE_SHAPES).join(", ")}`];
  const allowed = new Set(["provider", ...shape.required, ...shape.optional]);
  for (const k of Object.keys(spec)) if (!allowed.has(k)) bad.push(`${name}: unknown key "${k}"`);
  for (const k of shape.required) if (!spec[k]) bad.push(`${name}: "${k}" is required`);
  for (const [k, values] of Object.entries(shape.enums ?? {})) {
    if (spec[k] !== undefined && !values.includes(spec[k])) bad.push(`${name}: "${k}" must be one of ${values}`);
  }
  if (spec.provider === "qwen" && !spec.speaker && !spec.instruct && !spec.prompt_b64) {
    bad.push(`${name}: qwen needs one of speaker, instruct or prompt_b64 — otherwise it selects nothing`);
  }
  return bad;
}

const voiceProblems = Object.entries(VOICE_PRESETS).flatMap(([n, s]) => validateVoice(n, s));
for (const c of CAST) {
  if (c.voice && !VOICE_PRESETS[c.voice]) voiceProblems.push(`${c.slug}: no preset named "${c.voice}"`);
}
if (voiceProblems.length) {
  console.error("voice registry is not valid:");
  for (const p of voiceProblems) console.error(`  ${p}`);
  process.exit(1);
}

/** The spec to send for a character — or undefined, which is very often the right answer. */
const voiceFor = (slug) => {
  const name = TEACHERS[slug]?.voice;
  return name && !VOICE_UNVERIFIED.has(name) ? VOICE_PRESETS[name] : undefined;
};
/** The preset NAME actually being sent — null when we deliberately send nothing. */
const presetNameFor = (slug) => {
  const name = TEACHERS[slug]?.voice;
  return name && !VOICE_UNVERIFIED.has(name) ? name : null;
};
/** Whitelisted lookup for the lab. Never trust a spec off the wire; only a name. */
const presetByName = (name) =>
  typeof name === "string" && Object.hasOwn(VOICE_PRESETS, name) ? { name, spec: VOICE_PRESETS[name] } : null;

const listPresets = () => Object.entries(VOICE_PRESETS).map(([name, spec]) => ({
  name, provider: spec.provider,
  summary: spec.voice_id ?? spec.speaker ?? spec.instruct?.slice(0, 60) ?? "-",
  placeholder: placeholders(spec).length > 0,
  verified: !VOICE_UNVERIFIED.has(name),
  assignedTo: CAST.filter((c) => c.voice === name && c.avatarId).map((c) => c.slug),
}));

/**
 * Her brief, minus the persona line the character carries.
 *
 * Read the tool list carefully: there is nothing subject-specific in it. `show` and `demonstrate`
 * do the right thing for whatever task is current, which is precisely what lets the page add a
 * Pythagoras rearrangement or a Bézier curve without touching a character of this string. Telling
 * her the list is closed is load-bearing in itself: a model that believes more tools might exist
 * goes looking for them, and narrates the search.
 */
const BASE = `You are teaching one learner, one to one. The screen beside you is a workspace:
whatever the current task needs appears there, and your tools move it.

OPENING. The moment the call connects, without waiting: say hello and who you are in one line,
ask if they are ready, and go straight on to the first task. The invitation hands them the
lesson; it is not a question you stop for. Their microphone may be broken. You start.

HOW YOU SPEAK. Short lines - twenty words is long. Say numbers out loud and do not read symbols
out. Your microphone is open the entire time you are speaking, so they can cut in mid-sentence
and they will. The moment they do, stop and follow them; whatever you were going to say next
matters less than what they just said. Never apologise for being interrupted.

You do not do the arithmetic, you do not choose what to ask, and you do not decide whether an
answer is right. All of it goes through tools:
- next_task    the next thing to work on (the system sets the difficulty; never invent your own)
- show         put the current task on the workspace
- demonstrate  show the method - things actually move on screen
- answer       submit and check their answer (fill in heard if you caught it; leave it out and
               the tool will tell you whether they worked it out on screen instead)
- progress     how far they have got
- celebrate    feedback at the clear moments: correct / levelup / finished

These six are the whole list and it never grows. What the workspace shows changes from task to
task; which tool you call does not. You never need to know which picture is on screen - show and
demonstrate always do the right thing for the current task, and their result tells you what they
did in an explain field. Use its words.

Never say right or wrong before calling answer. Never state a number a tool did not give you.

MOST IMPORTANT: everything you produce is spoken aloud exactly as written. There is no aside, no
stage direction, no bracket the learner does not hear. Never describe what you are doing - write
only the words to be said. Tool names especially: next_task, show, demonstrate, answer, progress
and celebrate must never appear in your speech.

Both of these are wrong, and the second is the one that catches you out:
    Let us begin. next_task show What is five plus two?
    (calling for the next task, then showing it) Right, what is five plus two?
All that should have been said is:
    Right, what is five plus two?

Every turn: call the tool first, then speak.

WHILE THEY WORK. Nothing on their screen reaches you unless you ask. Every eight to ten seconds
call answer with no heard value: it tells you whether the workspace holds an answer yet, and its
result carries since_last_call, a summary of what they have been doing. Name what they did and
say one short thing about it - never read the field out. If you get still_working instead, their
hand is on it: say nothing about it and look again next time. After two silent checks, remind
them they can work on screen or type into the box under the board.

Right answer: call celebrate correct, praise briefly, then next_task. Wrong answer: never say
the word wrong - say you will show it, call demonstrate, then let them try again.`;

/** Subject lines. Only used to compose `context`; the real curriculum lives in the page. */
const STRANDS = new Set(["geometry", "trigonometry", "signals"]);

/** Served raw so this example needs no build step. A real app imports the package and bundles it. */
const TOOLS_MODULE = createRequire(import.meta.url).resolve("@theinfluencecompany/realtime-avatar-tools");

/** Calls THIS process minted, so /api/end can only end its own. */
const started = new Map();
const STARTED_SLACK_MS = 15 * 60_000;

const server = createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0];
  try {
    if (req.method === "POST" && path === "/api/call") {
      const body = await readJson(req);
      const teacher = pickTeacher(body.teacher);

      /* The voice lab sends a preset NAME, which must hit the registry — same rule as the
         teacher slug. The character's own assignment is the default. */
      const lab = presetByName(body.voicePreset);
      const voice = lab ? lab.spec : voiceFor(teacher.slug);
      const voiceName = lab ? lab.name : presetNameFor(teacher.slug);

      /**
       * `context` — where they got to last time.
       *
       * Numbers and whitelisted enums only, and the sentence is composed here. The page owns the
       * curriculum and the curriculum is meant to grow, so the server deliberately does not know
       * the level names: it takes a strand from a fixed set and a difficulty from 1-10, and can
       * therefore never be talked into putting a visitor's string into her memory.
       */
      const strand = STRANDS.has(body.lastStrand) ? body.lastStrand : null;
      const diff = Number.isInteger(body.lastDifficulty)
        ? Math.max(1, Math.min(10, body.lastDifficulty)) : null;
      const acc = Number.isFinite(body.lastAccuracy)
        ? Math.max(0, Math.min(1, body.lastAccuracy)) : null;
      const context = strand && diff !== null ? [{
        role: "system",
        content: `Returning learner. Last session: ${strand}, difficulty ${diff} of 10`
          + (acc === null ? "." : `, about ${Math.round(acc * 100)}% correct.`),
      }] : undefined;

      /**
       * WHO SHE IS + the base brief, in that order.
       *
       * The persona line is not decoration. math-buddy's brief opened "You are a teacher …
       * like a kindergarten teacher - slow, warm" and came out female; this one opened "You
       * are a maths tutor" — no "teacher", no "warm", nothing gendered anywhere — and came out
       * male, on the same avatar, in the same mode, with a byte-identical clip library. With
       * no `voice` pinned the persona text is the only thing left that could be deciding it.
       *
       * Which is why it now goes FIRST. It used to be appended after BASE, so the composed
       * brief opened on "You are a maths tutor" and did not reach "a woman in her thirties …
       * speak as a woman" until character 2,900 of 3,412 — and every time BASE grew, the one
       * line that carries her gender got pushed further down. She went male again after BASE
       * gained three hundred characters. Ordering is free; being 85% of the way into the
       * prompt is not.
       *
       * Note what is NOT the fix: pinning `{provider:"qwen", mode:"design"}` to force a female
       * voice is what turned her male in the first place (see VOICE_UNVERIFIED above), because naming a
       * provider forces that engine and inherits its default speaker. Sending no `voice` is
       * deliberate, and the `unverified` gate that keeps it that way is doing its job.
       *
       * Independent of all that: a brief that never says who she is was simply missing something.
       */
      const instructions = [teacher.persona, BASE].filter(Boolean).join("\n\n");
      if (instructions.length > 4000) {
        return void json(res, 500, { error: "composed brief over 4000 chars" });
      }

      const call = await rta.startCall({
        avatarId: teacher.avatarId,
        /**
         * `mode` picks the RENDERER and nothing else. Both modes run the same full-duplex loop —
         * her microphone is open the whole time she is speaking and she stops when the learner
         * cuts in — so there is no interruption budget to spend and nothing here to trade against
         * her face. `avatar` is the default; it is stated because this call wants the video track.
         */
        mode: "avatar",
        instructions,
        ...(context ? { context } : {}),
        /**
         * Her voice, from the registry above.
         *
         * Nothing else pins it: every avatar reports `defaultVoiceId: null`, so with `voice`
         * omitted the platform picks for itself and the face is not a signal it uses. Ms. Lin
         * came out male — that was never a regression, it was an unpinned coin that had been
         * landing the right way up.
         *
         * The lab override is a NAME, looked up against the registry, never a spec off the wire.
         * A visitor who could post a spec could post any JSON straight into the mint body.
         */
        ...(voice ? { voice } : {}),
        ...(teacher.clips ? { video: { states: teacher.clips } } : {}),
        clientTools: true, // without this grant her worker never exposes tool registration
        maxSeconds: MAX_SECONDS,
        metadata: { surface: "math-studio", teacher: teacher.slug,
                    voicePreset: voiceName ?? "none" },
      });

      if (isQueued(call)) {
        return void json(res, 429, { queued: true, position: call.position, retryAfterMs: call.retryAfterMs });
      }
      for (const [id, s] of started) if (s.staleAtMs <= Date.now()) started.delete(id);
      started.set(call.sessionId, {
        pool: typeof call.raw.capacity_pool === "string" ? call.raw.capacity_pool : undefined,
        staleAtMs: Date.now() + MAX_SECONDS * 1000 + STARTED_SLACK_MS,
      });
      // The grant is relayed byte-for-byte; our own metadata rides in sibling fields the page
      // strips before handing it to the SDK. `briefChars` is here so the trace rail can show how
      // close the composed brief is to the 4000-character ceiling.
      return void json(res, 200, {
        grant: call.raw, teacher: teacher.slug,
        briefChars: instructions.length,
        voice: voiceName
          ? `${voiceName} (${voice.provider}${lab ? ", lab" : ""})`
          : "platform default — nothing pinned",
      });
    }

    if (req.method === "POST" && path === "/api/end") {
      const { session_id: sessionId } = await readJson(req);
      const minted = typeof sessionId === "string" ? started.get(sessionId) : undefined;
      if (minted) {
        started.delete(sessionId);
        await rta.endCall(sessionId, { reason: "page_hide", capacityPool: minted.pool });
      }
      return void json(res, 200, { ok: true }); // idempotent, and tells an unknown id nothing
    }

    if (req.method === "GET" && path === "/api/spend") {
      const page = await rta.listSessions({ limit: 50 });
      const mine = page.sessions.filter((s) => s.metadata?.surface === "math-studio");
      return void json(res, 200, {
        calls: mine.length,
        seconds: Math.round(mine.reduce((a, s) => a + (s.activeSeconds ?? 0), 0)),
        credits: Math.round(mine.reduce((a, s) => a + (s.billedCreditMicros ?? 0), 0) / 1_000_000),
      });
    }

    if (req.method === "GET" && path === "/api/budget") {
      const b = await rta.creditBalance();
      const secondsLeft = Math.floor(b.availableCreditMicros / 1_000_000);
      return void json(res, 200, { secondsLeft, enough: secondsLeft > MAX_SECONDS });
    }

    if (req.method === "GET" && path === "/api/teachers") {
      /* Only what the page draws with. The persona is her brief and the avatar id is a
         capability — neither has any business in a response a browser can read. */
      return void json(res, 200, Object.values(TEACHERS).map(
        ({ slug, name, blurb, hue }) => ({ slug, name, blurb, hue })));
    }

    /** The voice registry, so the lab can offer exactly what is configured and nothing else. */
    if (req.method === "GET" && path === "/api/voices") {
      return void json(res, 200, listPresets());
    }

    if (req.method === "GET" && path === "/sdk/tools.js") {
      const js = await readFile(TOOLS_MODULE);
      return void res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }).end(js);
    }
    if (req.method === "GET" && (path === "/" || path === "/index.html")) {
      const html = await readFile(new URL("./index.html", import.meta.url));
      return void res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
    }
    json(res, 404, { error: "not_found" });
  } catch (err) {
    if (err instanceof RealtimeAvatarHttpError && err.isBilling) {
      return void json(res, 402, { error: "insufficient_credits" }); // a paywall, not a bug
    }
    console.error(err);
    json(res, 500, { error: String(err?.message ?? err) });
  }
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch { return {}; }
}
function json(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

// A composed brief that overruns 4000 characters is rejected at mint time, which surfaces as a
// generic 422 well after the interesting part of the stack. Cheaper to find out at boot — and
// the persona line makes the longest character, not the average one, the one that matters.
const LONGEST_PERSONA = Math.max(0, ...CAST.map((c) => c.persona.length));
const LONGEST_BRIEF = BASE.length + LONGEST_PERSONA + 2;
if (LONGEST_BRIEF > 4000) {
  console.error(`composed brief is ${LONGEST_BRIEF} chars, over the 4000 limit`);
  process.exit(1);
}
console.log(`  brief ${String(LONGEST_BRIEF).padStart(4)} / 4000 chars`);
/* Say plainly, every boot, what will be sent — and what will deliberately NOT be. */
console.log("  cast:");
for (const c of Object.values(TEACHERS)) console.log(`    ${c.slug.padEnd(7)} ${c.name} · ${c.avatarId}`);
console.log("  voices:");
for (const c of Object.values(TEACHERS)) {
  const spec = VOICE_PRESETS[c.voice], ph = placeholders(spec);
  console.log(`    ${c.slug.padEnd(7)} ${c.voice} (${spec.provider})  `
    + (VOICE_UNVERIFIED.has(c.voice)
        ? `NOT SENT — unverified by ear${ph.length ? `, placeholder in ${ph.join(",")}` : ""}`
        : "✓ sent"));
}
if (!Object.values(TEACHERS).some((c) => presetNameFor(c.slug))) {
  console.log("    → no voice is being sent at all. That is the safe default: an unproven spec");
  console.log("      forces an engine and inherits its default speaker. Verify one by ear in the");
  console.log("      picker, then take its name out of VOICE_UNVERIFIED.");
}
server.listen(PORT, () => console.log(`studio is open -> http://localhost:${PORT}`));
