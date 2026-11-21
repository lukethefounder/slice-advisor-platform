import type { AgentEvidence } from "./contracts";

/** These DTOs carry research provenance, never execution authority or credentials. */
export type AgentResearchSource = {
  id: string;
  title: string;
  url: string;
  publisher: string;
  publishedAt: string | null;
  retrievedAt: string;
  contentScope: "search-reference" | "public-discovery-metadata" | "public-page-excerpt";
  excerpt: string | null;
  sha256: string | null;
  scope: "owner" | "opt-in-public-market-sources";
};
export type AgentResearchIssue = { tool: string; code: string; message: string };
export type AgentResearchCapability = {
  id: string;
  label: string;
  status: "available" | "empty" | "unavailable" | "restricted";
  recordCount: number;
  scope: "owner" | "owner-and-workspace" | "local-browser-only";
  detail: string;
};
export type AgentWorkspaceRecord = {
  id: string;
  capability: string;
  title: string;
  href: string;
  symbol: string | null;
  observedAt: string | null;
  retrievedAt: string;
  classification: "stored-research" | "hypothetical-backtest" | "registered-scenario" | "user-context" | "agent-discussion";
  summary: string;
  /** An allowlisted projection, not a copy of the application's database row. */
  data: Record<string, unknown>;
};
export type AgentResearchWeb = {
  status: "ready" | "cached" | "empty" | "disabled" | "unconfigured" | "error";
  provider: "OpenAI hosted web search";
  model: string | null;
  queries: string[];
  sources: AgentResearchSource[];
  summary: string | null;
  requestId: string | null;
  retrievedAt: string | null;
  usage: { inputTokens: number | null; outputTokens: number | null; searchCalls: number; billableUsd: null };
  cacheHit: boolean;
  cacheTtlSeconds: number;
  liveAccessRequested: boolean;
  detail: string;
};
export type ResearchSharingPreference = {
  version: 1;
  enabled: boolean;
  updatedAt: string | null;
  scope: "opt-in-public-market-sources";
  detail: string;
  revocation: string;
};
export type AgentSharedResearch = {
  status: "ready" | "empty" | "disabled" | "unavailable";
  publisherCount: number;
  sourceCount: number;
  scope: "opt-in-public-market-sources";
  sources: AgentResearchSource[];
  detail: string;
  truncated: boolean;
};
export type AgentResearchAccess = {
  version: 1;
  symbol: string;
  checkedAt: string;
  evidence: AgentEvidence[];
  web: AgentResearchWeb;
  workspace: { capabilities: AgentResearchCapability[]; records: AgentWorkspaceRecord[]; sources: AgentResearchSource[]; issues: AgentResearchIssue[] };
  shared: AgentSharedResearch;
  issues: AgentResearchIssue[];
};
