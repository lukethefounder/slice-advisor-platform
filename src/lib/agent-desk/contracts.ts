import type { DeskControls, DeskPolicy, PaperAccount, PaperFill, PaperDecision, TradeProposal, DeskQuote } from "./guardrails";
import type { CurrentResearchReport } from "@/lib/intelligence/research-current-types";
import type { SliceAgenticScore } from "@/lib/intelligence/research-swarm-types";
import type { ScoutDiscovery, DeskResearchTools } from "./research-tool-types";
import type { AgentLearningSummary } from "./collaboration-types";

export const AGENT_ROLES = ["chief", "sentiment", "scout", "news", "skeptic", "charts"] as const;
export type AgentRole = typeof AGENT_ROLES[number];
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = { chief: "Chief", sentiment: "Sentiment", scout: "Scout", news: "News", skeptic: "Skeptic", charts: "Charts" };
export const AGENT_ROLE_MISSIONS: Record<AgentRole, string> = {
  chief: "Consolidate the team's discussion, historical results and lessons; resolve challenges and make the final proposal for the selected account within the founder's policy. Execution is independently controlled by the server.",
  sentiment: "Use Intelligence's economy and market research to assess investor risk appetite, participation, financial conditions and willingness to commit capital; label proxies and missing observations.",
  scout: "Continuously inspect observed candidate stocks, explain why an opportunity deserves Intelligence research, and check alternatives without extending the approved trading universe.",
  news: "Investigate the selected Scout opportunity using the media side of the Intelligence graph; explain current catalysts, contradictory coverage and evidence-based short- and long-horizon scenarios.",
  skeptic: "Use Strategy Studio's verified historical tests, analogous scenarios and holdout samples to challenge both short- and long-term cases; distinguish empirical frequencies from future probabilities and veto unsupported entries.",
  charts: "Use Intelligence technicals, Market Visuals and Custom Board calculations to evaluate price structure, volume, momentum, volatility and viability without inventing missing metrics.",
};
export type DeskScope = { userId: string; firmId: string };
export type DeskScoutingSettings = { enabled: boolean; autoResearch: boolean; intervalMinutes: number; universe: string[]; maxCandidates: number };
export const DEFAULT_DESK_SCOUTING: DeskScoutingSettings = { enabled: false, autoResearch: false, intervalMinutes: 15, universe: [], maxCandidates: 8 };
export type DeskOperationsSettings = { mode: "economy" | "responsive"; helpersEnabled: boolean; maxHelpers: number; maxConcurrentHelpers: number; internetResearch: boolean; sharedResearch: boolean };
export const DEFAULT_DESK_OPERATIONS: DeskOperationsSettings = { mode: "economy", helpersEnabled: true, maxHelpers: 4, maxConcurrentHelpers: 2, internetResearch: true, sharedResearch: true };
export type DeskSettings = { symbol: string; intervalMinutes: number; initialCapital: number; policy: DeskPolicy; scouting?: DeskScoutingSettings; operations?: DeskOperationsSettings };
export type AgentUsage = { requests: number; inputTokens: number; outputTokens: number; cachedInputTokens: number; measuredResponses: number; unmeasuredResponses: number };
export type AgentEvidence = {
  id: string; title: string; summary: string; source: string; url: string;
  observedAt: string | null; retrievedAt: string;
  kind: "scored-evidence" | "public-discovery" | "execution-reference" | "tool-research"; cohort: string;
  metrics: Record<string, number | string | boolean | null>;
};
export type AgentFinding = {
  role: AgentRole; status: "complete" | "failed" | "skipped";
  stance: "bullish" | "bearish" | "neutral" | "insufficient";
  summary: string;
  findings: Array<{ claim: string; evidenceIds: string[] }>;
  risks: string[]; missingData: string[]; veto: boolean;
  action: "buy" | "sell" | "hold"; allocationPct: number | null;
  model: string | null; requestId: string | null;
  startedAt: string; completedAt: string; error: string | null;
  toolCalls?: Array<{ tool: string; evidenceIds: string[]; at: string }>;
  round?: number; phase?: "discovery" | "research" | "challenge" | "reply" | "decision";
  messages?: Array<{ to: AgentRole | "team"; body: string; evidenceIds: string[]; replyToIds: string[] }>;
  candidateSymbol?: string | null;
  lessonsReviewed?: string[];
  horizonViews?: Array<{ horizon: "short" | "long"; stance: "bullish" | "bearish" | "neutral" | "insufficient"; summary: string; evidenceIds: string[] }>;
  worker?: { id: string; parentRole: AgentRole; focus: string };
  usage?: AgentUsage;
};
export type AgentHelperReport = { id: string; parentRole: AgentRole; focus: string; evidenceIds: string[]; sourceHash: string; report: AgentFinding };
export type AgentCapabilityView = { id: string; label: string; status: "available" | "unavailable" | "disabled" | "partial"; detail: string };
export type DeskResourceView = { internet: { status: string; sources: number; queries: number; cacheHit: boolean }; workspaceRecords: number; sharedRecords: number; capabilities: AgentCapabilityView[]; issues: string[] };
export type DeskCycle = {
  version: 1; id: string; symbol: string; status: "complete" | "blocked" | "failed";
  startedAt: string; completedAt: string; settingsRevision: number;
  researchRunId: string | null; researchScore: SliceAgenticScore | null;
  currentResearch: CurrentResearchReport | null;
  agents: AgentFinding[]; evidence: AgentEvidence[];
  proposal: TradeProposal | null; decision: PaperDecision | null; fill: PaperFill | null;
  errors: string[]; sourceHash: string; equity: number | null; unrealizedPnl: number | null;
  contextQuote?: DeskQuote | null; executionQuote?: DeskQuote | null;
  researchTools?: DeskResearchTools | null; discovery?: ScoutDiscovery | null;
  learningSnapshot?: AgentLearningSummary | null;
  deliberation?: { version: "slice-agent-deliberation-2.0.0"; rounds: number; reports: number; messages: number; complete: boolean };
  helpers?: AgentHelperReport[];
  resources?: DeskResourceView;
  usage?: AgentUsage;
  executionTarget?: "local-simulation" | "alpaca-paper" | "alpaca-live";
  brokerContextRevision?: number;
  mode: "paper"; executionStatus: "filled" | "blocked" | "held" | "awaiting-approval" | "failed";
};
export type DeskBusy = { cycleId: string; jobId: string | null; startedAt: string; expiresAt: string; stage: string; progress: number };
export type AgentDeskView = {
  version: 1; revision: number; settings: DeskSettings; controls: DeskControls; account: PaperAccount;
  executionMode: "paper"; liveExecutionAvailable: false;
  providers: { ai: "configured-unverified" | "missing"; market: "configured-unverified" | "missing"; model: string };
  busy: DeskBusy | null; latestCycle: DeskCycle | null; history: DeskCycle[];
  nextRunAt: string | null; lastError: string | null; updatedAt: string;
  worker: { requiredForAutonomy: true; command: "npm run beta:worker"; lastCheckedAt: string | null };
  scouting?: { lastScanAt: string | null; nextScanAt: string | null; busy: { jobId: string | null; startedAt: string } | null; lastError: string | null; discovery: ScoutDiscovery | null; selection?: AgentFinding | null };
  operations?: { mode: "economy" | "responsive"; helperLimit: number; concurrency: number; lastReason: string | null; lastSignalAt: string | null; nextFullReviewAt: string | null; skippedReviews: number; lastCycleUsage: AgentUsage | null; capabilities: AgentCapabilityView[] };
};
/** POST /api/intelligence/agent-desk. A revision prevents a stale tab from
 * replacing newer safeguards. Controls start disabled for every account. */
export type AgentDeskCommand =
  | { action: "settings"; revision: number; settings: DeskSettings }
  | { action: "cycle"; revision: number }
  | { action: "scout"; revision: number }
  | { action: "enable"; revision: number; paperOnly: true }
  | { action: "arm"; revision: number; paperOnly: true }
  | { action: "pause" | "kill" | "resume"; revision: number }
  | { action: "approve"; revision: number; cycleId: string; paperOnly: true };

export class AgentDeskError extends Error {
  constructor(public code: string, message: string, public status = 409) { super(message); this.name = "AgentDeskError"; }
}
