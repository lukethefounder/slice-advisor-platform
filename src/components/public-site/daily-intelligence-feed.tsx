"use client";

import type { ChangeEvent, ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Filter,
  Globe2,
  Loader2,
  Newspaper,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import type {
  PublicArticle,
  PublicIntelligenceSnapshot,
} from "@/lib/public-intelligence-types";

const STORAGE_KEY = "slice-public-daily-intelligence-v1";
const MAX_STORED_AGE_MS = 36 * 60 * 60_000;
const ARTICLE_LIMIT = 6;

type FeedStatus = "idle" | "loading" | "refreshing" | "ready" | "error";
type CategoryId =
  | "all"
  | "priority"
  | "markets"
  | "technology"
  | "economy"
  | "policy"
  | "digital-assets"
  | "client";

type DailyPayload = Partial<PublicIntelligenceSnapshot> & {
  ok?: boolean;
  error?: string;
  servedAt?: string;
};

type Category = {
  id: CategoryId;
  label: string;
  description: string;
};

const CATEGORIES: Category[] = [
  {
    id: "all",
    label: "Top edition",
    description: "All selected stories in the completed daily edition.",
  },
  {
    id: "priority",
    label: "Priority",
    description: "Stories marked for faster advisor review.",
  },
  {
    id: "markets",
    label: "Markets",
    description: "Equities, bonds, currencies, commodities, and market structure.",
  },
  {
    id: "technology",
    label: "Technology",
    description: "AI, semiconductors, software, cloud, and cybersecurity.",
  },
  {
    id: "economy",
    label: "Economy",
    description: "Inflation, rates, labor, growth, and liquidity.",
  },
  {
    id: "policy",
    label: "Policy",
    description: "Federal Reserve, regulation, government, and enforcement.",
  },
  {
    id: "digital-assets",
    label: "Digital assets",
    description: "Crypto, blockchain, adoption, and regulation.",
  },
  {
    id: "client",
    label: "Client relevance",
    description: "Portfolio, risk, planning, behavior, and communication context.",
  },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeExternalUrl(value?: string) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function formatDateTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function relativeTime(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Time unavailable";

  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function dedupeArticles(items: PublicArticle[]) {
  const seen = new Set<string>();
  const result: PublicArticle[] = [];

  for (const article of items) {
    const key = clean(article.link || `${article.sourceName}:${article.title}`)
      .toLowerCase();

    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(article);
  }

  return result
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return Date.parse(right.publishedAt ?? "") - Date.parse(left.publishedAt ?? "");
    })
    .slice(0, ARTICLE_LIMIT);
}

function buildTopicCounts(items: PublicArticle[]) {
  const counts = new Map<string, number>();

  for (const article of items) {
    for (const rawTopic of article.matchedThemes ?? []) {
      const topic = clean(rawTopic);
      if (topic) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic))
    .slice(0, 12);
}

function normalizeSnapshot(payload: DailyPayload): PublicIntelligenceSnapshot {
  const items = dedupeArticles(Array.isArray(payload.items) ? payload.items : []);

  return {
    schemaVersion: "slice-public-intelligence-2.0.0",
    generatedAt:
      clean(payload.generatedAt) || clean(payload.servedAt) || new Date().toISOString(),
    dateKey: clean(payload.dateKey),
    marketTimeZone: "America/New_York",
    provider: "Slice Public Intelligence Mesh",
    refreshCadence:
      clean(payload.refreshCadence) || "Published daily at 6:00 AM Eastern Time",
    storage:
      payload.storage === "database" ||
      payload.storage === "memory" ||
      payload.storage === "stale"
        ? payload.storage
        : "fresh",
    sources: Array.isArray(payload.sources) ? payload.sources : [],
    items,
    alertCandidates: items.filter((article) => article.shouldAlert),
    digestCandidates: items.filter(
      (article) => !article.shouldAlert && article.score >= 55,
    ),
    suppressed: items.filter((article) => article.score < 55),
    topicCounts:
      Array.isArray(payload.topicCounts) && payload.topicCounts.length
        ? payload.topicCounts.slice(0, 12)
        : buildTopicCounts(items),
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Slice received an invalid intelligence response (HTTP ${response.status}).`,
    );
  }
}

function readStoredSnapshot() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicIntelligenceSnapshot;
    const age = Date.now() - Date.parse(parsed.generatedAt);

    return parsed.schemaVersion === "slice-public-intelligence-2.0.0" &&
      Number.isFinite(age) &&
      age <= MAX_STORED_AGE_MS
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function storeSnapshot(snapshot: PublicIntelligenceSnapshot) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Session storage is a nonessential rendering optimization.
  }
}

function searchableText(article: PublicArticle) {
  return [
    article.title,
    article.summary,
    article.sourceName,
    article.sourceDomain,
    ...(article.matchedTickers ?? []),
    ...(article.matchedCompanies ?? []),
    ...(article.matchedThemes ?? []),
    ...(article.reasons ?? []),
  ]
    .join(" ")
    .toLowerCase();
}

function categoryMatches(article: PublicArticle, category: CategoryId) {
  if (category === "all") return true;
  if (category === "priority") return article.shouldAlert;

  const text = searchableText(article);
  const terms: Record<Exclude<CategoryId, "all" | "priority">, string[]> = {
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
      "portfolio",
      "exchange",
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
      "regulation",
      "regulatory",
      "federal reserve",
      "fed ",
      "policy",
      "government",
      "sec ",
      "enforcement",
      "filing",
    ],
    "digital-assets": [
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
      "planning",
      "advisor",
      "communication",
      "suitability",
      "behavior",
    ],
  };

  return terms[category].some((term) => text.includes(term));
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-subtle)]">
            {label}
          </div>
          <div className="mt-2 truncate text-2xl font-black tracking-[-0.035em] text-[var(--slice-heading)]">
            {value}
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-[var(--slice-muted)]">
            {helper}
          </div>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-700/15 bg-white text-emerald-800">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ article, featured }: { article: PublicArticle; featured: boolean }) {
  const external = safeExternalUrl(article.link);
  const content = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cx(
            "rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em]",
            article.shouldAlert
              ? "border-amber-700/20 bg-amber-50 text-amber-950"
              : "border-emerald-700/15 bg-emerald-50 text-emerald-900",
          )}
        >
          {article.shouldAlert ? "Priority review" : article.urgency}
        </span>
        <span className="rounded-full border border-emerald-950/10 bg-white px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em] text-[var(--slice-subtle)]">
          Score {Math.round(article.score)}
        </span>
      </div>

      <h3
        className={cx(
          "mt-5 font-black tracking-[-0.035em] text-[var(--slice-heading)]",
          featured ? "text-2xl sm:text-3xl" : "text-xl",
        )}
      >
        {article.title}
      </h3>
      <p className="mt-3 line-clamp-4 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
        {article.summary || "No summary was supplied by the completed intelligence edition."}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {[...(article.matchedTickers ?? []), ...(article.matchedThemes ?? [])]
          .slice(0, 5)
          .map((item) => (
            <span
              key={item}
              className="rounded-full border border-emerald-950/10 bg-[var(--slice-surface-muted)] px-2.5 py-1 text-[9px] font-bold text-[var(--slice-muted)]"
            >
              {item}
            </span>
          ))}
      </div>

      <div className="mt-auto flex items-end justify-between gap-4 pt-6">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-800">
            {article.sourceName}
          </div>
          <div className="mt-1 text-[9px] font-bold text-[var(--slice-subtle)]">
            {relativeTime(article.publishedAt)}
          </div>
        </div>
        {external ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-800">
            Read source
            <ExternalLink className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ShieldCheck className="h-4 w-4 text-emerald-700" />
        )}
      </div>
    </>
  );

  const classes = cx(
    "group flex h-full flex-col rounded-[1.7rem] border border-emerald-950/10 bg-white p-5 shadow-[0_18px_55px_rgba(6,78,55,0.08)] transition",
    external && "hover:-translate-y-0.5 hover:border-emerald-700/25 hover:shadow-[0_22px_65px_rgba(6,78,55,0.12)]",
    featured && "sm:p-7",
  );

  return external ? (
    <a
      href={external}
      target="_blank"
      rel="noreferrer noopener"
      className={classes}
    >
      {content}
    </a>
  ) : (
    <article className={classes}>{content}</article>
  );
}

export default function DailyIntelligenceFeed() {
  const [snapshot, setSnapshot] = useState<PublicIntelligenceSnapshot | null>(null);
  const [status, setStatus] = useState<FeedStatus>("idle");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId>("all");
  const snapshotRef = useRef(snapshot);
  const requestSequence = useRef(0);
  const requestInFlight = useRef(false);
  const requestAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const refresh = useCallback(async (manual = false) => {
    if (requestInFlight.current) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("This device is offline. The most recent retained edition remains visible.");
      setStatus((current) => (current === "idle" ? "error" : current));
      return;
    }

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    requestInFlight.current = true;
    setStatus(snapshotRef.current ? "refreshing" : "loading");
    if (manual) setError("");

    const controller = new AbortController();
    requestAbort.current?.abort();
    requestAbort.current = controller;

    try {
      const response = await fetch("/api/intelligence/daily", {
        cache: manual ? "no-store" : "default",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const payload = await readJson<DailyPayload>(response);

      if (requestId !== requestSequence.current) return;
      if (!response.ok || payload.ok === false) {
        throw new Error(
          clean(payload.error) ||
            `Daily intelligence returned HTTP ${response.status}.`,
        );
      }

      const normalized = normalizeSnapshot(payload);
      snapshotRef.current = normalized;
      setSnapshot(normalized);
      setError("");
      setStatus("ready");
      storeSnapshot(normalized);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (requestId !== requestSequence.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "The completed daily intelligence edition is temporarily unavailable.",
      );
      setStatus(snapshotRef.current ? "ready" : "error");
    } finally {
      if (requestId === requestSequence.current) {
        requestInFlight.current = false;
        if (requestAbort.current === controller) requestAbort.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const cached = readStoredSnapshot();
    if (cached) {
      snapshotRef.current = cached;
      setSnapshot(cached);
      setStatus("ready");
    }

    void refresh(false);

    return () => {
      requestSequence.current += 1;
      requestInFlight.current = false;
      requestAbort.current?.abort();
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (snapshot?.items ?? []).filter((article) => {
      if (!categoryMatches(article, category)) return false;
      if (!normalizedQuery) return true;
      return searchableText(article).includes(normalizedQuery);
    });
  }, [category, query, snapshot?.items]);

  const sourceHealth = useMemo(() => {
    const sources = snapshot?.sources ?? [];
    return {
      online: sources.filter((source) => source.ok).length,
      total: sources.length,
      fetched: sources.reduce((sum, source) => sum + source.fetched, 0),
    };
  }, [snapshot?.sources]);

  const activeCategory =
    CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0];

  return (
    <section className="rounded-[2rem] border border-emerald-950/10 bg-white/88 p-4 shadow-[0_24px_80px_rgba(6,78,55,0.11)] backdrop-blur-xl sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-900">
            <Newspaper className="h-3.5 w-3.5" />
            Completed daily edition
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-4xl">
            Sourced intelligence without a visit-triggered provider scan.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--slice-muted)]">
            This page reads the retained scheduled edition, keeps source evidence
            attached, and filters six selected stories locally after the first response.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh(true)}
          disabled={status === "loading" || status === "refreshing"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-950/15 bg-white px-4 py-3 text-sm font-black text-emerald-950 shadow-sm transition hover:border-emerald-700/30 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw
            className={cx(
              "h-4 w-4",
              (status === "loading" || status === "refreshing") && "animate-spin",
            )}
          />
          {status === "refreshing" ? "Refreshing" : "Refresh edition"}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Edition"
          value={snapshot?.dateKey || "Loading"}
          helper={snapshot ? formatDateTime(snapshot.generatedAt) : "Waiting for retained edition"}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <Metric
          label="Selected stories"
          value={snapshot ? String(snapshot.items.length) : "—"}
          helper="Fixed public article limit"
          icon={<Sparkles className="h-4 w-4" />}
        />
        <Metric
          label="Source health"
          value={sourceHealth.total ? `${sourceHealth.online}/${sourceHealth.total}` : "—"}
          helper={`${sourceHealth.fetched} source items evaluated`}
          icon={<Globe2 className="h-4 w-4" />}
        />
        <Metric
          label="Priority review"
          value={snapshot ? String(snapshot.alertCandidates.length) : "—"}
          helper={snapshot ? `${snapshot.storage} retained edition` : "Awaiting edition"}
          icon={<BellRing className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-700/20 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-black">Edition notice</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      ) : null}

      {snapshot?.warnings.length ? (
        <details className="mt-4 rounded-2xl border border-amber-700/15 bg-amber-50/70 p-4">
          <summary className="cursor-pointer text-xs font-black text-amber-950">
            Edition warnings ({snapshot.warnings.length})
          </summary>
          <ul className="mt-3 grid gap-2 text-xs font-semibold leading-6 text-amber-950">
            {snapshot.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className="mt-6 grid gap-4 rounded-[1.6rem] border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
          <input
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setQuery(event.target.value)
            }
            placeholder="Search titles, themes, tickers, companies, or sources"
            aria-label="Search daily intelligence"
            className="min-h-12 w-full rounded-xl border border-emerald-950/15 bg-white pl-11 pr-4 text-sm font-semibold text-[var(--slice-heading)] shadow-sm outline-none transition placeholder:text-[var(--slice-subtle)] focus:border-emerald-700/35 focus:ring-2 focus:ring-emerald-600/15"
          />
        </label>
        <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--slice-subtle)]">
          <Filter className="h-3.5 w-3.5 text-emerald-700" />
          {filtered.length} matching stories
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            aria-pressed={category === item.id}
            className={cx(
              "shrink-0 rounded-full border px-3.5 py-2 text-[10px] font-black transition",
              category === item.id
                ? "border-emerald-800/20 bg-emerald-700 text-white shadow-sm"
                : "border-emerald-950/10 bg-white text-[var(--slice-muted)] hover:border-emerald-700/25 hover:bg-emerald-50",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs font-semibold leading-6 text-[var(--slice-muted)]">
        {activeCategory.description}
      </p>

      {!snapshot?.items.length ? (
        <div className="mt-6 grid min-h-[22rem] place-items-center rounded-[1.6rem] border border-emerald-950/10 bg-[var(--slice-surface-muted)] text-center">
          <div className="max-w-md px-6">
            {status === "error" ? (
              <AlertTriangle className="mx-auto h-8 w-8 text-amber-800" />
            ) : (
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
            )}
            <h3 className="mt-4 text-xl font-black text-[var(--slice-heading)]">
              {status === "error"
                ? "The scheduled edition is unavailable."
                : "Loading the completed intelligence edition…"}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
              {status === "error"
                ? "Confirm the scheduled intelligence job and retained snapshot, then refresh this page."
                : "The page shell is already usable while one cached public response completes."}
            </p>
          </div>
        </div>
      ) : filtered.length ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filtered.map((article, index) => (
            <ArticleCard
              key={article.id || `${article.sourceName}:${article.title}`}
              article={article}
              featured={index === 0 && category === "all" && !query}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.6rem] border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-8 text-center">
          <Target className="mx-auto h-8 w-8 text-emerald-700" />
          <h3 className="mt-4 text-xl font-black text-[var(--slice-heading)]">
            No stories match this view.
          </h3>
          <p className="mt-2 text-sm font-semibold text-[var(--slice-muted)]">
            Change the category or clear the search field to restore the full edition.
          </p>
        </div>
      )}

      {snapshot?.sources.length ? (
        <details className="mt-6 rounded-[1.6rem] border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4 sm:p-5">
          <summary className="cursor-pointer text-sm font-black text-[var(--slice-heading)]">
            Inspect source health and retrieval counts
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.sources.map((source) => (
              <div
                key={source.id}
                className="rounded-2xl border border-emerald-950/10 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[var(--slice-heading)]">
                      {source.name}
                    </div>
                    <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.13em] text-[var(--slice-subtle)]">
                      {source.provider}
                    </div>
                  </div>
                  {source.ok ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-800" />
                  )}
                </div>
                <div className="mt-3 text-xs font-semibold text-[var(--slice-muted)]">
                  {source.fetched} items · checked {relativeTime(source.checkedAt)}
                </div>
                {source.error ? (
                  <div className="mt-2 text-xs font-semibold leading-5 text-amber-900">
                    {source.error}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}