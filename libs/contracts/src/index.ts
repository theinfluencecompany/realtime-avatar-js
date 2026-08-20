/**
 * Wire schemas for the public Realtime Avatar API.
 *
 * Extracted from the platform and stripped to code only — deliberately. The internal
 * source documents operational history in its comments (incidents, deploy orderings,
 * worker app names), and a pruned copy keeps prose describing code that is gone. Shipping
 * code without prose makes that leak impossible rather than merely unlikely.
 *
 * Prose belongs in the docs: https://realtimeavatar.ai/docs — and in BOUNDARY.md, which
 * says what may cross and is enforced by `npm run boundary`.
 */
import { z } from "zod";

export const DEFAULT_AVATAR_ID = "maria";
export const DEFAULT_BACKGROUND_ID = "plain_white";
export const DEFAULT_LIVEKIT_ROOM_PREFIX = "rta";

export const sessionModeSchema = z.enum(["avatar", "voice"]);
export type SessionMode = z.infer<typeof sessionModeSchema>;
export const DEFAULT_SESSION_MODE: SessionMode = "avatar";

export const DEFAULT_RESERVATION_TTL_SECONDS = 90;

export const DEFAULT_PARTICIPANT_TOKEN_TTL_SECONDS = 1800;

export const DEFAULT_ROOM_DEPARTURE_TIMEOUT_SECONDS = 30;
export const DEFAULT_ROOM_MAX_PARTICIPANTS = 8;
export const DEFAULT_CAPACITY_RETRY_MS = 750;

export const DEFAULT_QUEUE_TICKET_TTL_SECONDS = 30;

export const DEFAULT_JOIN_TIMEOUT_SECONDS = 75;
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 120;
export const DEFAULT_MAX_SESSION_SECONDS = 1_800;

export const LIVEKIT_CONTROL_REQUEST_TIMEOUT_SECONDS = 8;
export const SOURCE_VIDEO_CACHE_SCHEMA_VERSION = "rtav-v1";
export const DEFAULT_RENDER_STORAGE_ROOT = "/models/render";
export const DEFAULT_VIDEO_CACHE_TMP_ROOT = "/tmp/render-video-cache";
export const VIDEO_CACHE_DIRNAME = "video-avatars";

export const sourceVideoCacheSettingsSchema = z
  .object({
    fps: z.number().int().min(1).max(60).default(25),
    max_dim: z.number().int().min(256).max(2_160).default(1_280),
    max_duration_seconds: z.number().min(0.2).max(300).default(12),
    feature_dtype: z.enum(["fp16", "fp32"]).default("fp16"),
    feature_policy: z.enum(["keyframe_stride"]).default("keyframe_stride"),
    keyframe_stride: z.number().int().min(1).max(25).default(5),
    shard_frames: z.number().int().min(5).max(500).default(125),
    precompute: z
      .array(z.enum(["fullface", "roi", "tracking_preview"]))
      .max(3)
      .default(["fullface"]),
    storage_mode: z.enum(["volume", "volume_and_tmp", "tmp_only"]).default("volume_and_tmp"),
    stage_to_tmp: z.boolean().default(true),
    prefetch_chunks: z.number().int().min(0).max(16).default(4),
    gpu_ring_chunks: z.number().int().min(1).max(16).default(3),
    pinned_cpu_cache_mb: z.number().int().min(0).max(65_536).default(4_096),
    lease_ttl_seconds: z.number().int().min(10).max(3_600).default(600),
    allow_stale_while_registering: z.boolean().default(true),
    overwrite: z.boolean().default(false),
  })
  .strict()
  .superRefine((settings, ctx) => {
    if (settings.storage_mode === "tmp_only" && !settings.stage_to_tmp) {
      ctx.addIssue({
        code: "custom",
        message: "tmp_only storage requires stage_to_tmp=true",
        path: ["stage_to_tmp"],
      });
    }
  });

export const avatarSourceKindSchema = z.enum(["portrait", "source_video"]);
export const liveKitSttModeSchema = z.enum(["server", "off"]);

export const renderBackendSchema = z.enum(["warp", "generative"]);
export type RenderBackend = z.infer<typeof renderBackendSchema>;
export const DEFAULT_RENDER_BACKEND: RenderBackend = "warp";
export const LLM_PROVIDERS = ["local", "gemini", "openai"] as const;
export const llmProviderSchema = z.enum(LLM_PROVIDERS);

