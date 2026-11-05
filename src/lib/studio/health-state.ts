import type { ProviderHealth, ProviderState } from "./contracts";
import { StudioError } from "./core";
export function healthAfterFailure(error: unknown, model: string, requestId: string | null, cancelled: boolean): ProviderHealth | null {
 if (cancelled || !(error instanceof StudioError)) return null;
 const states: Record<string, ProviderState> = { PROVIDER_MISSING: "missing", PROVIDER_AUTH: "invalid", PROVIDER_PERMISSION: "permission", PROVIDER_QUOTA: "quota", PROVIDER_RATE: "rate-limited", PROVIDER_MODEL: "model-unavailable", PROVIDER_UNAVAILABLE: "unavailable", PROVIDER_REQUEST: "unavailable", RESPONSE_INCOMPLETE: "unavailable", STREAM_INTERRUPTED: "unavailable", STREAM_EMPTY: "unavailable" };
 const state = states[error.code]; if (!state) return null;
 return { configured: state !== "missing", state, model, message: error.message, checkedAt: new Date().toISOString(), latencyMs: null, requestId: error.requestId || requestId };
}
