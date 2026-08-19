"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BellRing,
  BrainCircuit,
  ChevronDown,
  CircleDot,
  Database,
  ExternalLink,
  FileCheck2,
  Filter,
  Globe2,
  Landmark,
  LineChart,
  Link2,
  Newspaper,
  Radar,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Zap,
} from "lucide-react";

import type {
  PublicArticle,
  PublicIntelligenceSnapshot,
  PublicSourceStatus,
} from "@/lib/public-intelligence-types";

type CategoryId =
  | "all"
  | "markets"
  | "technology"
  | "economy"
  | "policy"
  | "crypto"
  | "client"
  | "alerts";

type Category = {
  id: CategoryId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const REFRESH_MS = 5 * 60_000;

const EMPTY_SNAPSHOT: PublicIntelligenceSnapshot = {
  schemaVersion: "slice-public-intelligence-2.0.0",
  generatedAt: new Date(0).toISOString(),
  dateKey: "",
  marketTimeZone: "America/New_York",
  provider: "Slice Public Intelligence Mesh",
  refreshCadence: "Scheduled every four hours",
  storage: "fresh",
  sources: [],
  items: [],
  alertCandidates: [],
  digestCandidates: [],
  suppressed: [],
  topicCounts: [],
  warnings: [],
};

const CATEGORIES: Category[] = [
  {
    id: "all",
    label: "Top intelligence",
    description: "Highest-ranked sourced items across the complete market mesh.",
    icon: Sparkles,
  },
  {
    id: "markets",
    label: "Markets",
    description: "Equities, bonds, commodities, currencies, market structure, and trading events.",
    icon: LineChart,
  },
  {
    id: "technology",
    label: "Technology",
    description: "AI, semiconductors, cloud, software, cybersecurity, and innovation.",
    icon: BrainCircuit,
  },
  {
    id: "economy",
    label: "Economy",
    description: "Inflation, growth, labor, rates, liquidity, and economic releases.",
    icon: Globe2,
  },
  {
    id: "policy",
    label: "Policy and regulation",
    description: "The Federal Reserve, government policy, exchanges, SEC activity, and regulation.",
    icon: Landmark,
  },
  {
    id: "crypto",
    label: "Digital assets",
    description: "Crypto markets, blockchain infrastructure, adoption, and regulation.",
    icon: Zap,
  },
  {
    id: "client",
    label: "Client relevance",
    description: "Risk, portfolios, investor behavior, communication, planning, and suitability context.",
    icon: Target,
  },
  {
    id: "alerts",
    label: "Priority alerts",
    description: "Items that cleared the faster advisor-review threshold.",
    icon: BellRing,
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function OriginalBrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-600 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="line-clamp-2 text-[10px] font-black uppercase leading-snug tracking-[0.22em] text-emerald-400 sm:truncate">
          Advisor Intelligence Platform
        </div>
      </div>
    </div>
  );
}

function normalizeSnapshot(
  value: Partial<PublicIntelligenceSnapshot>,
): PublicIntelligenceSnapshot {
  const items = Array.isArray(value.items) ? value.items : [];

  return {
    schemaVersion: "slice-public-intelligence-2.0.0",
    generatedAt: value.generatedAt ?? EMPTY_SNAPSHOT.generatedAt,
    dateKey: value.dateKey ?? "",
    marketTimeZone: "America/New_York",
    provider: "Slice Public Intelligence Mesh",
    refreshCadence: value.refreshCadence ?? "Scheduled every four hours",
    storage: value.storage ?? "fresh",
    sources: Array.isArray(value.sources) ? value.sources : [],
    items,
    alertCandidates: Array.isArray(value.alertCandidates)
      ? value.alertCandidates
      : items.filter((item) => item.shouldAlert),
    digestCandidates: Array.isArray(value.digestCandidates)
      ? value.digestCandidates
      : items.filter((item) => !item.shouldAlert),
    suppressed: Array.isArray(value.suppressed) ? value.suppressed : [],
    topicCounts: Array.isArray(value.topicCounts) ? value.topicCounts : [],
    warnings: Array.isArray(value.warnings) ? value.warnings : [],
  };
}

function relativeTime(value?: string) {
  if (!value) return "Time unavailable";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Time unavailable";

  const seconds = Math.max(0, Math.round((Date.now() - parsed) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDateTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Waiting for scan";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function marketDateKey(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${read("year")}-${read("month")}-${read("day")}`;
}

function safeUrl(value?: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function searchableText(article: PublicArticle) {
  return [
    article.title,
    article.summary,
    article.sourceName,
    article.sourceDomain,
    ...article.matchedTickers,
    ...article.matchedCompanies,
    ...article.matchedThemes,
    ...article.reasons,
  ]
    .join(" ")
    .toLowerCase();
}

function categoryMatches(article: PublicArticle, category: CategoryId) {
  if (category === "all") return true;
  if (category === "alerts") return article.shouldAlert;

  const text = searchableText(article);
  const groups: Record<Exclude<CategoryId, "all" | "alerts">, string[]> = {
    markets: [
      "market",
      "equity",
      "stock",
      "bond",
      "treasury",
      "yield",
      "commodity",
      "currency",
      "earnings",
      "trade halt",
      "exchange",
      "portfolio",
    ],
    technology: [
      "technology",
      "artificial intelligence",
      " ai ",
      "semiconductor",
      "chip",
      "cloud",
      "software",
      "cybersecurity",
      "data center",
    ],
    economy: [
      "economy",
      "economic",
      "inflation",
      "cpi",
      "jobs",
      "labor",
      "growth",
      "liquidity",
      "interest rate",
      "treasury",
      "yield",
    ],
    policy: [
      "regulatory",
      "regulation",
      "sec ",
      "federal reserve",
      "fed ",
      "policy",
      "government",
      "filing",
      "enforcement",
      "suspension",
    ],
    crypto: [
      "crypto",
      "bitcoin",
      "ethereum",
      "blockchain",
      "digital asset",
      "btc",
      "eth",
    ],
    client: [
      "client",
      "investor",
      "risk",
      "portfolio",
      "liquidity",
      "suitability",
      "planning",
      "advisor",
      "communication",
    ],
  };

  return groups[category].some((term) => text.includes(term));
}

function dedupeAndSort(items: PublicArticle[]) {
  const seen = new Set<string>();
  const result: PublicArticle[] = [];

  for (const article of items) {
    const key = (article.link || `${article.sourceName}:${article.title}`)
      .toLowerCase()
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return Date.parse(right.publishedAt ?? "") - Date.parse(left.publishedAt ?? "");
  });
}

function useDailyIntelligence() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);

    try {
      const response = await fetch("/api/intelligence/daily?limit=140", {
        cache: "no-store",
      });
      const data = (await response.json()) as Partial<PublicIntelligenceSnapshot> & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          data.error || `Daily intelligence returned HTTP ${response.status}.`,
        );
      }

      setSnapshot(normalizeSnapshot(data));
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The daily intelligence edition is temporarily unavailable.",
      );
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [refresh]);

  const allStories = useMemo(
    () => dedupeAndSort(snapshot.items),
    [snapshot.items],
  );
  const todaysStories = useMemo(
    () =>
      allStories.filter(
        (article) => marketDateKey(article.publishedAt) === snapshot.dateKey,
      ),
    [allStories, snapshot.dateKey],
  );
  const stories = todaysStories.length ? todaysStories : allStories;
  const isRecentFallback = Boolean(allStories.length && !todaysStories.length);
  const health = useMemo(() => {
    const online = snapshot.sources.filter((source) => source.ok).length;
    const fetched = snapshot.sources.reduce(
      (sum, source) => sum + source.fetched,
      0,
    );
    return {
      online,
      total: snapshot.sources.length,
      fetched,
      alphaOnline: snapshot.sources.some(
        (source) => source.provider === "Alpha Vantage" && source.ok,
      ),
    };
  }, [snapshot.sources]);

  return {
    snapshot,
    stories,
    allStoryCount: allStories.length,
    isRecentFallback,
    health,
    loading,
    refreshing,
    error,
    refresh,
  };
}