export const llmConfigSchema = z
  .object({
    backend: llmProviderSchema.optional(),
    model: z.string().max(200).nullable().optional(),
  })
  .strict();

export const llmSelectionSchema = z
  .object({
    provider: llmProviderSchema,
    model: z.string().max(200).nullable().optional(),
  })
  .strict();

export const liveKitInitialContextMessageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant"]),
    content: z.string().min(1).max(4_000),
  })
  .strict();

export const CARTESIA_TTS_MODELS = [
  "cartesia/sonic-2",
  "cartesia/sonic-2-latest",
  "cartesia/sonic-3",
  "cartesia/sonic-3-latest",
  "cartesia/sonic-turbo",
  "cartesia/sonic-turbo-latest",
] as const;
export const cartesiaTtsModelSchema = z.enum(CARTESIA_TTS_MODELS);

export const qwenVoiceSpecSchema = z
  .object({
    provider: z.literal("qwen").default("qwen"),
    mode: z.enum(["preset", "design", "clone"]).default("preset"),
    speaker: z.string().min(1).max(120).nullable().optional(),
    instruct: z.string().min(1).max(2_000).nullable().optional(),
    prompt_b64: z.string().min(1).max(24_000).nullable().optional(),
  })
  .strict();

export const cartesiaVoiceSpecSchema = z
  .object({
    provider: z.literal("cartesia"),
    model: cartesiaTtsModelSchema.default("cartesia/sonic-3"),
    voice_id: z.string().min(1).max(120),
    speed: z.number().min(0.5).max(2).nullable().optional(),
    emotion: z.string().min(1).max(80).nullable().optional(),
    language: z.string().min(2).max(16).nullable().optional(),
  })
  .strict();

export const FISH_TTS_MODELS = ["speech-1.6", "s1", "s2-pro", "speech-1.5", "s1-mini"] as const;
export const fishTtsModelSchema = z.enum(FISH_TTS_MODELS);

export const breezeVoiceSpecSchema = z
  .object({
    provider: z.literal("breezeblue"),
    model: z.string().min(1).max(80).default("bluebell-v1-en"),
    voice_id: z.string().min(1).max(120),
    guidance_scale: z.number().min(1).max(10).nullable().optional(),
    instructions: z.string().min(1).max(1_000).nullable().optional(),
    language: z.string().min(2).max(16).nullable().optional(),
  })
  .strict();

export const fishVoiceSpecSchema = z
  .object({
    provider: z.literal("fish"),
    model: fishTtsModelSchema.default("speech-1.6"),
    voice_id: z.string().min(1).max(120),
    speed: z.number().min(0.5).max(2).nullable().optional(),
    emotion: z.string().min(1).max(80).nullable().optional(),
    language: z.string().min(2).max(16).nullable().optional(),
  })
  .strict();

export const voiceSpecSchema = z.preprocess(
  (value) => {
    if (value && typeof value === "object" && !Array.isArray(value) && !("provider" in value)) {
      return { ...(value as Record<string, unknown>), provider: "qwen" };
    }
    return value;
  },
  z.discriminatedUnion("provider", [
    qwenVoiceSpecSchema,
    cartesiaVoiceSpecSchema,
    breezeVoiceSpecSchema,
    fishVoiceSpecSchema,
  ]),
);

const nullableUrlSchema = z.string().url().nullable();

export const clipTriggerSchema = z.enum([
  "idle", 
  "listen", 
  "think", 
  "directive", 
]);
export type ClipTrigger = z.infer<typeof clipTriggerSchema>;

export const sessionClipSchema = z
  .object({
    clip_id: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/, "clip_id must be a slug")
      .refine((id) => id !== "primary", "'primary' is reserved for the avatar's source video"),
    source_video_url: z.string().url().optional(),
    video_cache_id: z.string().min(8).max(160).optional(),
    max_seconds: z.number().min(1).max(10).optional(),

    trigger: clipTriggerSchema.optional(),

    loop: z.boolean().optional(),

    weight: z.number().min(0).max(100).optional(),

    crossfade_ms: z.number().int().min(0).max(1000).optional(),

    trim_start_ms: z.number().int().min(0).max(2000).optional(),

    trim_end_ms: z.number().int().min(0).max(2000).optional(),

    hint: z.string().min(1).max(120).optional(),
  })
  .strict()
  .refine((clip) => clip.source_video_url || clip.video_cache_id, {
    message: "a clip needs source_video_url or video_cache_id",
  });

