import type { WorkspaceBriefHighlight } from "./home-contract";
import { safeResearchSourceUrl } from "@/lib/intelligence/research-evidence";

type RecordValue = Record<string, unknown>;
function object(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}
function text(value: unknown, limit = 1000) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
function numeric(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function score(value: unknown) { const n = numeric(value); return n !== null && n >= 0 && n <= 100 ? n : null; }
function timestamp(value: unknown) {
  const raw = value instanceof Date ? Number.isFinite(value.getTime()) ? value.toISOString() : "" : text(value, 64);
  return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : null;
}
function strings(value: unknown, limit = 4) {
  return Array.isArray(value) ? value.flatMap(item => text(item) ? [text(item)] : []).slice(0, limit) : [];
}

/** The saved ranking order is authoritative. An absent/corrupt brief never becomes a synthetic stock pick. */
export function selectWorkspaceBriefHighlight(record: { id: string; metricsJson: string; createdAt: Date | string } | null): WorkspaceBriefHighlight | null {
  if (!record) return null;
  let stored: RecordValue;
  try { stored = object(JSON.parse(record.metricsJson)); } catch { return null; }
  const brief = object(stored.brief);
  if (stored.kind !== "ADVISOR_MARKET_BRIEF_V1" || brief.schemaVersion !== "slice-advisor-market-brief-1.0.0" || !Array.isArray(brief.overallRankedSecurities)) return null;
  const security = brief.overallRankedSecurities.map(object).find(item => /^[A-Z][A-Z0-9.:-]{0,23}$/.test(text(item.symbol, 80).toUpperCase()));
  const createdAt = timestamp(record.createdAt);
  if (!security || !createdAt) return null;
  const quote = object(security.quote);
  const symbol = text(security.symbol, 24).toUpperCase();
  const price = numeric(quote.price);
  const rank = numeric(security.overallRank);
  const sourceIds = new Set(strings(security.sourceIds, 200));
  const sourceUrls = new Set<string>();
  const sources: WorkspaceBriefHighlight["sources"] = [];
  for (const raw of Array.isArray(brief.sources) ? brief.sources : []) {
    const source = object(raw), id = text(source.id, 200), url = safeResearchSourceUrl(source.url);
    if (!sourceIds.has(id) || !url || sourceUrls.has(url)) continue;
    sourceUrls.add(url);
    sources.push({ id, label: text(source.label, 200), publisher: text(source.publisher, 120) || text(source.provider, 120), url, asOf: timestamp(source.asOf) });
  }
  const quoteMatches = text(quote.symbol, 80).toUpperCase() === symbol;
  return {
    recordId: record.id, briefId: text(brief.briefId, 160), title: text(brief.title, 240) || "Saved advisor market brief",
    createdAt, generatedAt: timestamp(brief.generatedAt), marketAsOf: timestamp(brief.marketAsOf),
    providerMode: text(brief.providerMode, 40) || "Unknown", symbol,
    companyName: text(security.name, 240) || symbol, industryName: text(security.industryName, 200) || "Industry not recorded",
    rank: rank !== null && rank > 0 && Number.isInteger(rank) ? rank : null,
    score: score(security.score), confidence: score(security.confidence), dataQuality: score(brief.dataQuality),
    price: quoteMatches && price !== null && price > 0 ? price : null,
    changePercent: quoteMatches ? numeric(quote.changePercent) : null, quoteAsOf: quoteMatches ? timestamp(quote.timestamp) : null,
    explanation: text(security.explanation, 1800), positiveDrivers: strings(security.positiveDrivers), riskFlags: strings(security.riskFlags), warnings: strings(brief.warnings), sources: sources.slice(0, 24),
  };
}
