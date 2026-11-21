import "server-only";
import { requireAgentDeskAccess } from "./access";
import { AgentDeskError, type AgentEvidence, type DeskScope } from "./contracts";
import { requireResearchSymbol, researchText, uniqueResearchSources } from "./research-access-core";
import { loadAgentWorkspaceResearch } from "./research-access-platform";
import { emptySharedResearch, loadSharedPublicResearch } from "./research-access-sharing";
import { searchAgentPublicWeb } from "./research-access-web";
import type { AgentResearchAccess, AgentResearchIssue, AgentResearchSource } from "./research-access-types";

type ResearchAccessDependencies = { authorize?: typeof requireAgentDeskAccess; workspace?: typeof loadAgentWorkspaceResearch; web?: typeof searchAgentPublicWeb; shared?: typeof loadSharedPublicResearch; now?: () => number };
function sourceEvidence(source: AgentResearchSource): AgentEvidence {
  return { id: source.id, title: source.title,
    summary: source.excerpt ?? `${source.title}. ${source.publishedAt ? `Publication date: ${source.publishedAt}.` : "Publication date is unverified."} ${source.contentScope === "search-reference" ? "Returned as a consulted web-search reference; article content has not been independently opened." : "Public discovery metadata; no inferred sentiment or calibrated probability."}`,
    source: source.publisher, url: source.url, observedAt: source.publishedAt, retrievedAt: source.retrievedAt, kind: "tool-research", cohort: "media",
    metrics: { contentScope: source.contentScope, scope: source.scope, publicationDateKnown: Boolean(source.publishedAt), increasesResearchConfidence: false, calibratedProfitProbability: null, sha256: source.sha256 } };
}

/** All providers receive the authenticated owner scope. Independent reads are
 * bounded and may be partial; missing coverage remains explicit. */
export async function loadAgentResearchAccess(scope: DeskScope, input: { symbol: string; signal: AbortSignal; webEnabled?: boolean; maxWebQueries?: number; includeWorkspace?: boolean; includeShared?: boolean }, dependencies: ResearchAccessDependencies = {}): Promise<AgentResearchAccess> {
  const authorize = dependencies.authorize ?? requireAgentDeskAccess;
  input.signal.throwIfAborted(); await authorize(scope);
  const symbol = requireResearchSymbol(input.symbol), checkedAt = new Date(dependencies.now?.() ?? Date.now()).toISOString(), issues: AgentResearchIssue[] = [];
  const [workspace, web, shared] = await Promise.all([
    input.includeWorkspace === false ? Promise.resolve({ capabilities: [], records: [], sources: [], issues: [] } as AgentResearchAccess["workspace"]) : (dependencies.workspace ?? loadAgentWorkspaceResearch)(scope, { symbol, signal: input.signal }),
    (dependencies.web ?? searchAgentPublicWeb)(scope, { symbol, signal: input.signal, enabled: input.webEnabled, maxWebQueries: input.maxWebQueries }),
    input.includeShared === false ? Promise.resolve(emptySharedResearch("disabled")) : (dependencies.shared ?? loadSharedPublicResearch)(scope, symbol, input.signal).catch(error => {
      input.signal.throwIfAborted();
      if (error instanceof AgentDeskError && error.status === 403) throw error;
      issues.push({ tool: "shared-research", code: "SHARED_RESEARCH_UNAVAILABLE", message: "The consented public-source pool could not be read. No other users' private research was substituted." });
      return emptySharedResearch("unavailable");
    }),
  ]);
  input.signal.throwIfAborted(); await authorize(scope);
  if (["error", "unconfigured"].includes(web.status)) issues.push({ tool: "internet", code: web.status === "unconfigured" ? "WEB_RESEARCH_UNCONFIGURED" : "WEB_RESEARCH_UNAVAILABLE", message: web.detail });
  const sourceRows = uniqueResearchSources([...web.sources, ...workspace.sources, ...shared.sources], 64).map(sourceEvidence);
  const records: AgentEvidence[] = workspace.records.slice(0, 36).map(row => ({ id: row.id, title: row.title, summary: row.summary, source: `Slice ${row.capability}`, url: row.href,
    observedAt: row.observedAt, retrievedAt: row.retrievedAt, kind: "tool-research", cohort: ["strategies", "scenarios"].includes(row.capability) ? "historical" : "workspace",
    metrics: { capability: row.capability, classification: row.classification, increasesResearchConfidence: false, calibratedProfitProbability: null } }));
  return { version: 1, symbol, checkedAt, evidence: [...sourceRows, ...records].slice(0, 100), workspace, web, shared, issues: [...issues, ...workspace.issues] };
}

/** A finite, zero-network read tool for agents and helpers. It searches only the
 * server-preloaded inventory; a model cannot introduce an owner, SQL or API URL. */
export function searchAgentResearchInventory(access: AgentResearchAccess, input: { query?: string; capability?: string; limit?: number }) {
  if (input.query !== undefined && (typeof input.query !== "string" || input.query.length > 240) || input.limit !== undefined && (!Number.isFinite(input.limit) || input.limit < 1)) throw new AgentDeskError("INVALID_RESEARCH_QUERY", "Use a short research search and a positive finite result limit.", 400);
  if (input.capability && !access.workspace.capabilities.some(row => row.id === input.capability)) throw new AgentDeskError("INVALID_RESEARCH_CAPABILITY", "Choose an available research capability from this inventory.", 400);
  const words = researchText(input.query, 240).toLowerCase().split(/\W+/).filter(Boolean).slice(0, 12), limit = Math.min(20, Math.floor(input.limit ?? 10));
  const rank = (value: string) => words.reduce((sum, word) => sum + (value.toLowerCase().includes(word) ? 1 : 0), 0);
  const records = access.workspace.records.filter(row => !input.capability || row.capability === input.capability)
    .map(row => ({ row, rank: rank(`${row.title} ${row.summary} ${JSON.stringify(row.data)}`) })).filter(item => !words.length || item.rank > 0).sort((a, b) => b.rank - a.rank).slice(0, limit).map(item => item.row);
  const sources = input.capability ? [] : uniqueResearchSources([...access.web.sources, ...access.workspace.sources, ...access.shared.sources])
    .map(row => ({ row, rank: rank(`${row.title} ${row.publisher} ${row.url}`) })).filter(item => !words.length || item.rank > 0).sort((a, b) => b.rank - a.rank).slice(0, limit).map(item => item.row);
  return { symbol: access.symbol, checkedAt: access.checkedAt, records, sources, evidenceIds: [...records.map(row => row.id), ...sources.map(row => row.id)].filter(id => access.evidence.some(row => row.id === id)),
    scope: "preloaded-authorized-research" as const, networkRequests: 0, detail: "Stored context and source references retain their original timestamps. Search results do not alter confidence, trading policy, or user permissions." };
}
