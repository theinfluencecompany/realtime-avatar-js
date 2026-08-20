/**
 * The coding companion.
 *
 * You describe what you want out loud. SHE decides it is a build: her model calls a tool that
 * lives in the page, real code streams into the panel beside her and runs in the browser, and
 * when it throws the build hands the error back to the code model and patches it.
 *
 * Two models, on purpose. Holding a conversation and writing code are different jobs, and
 * paying conversation prices for both is how a demo becomes a bill — so the avatar is the
 * voice and a cheaper coding model is the editor. The avatar platform never sees the coding
 * model, its key, or the code.
 *
 * The rule that survives being copied: she is told never to read code aloud. A character who
 * dictates a function signature is unlistenable, and she will do it unless told not to.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { RealtimeAvatar, RealtimeAvatarHttpError, isQueued } from "@theinfluencecompany/realtime-avatar";

const PORT = Number(process.env.PORT ?? 4192);
const MAX_SECONDS = Number(process.env.MAX_CALL_SECONDS ?? 300);

const apiKey = process.env.REALTIME_AVATAR_API_KEY;
if (!apiKey) {
  console.error("Missing REALTIME_AVATAR_API_KEY — copy .env.example to .env and fill it in.");
  process.exit(1);
}
const codeKey = process.env.OPENAI_API_KEY;
if (!codeKey) {
  console.error("Missing OPENAI_API_KEY — the code panel is the app. See .env.example.");
  process.exit(1);
}
const rta = new RealtimeAvatar({ apiKey, userAgent: "coding-companion" });

/** The coding brain. Any OpenAI-compatible endpoint; deliberately not the conversation model. */
const CODE_BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const CODE_MODEL = process.env.CODE_MODEL ?? "gpt-4.1";

/**
 * Her brief.
 *
 * The tools are named and given rules of engagement, because a description alone does not
 * keep her honest about outcomes: a build she STARTED reads, to a language model, a lot like
 * a build that WORKED. The "never announce a result check_program has not given you" line is
 * the one doing the work.
 */
const COMPANION = `You are a warm, sharp senior engineer pair-programming out loud with someone talking to you by voice. You are the VOICE, not the editor. Code is written by tools in the page, on your say-so.

Your two tools:
- write_program — call it whenever they ask you to write, change, fix or extend code, passing their request in their own words. It returns a receipt immediately; the real build takes seconds to tens of seconds, streams the code onto the panel beside you, and retries itself when the program throws.
- check_program — call it when they ask whether it worked, what it printed, or what happened. A build you started is not a build that worked: never announce a result check_program has not given you.

After starting a build, say so in one short sentence and move on. If check_program says writing, running or retrying, say it is still going. If it says failed, say what broke in words — not code — and ask what they actually want.

RULES: Never read code aloud. Never spell out syntax, symbols, markdown or a function signature. The code appears on a panel beside you — point at it ("it's on the panel", "try running it"). At most two spoken sentences per turn. Be specific: name the approach, flag the one tradeoff worth knowing. If they go quiet, ask what they are building.`;

/**
 * The code model's system prompt. It writes for the SANDBOX, not for a human reader — the
 * panel's contents are handed straight to a Web Worker, so anything that is not runnable
 * JavaScript lands in the editor and breaks the run.
 */
const CODE_SYSTEM = `You are the code engine behind a voice coding companion. You output a COMPLETE, self-contained JavaScript program and nothing else.
HARD RULES:
- Output RAW JavaScript only. No markdown, no code fences, no prose. Comments inside the code are fine.
- It runs in a sandboxed Web Worker: no DOM, no network, no imports, no require, no file system. Vanilla ES2020 only.
- Show results with console.log. If they asked for a function, also call it on an example so running the file demonstrates it.
- When you are given the previous program and its run output, return the ENTIRE corrected program, not a diff.
- Keep it focused. Prefer clarity over cleverness.`;

/**
 * The browser owns the conversation; this server owns the system prompt.
 *
 * Only `user` and `assistant` turns survive. A `system` turn in a request body is an
 * instruction-injection vector — it would sit alongside CODE_SYSTEM and quietly outrank it.
 */
function sanitize(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    .slice(-20);
}

/**
 * The character to call.
 *
 * `AVATAR_ID` is what a host platform sets when it launches this app with an avatar the user
 * picked, so it always wins. With nothing set we call the first READY avatar built from a
 * VIDEO source on this key — an avatar built from a still image also reports `ready`, then
 * publishes an all-black track, and nothing in the API says so.
 */
let resolvedAvatarId = process.env.AVATAR_ID || process.env.REALTIME_AVATAR_ID || null;
async function avatarId() {
  if (resolvedAvatarId) return resolvedAvatarId;
  const usable = (await rta.listAvatars()).find((a) => a.status === "ready" && a.sourceKind === "video");
  if (!usable) {
    throw new Error(
      "no ready video-sourced avatar on this key — set AVATAR_ID, or make one with createAvatarFromVideo()",
    );
  }
  resolvedAvatarId = usable.id;
  console.log(`no AVATAR_ID set — using ${usable.displayName} (${usable.id})`);
  return resolvedAvatarId;
}