export const sessionChoreographySchema = z
  .object({

    idle_dwell_min_seconds: z.number().min(1).max(60).optional(),
    idle_dwell_max_seconds: z.number().min(1).max(120).optional(),

    special_weight: z.number().min(0).max(100).optional(),

    start_grace_seconds: z.number().min(0).max(60).optional(),

    crossfade_ms: z.number().int().min(0).max(1000).optional(),

    crossfade_easing: z.enum(["linear", "smooth", "ease_out"]).optional(),

    wrap_crossfade_ms: z.number().int().min(0).max(1000).optional(),
  })
  .strict()
  .refine(
    (c) =>
      c.idle_dwell_min_seconds === undefined ||
      c.idle_dwell_max_seconds === undefined ||
      c.idle_dwell_min_seconds <= c.idle_dwell_max_seconds,
    { message: "idle_dwell_min_seconds must be <= idle_dwell_max_seconds" },
  );
export type SessionChoreography = z.infer<typeof sessionChoreographySchema>;

export type SessionClip = z.infer<typeof sessionClipSchema>;

export const sessionBehaviorSchema = z
  .object({

    gestures_enabled: z.boolean().optional(),

    gesture_freq: z.enum(["sparse", "balanced", "lively"]).optional(),
  })
  .strict();
export type SessionBehavior = z.infer<typeof sessionBehaviorSchema>;

const _SCENE_CLIP_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export const sceneIdSchema = z.string().regex(/^[a-z0-9_]{1,40}$/, "scene_id must be a lowercase slug");
export type SceneId = z.infer<typeof sceneIdSchema>;

export const sceneTransitionSchema = z
  .object({
    clip_id: z.string().regex(_SCENE_CLIP_ID_RE, "clip_id must be a slug"),
    source_video_url: z.string().url(),
    from_scene: sceneIdSchema,
    to_scene: sceneIdSchema,
    max_seconds: z.number().min(1).max(10).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.from_scene === v.to_scene) {
      ctx.addIssue({ code: "custom", message: "a transition's from_scene must differ from to_scene", path: ["to_scene"] });
    }
  });
export type SceneTransition = z.infer<typeof sceneTransitionSchema>;

export const sceneClusterSchema = z
  .object({
    scene_id: sceneIdSchema,
    hub_clip_id: z.string().regex(_SCENE_CLIP_ID_RE, "hub_clip_id must be a slug"),
    clips: z.array(sessionClipSchema).min(1).max(4),
  })
  .strict();
export type SceneCluster = z.infer<typeof sceneClusterSchema>;

export const sceneGraphSchema = z
  .object({
    scenes: z.array(sceneClusterSchema).min(1).max(4),
    transitions: z.array(sceneTransitionSchema).min(2).max(12),
  })
  .strict();
export type SceneGraph = z.infer<typeof sceneGraphSchema>;

export const transcriptWebhookSchema = z
  .object({

    url: z.string().url().max(500),

    secret: z.string().min(16).max(200),
  })
  .strict();
export type TranscriptWebhook = z.infer<typeof transcriptWebhookSchema>;

export const clientMetadataSchema = z
  .record(z.string().min(1).max(64), z.string().max(200))
  .refine((value) => Object.keys(value).length <= 16, {
    message: "client_metadata carries at most 16 entries",
  });
export type ClientMetadata = z.infer<typeof clientMetadataSchema>;

