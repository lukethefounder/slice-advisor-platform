"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BellRing,
  Check,
  CircleDollarSign,
  Clock3,
  Eye,
  FolderPlus,
  Gauge,
  Layers3,
  Loader2,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  useRealtimeMarket,
  type RealtimeAssetSnapshot,
} from "@/hooks/useRealtimeMarket";

type WatchlistItem = {
  id: string;
  watchlistId: string;
  symbol: string;
  assetName: string;
  assetType: string;
  sourceType: string;
  sourceId: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  originalScore: number | null;
  thesis: string | null;
  riskNotes: string | null;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
};

type Watchlist = {
  id: string;
  name: string;
  description: string | null;
  focus: string;
  riskLevel: string;
  createdAt: string;
  updatedAt: string;
  items: WatchlistItem[];
};

type Alert = {
  id: string;
  title: string;
  body: string;
  source: string;
  ticker: string | null;
  urgency: string;
  score: number;
  status: string;
  createdAt: string;
  sourceUrl: string | null;
  aiBriefing: string | null;
  suggestedSymbol: string;
  suggestedAssetType: string;
  alreadySaved: boolean;
  inPortfolio: boolean;
};

type Decision = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceTier: string;
  url: string | null;
  category: string;
  subcategory: string;
  importanceTier: string;
  action: string;
  urgency: string;
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  createdAt: string;
  matchedTickers: string[];
  matchedAreas: string[];
  reasons: string[];
  channels: string[];
  suggestedSymbol: string;
  suggestedAssetType: string;
  alreadySaved: boolean;
  inPortfolio: boolean;
};

type Holding = {
  id: string;
  symbol: string;
  assetName: string;
  assetClass: string;
  valueNumber: number;
  riskLevel: string;
};

type WatchlistResponse = {
  watchlists: Watchlist[];
  alerts: Alert[];
  decisions: Decision[];
  holdings: Holding[];
  aggregate: {
    watchlistCount: number;
    itemCount: number;
    stockCount: number;
    cryptoCount: number;
    savedFromAlerts: number;
    savedFromScans: number;
    portfolioOverlapCount: number;
  };
};

type View = "watchlists" | "alerts" | "scans" | "portfolio";
type Tone = "red" | "green" | "amber" | "cyan" | "purple" | "slate";

const INPUT =
  "w-full min-w-0 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-50";

const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-xs font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:opacity-40";

const SOFT =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-40";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeSymbol(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^\$/, "");
}

function money(value: number | null | undefined, maximumFractionDigits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
  }).format(value);
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function shortDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function shortDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusTone(value: string | number): Tone {
  const text = String(value).toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    text.includes("live") ||
    text.includes("active") ||
    text.includes("watching") ||
    text.includes("complete") ||
    (!Number.isNaN(numeric) && numeric >= 80)
  ) {
    return "green";
  }

  if (
    text.includes("stale") ||
    text.includes("critical") ||
    text.includes("removed") ||
    (!Number.isNaN(numeric) && numeric < 45)
  ) {
    return "red";
  }

  if (
    text.includes("delayed") ||
    text.includes("closed") ||
    text.includes("pending") ||
    text.includes("high") ||
    (!Number.isNaN(numeric) && numeric >= 45 && numeric < 65)
  ) {
    return "amber";
  }

  if (text.includes("scan") || text.includes("ai") || text.includes("crypto")) {
    return "purple";
  }

  if (text.includes("alpha") || text.includes("provider") || text.includes("medium")) {
    return "cyan";
  }

  return "slate";
}

function toneClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    red: "border-red-400/25 bg-red-400/10 text-red-100",
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-100",
    cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
    purple: "border-violet-400/25 bg-violet-400/10 text-violet-100",
    slate: "border-white/10 bg-white/[0.055] text-slate-300",
  };

  return classes[tone];
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        toneClass(tone)
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "min-w-0 overflow-hidden rounded-[1.8rem] border border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.045] p-4">
      <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-red-600/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 truncate text-3xl font-black">{value}</div>
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {helper}
          </div>
        </div>

        <div className="shrink-0 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function LiveSnapshot({
  snapshot,
  compact = false,
}: {
  snapshot: RealtimeAssetSnapshot | null;
  compact?: boolean;
}) {
  if (!snapshot) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-3 text-xs font-bold text-slate-600">
        Alpha Vantage quote unavailable
      </div>
    );
  }

  const positive = (snapshot.changePercent ?? 0) >= 0;

  return (
    <div className="min-w-0 rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] p-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cx("font-black text-white", compact ? "text-xl" : "text-2xl")}>
            {money(snapshot.price, snapshot.price < 10 ? 6 : 2)}
          </div>
          <div
            className={cx(
              "mt-1 text-xs font-black",
              positive ? "text-emerald-300" : "text-red-300"
            )}
          >
            {percent(snapshot.changePercent)}
          </div>
        </div>

        <div className="grid justify-items-end gap-1.5">
          <Badge tone={statusTone(snapshot.marketState)}>{snapshot.marketState}</Badge>
          <Badge tone="cyan">Alpha Vantage</Badge>
        </div>
      </div>

      {!compact ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-black/25 p-2.5">
              <div className="font-black uppercase text-slate-600">Volume</div>
              <div className="mt-1 font-black text-slate-200">
                {compactNumber(snapshot.volume)}
              </div>
            </div>
            <div className="rounded-xl bg-black/25 p-2.5">
              <div className="font-black uppercase text-slate-600">Quality</div>
              <div className="mt-1 font-black text-slate-200">
                {snapshot.qualityScore}/100
              </div>
            </div>
          </div>

          <div className="mt-3 text-[11px] font-semibold leading-5 text-cyan-50/65">
            {snapshot.technicals.technicalSummary}
          </div>
        </>
      ) : null}

      <div className="mt-2 truncate text-[10px] font-bold text-slate-600">
        As of {shortDateTime(snapshot.providerTimestamp ?? snapshot.receivedAt)}
      </div>
    </div>
  );
}

