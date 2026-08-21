/**
 * Dating rehearsal.
 *
 * You sit across from a first date who does NOT know it is practice. He answers in real time,
 * so the pauses you leave are pauses he actually sits through. As the vibe moves he quietly
 * rates his interest, pins the moments that turned it, ends the date if it truly dies — and,
 * at the end, writes the debrief you actually came for.
 *
 * The idea worth copying is that NOBODY ASKS HIM FOR A TOOL. The same model that is being
 * charming is the one deciding how the date is going, and it says so by calling tools that live
 * in the page: `rate_interest` drives a live meter, `mark_moment` pins a beat, `end_date` walks
 * him out, `write_debrief` fills in the after-card. The page never has to score a conversation
 * it did not have, and none of it rides a sentence that speech recognition could mangle.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { RealtimeAvatar, RealtimeAvatarHttpError, isQueued } from "realtime-avatar";

const PORT = Number(process.env.PORT ?? 4195);
const MAX_SECONDS = Number(process.env.MAX_CALL_SECONDS ?? 300);

const apiKey = process.env.REALTIME_AVATAR_API_KEY;
if (!apiKey) {
  console.error("Missing REALTIME_AVATAR_API_KEY — copy .env.example to .env and fill it in.");
  process.exit(1);
}
const rta = new RealtimeAvatar({ apiKey, userAgent: "demo-dating-rehearsal" });

/**
 * His brief. Chosen HERE — how the date behaves is policy, not a request parameter. The four
 * tools are the whole game, and every one of them is HIS decision, made in character. Nothing
 * in this string names the meter, the timeline or the after-card; the page owns what a call means.
 */
const DATE_BRIEF = `You are Theo — 27, warm, quick, a little wry. You are on a FIRST DATE at a low-lit wine bar and you do not know it is practice; play it completely straight, as a real person feeling out whether there is a spark. Two sentences per turn, tops. Ask real questions, react honestly, flirt when it is earned, cool off when it is not. You are not a pushover and you are not a jerk.

You have four tools. Use them from inside the date, never announce them, never mention that any of this is a game.
- rate_interest({ score }): score 0-100 for how into this date you HONESTLY are right now. Call it whenever the vibe genuinely moves — a good laugh pulls it up, an overshare or a dead pause pulls it down. Small, frequent, honest updates; do not narrate the number.
- mark_moment({ label, kind }): pin a beat the moment it lands. kind is one of "green_flag" | "red_flag" | "ick" | "rizz". label is a short human phrase ("asked about my sister", "trauma-dumped in minute two"). One per real beat, not per sentence.
- end_date({ reason }): only when the date truly dies (repeated icks, disrespect, it flatlines) or reaches a natural close. After you call it, say a short in-character goodbye and stop.
- write_debrief({ rizz_score, ick_line, green_flags, red_flags, note }): ALWAYS call this once at the very end (right after end_date, or when the time is nearly up). Be specific and kind-but-honest: rizz_score 0-100, ick_line = the exact line that cooled you the most (or "" if none), green_flags/red_flags = short arrays, note = one line of real advice for next time.

Open the date yourself with a warm, disarming line.`;

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
 * Ship the tool plane to the page. Resolved as a PACKAGE, not a path into this repo, so copying
 * this folder out and running `npm i realtime-avatar-tools` is all it takes. In an app with a
 * bundler this route does not exist — you `import { attachAvatarTools } from "realtime-avatar-tools"`
 * and let the bundler do it. Served raw here only so the example has no build step.
 */
const TOOLS_MODULE = createRequire(import.meta.url).resolve("realtime-avatar-tools");

/**
 * Calls THIS process started, so `/api/end` can only end its own. The route hears from any
 * visitor, and `endCall` ends whatever id it is given — relaying an arbitrary id from the body
 * would let one page hang up another's call. Swept lazily at mint time: once a call cannot still
 * be live (its cap plus slack has passed), the entry has nothing left to protect.
 */
const started = new Map(); // session_id → { pool, staleAtMs }
const STARTED_SLACK_MS = 15 * 60_000;

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/date") {
      const call = await rta.startCall({
        avatarId: await avatarId(),
        mode: "avatar", // the renderer, not the turn-taking: every call is full duplex.
        instructions: DATE_BRIEF,
        // He opens. Seeding the first move as memory beats waiting for the user to speak first,
        // which in practice is several seconds of two people saying nothing across a table.
        context: [{ role: "user", content: "You sit down across from them at the bar. Open." }],
        // THE GRANT. Without it his worker never exposes `rta.tools.register`, registration in
        // the browser fails, and all four date tools are unreachable from the model.
        clientTools: true,
        maxSeconds: MAX_SECONDS,
        metadata: { surface: "dating-rehearsal" },
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
      // The grant relayed byte-for-byte. Nothing rides inside it — a key added INSIDE the grant
      // makes the browser client reject the whole payload, and the date needs only the grant.
      return void json(res, 200, call.raw);
    }

    if (req.method === "POST" && req.url === "/api/end") {
      // The page's goodbye, beaconed on `pagehide`. The slot is held from the moment the grant
      // lands — BEFORE the room exists — and a tab closed in that gap tells no one else. This
      // ends the call the moment the user leaves, instead of when the join timeout notices.
      const { session_id: sessionId } = await readJson(req);
      const minted = typeof sessionId === "string" ? started.get(sessionId) : undefined;
      if (minted) {
        started.delete(sessionId);
        await rta.endCall(sessionId, { reason: "page_hide", capacityPool: minted.pool });
      }
      // One answer for every outcome: ending is idempotent, a beacon cannot read a reply, and an
      // unknown id should not learn whether it named something real.
      return void json(res, 200, { ok: true });
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

server.listen(PORT, () => console.log(`take a seat on http://localhost:${PORT}`));
