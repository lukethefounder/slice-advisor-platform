import { AgentDeskError, DEFAULT_DESK_OPERATIONS, type AgentEvidence, type AgentUsage, type DeskOperationsSettings } from "./contracts";

export function validateDeskOperations(value: unknown): DeskOperationsSettings {
  if (value === undefined) return { ...DEFAULT_DESK_OPERATIONS };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AgentDeskError("INVALID_OPERATIONS", "Choose valid agent operation settings.", 400);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !["mode", "helpersEnabled", "maxHelpers", "maxConcurrentHelpers", "internetResearch", "sharedResearch"].includes(key)) || !["economy", "responsive"].includes(String(row.mode)) || typeof row.helpersEnabled !== "boolean" || typeof row.internetResearch !== "boolean" || typeof row.sharedResearch !== "boolean" || !Number.isInteger(row.maxHelpers) || Number(row.maxHelpers) < 0 || Number(row.maxHelpers) > 12 || !Number.isInteger(row.maxConcurrentHelpers) || Number(row.maxConcurrentHelpers) < 1 || Number(row.maxConcurrentHelpers) > 3)
    throw new AgentDeskError("INVALID_OPERATIONS", "Choose economy or responsive mode, 0–12 helpers, and 1–3 concurrent helpers.", 400);
  return row as DeskOperationsSettings;
}
export const emptyAgentUsage = (): AgentUsage => ({ requests: 0, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, measuredResponses: 0, unmeasuredResponses: 0 });
export function sumAgentUsage(rows: Array<AgentUsage | undefined>): AgentUsage {
  const result = emptyAgentUsage();
  for (const row of rows) if (row) for (const key of Object.keys(result) as Array<keyof AgentUsage>) result[key] += Number.isFinite(row[key]) && row[key] >= 0 ? row[key] : 0;
  return result;
}
export type AgentSignalState = { evaluatedAt: string | null; lastReviewAt: string | null; referencePrice: number | null; lastSourceFingerprint: string | null; lastExposureFingerprint: string | null; lastReason: string | null; nextFullReviewAt: string | null; skippedReviews: number };
export const emptyAgentSignal = (): AgentSignalState => ({ evaluatedAt: null, lastReviewAt: null, referencePrice: null, lastSourceFingerprint: null, lastExposureFingerprint: null, lastReason: null, nextFullReviewAt: null, skippedReviews: 0 });

/** A cheap observed-data check gates expensive model reviews. Monitoring and
 * broker-native protection continue independently; no old proposal is re-executed. */
export function decideAgentReview(input: {
  mode: DeskOperationsSettings["mode"]; now: string; state: AgentSignalState; price: number | null;
  sourceFingerprint: string | null; exposureFingerprint: string; intervalMinutes: number;
  observationsFresh: boolean; force?: boolean;
}) {
  const now = Date.parse(input.now), last = Date.parse(input.state.lastReviewAt ?? "");
  const maximumMinutes = input.mode === "economy" ? Math.max(60, input.intervalMinutes) : Math.max(15, input.intervalMinutes);
  const minimumMinutes = input.mode === "economy" ? Math.max(10, input.intervalMinutes) : Math.max(5, input.intervalMinutes);
  const nextFullReviewAt = Number.isFinite(last) ? new Date(last + maximumMinutes * 60_000).toISOString() : input.now;
  if (!Number.isFinite(now)) throw new AgentDeskError("INVALID_SIGNAL_TIME", "The review needs a valid observation time.");
  const elapsed = Number.isFinite(last) ? now - last : Infinity;
  const movementPct = input.price !== null && input.state.referencePrice !== null && input.state.referencePrice > 0 ? Math.abs(input.price / input.state.referencePrice - 1) * 100 : null;
  const sourceChanged = Boolean(input.sourceFingerprint && input.sourceFingerprint !== input.state.lastSourceFingerprint);
  const exposureChanged = input.exposureFingerprint !== input.state.lastExposureFingerprint;
  const reason = input.force ? "Explicit research request" : !input.observationsFresh ? "Waiting for a fresh observed market input" : !Number.isFinite(last) ? "Initial research review" : exposureChanged ? "Account exposure changed" : elapsed < minimumMinutes * 60_000 ? "Minimum review interval; price monitoring remains active" : sourceChanged ? "New dated research material" : movementPct !== null && movementPct >= (input.mode === "economy" ? 0.75 : 0.25) ? "Material observed price change" : elapsed >= maximumMinutes * 60_000 ? "Scheduled full evidence refresh" : "No material change; reused monitoring context without another model review";
  const review = Boolean(input.force || input.observationsFresh && (!Number.isFinite(last) || exposureChanged || elapsed >= minimumMinutes * 60_000 && (sourceChanged || movementPct !== null && movementPct >= (input.mode === "economy" ? 0.75 : 0.25) || elapsed >= maximumMinutes * 60_000)));
  return { review, reason, movementPct, nextFullReviewAt };
}

/** Original sources remain the unit of evidence. Helpers never add score votes. */
export function uniqueAgentEvidence(evidence: AgentEvidence[]): AgentEvidence[] {
  return [...new Map(evidence.map(item => [item.id, item])).values()];
}
