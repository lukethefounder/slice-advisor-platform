import "server-only";
import { prisma } from "@/lib/prisma";
import { getResearchNetwork } from "@/lib/connected-research/network-service";
import { requireAgentDeskAccess } from "./access";
import { readAgentBoard, readAgentBriefs } from "./collaboration";
import { AgentDeskError, type DeskScope } from "./contracts";
import { projectPublicDiscoverySources, publicResearchUrl, researchDate, researchHash, researchJson, researchObject, researchText, uniqueResearchSources } from "./research-access-core";
import type { AgentResearchAccess, AgentResearchCapability, AgentResearchSource, AgentWorkspaceRecord } from "./research-access-types";

type PlatformDatabase = Pick<typeof prisma, "sliceForecastBundle" | "sliceStrategyDefinition" | "sliceStrategyRun" | "sliceForwardScenario" | "namedWatchlistItem" | "headlineDecision" | "briefingReport">;
type PlatformDependencies = { db?: PlatformDatabase; authorize?: typeof requireAgentDeskAccess; network?: typeof getResearchNetwork; board?: typeof readAgentBoard; briefs?: typeof readAgentBriefs; now?: () => number };
type Projection = Omit<AgentWorkspaceRecord, "capability" | "retrievedAt">;
const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(0, 100) : [];
function numericFields(value: unknown, keys: string[]): Record<string, number | null> {
  const object = researchJson(value);
  return Object.fromEntries(keys.map(key => [key, typeof object[key] === "number" && Number.isFinite(object[key]) ? object[key] : null]));
}
const performanceKeys = ["totalReturnPct", "cagrPct", "maxDrawdownPct", "annualizedVolatilityPct", "sharpe", "dailyWinRatePct", "tradeCount", "fees", "slippage"];
function safeRuleSet(value: unknown, depth = 0): unknown {
  if (!researchObject(value) || depth > 3) return null;
  return { mode: value.mode === "any" ? "any" : "all", rules: Array.isArray(value.rules) ? value.rules.slice(0, 30).filter(researchObject).map(rule => ({ metric: researchText(rule.metric, 50), comparator: researchText(rule.comparator, 20), subject: researchText(rule.subject, 20), ...numericFields(rule, ["period", "value", "upper"]) })) : [],
    groups: Array.isArray(value.groups) ? value.groups.slice(0, 6).map(group => safeRuleSet(group, depth + 1)) : [] };
}
function strategyProjection(spec: Record<string, unknown>) {
  return { symbols: list(spec.symbols), benchmark: researchText(spec.benchmark, 32), startDate: researchText(spec.startDate, 20), endDate: researchText(spec.endDate, 20),
    entry: safeRuleSet(spec.entry), exit: safeRuleSet(spec.exit), regime: safeRuleSet(spec.regime), ranking: researchText(spec.ranking, 40), weighting: researchText(spec.weighting, 40), rebalance: researchText(spec.rebalance, 30),
    ...numericFields(spec, ["maxHoldings", "maxPositionPct", "maxExposurePct", "trailingStopPct", "maxHoldingSessions", "stopLossPct", "takeProfitPct", "portfolioStopPct", "cooldownSessions", "feeBps", "slippageBps", "commissionUsd"]) };
}

/** Read-only federation. User-owned models retain their existing userId guard;
 * workspace-specific models retain both userId and firmId. This grants no client
 * portfolio, document, security, billing, invitation or administrative capability. */
