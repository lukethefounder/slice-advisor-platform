"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type WatchlistItem = {
  id: string;
  watchlistId: string;
  symbol: string;
  assetName: string;
  priority: string;
  status: string;
};

type Watchlist = {
  id: string;
  name: string;
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
  stats: {
    total: number;
    active: number;
    triggered: number;
    paused: number;
    recentEvents: number;
  };
  message?: string;
  check?: {
    checked: number;
    triggered: number;
    results: Array<Record<string, unknown>>;
  };
};

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

  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toneFor(value: string): "red" | "green" | "amber" | "purple" | "slate" {
  const lower = value.toLowerCase();

  if (lower.includes("trigger") || lower.includes("high") || lower.includes("low")) return "red";
  if (lower.includes("active") || lower.includes("checked")) return "green";
  if (lower.includes("pause") || lower.includes("skip")) return "amber";
  if (lower.includes("dashboard")) return "purple";

  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span className={cx("inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20", className)}>
      {children}
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
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const glows = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

export default function WatchlistAlertsPage() {
  const [data, setData] = useState<PriceAlertsPayload | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const [form, setForm] = useState({
    watchlistItemId: "",
    symbol: "",
    upperTargetPrice: "",
    lowerTargetPrice: "",
    notificationChannel: "Dashboard",
    notes: "",
  });

  const watchlistItems = useMemo(() => {
    return data?.watchlists.flatMap((watchlist) =>
      watchlist.items.map((item) => ({
        ...item,
        watchlistName: watchlist.name,
      }))
    ) ?? [];
  }, [data]);

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
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setWorking(action);
    setMessage("");

    try {
      const response = await fetch("/api/watchlist-price-alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Action failed.");
        return;
      }

      setData(payload);
      setMessage(payload.message ?? "Watchlist alert updated.");
    } finally {
      setWorking("");
    }
  }

  async function createAlert(event: FormEvent) {
    event.preventDefault();

    const selected = watchlistItems.find((item) => item.id === form.watchlistItemId);
    const symbol = selected?.symbol ?? form.symbol;

    if (!symbol.trim()) {
      setMessage("Choose a watchlist stock or enter a ticker.");
      return;
    }

    await runAction("createAlert", {
      ...form,
      symbol,
    });

    setForm({
      watchlistItemId: "",
      symbol: "",
      upperTargetPrice: "",
      lowerTargetPrice: "",
      notificationChannel: "Dashboard",
      notes: "",
    });
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#050505] p-6 text-white">
        <Card className="mx-auto mt-20 max-w-3xl text-center">
          <Pill tone="red">Slice</Pill>
          <h1 className="mt-4 text-3xl font-black">Loading watchlist alerts...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(88,28,135,0.24),_transparent_30%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1500px] gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Watchlist Price Alerts
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                Notify when watched stocks hit your high or low.
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                Create high/low price targets for stocks in named watchlists.
                When a live quote provider is connected, Slice checks the current
                price and queues dashboard/email notification records when targets
                are reached.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>
              <a
                href="/market-visuals"
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100"
              >
                Market Visuals
              </a>
              <button
                onClick={() => runAction("checkAlerts")}
                disabled={working === "checkAlerts"}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                {working === "checkAlerts" ? "Checking..." : "Check Alerts Now"}
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Total Alerts" value={data.stats.total} helper="All rules" tone="purple" />
          <Metric label="Active" value={data.stats.active} helper="Being checked" tone="green" />
          <Metric label="Triggered" value={data.stats.triggered} helper="Target reached" tone="red" />
          <Metric label="Paused" value={data.stats.paused} helper="Not checking" tone="amber" />
          <Metric label="Events" value={data.stats.recentEvents} helper="Recent triggers" tone="slate" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
              New Alert
            </div>
            <h2 className="mt-2 text-2xl font-black">Create price target</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Choose a stock from your watchlists or enter a ticker manually.
            </p>

            <form onSubmit={createAlert} className="mt-5 grid gap-3">
              <select
                value={form.watchlistItemId}
                onChange={(event) => {
                  const selected = watchlistItems.find((item) => item.id === event.target.value);

                  setForm((current) => ({
                    ...current,
                    watchlistItemId: event.target.value,
                    symbol: selected?.symbol ?? current.symbol,
                  }));
                }}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option value="">Choose watchlist stock</option>
                {watchlistItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.symbol} · {item.assetName} · {item.watchlistName}
                  </option>
                ))}
              </select>

              <input
                value={form.symbol}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    symbol: event.target.value.toUpperCase(),
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Or enter ticker manually, e.g. NVDA"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={form.upperTargetPrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      upperTargetPrice: event.target.value,
                    }))
                  }
                  type="number"
                  step="0.01"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="High target price"
                />

                <input
                  value={form.lowerTargetPrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      lowerTargetPrice: event.target.value,
                    }))
                  }
                  type="number"
                  step="0.01"
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Low target price"
                />
              </div>

              <select
                value={form.notificationChannel}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notificationChannel: event.target.value,
                  }))
                }
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option>Dashboard</option>
                <option>Email</option>
              </select>

              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="min-h-24 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Optional notes"
              />

              <button
                disabled={working === "createAlert"}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                Create Price Alert
              </button>
            </form>

            <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
              Price alerts only trigger from live quote data. Set
              <span className="font-black"> ALPHA_VANTAGE_API_KEY </span>
              in `.env` for live checks.
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                  Active Rules
                </div>
                <h2 className="mt-2 text-2xl font-black">Watchlist alerts</h2>
              </div>
              <Pill tone="green">{data.stats.active} active</Pill>
            </div>

            <div className="mt-5 grid gap-3">
              {data.alerts.length ? (
                data.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-black text-white">
                          {alert.symbol}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {alert.assetName ?? alert.symbol} · Provider: {alert.lastProvider ?? "Not checked"}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Pill tone={toneFor(alert.status)}>{alert.status}</Pill>
                        <Pill tone={toneFor(alert.notificationChannel)}>
                          {alert.notificationChannel}
                        </Pill>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-5">
                      <Metric label="Last" value={money(alert.lastPrice)} helper={shortDate(alert.lastCheckedAt)} tone="purple" />
                      <Metric label="High Target" value={money(alert.upperTargetPrice)} helper={alert.triggeredHighAt ? `Hit ${shortDate(alert.triggeredHighAt)}` : "Not hit"} tone="red" />
                      <Metric label="Low Target" value={money(alert.lowerTargetPrice)} helper={alert.triggeredLowAt ? `Hit ${shortDate(alert.triggeredLowAt)}` : "Not hit"} tone="amber" />
                      <Metric label="Triggers" value={alert.triggerCount} helper="Total hits" tone="green" />
                      <Metric label="Created" value={shortDate(alert.createdAt)} helper="Rule date" tone="slate" />
                    </div>

                    {alert.notes ? (
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {alert.notes}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
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
                        Reset Triggers
                      </button>

                      <button
                        onClick={() => runAction("deleteAlert", { alertId: alert.id })}
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-8 text-center text-sm text-slate-400">
                  No price alerts yet. Create one from a watchlist stock.
                </div>
              )}
            </div>
          </Card>
        </section>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                Recent Trigger Events
              </div>
              <h2 className="mt-2 text-2xl font-black">Triggered notifications</h2>
            </div>
            <Pill tone="red">{data.events.length}</Pill>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.events.length ? (
              data.events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black text-white">
                        {event.symbol}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {shortDate(event.createdAt)} · {event.provider}
                      </div>
                    </div>
                    <Pill tone={toneFor(event.triggerType)}>{event.triggerType}</Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    {event.message}
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Metric label="Target" value={money(event.targetPrice)} />
                    <Metric label="Observed" value={money(event.observedPrice)} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                No triggered events yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}