export const liveKitSessionWireRequestSchema = z
  .object({
    avatar_id: z.string().min(1).max(160).default(DEFAULT_AVATAR_ID),
    background_id: z.string().min(1).max(160).default(DEFAULT_BACKGROUND_ID),



    mode: sessionModeSchema.default(DEFAULT_SESSION_MODE),
    create_room: z.boolean().default(true),
    dispatch_agent: z.boolean().default(true),
    instructions: z.string().min(1).max(4_000).optional(),
    initial_context: z.array(liveKitInitialContextMessageSchema).max(32).default([]),
    initial_say: z.string().min(1).max(1_000).optional(),
    llm: llmConfigSchema.nullable().optional(),
    max_session_seconds: z.number().int().min(1).max(DEFAULT_MAX_SESSION_SECONDS).optional(),
    participant_identity: z.string().min(1).max(160).optional(),
    participant_name: z.string().max(160).optional(),
    queue_ticket_id: z.string().min(1).max(160).optional(),
    portrait_url: nullableUrlSchema.optional(),
    room_name: z.string().min(1).max(160).optional(),
    source_kind: avatarSourceKindSchema.default("portrait"),
    source_video_url: nullableUrlSchema.optional(),
    stt_mode: liveKitSttModeSchema.default("off"),
    video_cache_id: z.string().min(1).max(240).nullable().optional(),
    voice: voiceSpecSchema.nullable().optional(),
    voice_id: z.string().min(1).max(240).nullable().optional(),

    clip_library: z.array(sessionClipSchema).max(8).optional(),



    choreography: sessionChoreographySchema.optional(),


    scene_graph: sceneGraphSchema.optional(),
    behavior: sessionBehaviorSchema.optional(),




    expression_profile: z.string().min(1).max(40).optional(),













    render_backend: renderBackendSchema.optional(),







    transcript_webhook: transcriptWebhookSchema.optional(),



    client_metadata: clientMetadataSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.source_kind === "portrait") {
      if (value.source_video_url || value.video_cache_id) {
        ctx.addIssue({
          code: "custom",
          message: "source_video_url/video_cache_id require source_kind='source_video'",
          path: ["source_kind"],
        });
      }
      return;
    }
    if (value.portrait_url) {
      ctx.addIssue({
        code: "custom",
        message: "portrait_url cannot be combined with source_kind='source_video'",
        path: ["portrait_url"],
      });
    }
    if (!value.source_video_url && !value.video_cache_id) {
      ctx.addIssue({
        code: "custom",
        message: "source_kind='source_video' requires source_video_url or video_cache_id",
        path: ["source_video_url"],
      });
    }
  });

export const liveKitSessionRequestSchema = z
  .object({
    avatarId: z.string().min(1).max(160),
    backgroundId: z.string().min(1).max(160).default(DEFAULT_BACKGROUND_ID),



    mode: sessionModeSchema.default(DEFAULT_SESSION_MODE),
    createRoom: z.boolean().default(true),
    dispatchAgent: z.boolean().default(true),
    instructions: z.string().min(1).max(4_000).optional(),
    initialContext: z.array(liveKitInitialContextMessageSchema).max(32).default([]),
    initialSay: z.string().min(1).max(1_000).optional(),
    llm: llmSelectionSchema.nullable().optional(),
    maxSessionSeconds: z.number().int().min(1).max(DEFAULT_MAX_SESSION_SECONDS).optional(),
    participantIdentity: z.string().min(1).max(160).optional(),
    participantName: z.string().max(160).optional(),
    queueTicketId: z.string().min(1).max(160).optional(),
    roomName: z.string().min(1).max(160).optional(),
    sttMode: liveKitSttModeSchema.default("off"),
    voice: voiceSpecSchema.nullable().optional(),
    voiceId: z.string().min(1).max(240).nullable().optional(),

    clipLibrary: z.array(sessionClipSchema).max(8).optional(),

    sceneGraph: sceneGraphSchema.optional(),

    behavior: sessionBehaviorSchema.optional(),

    renderBackend: renderBackendSchema.optional(),

    transcriptWebhook: transcriptWebhookSchema.optional(),


    clientMetadata: clientMetadataSchema.optional(),
  })
  .strict();

export const liveKitSessionGrantSchema = z
  .object({
    status: z.literal("ready").default("ready"),
    session_id: z.string().min(1),
    room_name: z.string().min(1),
    livekit_url: z.string().min(1),
    participant_token: z.string().min(1),
    participant_identity: z.string().min(1),
    reservation_expires_at: z.string().datetime({ offset: true }),
    stt_mode: liveKitSttModeSchema.default("off"),
    room_created: z.boolean().default(false),
    dispatch_created: z.boolean().default(false),
    join_timeout_seconds: z.number().int().nonnegative().default(DEFAULT_JOIN_TIMEOUT_SECONDS),
    idle_timeout_seconds: z.number().int().nonnegative().default(DEFAULT_IDLE_TIMEOUT_SECONDS),
    max_session_seconds: z.number().int().nonnegative().default(DEFAULT_MAX_SESSION_SECONDS),
  })
  .passthrough();

