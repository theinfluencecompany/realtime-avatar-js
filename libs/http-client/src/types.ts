/**
 * The public shapes. Everything an integrator touches is here, in one file, on purpose:
 * an agent reading this repo should be able to learn the whole surface without following
 * imports.
 *
 * Naming is camelCase throughout. The HTTP wire is snake_case and strict — that translation
 * happens once, inside `client.ts`, and nowhere else.
 */

/**
 * Live video and audio (default), or audio only.
 *
 * `mode` picks the RENDERER, not the turn-taking. Both modes run the same full-duplex
 * loop — she listens the entire time she is speaking, and she stops when you cut in.
 * `voice` skips the GPU render (cheaper, no video track); `avatar` publishes video.
 *
 * There is deliberately no `duplex` option. An earlier version of this SDK had one and
 * reached "full duplex" by pinning an internal capacity pool — which is why
 * `{ mode: "avatar", duplex: "full" }` used to silently rewrite `mode` to `"voice"` and
 * hand back a call with no video track. That separate engine was retired upstream: its
 * turn-taking now runs on both the render and the voice worker, so the pool it pinned
 * serves no traffic. Interruption is not a mode you select — it is how calls work.
 */
export type CallMode = "avatar" | "voice";

/** A prior message replayed as memory when the call opens. */
export interface ContextMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** One named state the character can rest in, and when she should be in it. */
export interface VideoState {
  /**
   * A plain sentence — "when the user is happy". Read by the CHARACTER, not by a rules
   * engine, so write it the way you would brief an actor. `sentiment > 0.7` does nothing.
   */
  when: string;
  /** A closed-loop clip: first frame and last frame on the same rest pose. */
  url: string;
  /** Relative likelihood against sibling states. Default 1. */
  weight?: number;
}

/**
 * How the character is rendered.
 *
 * A union rather than optional fields: clips on a generative call is a contradiction, and
 * this makes it unrepresentable instead of silently ignored.
 */
export type VideoPolicy =
  | {
      mode?: "looping";
      /** The one clip she rests in. Omit to use the avatar's stored source video. */
      loop?: string;
      /** Named states we compile into a state machine and switch between. Max 8. */
      states?: Record<string, VideoState>;
    }
  | { mode: "generative" };

/** What YOUR SERVER decides about a call. Never accept any of this from a browser. */
export interface CallPolicy {
  /** Her behavior contract — who she is and how she speaks. Max 4000 chars. */
  instructions?: string;
  /** Up to 32 prior messages, replayed as memory. */
  context?: readonly ContextMessage[];
  /** Hard stop in seconds, max 1800. Compute it from the balance you just admitted. */
  maxSeconds?: number;
  /** Speech recognition. `server` for a spoken conversation, `off` if you drive turns. */
  listen?: boolean;
  /** How she is rendered. */
  video?: VideoPolicy;
  /** Voice override for this call; omit to use the avatar's default. */
  voice?: unknown;
  /**
   * Let the browser register tools the model may call.
   *
   * This is a CAPABILITY, granted at mint time by your server — it is the gate, and the only
   * off switch. Without it the worker never exposes the registration method, so no page code
   * is reachable from the model at all. Never grant it from a request body.
   *
   * Note the manifest does NOT ride this request: it is registered over RPC after the client
   * connects. Putting tools on the mint returns 422 (the request schema is strict).
   */
  clientTools?: boolean;

  /** Receive the two-sided transcript, signed, after the call ends. */
  transcript?: { url: string; secret: string };
  /** Up to 16 string pairs, echoed verbatim on that transcript. */
  metadata?: Record<string, string>;
}

/**
 * What a client needs to join. Treat it as OPAQUE and relay it byte-for-byte — the browser
 * SDK validates it strictly, and adding or wrapping a key throws.
 */
export interface CallConnection {
  status: "ready";
  sessionId: string;
  roomName: string;
  /** Hand these two to `livekit-client` if you are not using the browser SDK. */
  livekitUrl: string;
  participantToken: string;
  participantIdentity: string;
  maxSessionSeconds: number;
  idleTimeoutSeconds: number;
  /** Join before this or the slot returns to the pool. */
  reservationExpiresAt: string;
  /** The untouched server payload. Relay THIS, not the parsed object above. */
  raw: Record<string, unknown>;
}

/** Every slot is busy. Not an error — hold and retry. */
export interface CallQueued {
  queued: true;
  position: number | null;
  size: number;
  retryAfterMs: number;
}