export async function loadAgentWorkspaceResearch(scope: DeskScope, input: { symbol: string; signal: AbortSignal }, dependencies: PlatformDependencies = {}): Promise<AgentResearchAccess["workspace"]> {
  const db = dependencies.db ?? prisma, authorize = dependencies.authorize ?? requireAgentDeskAccess, now = dependencies.now?.() ?? Date.now(), retrievedAt = new Date(now).toISOString();
  input.signal.throwIfAborted(); await authorize(scope);
  const sources: AgentResearchSource[] = [];
  const capture = async (id: string, label: string, recordScope: AgentResearchCapability["scope"], detail: string, read: () => Promise<Projection[]>) => {
    try {
      input.signal.throwIfAborted();
      const found = await read(); input.signal.throwIfAborted();
      return { capability: { id, label, status: found.length ? "available" as const : "empty" as const, recordCount: found.length, scope: recordScope, detail },
        records: found.map(row => ({ ...row, capability: id, retrievedAt })), issues: [] };
    } catch (error) {
      input.signal.throwIfAborted();
      if (error instanceof AgentDeskError && error.status === 403) throw error;
      return { capability: { id, label, status: "unavailable" as const, recordCount: 0, scope: recordScope, detail: "This source could not be read. No replacement records or fabricated data were supplied." }, records: [],
        issues: [{ tool: id, code: error instanceof AgentDeskError ? error.code : "WORKSPACE_RESEARCH_UNAVAILABLE", message: `${label} is currently unavailable.` }] };
    }
  };
  const results = await Promise.all([
    capture("knowledge-graph", "Intelligence knowledge graphs", "owner", "Latest four saved research runs for this symbol, with integrity checks, source metadata and original score timestamps.", async () => {
      const rows = await db.sliceForecastBundle.findMany({ where: { userId: scope.userId, symbol: input.symbol, status: { in: ["Ready", "ResearchOnly"] } }, orderBy: { createdAt: "desc" }, take: 4,
        select: { id: true, symbol: true, researchRunId: true, status: true, provider: true, researchJson: true, graphJson: true, operationsJson: true, asOfAt: true } });
      return rows.map(row => {
        const audit = researchJson(row.operationsJson);
        if (audit.researchSha256 !== researchHash(row.researchJson) || audit.graphSha256 !== researchHash(row.graphJson)) throw new AgentDeskError("RESEARCH_ARCHIVE_INTEGRITY", "A stored research record failed its source-integrity check.", 503);
        const research = researchJson(row.researchJson), graph = researchJson(row.graphJson), current = researchJson(research.currentResearch);
        sources.push(...projectPublicDiscoverySources(research, now));
        return { id: `graph:${row.id}`, title: `${row.symbol} ${researchText(research.companyName, 120)} research`, href: `/workspace/intelligence?symbol=${encodeURIComponent(row.symbol)}&researchRunId=${encodeURIComponent(row.researchRunId)}`, symbol: row.symbol,
          observedAt: researchDate(row.asOfAt, now), classification: "stored-research" as const, summary: `Saved ${row.status} research. Its original score is an analysis output, not a calibrated chance of profit.`,
          data: { researchRunId: row.researchRunId, provider: row.provider, status: row.status, sector: researchText(research.sector, 100), industry: researchText(research.industry, 100),
            score: numericFields(research.score, ["overall", "confidence"]), currentResearch: { status: researchText(current.status, 30), checkedAt: researchDate(current.checkedAt, now), publication: researchText(current.publication, 30), gaps: Array.isArray(current.gaps) ? current.gaps.slice(0, 12).filter(researchObject).map(gap => ({ code: researchText(gap.code, 80), description: researchText(gap.description, 400), action: researchText(gap.action, 400) })) : [] },
            graph: { nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : 0, edgeCount: Array.isArray(graph.edges) ? graph.edges.length : 0,
              nodes: Array.isArray(graph.nodes) ? graph.nodes.slice(0, 16).filter(researchObject).map(node => ({ id: researchText(node.id, 120), label: researchText(node.label, 180), type: researchText(node.type, 40) })) : [] } } };
      });
    }),
    capture("research-network", "Research lineage", "owner-and-workspace", "Owned forecast, historical dataset, backtest and forward-scenario relationships. Symbol links are context, not causation.", async () => {
      const network = await (dependencies.network ?? getResearchNetwork)(scope, input.symbol);
      return network.nodes.filter(node => node.kind !== "symbol").slice(0, 24).map(node => ({ id: `lineage:${node.id}`, title: node.label, href: node.href, symbol: input.symbol, observedAt: node.asOf, classification: "stored-research" as const,
        summary: researchText(node.subtitle, 700), data: { kind: node.kind, state: node.state, classification: node.classification, edges: network.edges.filter(edge => edge.source === node.id || edge.target === node.id).slice(0, 12) } }));
    }),
    capture("strategies", "Strategy Studio definitions and results", "owner", "Saved entry/exit rules and actual stored historical simulation summaries; backtest win rates are not future profit probabilities.", async () => {
      const [definitions, runs] = await Promise.all([
        db.sliceStrategyDefinition.findMany({ where: { userId: scope.userId }, orderBy: { updatedAt: "desc" }, take: 30, select: { id: true, name: true, specJson: true, updatedAt: true } }),
        db.sliceStrategyRun.findMany({ where: { userId: scope.userId }, orderBy: { createdAt: "desc" }, take: 30, select: { id: true, name: true, summaryJson: true, engineVersion: true, inputSha256: true, outputSha256: true, createdAt: true } }),
      ]);
      return [
        ...definitions.flatMap(row => { const spec = researchJson(row.specJson); return list(spec.symbols).includes(input.symbol) ? [{ id: `strategy:${row.id}`, title: researchText(row.name, 180), href: `/workspace/strategy-lab?symbol=${encodeURIComponent(input.symbol)}`, symbol: input.symbol, observedAt: researchDate(row.updatedAt, now), classification: "user-context" as const, summary: "Owner-selected rules and exits. A saved definition is not a successful strategy result.", data: strategyProjection(spec) }] : []; }).slice(0, 8),
        ...runs.flatMap(row => { const summary = researchJson(row.summaryJson); return list(summary.universe).includes(input.symbol) ? [{ id: `backtest:${row.id}`, title: researchText(row.name, 180), href: `/workspace/strategy-lab?strategyRunId=${encodeURIComponent(row.id)}&symbol=${encodeURIComponent(input.symbol)}`, symbol: input.symbol, observedAt: researchDate(row.createdAt, now), classification: "hypothetical-backtest" as const, summary: "Stored hypothetical historical returns with original run identity and engine. Check costs, holdout and dataset vintage before drawing conclusions.", data: { universe: list(summary.universe), start: researchText(summary.start, 20), end: researchText(summary.end, 20), engineVersion: row.engineVersion, inputSha256: row.inputSha256, outputSha256: row.outputSha256, strategy: numericFields(summary.strategy, performanceKeys), benchmark: numericFields(summary.benchmarkPerformance, performanceKeys) } }] : []; }).slice(0, 8),
      ];
    }),
    capture("scenarios", "Registered forward scenarios", "owner-and-workspace", "Owned workspace scenario definitions and tracked session status. Assumptions remain separate from observed outcomes.", async () => {
      const rows = await db.sliceForwardScenario.findMany({ where: scope, orderBy: { updatedAt: "desc" }, take: 24, select: { id: true, name: true, status: true, specJson: true, sourceRunId: true, acceptedSessions: true, lastSession: true, lastCheckedAt: true } });
      return rows.flatMap(row => { const spec = researchJson(row.specJson); return list(spec.symbols).includes(input.symbol) ? [{ id: `scenario:${row.id}`, title: researchText(row.name, 180), href: `/workspace/connected?symbol=${encodeURIComponent(input.symbol)}`, symbol: input.symbol, observedAt: researchDate(row.lastCheckedAt, now), classification: "registered-scenario" as const,
        summary: `${row.status} scenario; ${row.acceptedSessions} accepted tracking sessions, most recent ${row.lastSession ?? "unavailable"}.`, data: { sourceRunId: row.sourceRunId, status: row.status, acceptedSessions: row.acceptedSessions, lastSession: row.lastSession, rules: strategyProjection(spec) } }] : []; }).slice(0, 12);
    }),
    capture("watchlists", "Saved watchlists", "owner", "Owner's saved thesis and risk notes for this symbol. User notes are context, never independently verified evidence.", async () => {
      const rows = await db.namedWatchlistItem.findMany({ where: { userId: scope.userId, watchlist: { userId: scope.userId }, symbol: input.symbol }, take: 12, orderBy: { updatedAt: "desc" },
        select: { id: true, symbol: true, assetName: true, status: true, priority: true, thesis: true, riskNotes: true, sourceUrl: true, updatedAt: true } });
      return rows.map(row => ({ id: `watch:${row.id}`, title: researchText(row.assetName, 180), href: `/workspace/watchlists?symbol=${encodeURIComponent(row.symbol)}`, symbol: row.symbol, observedAt: researchDate(row.updatedAt, now), classification: "user-context" as const,
        summary: researchText(row.thesis, 1200) || "Saved owner watchlist item.", data: { status: row.status, priority: row.priority, riskNotes: researchText(row.riskNotes, 1000), sourceUrl: publicResearchUrl(row.sourceUrl) } }));
    }),
    capture("news", "News triage", "owner", "Recent owner news decisions. Record creation is a triage timestamp; it does not establish the article publication date.", async () => {
      const rows = await db.headlineDecision.findMany({ where: { userId: scope.userId, createdAt: { gte: new Date(now - 7 * 86_400_000) }, matchedTickersJson: { contains: JSON.stringify(input.symbol) } }, take: 20, orderBy: { createdAt: "desc" },
        select: { id: true, title: true, summary: true, sourceName: true, url: true, category: true, matchedTickersJson: true, createdAt: true } });
      return rows.filter(row => { try { return list(JSON.parse(row.matchedTickersJson)).includes(input.symbol); } catch { return false; } }).map(row => ({ id: `news:${row.id}`, title: researchText(row.title, 300), href: publicResearchUrl(row.url) ?? "/news", symbol: input.symbol, observedAt: null, classification: "stored-research" as const,
        summary: researchText(row.summary, 1200), data: { source: researchText(row.sourceName, 120), category: row.category, sourceUrl: publicResearchUrl(row.url), triagedAt: researchDate(row.createdAt, now), publishedAt: null } }));
    }),
    capture("briefs", "Market and trade briefs", "owner-and-workspace", "Owner market-only briefs and founder paper-trade reports. Client and portfolio briefing fields are not selected.", async () => {
      const [market, trades] = await Promise.all([
        db.briefingReport.findMany({ where: { userId: scope.userId, clientId: null }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, title: true, marketSummary: true, createdAt: true } }),
        (dependencies.briefs ?? readAgentBriefs)(scope, { limit: 12 }),
      ]);
      return [...market.map(row => ({ id: `market-brief:${row.id}`, title: researchText(row.title, 180), href: "/workspace/brief", symbol: null, observedAt: researchDate(row.createdAt, now), classification: "stored-research" as const, summary: researchText(row.marketSummary, 2400), data: { scope: "market-section-only", predictionVerified: false } })),
        ...trades.filter(row => row.symbol === input.symbol).slice(0, 6).map(row => ({ id: `trade-brief:${row.id}`, title: row.title, href: "/workspace/intelligence/agent-desk", symbol: row.symbol, observedAt: row.createdAt, classification: "agent-discussion" as const, summary: researchText(row.summary, 1600), data: { classification: row.classification, cycleId: row.cycleId, realized: row.realized, netPnl: row.netPnl, netReturnPct: row.netReturnPct } }))];
    }),
    capture("team-board", "Agent Team Board", "owner-and-workspace", "Recent founder-owned discussion for this symbol; messages remain attributed and are not instructions to bypass trading controls.", async () => {
      const messages = await (dependencies.board ?? readAgentBoard)(scope, { limit: 50 });
      return messages.filter(row => row.symbol === input.symbol).slice(-16).map(row => ({ id: `discussion:${row.id}`, title: `${row.from} → ${row.to}`, href: "/workspace/intelligence/agent-desk", symbol: row.symbol, observedAt: row.createdAt, classification: "agent-discussion" as const,
        summary: researchText(row.body, 1800), data: { from: row.from, to: row.to, phase: row.phase, cycleId: row.cycleId, evidenceIds: row.evidenceIds.slice(0, 40), replyToIds: row.replyToIds.slice(0, 24) } }));
    }),
  ]);
  input.signal.throwIfAborted(); await authorize(scope);
  const records = results.flatMap(result => result.records).slice(0, 100);
  const capabilities: AgentResearchCapability[] = results.map(result => ({ ...result.capability, recordCount: records.filter(row => row.capability === result.capability.id).length }));
  capabilities.push({ id: "custom-board-layout", label: "Custom Board browser layout", status: "restricted", recordCount: 0, scope: "local-browser-only", detail: "Unsynced browser layout preferences are local to the user's browser. The agent market tool supplies actual Custom Board technical metrics separately; it cannot read local-only browser drafts." });
  return { capabilities, records, issues: results.flatMap(result => result.issues), sources: uniqueResearchSources(sources, 40) };
}
