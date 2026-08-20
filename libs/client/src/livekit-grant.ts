import type {
  CapacityBusyResponse,
  LiveKitCapacitySnapshot,
  LiveKitInitialContextMessage,
  LiveKitSessionGrant,
  LiveKitSessionRequestInput,
  LiveKitSessionWireRequestInput,
  LiveKitSttMode,
  LLMProvider,
  LLMSelectionForProvider,
} from "@theinfluencecompany/realtime-avatar-contracts";
import { toLiveKitSessionWireRequest as toContractLiveKitSessionWireRequest } from "@theinfluencecompany/realtime-avatar-contracts";
import type { VoiceSpecInput } from "./types";

export type {
  CapacityBusyResponse,
  ClientMetadata,
  LiveKitCapacitySnapshot,
  LiveKitInitialContextMessage,
  LiveKitSessionGrant,
  LiveKitSttMode,
  RenderBackend,
  TranscriptWebhook,
} from "@theinfluencecompany/realtime-avatar-contracts";

export type LiveKitSessionRequest<
  TLlmProvider extends LLMProvider = LLMProvider,
> = Omit<LiveKitSessionRequestInput, "llm" | "voice"> & {
  llm?: LLMSelectionForProvider<TLlmProvider> | null;
  // The INPUT voice type — `provider` is optional (the contract preprocess
  // defaults a `provider`-less, legacy `{mode,instruct}` voice to the qwen arm).
  // Using the OUTPUT VoiceSpec here would force callers to pass `provider`,
  // breaking every provider-less voice that used to typecheck.
  voice?: VoiceSpecInput | null;
};

/** Maps the ergonomic SDK request to the snake_case platform contract. */
export function toLiveKitSessionWireRequest<TLlmProvider extends LLMProvider>(
  input: LiveKitSessionRequest<TLlmProvider>,
): LiveKitSessionWireRequestInput {
  return toContractLiveKitSessionWireRequest(input);
}
