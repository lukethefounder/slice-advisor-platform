import type { ResearchWeights } from "./research-swarm-types";
import { normalizeResearchWeights } from "./research-config";
import { safeResearchSourceUrl } from "./research-evidence";

/** Public discovery records are deliberately unscored. A headline is not a
 * provider sentiment observation, a verified company filing, or a prediction. */
export type PublicResearchArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  publisher: string;
  publisherUrl: string | null;
  publisherDomain: string;
  publisherAttribution: "article-host" | "feed-reported" | "unknown";
  linkKind: "publisher" | "aggregator";
  publishedAt: string;
  retrievedAt: string;
  feedUrl: string;
  discoveryProvider: "Google News RSS";
  matchedBy: "company-name" | "query-name" | "alias" | "ticker";
  sentiment: null;
  duplicateCount: number;
  relatedSources: Array<{ url: string; publisher: string; publisherDomain: string; publishedAt: string }>;
};

export type PublicNewsQueryDiagnostic = {
  query: string;
  url: string;
  status: "ok" | "empty" | "rate-limited" | "unavailable" | "invalid-response";
  cacheState: "fresh-fetch" | "cache" | "cooldown";
  retrievedAt: string | null;
  parsedCount: number;
  acceptedCount: number;
  rejected: { stale: number; future: number; undated: number; unrelated: number; unsafeUrl: number; duplicate: number };
};

export type PublicResearchNewsResult = {
  articles: PublicResearchArticle[];
  diagnostics: {
    status: "complete" | "partial" | "empty" | "unavailable" | "not-needed" | "disabled";
    windowStart: string;
    windowEnd: string;
    requestedQueries: number;
    completedQueries: number;
    uniqueArticles: number;
    publisherCount: number;
    queries: PublicNewsQueryDiagnostic[];
    warnings: string[];
  };
};

type ExistingArticle = { url: string; title: string; publishedAt: string | null; sourceDomain?: string };
export type PublicResearchNewsInput = {
  symbol: string;
  companyName?: string | null;
  queryName?: string | null;
  aliases?: string[];
  assetType?: "stock" | "index" | "fund" | "unknown";
  sector?: string | null;
  weights: ResearchWeights;
  existing?: ExistingArticle[];
  signal?: AbortSignal;
  maxQueries?: number;
  maxAgeHours?: number;
  forceRefresh?: boolean;
};

type FeedRecord = { title: string; summary: string; url: string; publisher: string; publisherUrl: string; publishedAt: string | null };
type FeedResponse = { status: PublicNewsQueryDiagnostic["status"]; retrievedAt: string | null; records: FeedRecord[] };
const FEED_ORIGIN = "https://news.google.com";
const MAX_BYTES = 1_048_576;
const MAX_FEED_ITEMS = 150;
const MAX_ARTICLES = 120;
const TRANSPORT_TIMEOUT_MS = 10_000;
const CACHE_MS = 60_000;
const FAILURE_COOLDOWN_MS = 30_000;
const MAX_CACHE_ENTRIES = 128;
const HOUR = 3_600_000;

function clean(value: unknown, maximum = 300) { return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum) : ""; }
function words(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/([a-z])([0-9])/gi, "$1 $2").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function nameWithoutSuffix(value: string) {
  return clean(value).replace(/\s*\b(?:incorporated|corporation|limited|holdings|holding|company|inc|corp|ltd|plc|llc|ag|nv|sa)\.?\s*$/i, "").replace(/\s*\b(?:incorporated|corporation|limited|holdings|holding|company|inc|corp|ltd|plc|llc|ag|nv|sa)\.?\s*$/i, "").replace(/[,.]+$/, "").trim();
}
function validSymbol(value: unknown) {
  const symbol = clean(value, 24).toUpperCase();
  return /^\^?[A-Z0-9][A-Z0-9.^:$-]{0,23}$/.test(symbol) ? symbol : "";
}
function isIndex(input: PublicResearchNewsInput) { return input.assetType === "index" || /^(?:INDEX:|\^)/i.test(input.symbol); }
function usableName(value: string, index: boolean) { return words(value).length >= 3 && (!index || !/^index [a-z0-9 ]+$/.test(words(value))); }
function maxAge(value: number | undefined) { return Number.isFinite(value) ? Math.max(1, Math.min(168, value!)) : 168; }
function queryBudget(value: number | undefined) { return Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value!))) : 3; }
function quoted(value: string) { return `"${clean(value, 160).replace(/["\\]/g, " ")}"`; }
function canonicalTitle(value: string) { return words(value); }
function datedTitle(value: string, publishedAt: string | null) { return `${canonicalTitle(value)}:${publishedAt?.slice(0, 10) ?? ""}`; }
function publicLink(value: unknown) {
  const link = safeResearchSourceUrl(value);
  if (!link) return "";
  const url = new URL(link), host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".localhost") || host.endsWith(".local") || /^\d+(?:\.\d+){3}$/.test(host) || host.startsWith("[")) return "";
  return link;
}
function domain(value: string) { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
function freshDate(value: string | null, now: number, ageHours: number) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) && parsed <= now + 300_000 && parsed >= now - ageHours * HOUR;
}

