"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";
type ViewMode = "command" | "lists" | "builder" | "technical" | "events";

type AlertCriteria = {
  alertStyle: string;
  requireAllCriteria: boolean;
  repeatCooldownMinutes: number;
  changePctAbove: number | null;
  changePctBelow: number | null;
  rsiAbove: number | null;
  rsiBelow: number | null;
  priceAboveSma20: boolean;
  priceBelowSma20: boolean;
  priceAboveSma50: boolean;
  priceBelowSma50: boolean;
  sma20AboveSma50: boolean;
  sma20BelowSma50: boolean;
  macdBullish: boolean;
  macdBearish: boolean;
  volumeSpikePctAbove: number | null;
  technicalScoreAbove: number | null;
  technicalScoreBelow: number | null;
  notes: string;
};

type WatchlistItem = {
  id: string;
  watchlistId: string;
  symbol: string;
  assetName: string;
  assetType: string;
  priority: string;
  status: string;
  thesis: string | null;
  riskNotes: string | null;
  alertCount?: number;
  activeAlertCount?: number;
  clientExposureCount?: number;
  watchlistName?: string;
};

type Watchlist = {
  id: string;
  name: string;
  description: string | null;
  focus: string;
  riskLevel: string;
  items: WatchlistItem[];
};

type PriceAlert = {
  id: string;
  watchlistId: string | null;
  watchlistItemId: string | null;
  symbol: string;
  assetName: string | null;
  upperTargetPrice: number | null;
  lowerTargetPrice: number | null;
  lastPrice: number | null;
  lastProvider: string | null;
  lastCheckedAt: string | null;
  triggeredHighAt: string | null;
  triggeredLowAt: string | null;
  triggerCount: number;
  notificationChannel: string;
  status: string;
  notes: string | null;
  criteria?: AlertCriteria;
  advancedCriteriaCount?: number;
  alertMeta?: {
    lastTechnicalTriggeredAt?: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

type AlertEvent = {
  id: string;
  symbol: string;
  triggerType: string;
  targetPrice: number;
  observedPrice: number;
  provider: string;
  message: string;
  createdAt: string;
};

type PriceAlertsPayload = {
  alerts: PriceAlert[];
  events: AlertEvent[];
  watchlists: Watchlist[];
  provider: {
    alphaVantageConfigured: boolean;
    quoteProvider: string;
    tradingViewMode: string;
    maxSymbolsPerCheck: number;
  };
  stats: {
    total: number;
    active: number;
    triggered: number;
    paused: number;
    technical: number;
    recentEvents: number;
    watchlists: number;
    symbols: number;
    clientExposedSymbols: number;
  };
  message?: string;
  check?: {
    checked: number;
    symbolsChecked: number;
    triggered: number;
    skipped: number;
    results: Array<Record<string, unknown>>;
  };
};

const DEFAULT_CRITERIA: AlertCriteria = {
  alertStyle: "Hybrid",
  requireAllCriteria: false,
  repeatCooldownMinutes: 240,
  changePctAbove: null,
  changePctBelow: null,
  rsiAbove: null,
  rsiBelow: null,
  priceAboveSma20: false,
  priceBelowSma20: false,
  priceAboveSma50: false,
  priceBelowSma50: false,
  sma20AboveSma50: false,
  sma20BelowSma50: false,
  macdBullish: false,
  macdBearish: false,
  volumeSpikePctAbove: null,
  technicalScoreAbove: null,
  technicalScoreBelow: null,
  notes: "",
};

const inputClass =
  "rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

const chartColors = ["#ef4444", "#06b6d4", "#a855f7", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cleanSymbols(value: string) {
  return Array.from(
    new Set(
      value
        .split(/,|\n|\s|\t/)
        .map((item) => item.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, ""))
        .filter(Boolean)
    )
  );
}

function toneFor(value: string | number | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    lower.includes("trigger") ||
    lower.includes("high") ||
    lower.includes("critical") ||
    lower.includes("delete") ||
    (!Number.isNaN(numeric) && numeric >= 85)
  ) {
    return "red";
  }

  if (
    lower.includes("active") ||
    lower.includes("checked") ||
    lower.includes("watching") ||
    lower.includes("dashboard") ||
    (!Number.isNaN(numeric) && numeric >= 70)
  ) {
    return "green";
  }

  if (
    lower.includes("pause") ||
    lower.includes("skip") ||
    lower.includes("medium") ||
    lower.includes("review") ||
    (!Number.isNaN(numeric) && numeric >= 50)
  ) {
    return "amber";
  }

  if (lower.includes("technical") || lower.includes("hybrid") || lower.includes("email")) {
    return "purple";
  }

  if (lower.includes("stock") || lower.includes("watch") || lower.includes("price")) {
    return "cyan";
  }

  return "slate";
}

function criteriaCount(criteria: AlertCriteria | undefined) {
  if (!criteria) return 0;

  return [
    criteria.changePctAbove !== null,
    criteria.changePctBelow !== null,
    criteria.rsiAbove !== null,
    criteria.rsiBelow !== null,
    criteria.priceAboveSma20,
    criteria.priceBelowSma20,
    criteria.priceAboveSma50,
    criteria.priceBelowSma50,
    criteria.sma20AboveSma50,
    criteria.sma20BelowSma50,
    criteria.macdBullish,
    criteria.macdBearish,
    criteria.volumeSpikePctAbove !== null,
    criteria.technicalScoreAbove !== null,
    criteria.technicalScoreBelow !== null,
  ].filter(Boolean).length;
}

function tradingViewSymbol(symbol: string) {
  if (!symbol) return "NASDAQ:AAPL";
  if (symbol.includes(":")) return symbol;
  return `NASDAQ:${symbol}`;
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10",
        className
      )}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 p-3 text-xs text-white shadow-xl shadow-black/40">
      <div className="mb-2 font-black text-slate-200">{label}</div>
      <div className="grid gap-1">
        {payload.map((item: any, index: number) => (
          <div key={`${item.dataKey}-${index}`} className="flex items-center justify-between gap-5">
            <span className="text-slate-400">{item.name || item.dataKey}</span>
            <span className="font-black text-white">
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradingViewChart({ symbol }: { symbol: string }) {
  const resolved = tradingViewSymbol(symbol);

  return (
    <iframe
      key={resolved}
      title={`TradingView ${resolved}`}
      src={`https://s.tradingview.com/widgetembed/?frameElementId=slice_watchlist_${encodeURIComponent(
        resolved
      )}&symbol=${encodeURIComponent(
        resolved
      )}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=131722&studies=%5B%22Volume%40tv-basicstudies%22%2C%22MASimple%40tv-basicstudies%22%2C%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D&theme=dark&style=1&timezone=America%2FPhoenix&withdateranges=1&hideideas=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&utm_source=slice.local&utm_medium=widget&utm_campaign=chart&utm_term=${encodeURIComponent(
        resolved
      )}`}
      className="h-[520px] w-full rounded-[1.5rem] border border-white/10 bg-black"
      allowFullScreen
    />
  );
}

export default function WatchlistAlertsPage() {
  const [data, setData] = useState<PriceAlertsPayload | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const [view, setView] = useState<ViewMode>("command");

  const [selectedWatchlistId, setSelectedWatchlistId] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [alertFilter, setAlertFilter] = useState("Active");
  const [query, setQuery] = useState("");

  const [listForm, setListForm] = useState({
    name: "",
    description: "",
    focus: "General",
    riskLevel: "Mixed",
  });

  const [bulkForm, setBulkForm] = useState({
    symbols: "",
    priority: "Medium",
    thesis: "",
    riskNotes: "",
  });

  const [alertForm, setAlertForm] = useState({
    watchlistId: "",
    watchlistItemId: "",
    symbol: "",
    assetName: "",
    upperTargetPrice: "",
    lowerTargetPrice: "",
    notificationChannel: "Dashboard",
    notes: "",
    priority: "Medium",
    thesis: "",
    riskNotes: "",
    criteria: DEFAULT_CRITERIA,
  });

  const watchlists = data?.watchlists ?? [];
  const alerts = data?.alerts ?? [];
  const events = data?.events ?? [];

  const allItems = useMemo(() => {
    return watchlists.flatMap((watchlist) =>
      watchlist.items.map((item) => ({
        ...item,
        watchlistName: watchlist.name,
      }))
    );
  }, [watchlists]);

  const selectedWatchlist =
    watchlists.find((watchlist) => watchlist.id === selectedWatchlistId) ??
    watchlists[0] ??
    null;

  const selectedItem =
    allItems.find((item) => item.symbol === selectedSymbol) ??
    allItems[0] ??
    null;

  const symbolAlerts = alerts.filter((alert) => alert.symbol === selectedSymbol);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();

    return allItems.filter((item) => {
      const searchMatch =
        !search ||
        item.symbol.toLowerCase().includes(search) ||
        item.assetName.toLowerCase().includes(search) ||
        item.watchlistName?.toLowerCase().includes(search) ||
        item.thesis?.toLowerCase().includes(search);

      const listMatch =
        !selectedWatchlistId || item.watchlistId === selectedWatchlistId;

      return searchMatch && listMatch;
    });
  }, [allItems, query, selectedWatchlistId]);

  const filteredAlerts = useMemo(() => {
    const search = query.trim().toLowerCase();

    return alerts.filter((alert) => {
      const searchMatch =
        !search ||
        alert.symbol.toLowerCase().includes(search) ||
        alert.assetName?.toLowerCase().includes(search) ||
        alert.notes?.toLowerCase().includes(search);

      const statusMatch =
        alertFilter === "All" ||
        (alertFilter === "Active" && alert.status === "Active") ||
        (alertFilter === "Technical" && (alert.advancedCriteriaCount ?? 0) > 0) ||
        alert.status === alertFilter;

      return searchMatch && statusMatch;
    });
  }, [alerts, query, alertFilter]);

  const chartStatusData = useMemo(() => {
    const map = new Map<string, number>();

    alerts.forEach((alert) => map.set(alert.status, (map.get(alert.status) ?? 0) + 1));

    return Array.from(map.entries()).map(([status, count]) => ({
      status,
      count,
    }));
  }, [alerts]);

  const chartListData = useMemo(() => {
    return watchlists.map((watchlist) => ({
      name: watchlist.name,
      symbols: watchlist.items.length,
      alerts: watchlist.items.reduce((sum, item) => sum + (item.alertCount ?? 0), 0),
    }));
  }, [watchlists]);

  const chartCriteriaData = useMemo(() => {
    return [
      {
        name: "Price",
        value: alerts.filter((alert) => alert.upperTargetPrice !== null || alert.lowerTargetPrice !== null).length,
      },
      {
        name: "Technical",
        value: alerts.filter((alert) => (alert.advancedCriteriaCount ?? 0) > 0).length,
      },
      {
        name: "Hybrid",
        value: alerts.filter(
          (alert) =>
            (alert.upperTargetPrice !== null || alert.lowerTargetPrice !== null) &&
            (alert.advancedCriteriaCount ?? 0) > 0
        ).length,
      },
    ];
  }, [alerts]);

  async function load() {
    const response = await fetch("/api/watchlist-price-alerts", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load watchlist alerts.");
      return;
    }

    setData(payload);

    const firstList = payload.watchlists?.[0];
    const firstItem = firstList?.items?.[0];

    if (!selectedWatchlistId && firstList) setSelectedWatchlistId(firstList.id);
    if (!selectedSymbol && firstItem) setSelectedSymbol(firstItem.symbol);
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setWorking(action);
    setMessage("");

    try {
      const response = await fetch("/api/watchlist-price-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": action,
        },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Action failed.");
        return null;
      }

      setData(payload);
      setMessage(payload.message ?? "Watchlist alerts updated.");

      return payload as PriceAlertsPayload;
    } finally {
      setWorking("");
    }
  }

  async function createWatchlist(event: FormEvent) {
    event.preventDefault();

    if (!listForm.name.trim()) {
      setMessage("Watchlist name is required.");
      return;
    }

    const payload = await runAction("createWatchlist", listForm);

    if (payload) {
      const next = payload.watchlists.find((watchlist) => watchlist.name === listForm.name);
      if (next) setSelectedWatchlistId(next.id);

      setListForm({
        name: "",
        description: "",
        focus: "General",
        riskLevel: "Mixed",
      });
    }
  }

  async function addSymbols(event: FormEvent) {
    event.preventDefault();

    if (!selectedWatchlist) {
      setMessage("Choose a watchlist first.");
      return;
    }

    const symbols = cleanSymbols(bulkForm.symbols);

    if (!symbols.length) {
      setMessage("Enter at least one ticker.");
      return;
    }

    const payload = await runAction("addSymbols", {
      watchlistId: selectedWatchlist.id,
      ...bulkForm,
      symbols: symbols.join(","),
    });

    if (payload) {
      setBulkForm({
        symbols: "",
        priority: "Medium",
        thesis: "",
        riskNotes: "",
      });

      if (!selectedSymbol && symbols[0]) setSelectedSymbol(symbols[0]);
    }
  }

  async function createAlert(event: FormEvent) {
    event.preventDefault();

    const selected = allItems.find((item) => item.id === alertForm.watchlistItemId);
    const symbol = selected?.symbol ?? alertForm.symbol;

    if (!symbol.trim()) {
      setMessage("Choose a watchlist stock or enter a ticker.");
      return;
    }

    const payload = await runAction("createAlert", {
      ...alertForm,
      symbol,
      watchlistId: (selected?.watchlistId ?? alertForm.watchlistId) || selectedWatchlist?.id,
      criteria: alertForm.criteria,
    });

    if (payload) {
      setSelectedSymbol(symbol.toUpperCase());
      setAlertForm((current) => ({
        ...current,
        watchlistItemId: "",
        symbol: "",
        assetName: "",
        upperTargetPrice: "",
        lowerTargetPrice: "",
        notes: "",
        criteria: DEFAULT_CRITERIA,
      }));
    }
  }

  function updateCriteria(patch: Partial<AlertCriteria>) {
    setAlertForm((current) => ({
      ...current,
      criteria: {
        ...current.criteria,
        ...patch,
      },
    }));
  }

  function loadAlertIntoForm(alert: PriceAlert) {
    setView("builder");
    setSelectedSymbol(alert.symbol);
    setAlertForm({
      watchlistId: alert.watchlistId ?? selectedWatchlist?.id ?? "",
      watchlistItemId: alert.watchlistItemId ?? "",
      symbol: alert.symbol,
      assetName: alert.assetName ?? alert.symbol,
      upperTargetPrice: alert.upperTargetPrice?.toString() ?? "",
      lowerTargetPrice: alert.lowerTargetPrice?.toString() ?? "",
      notificationChannel: alert.notificationChannel,
      notes: alert.notes ?? "",
      priority: "Medium",
      thesis: "",
      riskNotes: "",
      criteria: alert.criteria ?? DEFAULT_CRITERIA,
    });
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#050505] p-6 text-white">
        <Card className="mx-auto mt-20 max-w-3xl text-center">
          <Pill tone="red">Slice</Pill>
          <h1 className="mt-4 text-3xl font-black">Loading watchlist alert desk...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#020617,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Watchlist Alerts</Pill>
                <Pill tone="cyan">Private per advisor</Pill>
                <Pill tone="purple">TradingView visuals</Pill>
                <Pill tone={data.provider.alphaVantageConfigured ? "green" : "amber"}>
                  {data.provider.alphaVantageConfigured ? "Alpha Vantage ready" : "Alpha Vantage key needed"}
                </Pill>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Private watchlist command center.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Organize hundreds of stocks into private advisor watchlists, attach price and technical alerts,
                review chart context through TradingView embeds, and check live quotes or technical criteria through
                Alpha Vantage when your API key is configured.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </a>
              <a href="/market-visuals" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100">
                Market Visuals
              </a>
              <a href="/intelligence-settings" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100">
                Intelligence Settings
              </a>
              <button
                onClick={() => runAction("checkAlerts")}
                disabled={working === "checkAlerts"}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                {working === "checkAlerts" ? "Checking..." : "Check Alerts Now"}
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <Metric label="Watchlists" value={data.stats.watchlists} helper="Private lists" tone="purple" />
            <Metric label="Symbols" value={data.stats.symbols} helper="Watched tickers" tone="cyan" />
            <Metric label="Total Rules" value={data.stats.total} helper="All alerts" tone="red" />
            <Metric label="Active" value={data.stats.active} helper="Being checked" tone="green" />
            <Metric label="Technical" value={data.stats.technical} helper="Advanced criteria" tone="purple" />
            <Metric label="Triggered" value={data.stats.triggered} helper="Rules hit" tone="red" />
            <Metric label="Client Exposure" value={data.stats.clientExposedSymbols} helper="Owned securities" tone="amber" />
            <Metric label="Events" value={data.stats.recentEvents} helper="Recent triggers" tone="slate" />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              ["command", "Command", "Lists + chart", "cyan"],
              ["lists", "Lists", "Bulk symbols", "purple"],
              ["builder", "Alert Builder", "Price + technical", "red"],
              ["technical", "Technical Lab", "Charts + criteria", "green"],
              ["events", "Events", "Triggered alerts", "amber"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key as ViewMode)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  view === key
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{label}</div>
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      tone === "red"
                        ? "bg-red-400"
                        : tone === "cyan"
                          ? "bg-cyan-400"
                          : tone === "purple"
                            ? "bg-purple-400"
                            : tone === "green"
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                    )}
                  />
                </div>
                <div className={cx("mt-1 text-[10px] font-bold", view === key ? "text-slate-500" : "text-slate-500")}>
                  {helper}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {view === "command" ? (
          <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)_520px]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                Private Lists
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Organized watch coverage</h2>

              <div className="mt-5 grid gap-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tickers, lists, thesis..."
                  className={inputClass}
                />

                <select
                  value={selectedWatchlistId}
                  onChange={(event) => setSelectedWatchlistId(event.target.value)}
                  className={inputClass}
                >
                  {watchlists.map((watchlist) => (
                    <option key={watchlist.id} value={watchlist.id}>
                      {watchlist.name} · {watchlist.items.length} symbols
                    </option>
                  ))}
                </select>

                <div className="grid max-h-[760px] gap-3 overflow-y-auto pr-2">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedSymbol(item.symbol);
                        setAlertForm((current) => ({
                          ...current,
                          watchlistId: item.watchlistId,
                          watchlistItemId: item.id,
                          symbol: item.symbol,
                          assetName: item.assetName,
                        }));
                      }}
                      className={cx(
                        "rounded-[1.5rem] border p-4 text-left transition hover:bg-white/[0.07]",
                        selectedSymbol === item.symbol
                          ? "border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-950/20"
                          : "border-white/10 bg-black/35"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-2xl font-black text-white">{item.symbol}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {item.assetName} · {item.watchlistName}
                          </div>
                        </div>
                        <Pill tone={toneFor(item.priority)}>{item.priority}</Pill>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill tone="cyan">{item.alertCount ?? 0} rules</Pill>
                        <Pill tone={item.activeAlertCount ? "green" : "slate"}>{item.activeAlertCount ?? 0} active</Pill>
                        <Pill tone={item.clientExposureCount ? "amber" : "slate"}>{item.clientExposureCount ?? 0} clients</Pill>
                      </div>
                    </button>
                  ))}

                  {!filteredItems.length ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No symbols match this filter.
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                    Chart Workspace
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    {selectedSymbol || "Select a symbol"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setView("builder")}
                    className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                  >
                    Create Alert
                  </button>
                  <a
                    href="/market-visuals"
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white"
                  >
                    Full Market Visuals
                  </a>
                </div>
              </div>

              <div className="mt-5">
                <TradingViewChart symbol={selectedSymbol || selectedItem?.symbol || "AAPL"} />
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                Symbol Rules
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                {selectedSymbol || "No symbol selected"}
              </h2>

              <div className="mt-5 grid gap-3">
                {symbolAlerts.map((alert) => (
                  <Panel key={alert.id} tone={toneFor(alert.status)} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-white">{alert.symbol}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Last {money(alert.lastPrice)} · {shortDate(alert.lastCheckedAt)}
                        </div>
                      </div>
                      <Pill tone={toneFor(alert.status)}>{alert.status}</Pill>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Metric label="High" value={money(alert.upperTargetPrice)} tone="red" />
                      <Metric label="Low" value={money(alert.lowerTargetPrice)} tone="amber" />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill tone="purple">{alert.advancedCriteriaCount ?? 0} technical</Pill>
                      <Pill tone={toneFor(alert.notificationChannel)}>{alert.notificationChannel}</Pill>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => loadAlertIntoForm(alert)}
                        className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction(alert.status === "Paused" ? "activateAlert" : "pauseAlert", { alertId: alert.id })}
                        className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100"
                      >
                        {alert.status === "Paused" ? "Activate" : "Pause"}
                      </button>
                    </div>
                  </Panel>
                ))}

                {!symbolAlerts.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No rules for this symbol yet.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {view === "lists" ? (
          <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="grid gap-5">
              <Card>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                  New Watchlist
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">Create organized coverage</h2>

                <form onSubmit={createWatchlist} className="mt-5 grid gap-3">
                  <input
                    value={listForm.name}
                    onChange={(event) => setListForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Watchlist name"
                    className={inputClass}
                  />
                  <textarea
                    value={listForm.description}
                    onChange={(event) => setListForm((current) => ({ ...current, description: event.target.value }))}
                    placeholder="What this list is watching"
                    className={cx(inputClass, "min-h-20")}
                  />
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={listForm.focus}
                      onChange={(event) => setListForm((current) => ({ ...current, focus: event.target.value }))}
                      className={inputClass}
                    >
                      <option>General</option>
                      <option>Growth</option>
                      <option>Value</option>
                      <option>Momentum</option>
                      <option>Income</option>
                      <option>Client Holdings</option>
                      <option>High Volatility</option>
                      <option>Options Watch</option>
                      <option>AI / Tech</option>
                    </select>

                    <select
                      value={listForm.riskLevel}
                      onChange={(event) => setListForm((current) => ({ ...current, riskLevel: event.target.value }))}
                      className={inputClass}
                    >
                      <option>Low</option>
                      <option>Balanced</option>
                      <option>Mixed</option>
                      <option>High</option>
                      <option>Speculative</option>
                    </select>
                  </div>

                  <button className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
                    Save Watchlist
                  </button>
                </form>
              </Card>

              <Card>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                  Bulk Add
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">Add hundreds of symbols</h2>

                <form onSubmit={addSymbols} className="mt-5 grid gap-3">
                  <select
                    value={selectedWatchlistId}
                    onChange={(event) => setSelectedWatchlistId(event.target.value)}
                    className={inputClass}
                  >
                    {watchlists.map((watchlist) => (
                      <option key={watchlist.id} value={watchlist.id}>
                        {watchlist.name}
                      </option>
                    ))}
                  </select>

                  <textarea
                    value={bulkForm.symbols}
                    onChange={(event) => setBulkForm((current) => ({ ...current, symbols: event.target.value }))}
                    placeholder="Paste symbols separated by commas, spaces, or new lines: NVDA, MSFT, AAPL, AMZN"
                    className={cx(inputClass, "min-h-36")}
                  />

                  <select
                    value={bulkForm.priority}
                    onChange={(event) => setBulkForm((current) => ({ ...current, priority: event.target.value }))}
                    className={inputClass}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>

                  <textarea
                    value={bulkForm.thesis}
                    onChange={(event) => setBulkForm((current) => ({ ...current, thesis: event.target.value }))}
                    placeholder="Optional thesis applied to these symbols"
                    className={cx(inputClass, "min-h-20")}
                  />

                  <button
                    disabled={working === "addSymbols"}
                    className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                  >
                    Add Symbols
                  </button>
                </form>
              </Card>
            </div>

            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                    Watchlist Library
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">Private lists by advisor</h2>
                </div>
                <Pill tone="purple">{watchlists.length} lists</Pill>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {watchlists.map((watchlist) => (
                  <Panel key={watchlist.id} tone={watchlist.id === selectedWatchlistId ? "cyan" : "slate"} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedWatchlistId(watchlist.id)}
                        className="text-left"
                      >
                        <div className="text-xl font-black text-white">{watchlist.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {watchlist.focus} · {watchlist.riskLevel} · {watchlist.items.length} symbols
                        </div>
                      </button>
                      <Pill tone={toneFor(watchlist.riskLevel)}>{watchlist.riskLevel}</Pill>
                    </div>

                    {watchlist.description ? (
                      <p className="mt-3 text-sm leading-6 text-slate-400">{watchlist.description}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {watchlist.items.slice(0, 16).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedSymbol(item.symbol)}
                          className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-black text-white hover:bg-white/10"
                        >
                          {item.symbol}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedWatchlistId(watchlist.id)}
                        className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                      >
                        Select
                      </button>
                      <button
                        type="button"
                        onClick={() => runAction("deleteWatchlist", { watchlistId: watchlist.id })}
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {view === "builder" ? (
          <section className="grid gap-5 xl:grid-cols-[450px_minmax(0,1fr)]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                Alert Builder
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Create price + technical rules</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Choose a symbol, then add price targets, technical criteria, or both. Technical checks use Alpha Vantage when available.
              </p>

              <form onSubmit={createAlert} className="mt-5 grid gap-3">
                <select
                  value={alertForm.watchlistItemId}
                  onChange={(event) => {
                    const selected = allItems.find((item) => item.id === event.target.value);
                    setAlertForm((current) => ({
                      ...current,
                      watchlistItemId: event.target.value,
                      watchlistId: selected?.watchlistId ?? current.watchlistId,
                      symbol: selected?.symbol ?? current.symbol,
                      assetName: selected?.assetName ?? current.assetName,
                    }));
                    if (selected) setSelectedSymbol(selected.symbol);
                  }}
                  className={inputClass}
                >
                  <option value="">Choose watchlist stock</option>
                  {allItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.symbol} · {item.assetName} · {item.watchlistName}
                    </option>
                  ))}
                </select>

                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={alertForm.symbol}
                    onChange={(event) =>
                      setAlertForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))
                    }
                    placeholder="Ticker, e.g. NVDA"
                    className={inputClass}
                  />
                  <input
                    value={alertForm.assetName}
                    onChange={(event) =>
                      setAlertForm((current) => ({ ...current, assetName: event.target.value }))
                    }
                    placeholder="Asset name"
                    className={inputClass}
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    value={alertForm.upperTargetPrice}
                    onChange={(event) =>
                      setAlertForm((current) => ({ ...current, upperTargetPrice: event.target.value }))
                    }
                    type="number"
                    step="0.01"
                    className={inputClass}
                    placeholder="High target price"
                  />

                  <input
                    value={alertForm.lowerTargetPrice}
                    onChange={(event) =>
                      setAlertForm((current) => ({ ...current, lowerTargetPrice: event.target.value }))
                    }
                    type="number"
                    step="0.01"
                    className={inputClass}
                    placeholder="Low target price"
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={alertForm.notificationChannel}
                    onChange={(event) =>
                      setAlertForm((current) => ({ ...current, notificationChannel: event.target.value }))
                    }
                    className={inputClass}
                  >
                    <option>Dashboard</option>
                    <option>Email</option>
                  </select>

                  <select
                    value={alertForm.criteria.alertStyle}
                    onChange={(event) => updateCriteria({ alertStyle: event.target.value })}
                    className={inputClass}
                  >
                    <option>Hybrid</option>
                    <option>Price</option>
                    <option>Technical</option>
                    <option>Momentum</option>
                    <option>Mean Reversion</option>
                    <option>Breakout</option>
                    <option>Risk Control</option>
                  </select>
                </div>

                <Panel tone="purple" className="bg-black/35">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">Technical criteria</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {criteriaCount(alertForm.criteria)} advanced rule(s) active.
                      </div>
                    </div>
                    <Pill tone="purple">{alertForm.criteria.requireAllCriteria ? "All" : "Any"}</Pill>
                  </div>

                  <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300">
                    Require all active criteria
                    <input
                      type="checkbox"
                      checked={alertForm.criteria.requireAllCriteria}
                      onChange={(event) => updateCriteria({ requireAllCriteria: event.target.checked })}
                    />
                  </label>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input
                      type="number"
                      value={alertForm.criteria.technicalScoreAbove ?? ""}
                      onChange={(event) =>
                        updateCriteria({ technicalScoreAbove: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="Technical score above"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={alertForm.criteria.technicalScoreBelow ?? ""}
                      onChange={(event) =>
                        updateCriteria({ technicalScoreBelow: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="Technical score below"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={alertForm.criteria.rsiAbove ?? ""}
                      onChange={(event) =>
                        updateCriteria({ rsiAbove: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="RSI above"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={alertForm.criteria.rsiBelow ?? ""}
                      onChange={(event) =>
                        updateCriteria({ rsiBelow: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="RSI below"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={alertForm.criteria.changePctAbove ?? ""}
                      onChange={(event) =>
                        updateCriteria({ changePctAbove: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="Day move above %"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={alertForm.criteria.changePctBelow ?? ""}
                      onChange={(event) =>
                        updateCriteria({ changePctBelow: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="Day move below %"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={alertForm.criteria.volumeSpikePctAbove ?? ""}
                      onChange={(event) =>
                        updateCriteria({ volumeSpikePctAbove: event.target.value ? Number(event.target.value) : null })
                      }
                      placeholder="Volume spike above %"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      value={alertForm.criteria.repeatCooldownMinutes}
                      onChange={(event) =>
                        updateCriteria({ repeatCooldownMinutes: Number(event.target.value) })
                      }
                      placeholder="Repeat cooldown minutes"
                      className={inputClass}
                    />
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {[
                      ["priceAboveSma20", "Price above 20 SMA"],
                      ["priceBelowSma20", "Price below 20 SMA"],
                      ["priceAboveSma50", "Price above 50 SMA"],
                      ["priceBelowSma50", "Price below 50 SMA"],
                      ["sma20AboveSma50", "20 SMA above 50 SMA"],
                      ["sma20BelowSma50", "20 SMA below 50 SMA"],
                      ["macdBullish", "MACD bullish"],
                      ["macdBearish", "MACD bearish"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs font-black text-slate-300"
                      >
                        {label}
                        <input
                          type="checkbox"
                          checked={Boolean((alertForm.criteria as any)[key])}
                          onChange={(event) => updateCriteria({ [key]: event.target.checked } as Partial<AlertCriteria>)}
                        />
                      </label>
                    ))}
                  </div>
                </Panel>

                <textarea
                  value={alertForm.notes}
                  onChange={(event) => setAlertForm((current) => ({ ...current, notes: event.target.value }))}
                  className={cx(inputClass, "min-h-24")}
                  placeholder="Advisor notes for why this alert matters"
                />

                <button
                  disabled={working === "createAlert"}
                  className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
                >
                  Create Alert Rule
                </button>
              </form>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                    Active Rules
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">Watchlist alert rules</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  {["Active", "All", "Technical", "Triggered", "Paused"].map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => setAlertFilter(filter)}
                      className={cx(
                        "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                        alertFilter === filter
                          ? "bg-white text-slate-950"
                          : "border border-white/10 bg-white/[0.045] text-white"
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                {filteredAlerts.map((alert) => (
                  <Panel key={alert.id} tone={toneFor(alert.status)} className="bg-black/35">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSymbol(alert.symbol)}
                        className="text-left"
                      >
                        <div className="text-xl font-black text-white">{alert.symbol}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {alert.assetName ?? alert.symbol} · Provider: {alert.lastProvider ?? "Not checked"}
                        </div>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <Pill tone={toneFor(alert.status)}>{alert.status}</Pill>
                        <Pill tone={toneFor(alert.notificationChannel)}>{alert.notificationChannel}</Pill>
                        {(alert.advancedCriteriaCount ?? 0) > 0 ? <Pill tone="purple">{alert.advancedCriteriaCount} technical</Pill> : null}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                      <Metric label="Last" value={money(alert.lastPrice)} helper={shortDate(alert.lastCheckedAt)} tone="purple" />
                      <Metric label="High" value={money(alert.upperTargetPrice)} helper={alert.triggeredHighAt ? `Hit ${shortDate(alert.triggeredHighAt)}` : "Not hit"} tone="red" />
                      <Metric label="Low" value={money(alert.lowerTargetPrice)} helper={alert.triggeredLowAt ? `Hit ${shortDate(alert.triggeredLowAt)}` : "Not hit"} tone="amber" />
                      <Metric label="Triggers" value={alert.triggerCount} helper="Total hits" tone="green" />
                      <Metric label="Created" value={shortDate(alert.createdAt)} helper="Rule date" tone="slate" />
                    </div>

                    {alert.notes ? (
                      <p className="mt-3 text-sm leading-6 text-slate-400">{alert.notes}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => loadAlertIntoForm(alert)}
                        className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                      >
                        Edit
                      </button>

                      {alert.status === "Paused" ? (
                        <button
                          onClick={() => runAction("activateAlert", { alertId: alert.id })}
                          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100"
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          onClick={() => runAction("pauseAlert", { alertId: alert.id })}
                          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-100"
                        >
                          Pause
                        </button>
                      )}

                      <button
                        onClick={() => runAction("resetAlert", { alertId: alert.id })}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white"
                      >
                        Reset
                      </button>

                      <button
                        onClick={() => runAction("deleteAlert", { alertId: alert.id })}
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </Panel>
                ))}

                {!filteredAlerts.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No alerts match this filter.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {view === "technical" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">
                Technical Lab
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Visual rule orientation</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                Use technical rules to combine price targets with momentum, trend, RSI, MACD, moving-average behavior,
                and volume confirmation. This is designed for advisor review and opportunity monitoring, not automatic trading.
              </p>

              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <Panel className="min-h-[360px] bg-black/30" tone="red">
                  <div className="text-lg font-black text-white">Alert status mix</div>
                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Pie data={chartStatusData} dataKey="count" nameKey="status" innerRadius={58} outerRadius={95} paddingAngle={4}>
                          {chartStatusData.map((entry, index) => (
                            <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="min-h-[360px] bg-black/30" tone="purple">
                  <div className="text-lg font-black text-white">List coverage</div>
                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartListData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="symbols" name="Symbols" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="alerts" name="Rules" fill="#ef4444" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="min-h-[360px] bg-black/30" tone="green">
                  <div className="text-lg font-black text-white">Criteria type</div>
                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartCriteriaData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" name="Rules" fill="#22c55e" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="min-h-[360px] bg-black/30" tone="cyan">
                  <div className="text-lg font-black text-white">Technical rule guide</div>
                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                      <div className="font-black text-white">Momentum continuation</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Use price above 20/50 SMA, MACD bullish, day move above, and technical score above.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                      <div className="font-black text-white">Mean reversion watch</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Use RSI below 30, price below moving average, and lower target levels.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                      <div className="font-black text-white">Breakout confirmation</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Use high price target, volume spike, MACD bullish, and technical score above 80.
                      </p>
                    </div>
                  </div>
                </Panel>
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                Provider Stack
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Data inputs</h2>

              <div className="mt-5 grid gap-3">
                <Panel tone={data.provider.alphaVantageConfigured ? "green" : "amber"} className="bg-black/35">
                  <div className="font-black text-white">Alpha Vantage</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {data.provider.alphaVantageConfigured
                      ? "Configured for quote and technical checks."
                      : "Set ALPHA_VANTAGE_API_KEY to enable live quote and technical checks."}
                  </p>
                </Panel>

                <Panel tone="purple" className="bg-black/35">
                  <div className="font-black text-white">TradingView</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Used here for free embedded chart orientation, visual confirmation, and advisor review.
                  </p>
                </Panel>

                <Panel tone="cyan" className="bg-black/35">
                  <div className="font-black text-white">Private workspace</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Watchlists are loaded by user ID, keeping individual advisor monitoring private to the logged-in user.
                  </p>
                </Panel>
              </div>
            </Card>
          </section>
        ) : null}

        {view === "events" ? (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-400">
                  Recent Trigger Events
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">Triggered notifications</h2>
              </div>
              <Pill tone="red">{events.length}</Pill>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {events.length ? (
                events.map((event) => (
                  <Panel key={event.id} tone={toneFor(event.triggerType)} className="bg-black/35">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-white">{event.symbol}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {shortDate(event.createdAt)} · {event.provider}
                        </div>
                      </div>
                      <Pill tone={toneFor(event.triggerType)}>{event.triggerType}</Pill>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-300">{event.message}</p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <Metric label="Target" value={money(event.targetPrice)} />
                      <Metric label="Observed" value={money(event.observedPrice)} />
                    </div>
                  </Panel>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                  No triggered events yet.
                </div>
              )}
            </div>
          </Card>
        ) : null}
      </div>
    </main>
  );
}