/**
 * Ship the tool plane to the page.
 *
 * Resolved as a PACKAGE, not as a path into this repo, so copying this folder out and running
 * `npm i @theinfluencecompany/realtime-avatar-tools` is all it takes. In an app with a bundler
 * this route does not exist at all — `import { attachAvatarTools } from
 * "@theinfluencecompany/realtime-avatar-tools"` and let the bundler do it. It is served raw
 * here only so the example has no build step.
 */
const TOOLS_MODULE = createRequire(import.meta.url).resolve("@theinfluencecompany/realtime-avatar-tools");

/**
 * Calls THIS process started, so `/api/end` can only end its own. The route hears from any
 * visitor, and `endCall` ends whatever id it is given — relaying an arbitrary id from the
 * body would let one page hang up another's call. Swept lazily at mint time: once a call
 * cannot still be live (its cap plus slack has passed), the entry has nothing left to protect.
 */
const started = new Map(); // session_id → { pool, staleAtMs }
const STARTED_SLACK_MS = 15 * 60_000;

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/call") {
      const call = await rta.startCall({
        avatarId: await avatarId(),
        mode: "avatar", // the renderer, not the turn-taking: every call is full duplex.
        instructions: COMPANION,
        // THE GRANT. Without it her worker never exposes `rta.tools.register`, registration
        // in the browser fails, and not one tool is reachable from the model.
        clientTools: true,
        maxSeconds: MAX_SECONDS,
        metadata: { surface: "coding-companion" },
      });
      if (isQueued(call)) {
        return void json(res, 429, {
          queued: true,
          position: call.position,
          retryAfterMs: call.retryAfterMs,
        });
      }
      // Remember what we minted — and where it is held — so /api/end can free exactly this.
      for (const [id, s] of started) if (s.staleAtMs <= Date.now()) started.delete(id);
      started.set(call.sessionId, {
        pool: typeof call.raw.capacity_pool === "string" ? call.raw.capacity_pool : undefined,
        staleAtMs: Date.now() + MAX_SECONDS * 1000 + STARTED_SLACK_MS,
      });
      // The grant relayed byte-for-byte. Nothing rides inside it.
      return void json(res, 200, call.raw);
    }

    if (req.method === "POST" && req.url === "/api/end") {
      // The page's goodbye, beaconed on `pagehide`. The slot is held from the moment the
      // grant lands — BEFORE the room exists — and a tab closed in that gap tells no one
      // else. This ends the call the moment the user leaves, instead of when the join
      // timeout notices.
      const { session_id: sessionId } = await readJson(req);
      const minted = typeof sessionId === "string" ? started.get(sessionId) : undefined;
      if (minted) {
        started.delete(sessionId);
        await rta.endCall(sessionId, { reason: "page_hide", capacityPool: minted.pool });
      }
      // One answer for every outcome: ending is idempotent, a beacon cannot read a reply,
      // and an unknown id should not learn whether it named something real.
      return void json(res, 200, { ok: true });
    }

    /**
     * Stream code to the panel.
     *
     * `runOutput`, when present, is what the sandbox printed last time — folded in as one more
     * turn so the fix is made against reality instead of against a guess. That feedback leg is
     * the whole difference between a code generator and a companion.
     */
    if (req.method === "POST" && req.url === "/api/code") {
      const body = await readJson(req);
      const messages = sanitize(body.messages);
      if (!messages.length) return void json(res, 400, { error: "say what to build" });

      const turns = [{ role: "system", content: CODE_SYSTEM }, ...messages];
      const runOutput = typeof body.runOutput === "string" ? body.runOutput.slice(0, 4000) : "";
      if (runOutput) {
        turns.push({
          role: "user",
          content: `Running the previous program printed:\n\n${runOutput}\n\nFix it and return the entire corrected program.`,
        });
      }

      const upstream = await fetch(`${CODE_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${codeKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model: CODE_MODEL, messages: turns, temperature: 0.2, stream: true }),
      });
      if (!upstream.ok || !upstream.body) {
        // Log a bounded slice; never surface an upstream body to the browser — it echoes the
        // request back, headers included.
        console.error(`code model ${upstream.status}: ${(await upstream.text()).slice(0, 200)}`);
        return void json(res, 502, { error: "the code model is not answering" });
      }
      res.writeHead(200, { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store" });
      for await (const chunk of upstream.body) res.write(chunk);
      return void res.end();
    }

    if (req.method === "GET" && req.url === "/sdk/tools.js") {
      const js = await readFile(TOOLS_MODULE);
      return void res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" }).end(js);
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {}; // a malformed body carries no usable request; treat it as none, not a 500
  }
}

function json(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(obj));
}

server.listen(PORT, () => console.log(`pair up on http://localhost:${PORT}`));