export const RTA_LIFECYCLE_TOPIC = "rta.lifecycle";

export const RTA_TURN_INSTRUCTIONS_ATTR = "rta.turn_instructions";
export const RTA_CLOSING_TURN_ATTR = "rta.closing_turn";
export const RTA_TURN_ID_ATTR = "rta.turn_id";

export const sessionEndReasonSchema = z.enum([
  "user_ended",
  "session_cap",
  "idle",
  "disconnected",
  "out_of_credits",
  "agent_ended",
  "failed",
]);
export type SessionEndReasonLabel = z.infer<typeof sessionEndReasonSchema>;

export const approachingEndReasonSchema = z.enum(["session_cap", "idle"]);
export type ApproachingEndReason = z.infer<typeof approachingEndReasonSchema>;

export const sessionClockFrameSchema = z
  .object({
    kind: z.literal("session_clock"),
    started_at_unix_ms: z.number().int().nonnegative(),
    max_session_seconds: z.number().int().nonnegative(),
    idle_timeout_seconds: z.number().int().nonnegative(),
  })
  .strict();

export const endingFrameSchema = z
  .object({ kind: z.literal("ending"), reason: approachingEndReasonSchema })
  .strict();

export const closingTurnDoneFrameSchema = z
  .object({ kind: z.literal("closing_turn_done"), turn_id: z.string().min(1) })
  .strict();

export const endedFrameSchema = z
  .object({ kind: z.literal("ended"), reason: sessionEndReasonSchema })
  .strict();

export const knownBehaviorStates = ["idle", "listening", "thinking", "speaking"] as const;
export type KnownBehaviorState = (typeof knownBehaviorStates)[number];

export const behaviorStateFrameSchema = z
  .object({
    kind: z.literal("behavior_state"),
    state: z.string().min(1).max(32),
    clip_id: z.string().min(1).max(64).optional(),

    trigger: clipTriggerSchema.optional(),
    loop: z.boolean().optional(),

    prev_clip_id: z.string().min(1).max(64).optional(),

    scene: z.string().min(1).max(40).optional(),

    scene_transition: z
      .object({
        clip_id: z.string().min(1).max(64),
        from_scene: z.string().min(1).max(40),
        to_scene: z.string().min(1).max(40),
      })
      .optional(),
  })
  .strip();

export const clipAckFrameSchema = z
  .object({
    kind: z.literal("clip_ack"),
    request_id: z.string().max(64),
    accepted: z.boolean(),
    reason: z.string().max(64),
  })
  .strip();

export const lifecycleServerFrameSchema = z.discriminatedUnion("kind", [
  sessionClockFrameSchema,
  endingFrameSchema,
  closingTurnDoneFrameSchema,
  endedFrameSchema,
  behaviorStateFrameSchema,
  clipAckFrameSchema,
]);
export type LifecycleServerFrame = z.infer<typeof lifecycleServerFrameSchema>;
export type BehaviorStateFrame = z.infer<typeof behaviorStateFrameSchema>;
export type ClipAckFrame = z.infer<typeof clipAckFrameSchema>;

export const requestGracefulCloseFrameSchema = z
  .object({ kind: z.literal("request_graceful_close"), reason: z.string().max(64).optional() })
  .strict();

export const extendFrameSchema = z
  .object({
    kind: z.literal("extend"),
    add_seconds: z.number().int().positive().max(DEFAULT_MAX_SESSION_SECONDS),
    proof: z.string().max(2048).optional(),
  })
  .strict();

export const clipRequestFrameSchema = z
  .object({
    kind: z.literal("clip_request"),
    request_id: z.string().min(1).max(64),
    clip_id: z.string().min(1).max(64),

    hold_seconds: z.number().min(3).max(20).optional(),
  })
  .strict();
export type ClipRequestFrame = z.infer<typeof clipRequestFrameSchema>;

