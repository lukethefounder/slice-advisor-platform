import { prisma } from "@/lib/prisma";
import { decryptSecret, safeJsonParse } from "@/lib/secret-crypto";

export type SourceTier =
  | "official-regulatory"
  | "official-exchange"
  | "public-news"
  | "advisor-paid"
  | "advisor-authorized"
  | "demo";

export type SourceKind = "RSS" | "JSON_API" | "HEADLINE_API";

export type FreeSource = {
  id: string;
  name: string;
  url: string;
  tier: SourceTier;
  category:
    | "sec"
    | "filings"
    | "exchange"
    | "halts"
    | "market-news"
    | "regulatory"
    | "advisor-research"
    | "macro"
    | "portfolio";
  baseTrust: number;
  minPollSeconds: number;
  kind?: SourceKind;
  maxItemsPerRun?: number;
};

export type AdvisorSourceForScan = {
  id: string;
  name: string;
  sourceUrl: string;
  sourceKind: SourceKind;
  platformType: string;
  enabled: boolean;
  headers: Record<string, string>;
  minScoreToRetain: number;
  minScoreToAlert: number;
  maxItemsPerRun: number;
};

export type WatchAsset = {
  ticker: string;
  companyNames: string[];
  sectors: string[];
};

export type SliceUserProfile = {
  id: string;
  name: string;
  watchlist: WatchAsset[];
  interests: string[];
  blockedTerms: string[];
};

export type RawNewsItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  sourceCategory: FreeSource["category"];
  sourceBaseTrust: number;
  minScoreToAlert: number;
  minScoreToRetain: number;
  title: string;
  summary: string;
  link: string;
  publishedAt: string;
};

export type ScoredNewsItem = RawNewsItem & {
  score: number;
  urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
  matchedTickers: string[];
  matchedCompanies: string[];
  matchedThemes: string[];
  reasons: string[];
  shouldAlert: boolean;
  channels: Array<"SMS" | "Email" | "Dashboard" | "Digest">;
  complianceLabel: string;
  alertCopy: string;
};

export type SourceStatus = {
  id: string;
  name: string;
  ok: boolean;
  fetched: number;
  paid: boolean;
  error?: string;
};

export type ScanResult = {
  scannedAt: string;
  profile: SliceUserProfile;
  sources: SourceStatus[];
  items: ScoredNewsItem[];
  alertCandidates: ScoredNewsItem[];
  digestCandidates: ScoredNewsItem[];
  suppressed: ScoredNewsItem[];
};

export const FREE_RSS_SOURCES: FreeSource[] = [
  {
    id: "sec-press-releases",
    name: "SEC Press Releases",
    url: "https://www.sec.gov/news/pressreleases.rss",
    tier: "official-regulatory",
    category: "sec",
    baseTrust: 24,
    minPollSeconds: 300,
    kind: "RSS",
  },
  {
    id: "sec-trading-suspensions",
    name: "SEC Trading Suspensions",
    url: "https://www.sec.gov/enforcement-litigation/trading-suspensions/rss",
    tier: "official-regulatory",
    category: "regulatory",
    baseTrust: 28,
    minPollSeconds: 300,
    kind: "RSS",
  },
  {
    id: "sec-xbrl-filings",
    name: "SEC Structured Disclosure Filings",
    url: "https://www.sec.gov/Archives/edgar/usgaap.rss.xml",
    tier: "official-regulatory",
    category: "filings",
    baseTrust: 26,
    minPollSeconds: 600,
    kind: "RSS",
  },
  {
    id: "nasdaq-trade-halts",
    name: "Nasdaq Trade Halts",
    url: "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts",
    tier: "official-exchange",
    category: "halts",
    baseTrust: 30,
    minPollSeconds: 60,
    kind: "RSS",
  },
  {
    id: "nasdaq-current-news",
    name: "Nasdaq Current News Alerts",
    url: "https://www.nasdaqtrader.com/rss.aspx?categorylist=0&feed=currentheadlines",
    tier: "official-exchange",
    category: "exchange",
    baseTrust: 20,
    minPollSeconds: 300,
    kind: "RSS",
  },
  {
    id: "nasdaq-equity-alerts",
    name: "Nasdaq Equity Alerts",
    url: "https://www.nasdaqtrader.com/rss.aspx?categorylist=2%2C6%2C7&feed=currentheadlines",
    tier: "official-exchange",
    category: "exchange",
    baseTrust: 22,
    minPollSeconds: 300,
    kind: "RSS",
  },
  {
    id: "nasdaq-regulatory-alerts",
    name: "Nasdaq Equity Regulatory Alerts",
    url: "https://www.nasdaqtrader.com/rss.aspx?categorylist=6&feed=currentheadlines",
    tier: "official-exchange",
    category: "regulatory",
    baseTrust: 24,
    minPollSeconds: 300,
    kind: "RSS",
  },
];