/** Query names come from the resolved security identity; no ticker or ETF
 * substitution is performed here. Short/ambiguous tickers need explicit tags. */
export function publicResearchNewsQueries(input: PublicResearchNewsInput) {
  const symbol = validSymbol(input.symbol);
  if (!symbol) return [];
  const index = isIndex(input);
  const companyName = index ? "" : nameWithoutSuffix(input.companyName ?? "");
  const identityName = clean(input.queryName || companyName, 160);
  const aliases = (input.aliases ?? []).map(name => clean(name, 120)).filter(name => usableName(name, index)).slice(0, 3);
  const identity = [...new Set([identityName, ...aliases].filter(name => usableName(name, index) && (!index || words(name) !== words(symbol))))];
  if (index && !identity.length) return [];
  const tickerTerm = `$${symbol.replace(/^\^/, "")}`;
  const base = index ? `(${identity.map(quoted).join(" OR ")})` : identity.length ? `(${identity.map(quoted).join(" OR ")} OR ${quoted(tickerTerm)})` : `(${quoted(tickerTerm)} OR ${quoted(`NYSE:${symbol}`)} OR ${quoted(`NASDAQ:${symbol}`)})`;
  const finance = index ? "(index OR markets OR stocks OR futures)" : "(stock OR shares OR earnings OR company OR investors)";
  const weights = normalizeResearchWeights(input.weights);
  const topics = [
    { query: "(earnings OR guidance OR revenue OR product OR acquisition)", priority: weights.media },
    { query: "(rates OR inflation OR economy OR demand OR regulation)", priority: weights.economy },
    { query: "(price OR volume OR volatility OR trading)", priority: weights.technical },
  ].sort((a, b) => b.priority - a.priority);
  const age = `when:${Math.ceil(maxAge(input.maxAgeHours) / 24)}d`;
  const candidates = [`${base} ${finance} ${age}`, ...topics.slice(0, 2).map(topic => `${base} ${topic.query} ${age}`)];
  const sector = clean(input.sector, 120);
  if (!index && sector) candidates[2] = `${base} (${quoted(sector)} OR ${topics[1].query.slice(1, -1)}) ${age}`;
  return [...new Set(candidates)].slice(0, queryBudget(input.maxQueries)).map(query => {
    const url = new URL("/rss/search", FEED_ORIGIN);
    url.searchParams.set("q", query); url.searchParams.set("hl", "en-US"); url.searchParams.set("gl", "US"); url.searchParams.set("ceid", "US:en");
    return { query, url: url.toString() };
  });
}

function decode(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&#(?:x([a-f0-9]+)|(\d+));/gi, (_, hex, decimal) => {
    const code = Number.parseInt(hex || decimal, hex ? 16 : 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
  }).replace(/&(amp|quot|apos|lt|gt|nbsp);/gi, (_, key) => ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " })[String(key).toLowerCase()]!);
}
function plain(value: string, maximum: number) { return clean(decode(value).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " "), maximum); }
function tag(block: string, names: string[]) {
  for (const name of names) {
    const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, "i").exec(block);
    if (match) return match[1];
  }
  return "";
}
function attribute(markup: string, name: string) { return decode(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(markup)?.[2] ?? ""); }

