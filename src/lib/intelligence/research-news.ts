import type { AlphaNewsItem, AlphaNewsSnapshot } from "./alpha-vantage-types";
import type { ResearchWeights } from "./research-swarm-types";
import { normalizeResearchWeights } from "./research-config";
import { safeResearchSourceUrl } from "./research-evidence";

const SECTOR_TOPICS: Array<[RegExp, string]> = [
  [/technology|communication|software|semiconductor/i, "technology"],
  [/health|life.science|pharma|biotech/i, "life_sciences"],
  [/finance|financial|bank|insurance/i, "finance"],
  [/real.estate|construction/i, "real_estate"],
  [/energy|transport|utilities/i, "energy_transportation"],
  [/retail|consumer|wholesale/i, "retail_wholesale"],
  [/industrial|materials|manufactur/i, "manufacturing"],
];

/** Distinct ticker-qualified searches share cached provider responses across all agents. */
export function researchNewsTopics(sector: string, weightsInput: ResearchWeights, limit = 3) {
  const weights = normalizeResearchWeights(weightsInput);
  const sectorTopic = SECTOR_TOPICS.find(([pattern]) => pattern.test(sector))?.[1] ?? "financial_markets";
  const candidates = [
    { topic: "earnings", priority: weights.media },
    { topic: sectorTopic, priority: weights.media * 0.9 },
    { topic: "financial_markets", priority: weights.technical },
    { topic: "economy_macro", priority: weights.economy },
    { topic: "economy_monetary", priority: weights.economy * 0.8 },
    { topic: "mergers_and_acquisitions", priority: weights.media * 0.6 },
  ].filter(item => item.priority > 0).sort((a, b) => b.priority - a.priority);
  return [...new Set(candidates.map(item => item.topic))].slice(0, Math.max(0, Math.min(6, Math.floor(limit))));
}

function number(value: unknown) {
  if (typeof value === "string" && !value.trim()) return null;
  const result = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(result) ? result : null;
}

function string(value: unknown, maximum = 2000) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }

function publicationTime(value: unknown) {
  const raw = string(value, 40);
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(raw);
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6] || "00"}Z`;
  const parsed = new Date(iso);
  // Reject rolled-over dates as well as invalid provider timestamps.
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(iso.slice(0, 19)) ? parsed.toISOString() : null;
}

export type ResearchNewsIdentity = { kind: "equity" | "index"; name: string; newsAliases: string[] };

function indexContextRelevance(title: string, summary: string, identity: ResearchNewsIdentity) {
  const normalize = (value: string) => value.replace(/&amp;/gi, "&").replace(/([a-z])([0-9])/gi, "$1 $2").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const names = [identity.name, ...identity.newsAliases].map(normalize).filter(name => name.length >= 4 && !/^index [a-z0-9]+$/.test(name));
  const match = (text: string) => names.some(name => ` ${normalize(text)} `.includes(` ${name} `));
  return match(title) ? .6 : match(summary) ? .35 : 0;
}

/** Never borrow the first company's sentiment when the requested ticker is absent. */
export function parseResearchNews(payload: Record<string, unknown>, symbol: string, maximum = 250, identity?: ResearchNewsIdentity): AlphaNewsSnapshot | null {
  const feed = Array.isArray(payload.feed) ? payload.feed : [];
  const items: AlphaNewsItem[] = [];
  for (const raw of feed.slice(0, Math.max(1, Math.min(1000, maximum)))) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const item = raw as Record<string, unknown>;
    const tickerRows = Array.isArray(item.ticker_sentiment) ? item.ticker_sentiment : [];
    const matching = tickerRows.find(row => row && typeof row === "object" && string(row.ticker).toUpperCase() === symbol) as Record<string, unknown> | undefined;
    const url = safeResearchSourceUrl(item.url), title = string(item.title, 1000), publishedAt = publicationTime(item.time_published);
    const summary = string(item.summary, 4000), indexContext = identity?.kind === "index" && symbol.startsWith("INDEX:");
    const sentiment = indexContext ? number(item.overall_sentiment_score) : number(matching?.ticker_sentiment_score);
    const relevance = indexContext ? indexContextRelevance(title, summary, identity) : number(matching?.relevance_score);
    if ((!indexContext && !matching) || sentiment === null || relevance === null || relevance <= 0 || !url || !title || !publishedAt) continue;
    items.push({
      id: `${symbol}:${url}:${publishedAt}`, title, summary, url,
      source: string(item.source, 200), sourceDomain: new URL(url).hostname,
      publishedAt, tickerSentimentScore: Math.max(-1, Math.min(1, sentiment)), tickerRelevance: Math.max(0, Math.min(1, relevance)),
      tickerSentimentLabel: indexContext ? `Index context: ${string(item.overall_sentiment_label, 80) || "provider article sentiment"}` : string(matching?.ticker_sentiment_label, 100),
      ...(indexContext ? { sentimentBasis: "provider-overall-index-context" as const } : {}),
      overallSentimentScore: number(item.overall_sentiment_score) ?? 0,
      overallSentimentLabel: string(item.overall_sentiment_label, 100),
      topics: (Array.isArray(item.topics) ? item.topics : []).flatMap(topic => topic && typeof topic === "object" && typeof topic.topic === "string" ? [topic.topic.slice(0,200)] : []),
    });
  }
  return newsSnapshot(items);
}

export function newsSnapshot(items: AlphaNewsItem[]): AlphaNewsSnapshot | null {
  if (!items.length) return null;
  const sorted = [...items].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const relevanceTotal = sorted.reduce((sum, item) => sum + item.tickerRelevance, 0);
  const averageSentiment = sorted.reduce((sum, item) => sum + item.tickerSentimentScore, 0) / sorted.length;
  return { items: sorted, articleCount: sorted.length, latestPublishedAt: sorted[0].publishedAt, latestTitle: sorted[0].title,
    averageSentiment, averageRelevance: relevanceTotal / sorted.length,
    relevanceWeightedSentiment: relevanceTotal ? sorted.reduce((sum, item) => sum + item.tickerSentimentScore * item.tickerRelevance, 0) / relevanceTotal : averageSentiment };
}

/** Round-robin publishers before truncation so one prolific site cannot fill the evidence budget. */
export function diversifyResearchNews(items: AlphaNewsItem[], maximum = 500, now = Date.now(), maxAgeHours = 168) {
  const seen = new Set<string>(), publishers = new Map<string, AlphaNewsItem[]>();
  for (const item of items) {
    const age = now - Date.parse(item.publishedAt ?? "");
    if (!Number.isFinite(age) || age < -300000 || age > maxAgeHours * 3600000) continue;
    const url = safeResearchSourceUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const bucket = publishers.get(host) ?? [];
    bucket.push({ ...item, url, sourceDomain: host });
    publishers.set(host, bucket);
  }
  for (const bucket of publishers.values()) bucket.sort((a,b) => b.tickerRelevance - a.tickerRelevance || String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const result: AlphaNewsItem[] = [];
  const groups = [...publishers.values()];
  for (let index = 0; result.length < maximum; index += 1) {
    let added = false;
    for (const group of groups) {
      if (group[index] && result.length < maximum) { result.push(group[index]); added = true; }
    }
    if (!added) break;
  }
  return result;
}