function Metric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[1.45rem] border border-white/[0.075] bg-white/[0.04] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent" />
      <Icon className="h-4 w-4 text-emerald-300" />
      <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">
        {value}
      </div>
      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
        {label}
      </div>
      <div className="mt-2 text-[10px] leading-4 text-slate-600">
        {helper}
      </div>
    </div>
  );
}

function UrgencyBadge({ article }: { article: PublicArticle }) {
  const style =
    article.urgency === "Critical"
      ? "border-rose-300/25 bg-rose-400/10 text-rose-200"
      : article.urgency === "High"
        ? "border-amber-300/25 bg-amber-400/10 text-amber-200"
        : article.urgency === "Medium"
          ? "border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-200"
          : "border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200";

  return (
    <span
      className={cx(
        "rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em]",
        style,
      )}
    >
      {article.urgency}
    </span>
  );
}

function StoryCard({
  article,
  featured = false,
}: {
  article: PublicArticle;
  featured?: boolean;
}) {
  const external = safeUrl(article.link);
  const sentimentPositive = (article.sentimentScore ?? 0) >= 0;

  return (
    <article
      className={cx(
        "group flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-white/[0.08] bg-white/[0.04] shadow-[0_25px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20",
        featured && "lg:col-span-2",
      )}
    >
      {article.bannerImage ? (
        <div
          className={cx(
            "relative overflow-hidden border-b border-white/[0.07]",
            featured ? "h-60 sm:h-72" : "h-44",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.bannerImage}
            alt=""
            className="h-full w-full object-cover opacity-55 saturate-75 transition duration-700 group-hover:scale-105 group-hover:opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06100b] via-[#06100b]/30 to-transparent" />
        </div>
      ) : (
        <div
          className={cx(
            "relative overflow-hidden border-b border-white/[0.07] bg-[radial-gradient(circle_at_30%_35%,rgba(16,185,129,0.22),transparent_42%),linear-gradient(135deg,#07140e,#020604)]",
            featured ? "h-44" : "h-32",
          )}
        >
          <div className="slice-blog-sweep absolute inset-0 opacity-60" />
          <Newspaper className="absolute bottom-5 left-6 h-7 w-7 text-emerald-300/75" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge article={article} />
          <span className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
            {article.sourceName}
          </span>
          <span className="text-[9px] font-bold text-slate-600">
            {relativeTime(article.publishedAt)}
          </span>
        </div>

        <h2
          className={cx(
            "mt-4 font-black tracking-[-0.04em] text-white",
            featured ? "text-2xl sm:text-4xl" : "text-xl",
          )}
        >
          {article.title}
        </h2>
        <p
          className={cx(
            "mt-4 line-clamp-3 leading-7 text-slate-500",
            featured ? "text-sm sm:text-base" : "text-sm",
          )}
        >
          {article.summary ||
            "Open the original source to review the complete article context."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            ...article.matchedTickers.slice(0, 4),
            ...article.matchedThemes.slice(0, 3),
          ].map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[8px] font-black text-slate-400"
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-auto pt-6">
          <div className="grid grid-cols-3 gap-3 border-t border-white/[0.065] pt-4">
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">
                Relevance
              </div>
              <div className="mt-1 text-lg font-black text-white">
                {article.score}/100
              </div>
            </div>
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">
                Sentiment
              </div>
              <div
                className={cx(
                  "mt-1 truncate text-xs font-black",
                  sentimentPositive ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {article.sentimentLabel || "Contextual"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">
                Feed
              </div>
              <div className="mt-1 text-[9px] font-black text-slate-300">
                {article.sourceKind === "alpha-vantage-news"
                  ? "Alpha Vantage"
                  : "Official"}
              </div>
            </div>
          </div>

          {external ? (
            <a
              href={external}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-xs font-black text-emerald-300 transition hover:text-emerald-100"
            >
              Read original source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function SourceHealth({ sources }: { sources: PublicSourceStatus[] }) {
  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-white/[0.08] bg-white/[0.04] shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="border-b border-white/[0.07] p-5">
        <div className="flex items-center gap-3">
          <Radar className="h-5 w-5 text-emerald-300" />
          <div>
            <h3 className="text-lg font-black text-white">Source health</h3>
            <p className="mt-1 text-[10px] text-slate-600">
              Status retained from the latest scheduled scan
            </p>
          </div>
        </div>
      </div>
      <div className="max-h-[560px] divide-y divide-white/[0.06] overflow-y-auto">
        {sources.map((source) => (
          <div key={source.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-black text-slate-200">
                  {source.name}
                </div>
                <div className="mt-1 text-[9px] font-bold text-slate-600">
                  {source.provider} · {source.fetched} items
                </div>
              </div>
              <span
                className={cx(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.13em]",
                  source.ok
                    ? "border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-300"
                    : "border-amber-300/20 bg-amber-400/[0.07] text-amber-200",
                )}
              >
                <CircleDot className="h-2.5 w-2.5" />
                {source.ok ? "Online" : "Issue"}
              </span>
            </div>
            {source.error ? (
              <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-amber-200/55">
                {source.error}
              </p>
            ) : null}
          </div>
        ))}
        {!sources.length ? (
          <div className="p-6 text-center text-xs font-bold text-slate-600">
            Source status will appear after the first completed edition.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function BlogPage() {
  const intelligence = useDailyIntelligence();
  const [category, setCategory] = useState<CategoryId>("all");
  const [query, setQuery] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return intelligence.stories.filter((article) => {
      if (!categoryMatches(article, category)) return false;
      if (!normalizedQuery) return true;
      return searchableText(article).includes(normalizedQuery);
    });
  }, [category, intelligence.stories, query]);

  const featured = filtered[0];
  const remaining = filtered.slice(1);
  const topTopics = intelligence.snapshot.topicCounts.slice(0, 12);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#010403] text-white selection:bg-emerald-400/30 selection:text-white">
      <style jsx global>{`
        html { background: #010403; }
        body {
          background:
            radial-gradient(circle at 12% 0%, rgba(16,185,129,0.11), transparent 30%),
            radial-gradient(circle at 88% 13%, rgba(34,211,238,0.055), transparent 27%),
            linear-gradient(180deg,#010403 0%,#020705 45%,#010403 100%);
        }
        @keyframes slice-blog-float {
          0%,100% { transform: translate3d(0,0,0); opacity: .22; }
          50% { transform: translate3d(8px,-20px,0); opacity: .7; }
        }
        @keyframes slice-blog-sweep {
          from { background-position: 0 0, 0 0; }
          to { background-position: 95px 65px, -120px 0; }
        }
        .slice-blog-dot { animation: slice-blog-float 8s ease-in-out infinite; }
        .slice-blog-sweep {
          background-image:
            radial-gradient(circle,rgba(167,243,208,.2) 1px,transparent 1.5px),
            linear-gradient(110deg,transparent 0%,rgba(52,211,153,.08) 46%,transparent 58%);
          background-size: 28px 28px,220px 100%;
          animation: slice-blog-sweep 16s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .slice-blog-dot,.slice-blog-sweep { animation: none !important; }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-48 -top-56 h-[42rem] w-[42rem] rounded-full bg-emerald-500/10 blur-[130px]" />
        <div className="absolute -right-40 top-[12%] h-[38rem] w-[38rem] rounded-full bg-cyan-500/[0.055] blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.022)_1px,transparent_1px)] [background-size:58px_58px] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]" />
        {Array.from({ length: 20 }, (_, index) => (
          <span
            key={index}
            className="slice-blog-dot absolute h-1 w-1 rounded-full bg-emerald-300/60 shadow-[0_0_15px_rgba(52,211,153,0.75)]"
            style={{
              left: `${(index * 41 + 7) % 100}%`,
              top: `${(index * 59 + 11) % 100}%`,
              animationDelay: `${-(index * 0.43)}s`,
            }}
          />
        ))}
      </div>

      <header className="sticky top-0 z-50 border-b border-emerald-300/10 bg-[#020705]/86 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" prefetch={false} aria-label="Slice homepage">
            <OriginalBrandMark />
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/"
              prefetch={false}
              className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-300 transition hover:border-emerald-300/20 hover:text-white sm:inline-flex"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Platform
            </Link>
            <Link
              href="/founder-login"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-900 px-4 py-2.5 text-xs font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.22)] transition hover:-translate-y-0.5 hover:from-emerald-400 hover:to-emerald-800"
            >
              Founder login
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 pb-14 pt-16 sm:pb-20 sm:pt-20 lg:pt-24">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_430px]">
            <div>
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.075] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 backdrop-blur-xl">
                <span className="relative flex h-2 w-2">
                  <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
                  <span className="relative h-2 w-2 rounded-full bg-emerald-300" />
                </span>
                Daily intelligence edition
                <span className="h-3 w-px bg-white/15" />
                {intelligence.isRecentFallback
                  ? "Latest sourced fallback"
                  : intelligence.snapshot.storage}
              </div>
              <h1 className="mt-7 max-w-5xl text-balance text-5xl font-black leading-[0.96] tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
                The day&apos;s most useful sourced articles—
                <span className="bg-gradient-to-r from-emerald-200 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                  connected to what matters.
                </span>
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg sm:leading-9">
                Slice scouts official market and regulatory feeds plus Alpha Vantage
                Market News &amp; Sentiment, then ranks the results by recency,
                relevance, materiality, source evidence, tickers, and connected themes.
                This is an advisor intelligence surface—not an anonymous stream of headlines.
              </p>
            </div>

            <div className="rounded-[1.9rem] border border-emerald-300/10 bg-white/[0.04] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">
                    Edition state
                  </div>
                  <div className="mt-2 text-xl font-black text-white">
                    {intelligence.snapshot.dateKey || "Awaiting first scan"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void intelligence.refresh()}
                  disabled={intelligence.refreshing}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-300 transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.08] disabled:opacity-50"
                  aria-label="Refresh daily intelligence"
                >
                  <RefreshCcw
                    className={cx(
                      "h-4 w-4",
                      intelligence.refreshing && "animate-spin",
                    )}
                  />
                </button>
              </div>
              <div className="mt-5 space-y-3 border-t border-white/[0.07] pt-5 text-[11px] text-slate-500">
                <div className="flex items-center justify-between gap-4">
                  <span>Generated</span>
                  <span className="font-bold text-slate-300">
                    {formatDateTime(intelligence.snapshot.generatedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Cadence</span>
                  <span className="text-right font-bold text-slate-300">
                    {intelligence.snapshot.refreshCadence}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span>Alpha news</span>
                  <span
                    className={cx(
                      "font-bold",
                      intelligence.health.alphaOnline
                        ? "text-emerald-300"
                        : "text-amber-300",
                    )}
                  >
                    {intelligence.health.alphaOnline ? "Online" : "Unavailable"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric
              icon={Newspaper}
              label="Retained stories"
              value={intelligence.stories.length || "—"}
              helper={
                intelligence.isRecentFallback
                  ? `${intelligence.allStoryCount} recent sourced items available`
                  : "Published in today’s market-date edition"
              }
            />
            <Metric
              icon={Radar}
              label="Sources online"
              value={`${intelligence.health.online}/${intelligence.health.total || 0}`}
              helper={`${intelligence.health.fetched} raw items scanned`}
            />
            <Metric
              icon={BellRing}
              label="Priority review"
              value={intelligence.snapshot.alertCandidates.length}
              helper="Faster advisor attention"
            />
            <Metric
              icon={Link2}
              label="Connected themes"
              value={intelligence.snapshot.topicCounts.length}
              helper="Graph relationships surfaced"
            />
            <Metric
              icon={Database}
              label="Durable storage"
              value={intelligence.snapshot.storage}
              helper="Latest completed database batch"
            />
          </div>

          {intelligence.error ? (
            <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-400/[0.055] p-4 text-xs leading-6 text-amber-100/75">
              <div className="flex items-start gap-3">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <span className="font-black text-amber-200">Feed status:</span>{" "}
                  {intelligence.error}. The interface does not insert placeholder articles.
                </div>
              </div>
            </div>
          ) : null}

          {intelligence.isRecentFallback && !intelligence.error ? (
            <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.045] p-4 text-xs leading-6 text-cyan-100/70">
              No article in the latest stored scan carried today’s New York market-date stamp, so Slice is showing the most recent sourced edition instead of presenting an empty or fabricated journal.
            </div>
          ) : null}
        </div>
      </section>

      <section className="relative z-10 border-y border-emerald-300/[0.07] bg-[#040a07]/62 py-6">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={query}
                onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
                placeholder="Search titles, sources, tickers, companies, themes, or reasons…"
                className="w-full rounded-2xl border border-white/[0.09] bg-black/25 py-3.5 pl-11 pr-11 text-sm font-bold text-white outline-none placeholder:text-slate-700 focus:border-emerald-300/30 focus:ring-2 focus:ring-emerald-400/10"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-500 hover:bg-white/[0.05] hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setMobileFilters((value) => !value)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3.5 text-xs font-black text-slate-300 lg:hidden"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <div className="hidden flex-wrap gap-2 lg:flex">
              {CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={cx(
                    "rounded-full border px-3.5 py-2 text-[9px] font-black uppercase tracking-[0.13em] transition",
                    category === item.id
                      ? "border-emerald-300/25 bg-emerald-400/[0.11] text-emerald-100"
                      : "border-white/[0.08] bg-white/[0.03] text-slate-600 hover:border-emerald-300/18 hover:text-white",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {mobileFilters ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:hidden">
              {CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setCategory(item.id);
                    setMobileFilters(false);
                  }}
                  className={cx(
                    "rounded-xl border px-3 py-3 text-[9px] font-black uppercase tracking-[0.12em]",
                    category === item.id
                      ? "border-emerald-300/25 bg-emerald-400/[0.11] text-emerald-100"
                      : "border-white/[0.08] bg-white/[0.03] text-slate-500",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="relative z-10 py-14 sm:py-20">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div>
              <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                    {CATEGORIES.find((item) => item.id === category)?.label}
                  </div>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">
                    {filtered.length} sourced {filtered.length === 1 ? "article" : "articles"}
                  </h2>
                </div>
                <p className="max-w-xl text-xs leading-6 text-slate-600 sm:text-right">
                  {CATEGORIES.find((item) => item.id === category)?.description}
                </p>
              </div>

              {featured ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <StoryCard article={featured} featured />
                  {remaining.map((article) => (
                    <StoryCard key={article.id} article={article} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-12 text-center">
                  {intelligence.loading ? (
                    <RefreshCcw className="mx-auto h-8 w-8 animate-spin text-emerald-300" />
                  ) : (
                    <Search className="mx-auto h-8 w-8 text-emerald-300" />
                  )}
                  <h3 className="mt-4 text-xl font-black text-white">
                    {intelligence.loading
                      ? "Loading the latest stored edition"
                      : "No articles match the current filter"}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-500">
                    {intelligence.loading
                      ? "Slice is retrieving the latest completed intelligence batch."
                      : "Clear the search or choose a broader category. Slice does not create placeholder stories when the source set has no match."}
                  </p>
                </div>
              )}
            </div>

            <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
              <SourceHealth sources={intelligence.snapshot.sources} />

              <div className="rounded-[1.8rem] border border-white/[0.08] bg-white/[0.04] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-cyan-300" />
                  <h3 className="text-lg font-black text-white">Connected themes</h3>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {topTopics.map((topic) => (
                    <button
                      key={topic.topic}
                      type="button"
                      onClick={() => setQuery(topic.topic)}
                      className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-bold text-slate-400 transition hover:border-emerald-300/20 hover:text-emerald-200"
                    >
                      {topic.topic} · {topic.count}
                    </button>
                  ))}
                  {!topTopics.length ? (
                    <p className="text-xs leading-6 text-slate-600">
                      Theme counts will appear after the first completed scan.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[1.8rem] border border-emerald-300/10 bg-gradient-to-br from-emerald-400/[0.08] to-white/[0.025] p-5">
                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                <h3 className="mt-4 text-lg font-black text-white">
                  Advisor review remains required
                </h3>
                <p className="mt-3 text-xs leading-6 text-slate-500">
                  Scores indicate intelligence priority, not a buy or sell instruction. Review the original source, affected exposures, client facts, and firm policy before client-specific use.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-emerald-300/[0.07] bg-[#040a07]/62 py-16 sm:py-20">
        <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMethodOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-6 text-left"
            aria-expanded={methodOpen}
          >
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                Editorial and technical methodology
              </div>
              <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl">
                Why Slice surfaced these articles.
              </h2>
            </div>
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300">
              <ChevronDown
                className={cx(
                  "h-5 w-5 transition-transform",
                  methodOpen && "rotate-180",
                )}
              />
            </span>
          </button>

          {methodOpen ? (
            <div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Newspaper,
                  title: "Original source retained",
                  text: "Each story preserves the publication, original link, source family, timestamp, and provider context whenever available.",
                },
                {
                  icon: BarChart3,
                  title: "Relevance and materiality",
                  text: "Recency, ticker relevance, themes, material terms, source trust, and advisor usefulness influence the ranking.",
                },
                {
                  icon: Link2,
                  title: "Graph relationships",
                  text: "Matched tickers, companies, topics, risk concepts, and macro themes show why an article entered the intelligence surface.",
                },
                {
                  icon: FileCheck2,
                  title: "Review-first use",
                  text: "Priority determines workflow attention. It does not convert sourced reporting into an autonomous client recommendation.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="rounded-[1.6rem] border border-white/[0.08] bg-white/[0.035] p-6"
                  >
                    <Icon className="h-5 w-5 text-emerald-300" />
                    <h3 className="mt-5 text-lg font-black text-white">
                      {item.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-500">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="relative z-10 px-4 py-20 sm:px-6 lg:px-8">
        <div className="slice-blog-sweep relative mx-auto max-w-[1500px] overflow-hidden rounded-[2.4rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-500/20 via-emerald-900/35 to-[#020604] px-6 py-12 shadow-[0_40px_125px_rgba(5,150,105,0.18)] sm:px-10 sm:py-14 lg:px-14">
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.19em] text-emerald-200">
                Continue into Slice
              </div>
              <h2 className="mt-4 max-w-4xl text-balance text-4xl font-black tracking-[-0.05em] text-white sm:text-5xl">
                Turn sourced intelligence into connected advisor work.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-emerald-50/70 sm:text-base">
                Open the platform to connect the article to market movement, portfolios, clients, documents, tasks, drafts, approvals, and firm memory.
              </p>
            </div>
            <div className="flex min-w-[240px] flex-col gap-3">
              <Link
                href="/founder-login"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-emerald-50"
              >
                Founder login
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                prefetch={false}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-6 py-4 text-sm font-black text-white transition hover:bg-white/[0.08]"
              >
                Platform overview
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-emerald-300/[0.08] bg-[#010403]/85 py-10 backdrop-blur-xl">
        <div className="mx-auto grid max-w-[1500px] gap-7 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
          <Link href="/" prefetch={false} className="justify-self-start">
            <OriginalBrandMark />
          </Link>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-[10px] font-black uppercase tracking-[0.13em] text-slate-600 lg:justify-center">
            <Link href="/" prefetch={false} className="hover:text-emerald-300">Platform</Link>
            <Link href="/intelligence" prefetch={false} className="hover:text-emerald-300">Workspace intelligence</Link>
            <Link href="/security" prefetch={false} className="hover:text-emerald-300">Security</Link>
            <Link href="/client-login" prefetch={false} className="hover:text-emerald-300">Client portal</Link>
            <Link href="/founder-login" prefetch={false} className="hover:text-emerald-300">Founder login</Link>
          </div>
          <p className="max-w-md text-[9px] font-bold uppercase leading-5 tracking-[0.11em] text-slate-700 lg:justify-self-end lg:text-right">
            Source-linked market intelligence and workflow support. Not investment advice or an automated recommendation.
          </p>
        </div>
      </footer>
    </main>
  );
}