export default function WatchlistsPage() {
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [activeView, setActiveView] = useState<View>("watchlists");
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [search, setSearch] = useState("");

  const [watchlistForm, setWatchlistForm] = useState({
    name: "",
    description: "",
    focus: "General",
    riskLevel: "Mixed",
  });

  const [manualForm, setManualForm] = useState({
    symbol: "",
    assetName: "",
    assetType: "Stock",
    thesis: "",
    riskNotes: "",
    priority: "Medium",
  });

  const watchlists = data?.watchlists ?? [];
  const alerts = data?.alerts ?? [];
  const decisions = data?.decisions ?? [];
  const holdings = data?.holdings ?? [];

  const selectedWatchlist = useMemo(
    () =>
      watchlists.find((watchlist) => watchlist.id === selectedWatchlistId) ??
      watchlists[0] ??
      null,
    [watchlists, selectedWatchlistId]
  );

  const marketSymbols = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...watchlists.flatMap((watchlist) => watchlist.items.map((item) => item.symbol)),
          ...holdings.map((holding) => holding.symbol),
          ...alerts.map((alert) => alert.suggestedSymbol || alert.ticker || ""),
          ...decisions.map((decision) => decision.suggestedSymbol || ""),
        ]
          .map(normalizeSymbol)
          .filter(Boolean)
      )
    ).slice(0, 100);
  }, [watchlists, alerts, decisions, holdings]);

  const market = useRealtimeMarket(marketSymbols, {
    provider: "alphavantage",
    strictProvider: true,
    persist: true,
    intervalMs: 30_000,
    enabled: marketSymbols.length > 0,
  });

  const snapshotMap = useMemo(
    () => new Map(market.snapshots.map((snapshot) => [snapshot.symbol, snapshot])),
    [market.snapshots]
  );

  const liveCoverage = marketSymbols.length
    ? Math.round((market.snapshots.length / marketSymbols.length) * 100)
    : 0;

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const items = selectedWatchlist?.items ?? [];

    return items.filter(
      (item) =>
        !query ||
        [
          item.symbol,
          item.assetName,
          item.assetType,
          item.sourceType,
          item.thesis,
          item.riskNotes,
          item.status,
          item.priority,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query)
    );
  }, [selectedWatchlist, search]);

  async function loadData(silent = false) {
    if (!silent) {
      setLoading(true);
    }

    try {
      const response = await fetch("/api/watchlists", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load watchlists.");
      }

      setData(payload);

      if (!selectedWatchlistId && payload.watchlists?.[0]?.id) {
        setSelectedWatchlistId(payload.watchlists[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load watchlists.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function postAction(body: Record<string, unknown>) {
    setWorking(true);
    setMessage("");

    try {
      const response = await fetch("/api/watchlists", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "watchlist-action"),
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? payload.detail ?? "Watchlist action failed.");
      }

      setData(payload);

      if (!selectedWatchlistId && payload.watchlists?.[0]?.id) {
        setSelectedWatchlistId(payload.watchlists[0].id);
      }

      return payload as WatchlistResponse;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Watchlist action failed.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function createWatchlist(event: FormEvent) {
    event.preventDefault();

    if (!watchlistForm.name.trim()) {
      setMessage("Watchlist name is required.");
      return;
    }

    const payload = await postAction({
      action: "createWatchlist",
      ...watchlistForm,
    });

    if (payload) {
      const created = payload.watchlists.find(
        (watchlist) => watchlist.name === watchlistForm.name.trim()
      );

      if (created) {
        setSelectedWatchlistId(created.id);
      }

      setWatchlistForm({
        name: "",
        description: "",
        focus: "General",
        riskLevel: "Mixed",
      });
      setMessage("Watchlist created.");
    }
  }

  async function saveManual(event: FormEvent) {
    event.preventDefault();

    if (!manualForm.symbol.trim()) {
      setMessage("Symbol is required.");
      return;
    }

    const payload = await postAction({
      action: "saveManualItem",
      watchlistId: selectedWatchlist?.id,
      ...manualForm,
    });

    if (payload) {
      setManualForm({
        symbol: "",
        assetName: "",
        assetType: "Stock",
        thesis: "",
        riskNotes: "",
        priority: "Medium",
      });
      setMessage("Item saved. Alpha Vantage polling will include it automatically.");
    }
  }

  async function saveAlert(alert: Alert) {
    const symbol =
      alert.suggestedSymbol ||
      normalizeSymbol(alert.ticker) ||
      window.prompt("Enter a symbol for this alert:", "") ||
      "";

    if (!symbol.trim()) {
      return;
    }

    const payload = await postAction({
      action: "saveFromAlert",
      watchlistId: selectedWatchlist?.id,
      alertId: alert.id,
      symbol,
    });

    if (payload) {
      setMessage(`${normalizeSymbol(symbol)} saved from alert.`);
    }
  }

  async function saveDecision(decision: Decision) {
    const symbol =
      decision.suggestedSymbol ||
      decision.matchedTickers?.[0] ||
      window.prompt("Enter a symbol for this scan result:", "") ||
      "";

    if (!symbol.trim()) {
      return;
    }

    const payload = await postAction({
      action: "saveFromDecision",
      watchlistId: selectedWatchlist?.id,
      decisionId: decision.id,
      symbol,
    });

    if (payload) {
      setMessage(`${normalizeSymbol(symbol)} saved from scan result.`);
    }
  }

  async function updateItemStatus(itemId: string, status: string) {
    const payload = await postAction({
      action: "updateItemStatus",
      itemId,
      status,
    });

    if (payload) {
      setMessage(`Item marked ${status}.`);
    }
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm("Remove this item from the watchlist?")) {
      return;
    }

    const payload = await postAction({
      action: "deleteItem",
      itemId,
    });

    if (payload) {
      setMessage("Item removed from watchlist.");
    }
  }

  useEffect(() => {
    void loadData();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadData(true);
      }
    }, 120_000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      watchlists.length &&
      !watchlists.some((watchlist) => watchlist.id === selectedWatchlistId)
    ) {
      setSelectedWatchlistId(watchlists[0].id);
    }
  }, [watchlists, selectedWatchlistId]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050505] text-white">
        <div className="flex items-center gap-3 text-sm font-black uppercase tracking-[0.18em] text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-red-400" />
          Loading Alpha Vantage watchlists
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-white md:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(153,27,27,0.46),transparent_30%),radial-gradient(circle_at_86%_8%,rgba(6,182,212,0.12),transparent_25%),linear-gradient(145deg,#030303,#09090b_48%,#111827)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative mx-auto grid max-w-[1900px] gap-5">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/25 backdrop-blur-xl md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-red-400">
                <Radar className="h-4 w-4" />
                SLICE Alpha Watchlists
              </div>

              <h1 className="mt-3 break-words text-4xl font-black tracking-tight md:text-6xl">
                Watch every idea against the live market.
              </h1>

              <p className="mt-3 max-w-4xl text-sm font-medium leading-7 text-slate-400 md:text-base">
                Saved ideas, alerts, scans, and portfolio holdings continuously refresh through
                the paid Alpha Vantage key. No alternate provider or demo price is accepted in
                this workspace.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void market.refresh()}
                disabled={market.loading || !marketSymbols.length}
                className={SOFT}
              >
                <RefreshCw className={cx("h-4 w-4", market.loading && "animate-spin")} />
                Refresh prices
              </button>

              <a
                href="/workspace"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 hover:bg-red-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to workspace
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        ) : null}

        {market.error ? (
          <div className="rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm font-bold leading-6 text-red-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alpha Vantage refresh failed
            </div>
            <div className="mt-2 text-red-100/75">{market.error}</div>
          </div>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Tracked symbols"
            value={marketSymbols.length}
            helper="Across all watch sources"
            icon={<Eye className="h-5 w-5" />}
          />
          <Metric
            label="Live coverage"
            value={`${liveCoverage}%`}
            helper={`${market.snapshots.length}/${marketSymbols.length || 0} returned`}
            icon={<Activity className="h-5 w-5" />}
          />
          <Metric
            label="Live now"
            value={market.data?.realtimeCount ?? 0}
            helper="Current market session"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <Metric
            label="Stale"
            value={market.data?.staleCount ?? 0}
            helper="Provider timestamp warning"
            icon={<Clock3 className="h-5 w-5" />}
          />
          <Metric
            label="Provider"
            value="Alpha Vantage"
            helper={
              market.lastUpdatedAt
                ? `Updated ${shortDateTime(market.lastUpdatedAt.toISOString())}`
                : "Waiting for first refresh"
            }
            icon={<ShieldCheck className="h-5 w-5" />}
          />
        </section>

        <nav className="grid gap-2 rounded-[1.6rem] border border-white/10 bg-black/55 p-2 md:grid-cols-4">
          {(
            [
              ["watchlists", "Watchlists", `${data?.aggregate.itemCount ?? 0} saved`, Layers3],
              ["alerts", "Alerts", `${alerts.length} ranked`, BellRing],
              ["scans", "Scans", `${decisions.length} decisions`, Sparkles],
              ["portfolio", "Portfolio", `${holdings.length} holdings`, WalletCards],
            ] as const
          ).map(([key, label, helper, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key)}
              className={cx(
                "rounded-2xl px-4 py-3 text-left transition",
                activeView === key
                  ? "bg-white text-zinc-950"
                  : "text-slate-300 hover:bg-white/[0.06]"
              )}
            >
              <div className="flex items-center gap-2 text-sm font-black">
                <Icon className="h-4 w-4" />
                {label}
              </div>
              <div className={cx("mt-1 text-xs", activeView === key ? "text-slate-600" : "text-slate-500")}>
                {helper}
              </div>
            </button>
          ))}
        </nav>

        {activeView === "watchlists" ? (
          <div className="grid gap-5 2xl:grid-cols-[320px_minmax(0,1fr)_390px]">
            <Panel className="h-fit 2xl:sticky 2xl:top-5">
              <div className="border-b border-white/10 p-5">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                  Named lists
                </div>
                <h2 className="mt-2 text-2xl font-black">Select a watchlist</h2>
              </div>

              <div className="max-h-[430px] space-y-2 overflow-y-auto p-3">
                {watchlists.map((watchlist) => (
                  <button
                    key={watchlist.id}
                    type="button"
                    onClick={() => setSelectedWatchlistId(watchlist.id)}
                    className={cx(
                      "w-full rounded-2xl border p-4 text-left",
                      selectedWatchlist?.id === watchlist.id
                        ? "border-red-400/40 bg-red-500/10"
                        : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black">{watchlist.name}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {watchlist.focus} · {watchlist.items.length} items
                        </div>
                      </div>
                      <Badge tone={statusTone(watchlist.riskLevel)}>{watchlist.riskLevel}</Badge>
                    </div>
                  </button>
                ))}
              </div>

              <form onSubmit={createWatchlist} className="grid gap-3 border-t border-white/10 p-4">
                <div className="flex items-center gap-2 text-xs font-black text-slate-300">
                  <FolderPlus className="h-4 w-4" />
                  New watchlist
                </div>
                <input
                  value={watchlistForm.name}
                  onChange={(event) =>
                    setWatchlistForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Name"
                  className={INPUT}
                />
                <textarea
                  value={watchlistForm.description}
                  onChange={(event) =>
                    setWatchlistForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Description"
                  className={cx(INPUT, "min-h-[76px]")}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={watchlistForm.focus}
                    onChange={(event) =>
                      setWatchlistForm((current) => ({ ...current, focus: event.target.value }))
                    }
                    placeholder="Focus"
                    className={INPUT}
                  />
                  <select
                    value={watchlistForm.riskLevel}
                    onChange={(event) =>
                      setWatchlistForm((current) => ({
                        ...current,
                        riskLevel: event.target.value,
                      }))
                    }
                    className={INPUT}
                  >
                    <option>Conservative</option>
                    <option>Moderate</option>
                    <option>Aggressive</option>
                    <option>Mixed</option>
                  </select>
                </div>
                <button disabled={working} className={PRIMARY}>
                  {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create list
                </button>
              </form>
            </Panel>

            <Panel>
              <div className="border-b border-white/10 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
                      Live Alpha Vantage board
                    </div>
                    <h2 className="mt-2 truncate text-3xl font-black">
                      {selectedWatchlist?.name ?? "No watchlist"}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {selectedWatchlist?.description || "Save symbols to begin continuous market monitoring."}
                    </p>
                  </div>

                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search this watchlist"
                      className={cx(INPUT, "pl-10")}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const symbol = normalizeSymbol(item.symbol);
                  const snapshot = snapshotMap.get(symbol) ?? null;

                  return (
                    <article
                      key={item.id}
                      className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-2xl font-black">{symbol}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">
                            {item.assetName} · {item.assetType}
                          </div>
                        </div>
                        <Badge tone={statusTone(item.priority)}>{item.priority}</Badge>
                      </div>

                      <div className="mt-4">
                        <LiveSnapshot snapshot={snapshot} />
                      </div>

                      {item.thesis ? (
                        <p className="mt-4 line-clamp-3 text-xs leading-5 text-slate-400">
                          {item.thesis}
                        </p>
                      ) : null}

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                        <Badge tone={statusTone(item.sourceType)}>{item.sourceType}</Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <select
                          value={item.status}
                          onChange={(event) =>
                            void updateItemStatus(item.id, event.target.value)
                          }
                          disabled={working}
                          className={INPUT}
                        >
                          <option>Watching</option>
                          <option>Action Needed</option>
                          <option>Reviewed</option>
                          <option>Complete</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => void deleteItem(item.id)}
                          disabled={working}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-400/10 px-3 text-xs font-black text-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}

                {!filteredItems.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500 md:col-span-2 xl:col-span-3">
                    No symbols match this watchlist view.
                  </div>
                ) : null}
              </div>
            </Panel>

            <Panel className="h-fit 2xl:sticky 2xl:top-5">
              <div className="border-b border-white/10 p-5">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                  <Plus className="h-3.5 w-3.5" />
                  Add symbol
                </div>
                <h2 className="mt-2 text-2xl font-black">Start live monitoring</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  New symbols enter the next Alpha Vantage refresh automatically.
                </p>
              </div>

              <form onSubmit={saveManual} className="grid gap-3 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={manualForm.symbol}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        symbol: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="Ticker"
                    className={INPUT}
                  />
                  <select
                    value={manualForm.assetType}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        assetType: event.target.value,
                      }))
                    }
                    className={INPUT}
                  >
                    <option>Stock</option>
                    <option>ETF</option>
                    <option>Crypto</option>
                  </select>
                </div>
                <input
                  value={manualForm.assetName}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      assetName: event.target.value,
                    }))
                  }
                  placeholder="Asset name"
                  className={INPUT}
                />
                <textarea
                  value={manualForm.thesis}
                  onChange={(event) =>
                    setManualForm((current) => ({ ...current, thesis: event.target.value }))
                  }
                  placeholder="Investment or monitoring thesis"
                  className={cx(INPUT, "min-h-[90px]")}
                />
                <textarea
                  value={manualForm.riskNotes}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      riskNotes: event.target.value,
                    }))
                  }
                  placeholder="Risk notes"
                  className={cx(INPUT, "min-h-[76px]")}
                />
                <select
                  value={manualForm.priority}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  className={INPUT}
                >
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                  <option>Critical</option>
                </select>
                <button disabled={working || !selectedWatchlist} className={PRIMARY}>
                  {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                  Save and monitor
                </button>
              </form>
            </Panel>
          </div>
        ) : null}

        {activeView === "alerts" ? (
          <Panel>
            <div className="border-b border-white/10 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">
                Alert intelligence
              </div>
              <h2 className="mt-2 text-3xl font-black">Ranked alerts with live market context</h2>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-2 2xl:grid-cols-3">
              {alerts.map((alert) => {
                const symbol = normalizeSymbol(alert.suggestedSymbol || alert.ticker);
                const snapshot = symbol ? snapshotMap.get(symbol) ?? null : null;

                return (
                  <article key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={statusTone(alert.urgency)}>{alert.urgency}</Badge>
                          {symbol ? <Badge tone="cyan">{symbol}</Badge> : null}
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-lg font-black">{alert.title}</h3>
                      </div>
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-400/25 bg-red-400/10 text-lg font-black">
                        {alert.score}
                      </div>
                    </div>

                    {symbol ? (
                      <div className="mt-4">
                        <LiveSnapshot snapshot={snapshot} compact />
                      </div>
                    ) : null}

                    <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-400">
                      {alert.aiBriefing || alert.body}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveAlert(alert)}
                        disabled={working || alert.alreadySaved}
                        className={PRIMARY}
                      >
                        {alert.alreadySaved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {alert.alreadySaved ? "Saved" : "Save to watchlist"}
                      </button>
                      {alert.sourceUrl ? (
                        <a href={alert.sourceUrl} target="_blank" rel="noreferrer" className={SOFT}>
                          Open source
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>
        ) : null}

        {activeView === "scans" ? (
          <Panel>
            <div className="border-b border-white/10 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">
                Ranked scan decisions
              </div>
              <h2 className="mt-2 text-3xl font-black">Research signals verified against live prices</h2>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-2 2xl:grid-cols-3">
              {decisions.map((decision) => {
                const symbol = normalizeSymbol(
                  decision.suggestedSymbol || decision.matchedTickers?.[0]
                );
                const snapshot = symbol ? snapshotMap.get(symbol) ?? null : null;

                return (
                  <article key={decision.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={statusTone(decision.urgency)}>{decision.urgency}</Badge>
                          {symbol ? <Badge tone="cyan">{symbol}</Badge> : null}
                        </div>
                        <h3 className="mt-3 line-clamp-2 text-lg font-black">{decision.title}</h3>
                        <div className="mt-1 text-xs font-semibold text-slate-600">
                          {decision.sourceName} · {decision.category}
                        </div>
                      </div>
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-violet-400/25 bg-violet-400/10 text-lg font-black">
                        {decision.score}
                      </div>
                    </div>

                    {symbol ? (
                      <div className="mt-4">
                        <LiveSnapshot snapshot={snapshot} compact />
                      </div>
                    ) : null}

                    <p className="mt-4 line-clamp-4 text-sm leading-6 text-slate-400">
                      {decision.summary || "No scan summary supplied."}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                      {[
                        ["Materiality", decision.materialityScore],
                        ["Relevance", decision.relevanceScore],
                        ["Trust", decision.trustScore],
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-xl bg-black/25 p-2.5">
                          <div className="text-[9px] font-black uppercase text-slate-600">{label}</div>
                          <div className="mt-1 font-black">{value}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveDecision(decision)}
                        disabled={working || decision.alreadySaved}
                        className={PRIMARY}
                      >
                        {decision.alreadySaved ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {decision.alreadySaved ? "Saved" : "Save to watchlist"}
                      </button>
                      {decision.url ? (
                        <a href={decision.url} target="_blank" rel="noreferrer" className={SOFT}>
                          Open source
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>
        ) : null}

        {activeView === "portfolio" ? (
          <Panel>
            <div className="border-b border-white/10 p-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                Portfolio overlap
              </div>
              <h2 className="mt-2 text-3xl font-black">Holdings with continuous Alpha Vantage pricing</h2>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {holdings.map((holding) => {
                const symbol = normalizeSymbol(holding.symbol);
                const snapshot = snapshotMap.get(symbol) ?? null;

                return (
                  <article key={holding.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-2xl font-black">{symbol}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {holding.assetName} · {holding.assetClass}
                        </div>
                      </div>
                      <Badge tone={statusTone(holding.riskLevel)}>{holding.riskLevel}</Badge>
                    </div>

                    <div className="mt-4">
                      <LiveSnapshot snapshot={snapshot} />
                    </div>

                    <div className="mt-4 rounded-xl bg-black/25 p-3">
                      <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                        Recorded holding value
                      </div>
                      <div className="mt-1 text-xl font-black">{money(holding.valueNumber, 0)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>
        ) : null}

        <footer className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs font-semibold text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Prices refresh every 30 seconds while this tab is visible. The provider route rejects
            non-Alpha Vantage snapshots in strict mode.
          </span>
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5" />
            {market.data?.warnings?.[0] || "Alpha Vantage strict mode active"}
          </div>
        </footer>
      </div>
    </main>
  );
}