/** A feed's updated time is not substituted for its publication time. */
export function publicNewsPublicationTime(value: string): string | null {
  const raw = plain(value, 100);
  const iso = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.exec(raw);
  const rfc = /^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+\d{2}:\d{2}(?::\d{2})?\s+(?:GMT|UTC|UT|[+-]\d{4})$/i.exec(raw);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const year = iso ? Number(iso[1]) : rfc ? Number(rfc[3]) : NaN;
  const month = iso ? Number(iso[2]) : rfc ? months.indexOf(rfc[2].toLowerCase()) + 1 : NaN;
  const day = iso ? Number(iso[3]) : rfc ? Number(rfc[1]) : NaN;
  if (!Number.isInteger(year) || year < 1970 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Bounded RSS/Atom metadata parsing, without external entities or page scraping. */
export function parsePublicResearchFeed(xml: string): FeedRecord[] {
  if (Buffer.byteLength(xml, "utf8") > MAX_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml) || !/<(?:rss|feed)(?:\s|>)/i.test(xml)) throw new Error("The source did not return an acceptable RSS or Atom feed.");
  const records: FeedRecord[] = [];
  const pattern = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/gi;
  for (const match of xml.matchAll(pattern)) {
    if (records.length >= MAX_FEED_ITEMS) break;
    const block = match[2], sourceMarkup = /<source\b[^>]*>/i.exec(block)?.[0] ?? "";
    const source = plain(tag(block, ["source"]), 200), title = plain(tag(block, ["title"]), 1000);
    const alternateLinks = [...block.matchAll(/<link\b[^>]*>/gi)].map(item => item[0]);
    const alternate = alternateLinks.find(item => attribute(item, "rel") === "alternate") ?? alternateLinks.find(item => !attribute(item, "rel"));
    const url = plain(tag(block, ["link"]), 2500) || (alternate ? attribute(alternate, "href") : "");
    const suffix = source ? ` - ${source}` : "";
    records.push({ title: suffix && title.toLowerCase().endsWith(suffix.toLowerCase()) ? title.slice(0, -suffix.length).trim() : title,
      summary: plain(tag(block, ["description", "summary", "content"]), 1500), url,
      publisher: source, publisherUrl: attribute(sourceMarkup, "url"), publishedAt: publicNewsPublicationTime(tag(block, ["pubDate", "published", "dc:date"])) });
  }
  return records;
}

export function publicNewsIdentityMatch(record: Pick<FeedRecord, "title" | "summary">, input: PublicResearchNewsInput): PublicResearchArticle["matchedBy"] | null {
  const text = `${record.title} ${record.summary}`, normalized = ` ${words(text)} `;
  const index = isIndex(input);
  const finance = /\b(stock|stocks|shares|earnings|revenue|profit|dividend|buyback|guidance|analysts?|investors?|valuation|quarter|quarterly|ceo|business|company|corporate|acquisition|merger|product|launch|chip|market|markets|index|indices|futures|trading)\b/i.test(text);
  const names: Array<[string, PublicResearchArticle["matchedBy"]]> = [[clean(input.queryName), "query-name"], [index ? "" : nameWithoutSuffix(input.companyName ?? ""), "company-name"], ...(input.aliases ?? []).slice(0, 6).map(name => [clean(name), "alias"] as [string, "alias"])];
  for (const [name, matchedBy] of names) {
    const normalizedName = words(name);
    if (!usableName(name, index) || normalizedName === words(input.symbol)) continue;
    if (normalized.includes(` ${normalizedName} `) && (normalizedName.includes(" ") || finance)) return matchedBy;
  }
  if (index) return null;
  const symbol = validSymbol(input.symbol).replace(/^\^/, "");
  if (!symbol) return null;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?:\\$|(?:NASDAQ|NYSE|AMEX|OTC|TSX|LSE)\\s*:\\s*)${escaped}(?![A-Za-z0-9.-])`, "i").test(text)) return "ticker";
  const ambiguous = new Set(["ALL", "ARE", "CAN", "CEO", "FOR", "MAN", "NEW", "NOW", "ONE", "OUT", "SEE", "THE", "TOP"]);
  if (symbol.length >= 3 && !ambiguous.has(symbol) && finance && new RegExp(`(?:^|[^A-Za-z0-9])${escaped}(?![A-Za-z0-9.-])`).test(text)) return "ticker";
  return null;
}

function abortIfRequested(signal?: AbortSignal) { if (signal?.aborted) throw signal.reason ?? new DOMException("Research collection was cancelled.", "AbortError"); }
async function boundedFeedText(response: Response, signal: AbortSignal) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("Feed exceeds its response size limit.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Feed body is unavailable.");
  const parts: Uint8Array[] = []; let size = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    for (;;) {
      abortIfRequested(signal);
      const result = await reader.read();
      abortIfRequested(signal);
      if (result.done) break;
      size += result.value.byteLength;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Feed exceeds its response size limit."); }
      parts.push(result.value);
    }
  } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
  return Buffer.concat(parts).toString("utf8");
}

/** Separate factory keeps tests and deployments' public response caches isolated. */
export function createPublicResearchNewsCollector(dependencies: { fetch?: typeof fetch; now?: () => number } = {}) {
  const request = dependencies.fetch ?? fetch, clock = dependencies.now ?? Date.now;
  const cache = new Map<string, { until: number; result: FeedResponse }>();
  async function readFeed(url: string, callerSignal?: AbortSignal, forceRefresh = false): Promise<FeedResponse & { cacheState: PublicNewsQueryDiagnostic["cacheState"] }> {
    abortIfRequested(callerSignal);
    const cached = cache.get(url);
    const cachedSuccess = cached && (cached.result.status === "ok" || cached.result.status === "empty");
    if (cached && cached.until > clock() && (!forceRefresh || !cachedSuccess)) return { ...cached.result, cacheState: cachedSuccess ? "cache" : "cooldown" };
    const controller = new AbortController();
    const cancel = () => controller.abort(callerSignal?.reason ?? new DOMException("Research collection was cancelled.", "AbortError"));
    callerSignal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new DOMException("The feed transport did not complete.", "TimeoutError")), TRANSPORT_TIMEOUT_MS);
    let result: FeedResponse;
    try {
      const response = await request(url, { method: "GET", redirect: "error", cache: "no-store", signal: controller.signal, headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "User-Agent": "SliceResearch/1.0" } });
      if (controller.signal.aborted) await response.body?.cancel().catch(() => undefined);
      abortIfRequested(controller.signal);
      if (!response.ok) { await response.body?.cancel(); result = { status: response.status === 429 ? "rate-limited" : "unavailable", retrievedAt: null, records: [] }; }
      else {
        const raw = await boundedFeedText(response, controller.signal);
        let records: FeedRecord[];
        try { records = parsePublicResearchFeed(raw); }
        catch { result = { status: "invalid-response", retrievedAt: null, records: [] }; records = []; }
        result ??= { status: records.length ? "ok" : "empty", retrievedAt: new Date(clock()).toISOString(), records };
      }
    } catch {
      abortIfRequested(callerSignal);
      result = { status: "unavailable", retrievedAt: null, records: [] };
    } finally { clearTimeout(timer); callerSignal?.removeEventListener("abort", cancel); controller.abort(); }
    abortIfRequested(callerSignal);
    while (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(url, { until: clock() + (["ok", "empty"].includes(result.status) ? CACHE_MS : FAILURE_COOLDOWN_MS), result });
    return { ...result, cacheState: "fresh-fetch" };
  }

  return async function collect(input: PublicResearchNewsInput): Promise<PublicResearchNewsResult> {
    abortIfRequested(input.signal);
    const now = clock(), ageHours = maxAge(input.maxAgeHours), plans = publicResearchNewsQueries(input);
    const windowStart = new Date(now - ageHours * HOUR).toISOString(), windowEnd = new Date(now).toISOString();
    const queries: PublicNewsQueryDiagnostic[] = [], articles: PublicResearchArticle[] = [], seenUrls = new Map<string, PublicResearchArticle | null>(), seenTitles = new Map<string, PublicResearchArticle | null>(), publishers = new Set<string>();
    let existingCount = 0;
    for (const item of (input.existing ?? []).slice(0, 500)) {
      const url = publicLink(item.url), title = canonicalTitle(item.title);
      if (!url || !title || !freshDate(item.publishedAt, now, ageHours) || seenUrls.has(url)) continue;
      const titleKey = datedTitle(item.title, item.publishedAt);
      if (seenTitles.has(titleKey)) continue;
      seenUrls.set(url, null); seenTitles.set(titleKey, null); publishers.add(domain(url)); existingCount++;
    }
    const enough = () => existingCount + articles.length >= 8 && publishers.size >= 3;
    const initiallyCovered = enough();
    if (!initiallyCovered) for (const plan of plans) {
      abortIfRequested(input.signal);
      const feed = await readFeed(plan.url, input.signal, input.forceRefresh);
      const diagnostic: PublicNewsQueryDiagnostic = { ...plan, status: feed.status, cacheState: feed.cacheState, retrievedAt: feed.retrievedAt, parsedCount: feed.records.length, acceptedCount: 0, rejected: { stale: 0, future: 0, undated: 0, unrelated: 0, unsafeUrl: 0, duplicate: 0 } };
      for (const record of feed.records) {
        const time = Date.parse(record.publishedAt ?? "");
        if (!record.publishedAt || !Number.isFinite(time)) { diagnostic.rejected.undated++; continue; }
        if (time < now - ageHours * HOUR) { diagnostic.rejected.stale++; continue; }
        if (time > now + 300_000) { diagnostic.rejected.future++; continue; }
        const url = publicLink(record.url);
        if (!url || !record.title) { diagnostic.rejected.unsafeUrl++; continue; }
        const matchedBy = publicNewsIdentityMatch(record, input);
        if (!matchedBy) { diagnostic.rejected.unrelated++; continue; }
        const urlDomain = domain(url), aggregator = urlDomain === "news.google.com";
        if (aggregator && !/^\/(?:rss\/)?(?:articles|read)\//.test(new URL(url).pathname)) { diagnostic.rejected.unsafeUrl++; continue; }
        const publisherUrl = publicLink(record.publisherUrl), publisherDomain = aggregator ? publisherUrl ? domain(publisherUrl) : "" : urlDomain;
        const titleKey = datedTitle(record.title, record.publishedAt), duplicate = seenUrls.has(url) || seenTitles.has(titleKey);
        if (duplicate) {
          diagnostic.rejected.duplicate++;
          const kept = seenUrls.get(url) ?? seenTitles.get(titleKey);
          if (kept) { kept.duplicateCount++; if (url !== kept.url && kept.relatedSources.length < 10 && !kept.relatedSources.some(item => item.url === url)) kept.relatedSources.push({ url, publisher: record.publisher || publisherDomain || "Unattributed publisher", publisherDomain, publishedAt: record.publishedAt }); }
          seenUrls.set(url, kept ?? null); seenTitles.set(titleKey, kept ?? null);
          continue;
        }
        if (articles.length >= MAX_ARTICLES) break;
        const item: PublicResearchArticle = { id: `public-news:${validSymbol(input.symbol)}:${url}`, title: record.title, summary: record.summary, url,
          publisher: record.publisher || publisherDomain || "Unattributed publisher", publisherUrl: publisherUrl || null, publisherDomain,
          publisherAttribution: aggregator ? publisherDomain ? "feed-reported" : "unknown" : "article-host", linkKind: aggregator ? "aggregator" : "publisher",
          publishedAt: record.publishedAt, retrievedAt: feed.retrievedAt!, feedUrl: plan.url, discoveryProvider: "Google News RSS", matchedBy, sentiment: null, duplicateCount: 0, relatedSources: [] };
        articles.push(item); seenUrls.set(url, item); seenTitles.set(titleKey, item); if (publisherDomain) publishers.add(publisherDomain); diagnostic.acceptedCount++;
      }
      queries.push(diagnostic);
      if (enough() || articles.length >= MAX_ARTICLES) break;
    }
    abortIfRequested(input.signal);
    const completedQueries = queries.filter(item => ["ok", "empty"].includes(item.status)).length;
    const status = !plans.length ? "disabled" : initiallyCovered ? "not-needed" : articles.length ? completedQueries === queries.length && enough() ? "complete" : "partial" : completedQueries ? "empty" : "unavailable";
    const warnings = [];
    if (!plans.length && queryBudget(input.maxQueries) > 0) warnings.push("Public discovery was skipped because a precise, valid security identity was not available.");
    if (queries.some(item => !["ok", "empty"].includes(item.status))) warnings.push("Some public news discovery requests were unavailable or limited; those requests contributed no evidence.");
    if (queries.some(item => item.rejected.undated || item.rejected.future || item.rejected.stale)) warnings.push("Public items without a valid publication time inside the selected seven-day-or-shorter window were excluded.");
    if (articles.length) warnings.push("Public feed headlines are unscored context. Feed-reported publisher names and aggregator links do not imply article-body verification or provider sentiment.");
    if (status === "empty") warnings.push("The public feeds returned no additional distinct, dated items matching this security in the selected window.");
    return { articles, diagnostics: { status, windowStart, windowEnd, requestedQueries: queries.length, completedQueries, uniqueArticles: articles.length, publisherCount: new Set(articles.map(item => item.publisherDomain).filter(Boolean)).size, queries, warnings } };
  };
}

export const collectPublicResearchNews = createPublicResearchNewsCollector();
