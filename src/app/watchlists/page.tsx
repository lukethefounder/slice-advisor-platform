"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

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

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(status: string): "red" | "green" | "amber" | "slate" | "purple" {
  if (["Watching", "Active", "Complete", "Reviewed"].includes(status)) return "green";
  if (["Critical", "Banned", "Removed"].includes(status)) return "red";
  if (["High", "Pending", "Action Needed"].includes(status)) return "amber";
  if (["Medium", "Crypto"].includes(status)) return "purple";
  return "slate";
}

function scoreTone(score: number): "red" | "green" | "amber" | "slate" | "purple" {
  if (score >= 90) return "red";
  if (score >= 80) return "amber";
  if (score >= 70) return "purple";
  if (score >= 60) return "green";
  return "slate";
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
        "overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/72 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-black ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Named Watchlists
        </div>
      </div>
    </div>
  );
}

function MetricBubble({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const glows = {
    red: "from-red-500/18 to-transparent",
    green: "from-emerald-500/18 to-transparent",
    amber: "from-amber-500/18 to-transparent",
    slate: "from-slate-400/10 to-transparent",
    purple: "from-purple-500/18 to-transparent",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition focus:ring-2";

export default function WatchlistsPage() {
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [activeView, setActiveView] = useState<View>("watchlists");
  const [selectedWatchlistId, setSelectedWatchlistId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

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

  const selectedWatchlist = useMemo(() => {
    return data?.watchlists.find((list) => list.id === selectedWatchlistId) ?? null;
  }, [data?.watchlists, selectedWatchlistId]);

  async function loadData() {
    const response = await fetch("/api/watchlists", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load watchlists.");
      return;
    }

    setData(payload);

    if (!selectedWatchlistId && payload.watchlists?.[0]?.id) {
      setSelectedWatchlistId(payload.watchlists[0].id);
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
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Watchlist action failed.");
        return null;
      }

      setData(payload);

      if (!selectedWatchlistId && payload.watchlists?.[0]?.id) {
        setSelectedWatchlistId(payload.watchlists[0].id);
      }

      return payload;
    } finally {
      setWorking(false);
    }
  }

  async function createWatchlist(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createWatchlist",
      ...watchlistForm,
    });

    if (payload) {
      const created = payload.watchlists.find(
        (list: Watchlist) => list.name === watchlistForm.name
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

    const payload = await postAction({
      action: "saveManualItem",
      watchlistId: selectedWatchlistId,
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
      setMessage("Item saved to watchlist.");
    }
  }

  async function saveAlert(alert: Alert, symbolOverride?: string) {
    const symbol =
      symbolOverride ||
      alert.suggestedSymbol ||
      window.prompt("Enter symbol to save from this alert:", alert.ticker ?? "") ||
      "";

    if (!symbol.trim()) return;

    const payload = await postAction({
      action: "saveFromAlert",
      watchlistId: selectedWatchlistId,
      alertId: alert.id,
      symbol,
    });

    if (payload) {
      setMessage(`${symbol.toUpperCase()} saved from alert.`);
    }
  }

  async function saveDecision(decision: Decision, symbolOverride?: string) {
    const symbol =
      symbolOverride ||
      decision.suggestedSymbol ||
      window.prompt(
        "Enter symbol to save from this scan result:",
        decision.matchedTickers?.[0] ?? ""
      ) ||
      "";

    if (!symbol.trim()) return;

    const payload = await postAction({
      action: "saveFromDecision",
      watchlistId: selectedWatchlistId,
      decisionId: decision.id,
      symbol,
    });

    if (payload) {
      setMessage(`${symbol.toUpperCase()} saved from scan result.`);
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
    const confirmed = window.confirm("Remove this item from the watchlist?");

    if (!confirmed) return;

    const payload = await postAction({
      action: "deleteItem",
      itemId,
    });

    if (payload) {
      setMessage("Item removed from watchlist.");
    }
  }

  useEffect(() => {
    async function run() {
      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <div className="mx-auto max-w-[1500px]">
          <Logo />
          <div className="mt-8 text-sm font-semibold text-slate-400">
            Loading named watchlists...
          </div>
        </div>
      </main>
    );
  }

  const aggregate = data?.aggregate;
  const watchlists = data?.watchlists ?? [];
  const alerts = data?.alerts ?? [];
  const decisions = data?.decisions ?? [];
  const holdings = data?.holdings ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>

              <a
                href="/triage"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Triage
              </a>

              <a
                href="/opportunity-radar"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Opportunity Radar
              </a>

              <button
                onClick={() => void loadData()}
                disabled={working}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              ["watchlists", "Watchlists"],
              ["alerts", "Save Alerts"],
              ["scans", "Save Scan Results"],
              ["portfolio", "Portfolio Emphasis"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveView(id as View)}
                className={cx(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-black transition",
                  activeView === id
                    ? "bg-gradient-to-r from-red-600 to-red-950 text-white shadow-lg shadow-red-950/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-5 grid gap-5">
          <Card className="relative p-5 md:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-600/18 to-transparent" />

            <div className="relative">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Named watchlist intelligence
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
                Save good alerts and scans into watchlists you control.
              </h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                Create named watchlists for stocks or crypto you want to watch
                closely. Once saved, those symbols receive additional emphasis in
                future triage scoring alongside actual portfolio holdings.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <MetricBubble
                  label="Watchlists"
                  value={aggregate?.watchlistCount ?? 0}
                  helper="Named lists"
                  tone="purple"
                />
                <MetricBubble
                  label="Items"
                  value={aggregate?.itemCount ?? 0}
                  helper="Saved symbols"
                  tone="green"
                />
                <MetricBubble
                  label="From Alerts"
                  value={aggregate?.savedFromAlerts ?? 0}
                  helper="Saved signal"
                  tone="red"
                />
                <MetricBubble
                  label="Portfolio Overlap"
                  value={aggregate?.portfolioOverlapCount ?? 0}
                  helper="Extra emphasis"
                  tone="amber"
                />
              </div>
            </div>
          </Card>

          <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Watchlist controls
              </div>

              <form onSubmit={createWatchlist} className="mt-5 space-y-3">
                <input
                  value={watchlistForm.name}
                  onChange={(event) =>
                    setWatchlistForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="New watchlist name"
                />

                <textarea
                  value={watchlistForm.description}
                  onChange={(event) =>
                    setWatchlistForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className={cx(inputClass, "min-h-20")}
                  placeholder="Description or strategy"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={watchlistForm.focus}
                    onChange={(event) =>
                      setWatchlistForm((current) => ({
                        ...current,
                        focus: event.target.value,
                      }))
                    }
                    className={selectClass}
                  >
                    <option>General</option>
                    <option>Growth Stocks</option>
                    <option>Dividend Watch</option>
                    <option>Crypto Momentum</option>
                    <option>AI / Technology</option>
                    <option>Turnaround Ideas</option>
                    <option>Client Review</option>
                    <option>High-Risk</option>
                  </select>

                  <select
                    value={watchlistForm.riskLevel}
                    onChange={(event) =>
                      setWatchlistForm((current) => ({
                        ...current,
                        riskLevel: event.target.value,
                      }))
                    }
                    className={selectClass}
                  >
                    <option>Conservative</option>
                    <option>Balanced</option>
                    <option>Growth</option>
                    <option>High</option>
                    <option>Extreme</option>
                    <option>Mixed</option>
                  </select>
                </div>

                <button
                  disabled={working}
                  className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                >
                  Create Watchlist
                </button>
              </form>

              <div className="mt-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                  Active watchlist
                </div>

                <select
                  value={selectedWatchlistId}
                  onChange={(event) => setSelectedWatchlistId(event.target.value)}
                  className={cx(selectClass, "mt-3")}
                >
                  {watchlists.map((watchlist) => (
                    <option key={watchlist.id} value={watchlist.id}>
                      {watchlist.name}
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={saveManual} className="mt-5 space-y-3">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                  Add manual item
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={manualForm.symbol}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        symbol: event.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="Symbol"
                  />

                  <select
                    value={manualForm.assetType}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        assetType: event.target.value,
                      }))
                    }
                    className={selectClass}
                  >
                    <option>Stock</option>
                    <option>Crypto</option>
                    <option>ETF</option>
                    <option>Fund</option>
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
                  className={inputClass}
                  placeholder="Asset name"
                />

                <textarea
                  value={manualForm.thesis}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      thesis: event.target.value,
                    }))
                  }
                  className={cx(inputClass, "min-h-20")}
                  placeholder="Why are you watching this?"
                />

                <textarea
                  value={manualForm.riskNotes}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      riskNotes: event.target.value,
                    }))
                  }
                  className={cx(inputClass, "min-h-20")}
                  placeholder="Risk notes"
                />

                <select
                  value={manualForm.priority}
                  onChange={(event) =>
                    setManualForm((current) => ({
                      ...current,
                      priority: event.target.value,
                    }))
                  }
                  className={selectClass}
                >
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>

                <button
                  disabled={working}
                  className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                >
                  Save Manual Item
                </button>
              </form>
            </Card>

            {activeView === "watchlists" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Saved watchlist items
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  {selectedWatchlist?.name ?? "No watchlist selected"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {selectedWatchlist?.description ||
                    "Saved alerts, scan results, and manual stock/crypto ideas appear here."}
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {selectedWatchlist?.items.length ? (
                    selectedWatchlist.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-2xl font-black">
                              {item.symbol}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-400">
                              {item.assetName}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 text-right">
                            <Pill tone={statusTone(item.assetType)}>
                              {item.assetType}
                            </Pill>
                            <Pill tone={statusTone(item.priority)}>
                              {item.priority}
                            </Pill>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Pill tone="slate">{item.sourceType}</Pill>
                          <Pill tone={statusTone(item.status)}>
                            {item.status}
                          </Pill>
                          {item.originalScore !== null ? (
                            <Pill tone={scoreTone(item.originalScore)}>
                              Score {item.originalScore}
                            </Pill>
                          ) : null}
                        </div>

                        {item.sourceTitle ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-bold text-slate-300">
                            {item.sourceTitle}
                          </div>
                        ) : null}

                        {item.thesis ? (
                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                            {item.thesis}
                          </p>
                        ) : null}

                        {item.riskNotes ? (
                          <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                            {item.riskNotes}
                          </div>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => updateItemStatus(item.id, "Watching")}
                            disabled={working}
                            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20 disabled:opacity-60"
                          >
                            Watching
                          </button>

                          <button
                            onClick={() =>
                              updateItemStatus(item.id, "High Interest")
                            }
                            disabled={working}
                            className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200 ring-1 ring-amber-500/30 disabled:opacity-60"
                          >
                            High Interest
                          </button>

                          <button
                            onClick={() => updateItemStatus(item.id, "Reviewed")}
                            disabled={working}
                            className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-500/30 disabled:opacity-60"
                          >
                            Reviewed
                          </button>

                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={working}
                            className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 ring-1 ring-red-500/30 disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>

                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                          >
                            Open Source
                          </a>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No saved items yet.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}

            {activeView === "alerts" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Save from alerts
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  Alert inbox to watchlist
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Save stock or crypto alerts into the selected named watchlist.
                </p>

                <div className="mt-5 grid gap-4">
                  {alerts.length ? (
                    alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={statusTone(alert.urgency)}>
                                {alert.urgency}
                              </Pill>
                              <Pill tone={scoreTone(alert.score)}>
                                Score {alert.score}
                              </Pill>
                              {alert.inPortfolio ? (
                                <Pill tone="green">In Portfolio</Pill>
                              ) : null}
                              {alert.alreadySaved ? (
                                <Pill tone="purple">Already Saved</Pill>
                              ) : null}
                            </div>

                            <h3 className="mt-3 text-lg font-black">
                              {alert.title}
                            </h3>

                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
                              {alert.aiBriefing || alert.body}
                            </p>

                            <div className="mt-2 text-xs text-slate-500">
                              {alert.source} · {shortDate(alert.createdAt)}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              onClick={() => saveAlert(alert)}
                              disabled={working}
                              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                            >
                              Save to Watchlist
                            </button>

                            {alert.sourceUrl ? (
                              <a
                                href={alert.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/20"
                              >
                                Source
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No alerts found.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}

            {activeView === "scans" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Save from scan results
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  Triage decisions to watchlist
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Save promising ranked scan results directly into a named
                  watchlist.
                </p>

                <div className="mt-5 grid gap-4">
                  {decisions.length ? (
                    decisions.map((decision) => (
                      <div
                        key={decision.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={statusTone(decision.urgency)}>
                                {decision.urgency}
                              </Pill>
                              <Pill tone={scoreTone(decision.score)}>
                                Score {decision.score}
                              </Pill>
                              <Pill tone="purple">{decision.category}</Pill>
                              {decision.inPortfolio ? (
                                <Pill tone="green">In Portfolio</Pill>
                              ) : null}
                              {decision.alreadySaved ? (
                                <Pill tone="purple">Already Saved</Pill>
                              ) : null}
                            </div>

                            <h3 className="mt-3 text-lg font-black">
                              {decision.title}
                            </h3>

                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
                              {decision.summary || "No summary stored."}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {decision.matchedTickers.map((ticker) => (
                                <Pill key={ticker} tone="red">
                                  {ticker}
                                </Pill>
                              ))}
                            </div>

                            <div className="mt-2 text-xs text-slate-500">
                              {decision.sourceName} · {shortDate(decision.createdAt)}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2">
                            <button
                              onClick={() => saveDecision(decision)}
                              disabled={working}
                              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                            >
                              Save to Watchlist
                            </button>

                            {decision.url ? (
                              <a
                                href={decision.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-2xl bg-white/10 px-4 py-3 text-center text-sm font-black text-white hover:bg-white/20"
                              >
                                Source
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No scan results found.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}

            {activeView === "portfolio" ? (
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                  Portfolio + watchlist emphasis
                </div>
                <h2 className="mt-2 text-3xl font-black">
                  These symbols get extra algorithm weight.
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Future scans now place stronger emphasis on securities in your
                  portfolio and in your named watchlists. Portfolio holdings get
                  the highest boost, named watchlists get the next strongest
                  boost, and normal watchlist assets continue to receive a
                  baseline boost.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {holdings.length ? (
                    holdings.map((holding) => (
                      <SoftCard key={holding.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xl font-black">
                              {holding.symbol}
                            </div>
                            <div className="mt-1 text-sm text-slate-400">
                              {holding.assetName}
                            </div>
                          </div>
                          <Pill tone="green">Portfolio Boost</Pill>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <div className="rounded-2xl bg-black/30 p-3">
                            <div className="text-xs text-slate-500">Value</div>
                            <div className="font-black">
                              {money(holding.valueNumber)}
                            </div>
                          </div>

                          <div className="rounded-2xl bg-black/30 p-3">
                            <div className="text-xs text-slate-500">Risk</div>
                            <div className="font-black">{holding.riskLevel}</div>
                          </div>
                        </div>
                      </SoftCard>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No portfolio holdings found.
                    </div>
                  )}
                </div>
              </Card>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}