export const lifecycleClientFrameSchema = z.discriminatedUnion("kind", [
  requestGracefulCloseFrameSchema,
  extendFrameSchema,
  clipRequestFrameSchema,
]);
export type LifecycleClientFrame = z.infer<typeof lifecycleClientFrameSchema>;

export const liveKitCapacitySnapshotSchema = z
  .object({
    // Placement identity + per-worker session ceiling. These are always present on the
    // wire (the platform serializes them and they come back on the grant, so a customer
    // already sees them) but are typed OPTIONAL here on purpose: this SDK is the defensive
    // READER of that wire, so a consumer must tolerate a response variant that omits them
    // rather than hard-fail parse. `max_sessions_per_gpu` is how many sessions one waking
    // worker serves — a queue-depth estimate input a consumer reads off the busy response.
    capacity_pool: z.string().min(1).optional(),
    agent_name: z.string().min(1).optional(),
    max_sessions: z.number().int().nonnegative(),
    max_sessions_per_gpu: z.number().int().positive().optional(),
    worker_count: z.number().int().nonnegative(),
    active_sessions: z.number().int().nonnegative(),
    reserved_sessions: z.number().int().nonnegative(),
    observed_worker_active_sessions: z.number().int().nonnegative(),
    available_sessions: z.number().int().nonnegative(),
    queue_size: z.number().int().nonnegative(),
    admission_open: z.boolean(),
    recommended_retry_ms: z.number().int().nonnegative(),
    load: z.number().min(0).max(1),
  })
  .passthrough();

export const capacityBusyResponseSchema = z
  .object({
    message: z.string().min(1),
    capacity: liveKitCapacitySnapshotSchema,
    queue_size: z.number().int().nonnegative(),
    queue_ticket_id: z.string().min(1).optional(),
    queue_position: z.number().int().positive().optional(),
    recommended_retry_ms: z.number().int().nonnegative(),
  })
  .strict();

export const liveKitSessionReleaseReasonSchema = z.enum([
  "page_hide", 
  "disconnected", 
  "superseded", 
  "unmount", 
  "manual", 
  "idle_timeout", 


]);

export const liveKitSessionReleaseRequestSchema = z
  .object({
    session_id: z.string().min(1).max(200).optional(),
    queue_ticket_id: z.string().min(1).max(200).optional(),
    reason: liveKitSessionReleaseReasonSchema.optional(),

  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.session_id && !value.queue_ticket_id) {
      ctx.addIssue({
        code: "custom",
        message: "release requires either session_id or queue_ticket_id",
        path: ["session_id"],
      });
    }
  });

export const liveKitJobMetadataSchema = z
  .object({
    session_id: z.string().min(1),
    room_name: z.string().min(1),
    reservation_expires_at: z.string().datetime({ offset: true }),
    metadata: z.record(z.string(), z.string()).default({}),
    initial_context: z.array(liveKitInitialContextMessageSchema).default([]),
    initial_say: z.string().optional(),
    max_session_seconds: z.number().int().positive().optional(),
    turn: z.record(z.string(), z.unknown()).optional(),


    clip_library: z.array(sessionClipSchema).max(8).optional(),

    choreography: sessionChoreographySchema.optional(),


    scene_graph: sceneGraphSchema.optional(),
    behavior: sessionBehaviorSchema.optional(),

    expression_profile: z.string().min(1).max(40).optional(),


    render_backend: renderBackendSchema.optional(),







    transcript_webhook: transcriptWebhookSchema.optional(),
    client_metadata: clientMetadataSchema.optional(),



  })
  .strict();

export const liveKitRoomMetadataSchema = z
  .object({
    session_id: z.string().min(1),
  })
  .strict();

export const liveKitParticipantMetadataSchema = liveKitRoomMetadataSchema
  .extend({
    stt_mode: liveKitSttModeSchema.default("off"),
  })
  .strict();

export const liveKitSessionConfigSchema = z
  .object({
    instructions: z.string().default(""),
    stt_mode: liveKitSttModeSchema.default("off"),
    avatar_id: z.string().min(1).max(160).optional(),



    render_backend: renderBackendSchema.optional(),
  })
  .strict();