export type StartCallResult = CallConnection | CallQueued;

export function isQueued(result: StartCallResult): result is CallQueued {
  return "queued" in result;
}

/**
 * Why a call ended. Diagnostic — it shows on the session record, and every reason frees the
 * slot identically. `page_hide` is the one a tab-close beacon sends; `manual` is an explicit
 * server-side decision.
 */
export type EndCallReason =
  | "page_hide"
  | "disconnected"
  | "superseded"
  | "unmount"
  | "manual"
  | "idle_timeout";

export interface EndCallOptions {
  reason?: EndCallReason;
  /**
   * The grant's `capacity_pool` (`call.raw.capacity_pool`), naming where the slot is held so
   * the release cannot miss it. Optional — without it the platform frees against its default
   * placement, which is where calls land today — but if the grant is in hand, pass it.
   */
  capacityPool?: string;
}

export type AssetKind = "image" | "video" | "audio";

export interface Asset {
  id: string;
  kind: AssetKind;
  /**
   * Public, unguessable, range-capable. Feed straight into `loop` or a state url.
   *
   * The API calls this field `publicUrl`; it is surfaced as `url` here because that is what
   * it is used for. Black-box testing caught the mapper reading the wrong name and handing
   * back `undefined` — hence the regression test.
   */
  url: string;
  status: "pending" | "ready" | "failed" | string;
  contentType: string | null;
  sizeBytes: number | null;
}

export interface Avatar {
  id: string;
  displayName: string;
  sourceKind: "image" | "video";
  status: "draft" | "preprocessing" | "ready" | "failed" | "disabled" | "deleted";
  defaultVoiceId: string | null;
}

/** One billable session — when it ran, how long it was billable for, what it cost. */
export interface UsageSession {
  sessionId: string;
  avatarId: string | null;
  status: "reserved" | "started" | "released" | "failed";
  startedAt: string | null;
  endedAt: string | null;
  /** Billable wall time in SECONDS. Null until the session settles. */
  activeSeconds: number | null;
  billedCreditMicros: number | null;
  /**
   * Whatever you passed as `metadata` to `startCall`. `{}` if you passed nothing — tagging
   * is optional, and per-session billing works either way.
   */
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface UsageSessionPage {
  sessions: UsageSession[];
  /** Pass as `cursor` for the next page. Null on the last one. */
  nextCursor: string | null;
  /** The window actually served — the platform clamps wide or inverted ranges. */
  from: string;
  to: string;
}

export interface ListSessionsOptions {
  /** ISO timestamps. Defaults to the trailing 30 days; 90 days is the widest served. */
  from?: string;
  to?: string;
  /** Only sessions you tagged with this `metadata.user_id`. */
  endUserId?: string;
  /** Page size, capped at 200. */
  limit?: number;
  cursor?: string;
}

export interface CreditBalance {
  balanceCreditMicros: number;
  reservedCreditMicros: number;
}

/** Result of reconciling an avatar's clip set to the cache tier. */
export interface ClipSyncResult {
  queued: string[];
  ready: string[];
  retired: string[];
}

/** The signed payload delivered to `CallPolicy.transcript.url` after a call ends. */
export interface TranscriptPayload {
  type: "session.transcript";
  session_id: string;
  avatar_id: string;
  mode: CallMode;
  started_at: number;
  ended_at: number;
  seconds: number;
  /** True when a very long call exceeded the buffer and the transcript is partial. */
  truncated: boolean;
  segments: Array<{
    role: "user" | "assistant";
    text: string;
    ts: number;
    /** She was cut off — this text is only what she actually said out loud. */
    interrupted?: boolean;
  }>;
  /**
   * The tool calls the model acted on, in order — absent when the session ran none. An
   * entry without `ok` means the call produced nothing the model saw. `arguments` and
   * `result`/`error` are truncated to 2,000 chars each: this is a history, not a replay.
   */
  tool_calls?: Array<{
    name: string;
    call_id: string;
    /** The raw JSON arguments string, exactly as the model sent it. */
    arguments: string;
    ts: number;
    ok?: boolean;
    result?: string;
    error?: string;
    duration_ms?: number;
  }>;
  /** True when the session ran more tool calls than the buffer holds — the tail is missing. */
  tool_calls_truncated?: boolean;
  client_metadata: Record<string, string>;
}
