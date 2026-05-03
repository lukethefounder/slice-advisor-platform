export type SourceTier =
  | "official-regulatory"
  | "official-exchange"
  | "public-news"
  | "demo";

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
    | "regulatory";
  baseTrust: number;
  minPollSeconds: number;
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
  },
  {
    id: "sec-trading-suspensions",
    name: "SEC Trading Suspensions",
    url: "https://www.sec.gov/enforcement-litigation/trading-suspensions/rss",
    tier: "official-regulatory",
    category: "regulatory",
    baseTrust: 28,
    minPollSeconds: 300,
  },
  {
    id: "sec-xbrl-filings",
    name: "SEC Structured Disclosure Filings",
    url: "https://www.sec.gov/Archives/edgar/usgaap.rss.xml",
    tier: "official-regulatory",
    category: "filings",
    baseTrust: 26,
    minPollSeconds: 600,
  },
  {
    id: "nasdaq-trade-halts",
    name: "Nasdaq Trade Halts",
    url: "https://www.nasdaqtrader.com/rss.aspx?feed=tradehalts",
    tier: "official-exchange",
    category: "halts",
    baseTrust: 30,
    minPollSeconds: 60,
  },
  {
    id: "nasdaq-current-news",
    name: "Nasdaq Current News Alerts",
    url: "https://www.nasdaqtrader.com/rss.aspx?categorylist=0&feed=currentheadlines",
    tier: "official-exchange",
    category: "exchange",
    baseTrust: 20,
    minPollSeconds: 300,
  },
  {
    id: "nasdaq-equity-alerts",
    name: "Nasdaq Equity Alerts",
    url: "https://www.nasdaqtrader.com/rss.aspx?categorylist=2%2C6%2C7&feed=currentheadlines",
    tier: "official-exchange",
    category: "exchange",
    baseTrust: 22,
    minPollSeconds: 300,
  },
  {
    id: "nasdaq-regulatory-alerts",
    name: "Nasdaq Equity Regulatory Alerts",
    url: "https://www.nasdaqtrader.com/rss.aspx?categorylist=6&feed=currentheadlines",
    tier: "official-exchange",
    category: "regulatory",
    baseTrust: 24,
    minPollSeconds: 300,
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
    if (match?.[1]) {
      return stripHtml(match[1]);
    }
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

function parseRss(xml: string, source: FreeSource): RawNewsItem[] {
  const itemBlocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s\S]*?<\/entry>/gi) ??
    [];

  return itemBlocks.map((block) => {
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
      sourceId: source.id,
      sourceName: source.name,
      sourceTier: source.tier,
      sourceCategory: source.category,
      title: title || "Untitled item",
      summary,
      link,
      publishedAt,
    };
  });
}

function scoreRecency(publishedAt: string) {
  const parsed = Date.parse(publishedAt);

  if (Number.isNaN(parsed)) {
    return { points: 6, reason: "No timestamp found; modest recency credit only." };
  }

  const minutesOld = Math.max(0, (Date.now() - parsed) / 1000 / 60);

  if (minutesOld <= 15) {
    return { points: 22, reason: "Very recent item." };
  }

  if (minutesOld <= 60) {
    return { points: 18, reason: "Recent within the last hour." };
  }

  if (minutesOld <= 360) {
    return { points: 10, reason: "Same-day item." };
  }

  if (minutesOld <= 1440) {
    return { points: 5, reason: "Published within the last day." };
  }

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

  let score = item.sourceTier === "official-regulatory" ? item.sourceName.includes("SEC") ? 24 : 22 : 0;
  score += item.sourceTier === "official-exchange" ? 20 : 0;
  score += item.sourceTier === "public-news" ? 10 : 0;

  if (score > 0) {
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
        if (!matchedCompanies.includes(company)) {
          matchedCompanies.push(company);
        }
        score += 18;
        reasons.push(`Company/watchlist name match: ${company}.`);
      }
    }

    for (const sector of asset.sectors) {
      if (normalized.includes(normalize(sector))) {
        if (!matchedThemes.includes(sector)) {
          matchedThemes.push(sector);
        }
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

  if (matchedTickers.length === 0 && matchedCompanies.length === 0 && matchedThemes.length === 0) {
    score -= 20;
    reasons.push("No direct user relevance match; suppressed unless materiality is very high.");
  }

  score = clamp(score, 0, 100);

  let urgency: ScoredNewsItem["urgency"] = "Low";

  if (score >= 90) {
    urgency = "Critical";
  } else if (score >= 75) {
    urgency = "High";
  } else if (score >= 55) {
    urgency = "Medium";
  } else if (score < 35) {
    urgency = "Suppressed";
  }

  const shouldAlert =
    score >= 90 ||
    (score >= 75 && (matchedTickers.length > 0 || matchedCompanies.length > 0)) ||
    (score >= 80 && item.sourceCategory === "halts") ||
    (score >= 80 && item.sourceCategory === "regulatory");

  const channels: ScoredNewsItem["channels"] = shouldAlert
    ? urgency === "Critical"
      ? ["SMS", "Email", "Dashboard"]
      : ["Email", "Dashboard"]
    : score >= 55
      ? ["Digest"]
      : [];

  const complianceLabel = shouldAlert
    ? "Market intelligence alert — not a buy/sell recommendation."
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
    reasons: Array.from(new Set(reasons)).slice(0, 8),
    shouldAlert,
    channels,
    complianceLabel,
    alertCopy,
  };
}

async function fetchSource(source: FreeSource): Promise<{
  status: SourceStatus;
  items: RawNewsItem[];
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SliceDemo/1.0 development@example.com",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
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
          error: `HTTP ${response.status}`,
        },
        items: [],
      };
    }

    const xml = await response.text();
    const items = parseRss(xml, source);

    return {
      status: {
        id: source.id,
        name: source.name,
        ok: true,
        fetched: items.length,
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
    const key = normalize(`${item.title}:${item.link}`).slice(0, 180);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  return deduped;
}

export async function scanFreeSources(
  profile: SliceUserProfile = DEMO_SLICE_PROFILE
): Promise<ScanResult> {
  const sourceResults = await Promise.all(FREE_RSS_SOURCES.map(fetchSource));

  const statuses = sourceResults.map((result) => result.status);
  const rawItems = sourceResults.flatMap((result) => result.items);
  const deduped = dedupeItems(rawItems);

  const items = deduped
    .map((item) => scoreNewsItem(item, profile))
    .sort((left, right) => right.score - left.score)
    .slice(0, 80);

  return {
    scannedAt: new Date().toISOString(),
    profile,
    sources: statuses,
    items,
    alertCandidates: items.filter((item) => item.shouldAlert),
    digestCandidates: items.filter(
      (item) => !item.shouldAlert && item.score >= 55
    ),
    suppressed: items.filter((item) => item.score < 55),
  };
}