export const liveKitSessionEventSchema = z
  .object({




    type: z.enum(["reserved", "started", "released", "capacity_full", "failed", "pod_uptime"]),
    session_id: z.string().min(1).optional(),
    room_name: z.string().min(1).optional(),
    worker_id: z.string().min(1).optional(),


    release_reason: liveKitSessionReleaseReasonSchema.optional(),

    pod_started_at_ms: z.number().int().nonnegative().optional(),
    pod_ended_at_ms: z.number().int().nonnegative().optional(),
    at: z.string().datetime({ offset: true }),
  })
  .strict();

export type AvatarSourceKind = z.infer<typeof avatarSourceKindSchema>;
export type LiveKitSttMode = z.infer<typeof liveKitSttModeSchema>;
export type LLMProvider = z.infer<typeof llmProviderSchema>;
export type LLMConfig = z.infer<typeof llmConfigSchema>;
export type LLMSelection = z.infer<typeof llmSelectionSchema>;
export type LLMSelectionForProvider<TProvider extends LLMProvider = LLMProvider> =
  TProvider extends LLMProvider
    ? Omit<LLMSelection, "provider"> & { provider: TProvider }
    : never;
export type LiveKitInitialContextMessage = z.infer<typeof liveKitInitialContextMessageSchema>;
export type CartesiaTtsModel = z.infer<typeof cartesiaTtsModelSchema>;
export type FishTtsModel = z.infer<typeof fishTtsModelSchema>;
export type QwenVoiceSpec = z.infer<typeof qwenVoiceSpecSchema>;
export type CartesiaVoiceSpec = z.infer<typeof cartesiaVoiceSpecSchema>;
export type BreezeVoiceSpec = z.infer<typeof breezeVoiceSpecSchema>;
export type FishVoiceSpec = z.infer<typeof fishVoiceSpecSchema>;

export type VoiceSpec = z.infer<typeof voiceSpecSchema>;

export type VoiceSpecInput = z.input<typeof voiceSpecSchema>;
export type LiveKitSessionRequestInput = z.input<typeof liveKitSessionRequestSchema>;
export type LiveKitSessionRequest = z.infer<typeof liveKitSessionRequestSchema>;
export type LiveKitSessionWireRequestInput = z.input<typeof liveKitSessionWireRequestSchema>;
export type LiveKitSessionWireRequest = z.infer<typeof liveKitSessionWireRequestSchema>;
export type LiveKitSessionGrant = z.infer<typeof liveKitSessionGrantSchema>;
export type LiveKitCapacitySnapshot = z.infer<typeof liveKitCapacitySnapshotSchema>;
export type CapacityBusyResponse = z.infer<typeof capacityBusyResponseSchema>;
export type LiveKitSessionEvent = z.infer<typeof liveKitSessionEventSchema>;
export type LiveKitSessionReleaseReason = z.infer<typeof liveKitSessionReleaseReasonSchema>;
export type LiveKitSessionReleaseRequest = z.infer<typeof liveKitSessionReleaseRequestSchema>;
export type LiveKitJobMetadata = z.infer<typeof liveKitJobMetadataSchema>;
export type LiveKitRoomMetadata = z.infer<typeof liveKitRoomMetadataSchema>;
export type LiveKitParticipantMetadata = z.infer<typeof liveKitParticipantMetadataSchema>;
export type LiveKitSessionConfig = z.infer<typeof liveKitSessionConfigSchema>;
export type SourceVideoCacheSettings = z.infer<typeof sourceVideoCacheSettingsSchema>;

