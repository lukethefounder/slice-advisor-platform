import type { MarketEvidence, MarketConnection } from "../market-evidence/contracts";
/** Shared wire contracts. No server secrets, provider clients, or database imports. */
export type StudioMode = "concise" | "balanced" | "detailed";
export type StudioState = "idle" | "recording" | "transcribing" | "thinking" | "responding";
export type ProviderState = "missing" | "unverified" | "verified" | "invalid" | "permission" | "quota" | "rate-limited" | "timeout" | "unavailable" | "model-unavailable";
export type ProviderHealth = {
    state: ProviderState;
    configured: boolean;
    model: string;
    message: string;
    checkedAt: string | null;
    latencyMs: number | null;
    requestId: string | null;
};
export type ResearchReference = {
    symbol: string;
    runId: string;
    bundleId: string;
    horizon: string;
    asOf: string;
    generatedAt: string;
    expectedReturnPct: number;
    probabilityPositive: number;
    confidence: number;
    expectedPrice: number;
    lowerPrice: number;
    upperPrice: number;
    referencePrice: number;
    targetAt: string | null;
    model: string;
    checksum: string;
    href: string;
};
export type StudioMessage = {
    id: string;
    role: "user" | "assistant";
    text: string;
    createdAt: string;
    state: "complete" | "streaming" | "cancelled" | "failed";
    requestKey: string;
    model?: string;
    reference?: ResearchReference | null;
    marketEvidence?: MarketEvidence | null;
    responseKind?: "model" | "evidence-only";
};
export type StudioThread = {
    id: string;
    title: string;
    updatedAt: string;
    messages: StudioMessage[];
    archived: boolean;
};
export type ThreadSummary = {
    id: string;
    title: string;
    updatedAt: string;
};
export type StudioBootstrap = {
    ok: true;
    health: ProviderHealth;
    marketHealth: MarketConnection;
    marketDefaults: string[];
    threads: ThreadSummary[];
    nextBefore: string | null;
    selected: StudioThread | null;
    transcriptionConfigured: boolean;
    researchChoices: Array<{
        symbol: string;
        runId: string;
        asOf: string;
    }>;
};
export type ResearchSelection = {
    symbol: string;
    runId: string;
    horizon: string;
};
export type ChatRequest = {
    prompt: string;
    threadId?: string;
    requestKey: string;
    mode: StudioMode;
    research?: ResearchSelection | null;
    market?: { symbols: string[]; news: boolean } | null;
    evidenceMode?: "auto" | "selected" | "off";
};
export type StudioEvent = {
    type: "start";
    threadId: string;
    title: string;
    user: StudioMessage;
    assistant: StudioMessage;
} | {
    type: "market";
    evidence: MarketEvidence;
} | {
    type: "status";
    message: string;
} | {
    type: "delta";
    text: string;
} | {
    type: "complete";
    message: StudioMessage;
    requestId: string | null;
} | {
    type: "failure";
    code: string;
    message: string;
    requestId: string | null;
};
export const STUDIO_LIMITS = { promptCharacters: 8000, messagesPerThread: 100, threadCharacters: 140000, contextCharacters: 24000, responseCharacters: 32000, jsonBytes: 40000, audioBytes: 3000000, audioSeconds: 60 } as const;