export const DEMO_SLICE_PROFILE: SliceUserProfile = {
  id: "demo-slice-user",
  name: "Slice Demo Investor",
  watchlist: [
    {
      ticker: "AAPL",
      companyNames: ["apple", "apple inc"],
      sectors: ["consumer technology", "hardware", "services"],
    },
    {
      ticker: "NVDA",
      companyNames: ["nvidia", "nvidia corporation"],
      sectors: ["ai", "semiconductors", "data centers"],
    },
    {
      ticker: "MSFT",
      companyNames: ["microsoft", "microsoft corporation"],
      sectors: ["cloud", "ai", "software"],
    },
    {
      ticker: "TSLA",
      companyNames: ["tesla", "tesla inc"],
      sectors: ["ev", "automotive", "energy"],
    },
    {
      ticker: "TLT",
      companyNames: ["treasury", "bond", "bonds", "duration"],
      sectors: ["bonds", "rates", "macro"],
    },
  ],
  interests: [
    "ai",
    "semiconductors",
    "interest rates",
    "inflation",
    "earnings",
    "cybersecurity",
    "merger",
    "acquisition",
    "crypto",
    "venture capital",
    "tax",
    "fed",
    "treasury",
  ],
  blockedTerms: [
    "sponsored",
    "advertisement",
    "newsletter promotion",
    "affiliate",
  ],
};

const MATERIALITY_RULES: Array<{
  label: string;
  weight: number;
  terms: string[];
}> = [
  {
    label: "Trading halt or suspension",
    weight: 35,
    terms: ["halt", "trading halt", "suspension", "suspended", "pause"],
  },
  {
    label: "SEC or regulatory action",
    weight: 32,
    terms: [
      "sec charges",
      "charged",
      "settlement",
      "enforcement",
      "investigation",
      "fraud",
      "subpoena",
      "regulatory",
      "delisting",
    ],
  },
  {
    label: "Material filing",
    weight: 30,
    terms: [
      "8-k",
      "form 8-k",
      "10-k",
      "10-q",
      "s-1",
      "13d",
      "13g",
      "form 4",
      "material",
      "restatement",
    ],
  },
  {
    label: "Corporate transaction",
    weight: 28,
    terms: [
      "merger",
      "acquisition",
      "takeover",
      "buyout",
      "spin-off",
      "divestiture",
      "strategic review",
    ],
  },
  {
    label: "Financial surprise",
    weight: 24,
    terms: [
      "guidance",
      "raises guidance",
      "cuts guidance",
      "earnings",
      "revenue",
      "profit warning",
      "misses estimates",
      "beats estimates",
    ],
  },
  {
    label: "Leadership or governance change",
    weight: 20,
    terms: [
      "ceo resigns",
      "cfo resigns",
      "resignation",
      "appointed",
      "board",
      "activist",
    ],
  },
  {
    label: "Balance sheet or capital event",
    weight: 18,
    terms: [
      "bankruptcy",
      "chapter 11",
      "debt",
      "offering",
      "share offering",
      "buyback",
      "dividend",
      "credit facility",
    ],
  },
  {
    label: "Product, AI, or technology catalyst",
    weight: 14,
    terms: [
      "ai",
      "artificial intelligence",
      "chip",
      "semiconductor",
      "cloud",
      "cybersecurity",
      "product launch",
      "partnership",
    ],
  },
  {
    label: "Macro-sensitive event",
    weight: 14,
    terms: [
      "inflation",
      "rates",
      "interest rate",
      "treasury",
      "fed",
      "federal reserve",
      "yield",
      "cpi",
      "jobs report",
    ],
  },
];

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function stripHtml(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function extractTag(block: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
    const match = block.match(pattern);

    if (match?.[1]) return stripHtml(match[1]);
  }

  return "";
}

function simpleHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$ ]/g, " ").replace(/\s+/g, " ");
}

function includesTicker(text: string, ticker: string) {
  const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^A-Z0-9])\\$?${escaped}([^A-Z0-9]|$)`, "i");

  return regex.test(text);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sourceToRawItemDefaults(source: FreeSource) {
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceTier: source.tier,
    sourceCategory: source.category,
    sourceBaseTrust: source.baseTrust,
    minScoreToAlert: 88,
    minScoreToRetain: 55,
  };
}

function parseRss(xml: string, source: FreeSource): RawNewsItem[] {
  const itemBlocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s\S]*?<\/entry>/gi) ??
    [];

  return itemBlocks.slice(0, source.maxItemsPerRun ?? 40).map((block) => {
    const title = extractTag(block, ["title"]);
    const summary = extractTag(block, ["description", "summary", "content"]);
    const link =
      extractTag(block, ["link"]) ||
      block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] ||
      "";
    const publishedAt = extractTag(block, [
      "pubDate",
      "updated",
      "published",
      "dc:date",
    ]);

    return {
      id: simpleHash(`${source.id}:${title}:${link}`),
      ...sourceToRawItemDefaults(source),
      title: title || "Untitled item",
      summary,
      link,
      publishedAt,
    };
  });
}

function extractJsonItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (!payload || typeof payload !== "object") return [];

  const object = payload as Record<string, unknown>;

  for (const key of ["articles", "items", "results", "data", "headlines", "news"]) {
    if (Array.isArray(object[key])) return object[key] as unknown[];
  }

  return [];
}

function jsonText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  return "";
}

function parseJsonFeed(payload: unknown, source: FreeSource): RawNewsItem[] {
  const items = extractJsonItems(payload);

  return items.slice(0, source.maxItemsPerRun ?? 40).map((item) => {
    const object =
      item && typeof item === "object" ? (item as Record<string, unknown>) : {};

    const title =
      jsonText(object.title) ||
      jsonText(object.headline) ||
      jsonText(object.name) ||
      "Untitled item";

    const summary =
      jsonText(object.summary) ||
      jsonText(object.description) ||
      jsonText(object.abstract) ||
      jsonText(object.content);

    const link =
      jsonText(object.url) ||
      jsonText(object.link) ||
      jsonText(object.web_url) ||
      jsonText(object.sourceUrl);

    const publishedAt =
      jsonText(object.publishedAt) ||
      jsonText(object.published_at) ||
      jsonText(object.datetime) ||
      jsonText(object.date) ||
      jsonText(object.created_at);

    return {
      id: simpleHash(`${source.id}:${title}:${link}`),
      ...sourceToRawItemDefaults(source),
      title,
      summary,
      link,
      publishedAt,
    };
  });
}

function scoreRecency(publishedAt: string) {
  const parsed = Date.parse(publishedAt);

  if (Number.isNaN(parsed)) {
    return {
      points: 6,
      reason: "No timestamp found; modest recency credit only.",
    };
  }

  const minutesOld = Math.max(0, (Date.now() - parsed) / 1000 / 60);

  if (minutesOld <= 15) return { points: 22, reason: "Very recent item." };
  if (minutesOld <= 60) return { points: 18, reason: "Recent within the last hour." };
  if (minutesOld <= 360) return { points: 10, reason: "Same-day item." };
  if (minutesOld <= 1440) return { points: 5, reason: "Published within the last day." };

  return { points: 0, reason: "Older item; no recency boost." };
}

export function scoreNewsItem(
  item: RawNewsItem,
  profile: SliceUserProfile
): ScoredNewsItem {
  const text = `${item.title} ${item.summary}`;
  const normalized = normalize(text);
  const reasons: string[] = [];
  const matchedTickers: string[] = [];
  const matchedCompanies: string[] = [];
  const matchedThemes: string[] = [];

  let score = item.sourceBaseTrust;

  if (item.sourceBaseTrust > 0) {
    reasons.push(`Trusted source: ${item.sourceName}.`);
  }

  const recency = scoreRecency(item.publishedAt);
  score += recency.points;
  reasons.push(recency.reason);

  for (const asset of profile.watchlist) {
    if (includesTicker(text, asset.ticker)) {
      matchedTickers.push(asset.ticker);
      score += 30;
      reasons.push(`Exact ticker/watchlist match: ${asset.ticker}.`);
    }

    for (const company of asset.companyNames) {
      if (normalized.includes(normalize(company))) {
        if (!matchedCompanies.includes(company)) matchedCompanies.push(company);

        score += 18;
        reasons.push(`Company/watchlist name match: ${company}.`);
      }
    }

    for (const sector of asset.sectors) {
      if (normalized.includes(normalize(sector))) {
        if (!matchedThemes.includes(sector)) matchedThemes.push(sector);

        score += 8;
        reasons.push(`Relevant sector/theme match: ${sector}.`);
      }
    }
  }

  for (const interest of profile.interests) {
    if (normalized.includes(normalize(interest)) && !matchedThemes.includes(interest)) {
      matchedThemes.push(interest);
      score += 6;
      reasons.push(`User interest match: ${interest}.`);
    }
  }

  for (const rule of MATERIALITY_RULES) {
    const matched = rule.terms.some((term) => normalized.includes(normalize(term)));

    if (matched) {
      score += rule.weight;
      reasons.push(rule.label);
    }
  }

  for (const blockedTerm of profile.blockedTerms) {
    if (normalized.includes(normalize(blockedTerm))) {
      score -= 35;
      reasons.push(`Noise penalty: ${blockedTerm}.`);
    }
  }

  if (item.sourceCategory === "halts") {
    score += 25;
    reasons.push("Trade halt source receives automatic priority boost.");
  }

  if (item.sourceCategory === "regulatory") {
    score += 16;
    reasons.push("Regulatory source receives priority boost.");
  }

  if (item.sourceTier === "advisor-paid" || item.sourceTier === "advisor-authorized") {
    score += 8;
    reasons.push("Advisor-approved paid or authorized source.");
  }

  if (
    matchedTickers.length === 0 &&
    matchedCompanies.length === 0 &&
    matchedThemes.length === 0
  ) {
    score -= 20;
    reasons.push("No direct user relevance match; suppressed unless materiality is very high.");
  }

  score = clamp(score, 0, 100);

  let urgency: ScoredNewsItem["urgency"] = "Low";

  if (score >= 90) urgency = "Critical";
  else if (score >= 75) urgency = "High";
  else if (score >= 55) urgency = "Medium";
  else if (score < 35) urgency = "Suppressed";

  const shouldAlert =
    score >= item.minScoreToAlert ||
    score >= 90 ||
    (score >= 75 && (matchedTickers.length > 0 || matchedCompanies.length > 0)) ||
    (score >= 80 && item.sourceCategory === "halts") ||
    (score >= 80 && item.sourceCategory === "regulatory");

  const channels: ScoredNewsItem["channels"] = shouldAlert
    ? urgency === "Critical"
      ? ["SMS", "Email", "Dashboard"]
      : ["Email", "Dashboard"]
    : score >= item.minScoreToRetain
      ? ["Digest"]
      : [];

  const complianceLabel = shouldAlert
    ? "Market intelligence alert — not a buy/sell recommendation. Advisor review required before client-specific use."
    : "Stored for review or digest only.";

  const primaryReason = reasons[0] ?? "Relevant market item detected.";

  const alertCopy = shouldAlert
    ? `${urgency}: ${item.title}. This may be relevant because ${primaryReason.toLowerCase()}`
    : `No instant alert. ${item.title}`;

  return {
    ...item,
    score,
    urgency,
    matchedTickers,
    matchedCompanies,
    matchedThemes,
    reasons: Array.from(new Set(reasons)).slice(0, 10),
    shouldAlert,
    channels,
    complianceLabel,
    alertCopy,
  };
}

async function fetchSource(source: FreeSource, headers: Record<string, string> = {}): Promise<{
  status: SourceStatus;
  items: RawNewsItem[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      method: "GET",
      headers: {
        "User-Agent": "SliceIntelligence/1.0",
        Accept:
          source.kind === "JSON_API"
            ? "application/json, text/json, */*"
            : "application/rss+xml, application/xml, text/xml, */*",
        ...headers,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: {
          id: source.id,
          name: source.name,
          ok: false,
          fetched: 0,
          paid: source.tier === "advisor-paid" || source.tier === "advisor-authorized",
          error: `HTTP ${response.status}`,
        },
        items: [],
      };
    }

    const items =
      source.kind === "JSON_API"
        ? parseJsonFeed(await response.json(), source)
        : parseRss(await response.text(), source);

    return {
      status: {
        id: source.id,
        name: source.name,
        ok: true,
        fetched: items.length,
        paid: source.tier === "advisor-paid" || source.tier === "advisor-authorized",
      },
      items,
    };
  } catch (error) {
    return {
      status: {
        id: source.id,
        name: source.name,
        ok: false,
        fetched: 0,
        paid: source.tier === "advisor-paid" || source.tier === "advisor-authorized",
        error: error instanceof Error ? error.message : "Unknown source error",
      },
      items: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeItems(items: RawNewsItem[]) {
  const seen = new Set<string>();
  const deduped: RawNewsItem[] = [];

  for (const item of items) {
    const key = normalize(`${item.title}:${item.link}`).slice(0, 220);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped;
}

function advisorSourceToFreeSource(source: AdvisorSourceForScan): FreeSource {
  return {
    id: `advisor-${source.id}`,
    name: source.name,
    url: source.sourceUrl,
    tier: "advisor-paid",
    category: "advisor-research",
    baseTrust: 24,
    minPollSeconds: 300,
    kind: source.sourceKind,
    maxItemsPerRun: source.maxItemsPerRun,
  };
}

export async function getAdvisorSourcesForScan(userId: string): Promise<AdvisorSourceForScan[]> {
  const sources = await prisma.advisorRealtimeSource.findMany({
    where: {
      userId,
      enabled: true,
      termsAcknowledged: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return sources.map((source) => {
    const nonSecretHeaders = safeJsonParse<Record<string, string>>(
      source.headersJson,
      {}
    );

    const decrypted = source.encryptedSecretJson
      ? safeJsonParse<{
          authHeaderName?: string;
          authHeaderValue?: string;
        }>(decryptSecret(source.encryptedSecretJson), {})
      : {};

    const headers = {
      ...nonSecretHeaders,
      ...(decrypted.authHeaderName && decrypted.authHeaderValue
        ? { [decrypted.authHeaderName]: decrypted.authHeaderValue }
        : {}),
    };

    return {
      id: source.id,
      name: source.name,
      sourceUrl: source.sourceUrl,
      sourceKind: source.sourceKind as SourceKind,
      platformType: source.platformType,
      enabled: source.enabled,
      headers,
      minScoreToRetain: source.minScoreToRetain,
      minScoreToAlert: source.minScoreToAlert,
      maxItemsPerRun: source.maxItemsPerRun,
    };
  });
}

export async function buildProfileForUser(userId: string): Promise<SliceUserProfile> {
  const [user, watchAssets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    }),
    prisma.watchAsset.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const watchlist =
    watchAssets.length > 0
      ? watchAssets.map((asset) => ({
          ticker: asset.ticker.toUpperCase(),
          companyNames: [
            asset.name,
            asset.ticker,
            asset.name.replace(/\b(inc|corp|corporation|company|ltd|plc)\b/gi, "").trim(),
          ].filter(Boolean),
          sectors: [
            asset.assetType,
            asset.signal ?? "",
            asset.notes ?? "",
          ].filter(Boolean),
        }))
      : DEMO_SLICE_PROFILE.watchlist;

  return {
    id: user?.id ?? userId,
    name: user?.name ?? "Slice Investor",
    watchlist,
    interests: DEMO_SLICE_PROFILE.interests,
    blockedTerms: DEMO_SLICE_PROFILE.blockedTerms,
  };
}

export async function scanPermittedSources(
  profile: SliceUserProfile = DEMO_SLICE_PROFILE,
  advisorSources: AdvisorSourceForScan[] = []
): Promise<ScanResult> {
  const advisorFreeSources = advisorSources.map(advisorSourceToFreeSource);

  const freeSourceJobs = FREE_RSS_SOURCES.map((source) => fetchSource(source));
  const advisorSourceJobs = advisorSources.map((source) => {
    const freeSource = advisorSourceToFreeSource(source);

    freeSource.baseTrust = 24;
    freeSource.maxItemsPerRun = source.maxItemsPerRun;

    return fetchSource(freeSource, source.headers);
  });

  const sourceResults = await Promise.all([...freeSourceJobs, ...advisorSourceJobs]);

  const statuses = sourceResults.map((result) => result.status);
  const rawItems = sourceResults.flatMap((result) => result.items);
  const deduped = dedupeItems(rawItems);

  const items = deduped
    .map((item) => {
      const advisorSource = advisorFreeSources.find((source) => source.id === item.sourceId);
      const sourceConfig = advisorSource
        ? advisorSources.find((source) => `advisor-${source.id}` === item.sourceId)
        : null;

      return scoreNewsItem(
        {
          ...item,
          minScoreToAlert: sourceConfig?.minScoreToAlert ?? item.minScoreToAlert,
          minScoreToRetain: sourceConfig?.minScoreToRetain ?? item.minScoreToRetain,
        },
        profile
      );
    })
    .filter((item) => item.score >= item.minScoreToRetain || item.shouldAlert)
    .sort((left, right) => right.score - left.score)
    .slice(0, 120);

  return {
    scannedAt: new Date().toISOString(),
    profile,
    sources: statuses,
    items,
    alertCandidates: items.filter((item) => item.shouldAlert),
    digestCandidates: items.filter(
      (item) => !item.shouldAlert && item.score >= item.minScoreToRetain
    ),
    suppressed: items.filter((item) => item.score < item.minScoreToRetain),
  };
}

export async function scanFreeSources(
  profile: SliceUserProfile = DEMO_SLICE_PROFILE
): Promise<ScanResult> {
  return scanPermittedSources(profile, []);
}

function headlineExpiresAt(item: ScoredNewsItem) {
  const days =
    item.urgency === "Critical" || item.urgency === "High"
      ? 45
      : item.urgency === "Medium"
        ? 21
        : 7;

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function persistIntelligenceResult(userId: string, result: ScanResult) {
  await prisma.intelligenceRun.create({
    data: {
      userId,
      mode: "realtime-advisor-sources",
      scannedCount: result.items.length + result.suppressed.length,
      retainedCount: result.items.length,
      alertCount: result.alertCandidates.length,
      digestCount: result.digestCandidates.length,
      discardedCount: result.suppressed.length,
      durationMs: 0,
    },
  });

  for (const item of result.items.slice(0, 80)) {
    await prisma.headlineDecision.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey: item.id,
        },
      },
      update: {
        title: item.title,
        summary: item.summary,
        sourceName: item.sourceName,
        sourceTier: item.sourceTier,
        url: item.link,
        category: item.sourceCategory,
        subcategory: item.sourceTier,
        importanceTier: item.urgency,
        action: item.shouldAlert ? "Alert" : "Digest",
        urgency: item.urgency,
        score: item.score,
        materialityScore: item.score,
        relevanceScore: item.matchedTickers.length || item.matchedCompanies.length ? 90 : 50,
        trustScore: item.sourceBaseTrust,
        matchedTickersJson: JSON.stringify(item.matchedTickers),
        matchedAreasJson: JSON.stringify(item.matchedThemes),
        reasonsJson: JSON.stringify(item.reasons),
        channelsJson: JSON.stringify(item.channels),
        expiresAt: headlineExpiresAt(item),
      },
      create: {
        userId,
        dedupeKey: item.id,
        title: item.title,
        summary: item.summary,
        sourceName: item.sourceName,
        sourceTier: item.sourceTier,
        url: item.link,
        category: item.sourceCategory,
        subcategory: item.sourceTier,
        importanceTier: item.urgency,
        action: item.shouldAlert ? "Alert" : "Digest",
        urgency: item.urgency,
        score: item.score,
        materialityScore: item.score,
        relevanceScore: item.matchedTickers.length || item.matchedCompanies.length ? 90 : 50,
        trustScore: item.sourceBaseTrust,
        matchedTickersJson: JSON.stringify(item.matchedTickers),
        matchedAreasJson: JSON.stringify(item.matchedThemes),
        reasonsJson: JSON.stringify(item.reasons),
        channelsJson: JSON.stringify(item.channels),
        expiresAt: headlineExpiresAt(item),
      },
    });
  }

  for (const item of result.alertCandidates.slice(0, 30)) {
    const dedupeKey = `intel:${item.id}`;

    const existingAlert = await prisma.alertEvent.findUnique({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey,
        },
      },
      select: {
        id: true,
      },
    });

    const alertEvent = await prisma.alertEvent.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey,
        },
      },
      update: {
        title: item.title,
        body: item.alertCopy,
        source: item.sourceName,
        ticker: item.matchedTickers[0] ?? null,
        urgency: item.urgency,
        score: item.score,
        channel: item.channels.join(", "),
        sourceUrl: item.link,
        aiBriefing: item.reasons.join("\n"),
      },
      create: {
        userId,
        dedupeKey,
        title: item.title,
        body: item.alertCopy,
        source: item.sourceName,
        ticker: item.matchedTickers[0] ?? null,
        urgency: item.urgency,
        score: item.score,
        channel: item.channels.join(", "),
        sourceUrl: item.link,
        aiBriefing: item.reasons.join("\n"),
      },
    });

    if (!existingAlert) {
      await prisma.notificationDelivery.create({
        data: {
          userId,
          alertEventId: alertEvent.id,
          channel: item.channels.join(", "),
          destination: "advisor-dashboard",
          status: "Queued",
          urgency: item.urgency,
          score: item.score,
          title: item.title,
          body: item.alertCopy,
          reason: item.reasons.join(" | "),
          simulated: true,
        },
      });

      await prisma.realtimeInvestorNotification.create({
        data: {
          userId,
          symbol: item.matchedTickers[0] ?? null,
          title: item.title,
          body: item.alertCopy,
          severity: item.urgency,
          score: item.score,
          sourceName: item.sourceName,
          sourceUrl: item.link,
          investorScope: "Advisor Review",
          channelsJson: JSON.stringify(item.channels),
        },
      });
    }
  }
}