export const planSourceVideoCache = async (
  sourceVideoUrl: string,
  settingsInput?: Partial<SourceVideoCacheSettings> | null,
  options: {
    storageRoot?: string;
    tmpRoot?: string;
  } = {},
) => {
  const settings = sourceVideoCacheSettingsSchema.parse(settingsInput ?? {});
  const sourceFingerprint = await sha256Hex(sourceVideoUrl.trim());
  const settingsFingerprint = await sha256Hex(stableJson(settings));
  const cacheIdMaterial = stableJson({
    cache_version: SOURCE_VIDEO_CACHE_SCHEMA_VERSION,
    source_fingerprint: sourceFingerprint,
    settings_fingerprint: settingsFingerprint,
  });
  const digest = await sha256Hex(cacheIdMaterial);
  const cacheId = `rtav_${digest.slice(0, 32)}`;
  const storageRoot = options.storageRoot ?? DEFAULT_RENDER_STORAGE_ROOT;
  const tmpRoot = options.tmpRoot ?? DEFAULT_VIDEO_CACHE_TMP_ROOT;
  const volumeRoot = `${storageRoot}/${VIDEO_CACHE_DIRNAME}/${cacheId}.rtav`;
  const stagingRoot = `${tmpRoot}/${cacheId}.rtav`;
  return {
    cache_id: cacheId,
    cache_version: SOURCE_VIDEO_CACHE_SCHEMA_VERSION,
    source_video_url: sourceVideoUrl,
    source_fingerprint: sourceFingerprint,
    settings_fingerprint: settingsFingerprint,
    paths: {
      volume_root: volumeRoot,
      staging_root: stagingRoot,
      manifest: `${volumeRoot}/manifest.json`,
      ready_marker: `${volumeRoot}/.ready`,
      lease: `${volumeRoot}/.registering.lock`,
      geometry: `${volumeRoot}/geometry.safetensors`,
      features_dir: `${volumeRoot}/features`,
      media_dir: `${volumeRoot}/media`,
      debug_dir: `${volumeRoot}/debug`,
    },
    settings,
  } as const;
};

export type VideoCachePlan = Awaited<ReturnType<typeof planSourceVideoCache>>;

export const toLiveKitSessionWireRequest = (
  input: LiveKitSessionRequestInput,
): LiveKitSessionWireRequestInput => {
  const request = liveKitSessionRequestSchema.parse(input);
  return defined({
    avatar_id: request.avatarId,
    background_id: request.backgroundId,
    mode: request.mode,
    create_room: request.createRoom,
    dispatch_agent: request.dispatchAgent,
    instructions: request.instructions,
    initial_context: request.initialContext,
    initial_say: request.initialSay,
    llm: request.llm
      ? {
          backend: request.llm.provider,
          model: request.llm.model ?? undefined,
        }
      : request.llm,
    max_session_seconds: request.maxSessionSeconds,
    participant_identity: request.participantIdentity,
    participant_name: request.participantName,
    queue_ticket_id: request.queueTicketId,
    room_name: request.roomName,
    stt_mode: request.sttMode,
    voice: request.voice,
    voice_id: request.voiceId,
    clip_library: request.clipLibrary,
    behavior: request.behavior,
    render_backend: request.renderBackend,
    transcript_webhook: request.transcriptWebhook,
    client_metadata: request.clientMetadata,
  });
};

export const assertCapacityInvariants = (timing: {
  reservationTtlSeconds: number;
  joinTimeoutSeconds: number;
}): void => {
  if (timing.reservationTtlSeconds < timing.joinTimeoutSeconds) {
    throw new Error(
      `reservationTtlSeconds (${timing.reservationTtlSeconds}) must be >= ` +
        `joinTimeoutSeconds (${timing.joinTimeoutSeconds}): a reserved lease that ` +
        `expires before the worker stops waiting for the participant re-hands a busy GPU`,
    );
  }
};

export const markStartedExpiresAtMs = (
  nowMs: number,
  timing: { joinTimeoutSeconds: number; idleTimeoutSeconds: number },
  marginSeconds = 15,
): number => {
  const horizonSeconds =
    Math.max(timing.joinTimeoutSeconds, timing.idleTimeoutSeconds) + Math.max(marginSeconds, 0);
  return nowMs + horizonSeconds * 1_000;
};

export const encodeLiveKitJobMetadata = (metadata: LiveKitJobMetadata): string => {
  return JSON.stringify(liveKitJobMetadataSchema.parse(metadata));
};

export const encodeLiveKitRoomMetadata = (metadata: LiveKitRoomMetadata): string => {
  return JSON.stringify(liveKitRoomMetadataSchema.parse(metadata));
};

export const encodeLiveKitParticipantMetadata = (
  metadata: LiveKitParticipantMetadata,
): string => {
  return JSON.stringify(liveKitParticipantMetadataSchema.parse(metadata));
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
};

const defined = <T extends Record<string, unknown>>(value: T): T => {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== null),
  ) as T;
};
