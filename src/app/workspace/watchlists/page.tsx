"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type ConstraintCondition =
  | "above"
  | "below"
  | "between"
  | "moves-by"
  | "crosses-above"
  | "crosses-below"
  | "news-at-least";

type ConstraintJoin = "AND" | "OR";
type Priority = "Monitor" | "Important" | "Critical";

type MetricId =
  | "last-price"
  | "change-pct"
  | "volume"
  | "avg-volume"
  | "rsi-14"
  | "macd"
  | "sma-50"
  | "atr-14"
  | "market-cap"
  | "pe-ratio"
  | "dividend-yield"
  | "news-score"
  | "regulatory-risk"
  | "halt-risk"
  | "intelligence-score";

type SecurityItem = {
  id: string;
  symbol: string;
  tvSymbol: string;
  label: string;
  assetType: "Stock" | "ETF" | "Index" | "Crypto" | "Futures" | "Other";
  note: string;
  addedAt: string;
};

type WatchConstraint = {
  id: string;
  metricId: MetricId;
  condition: ConstraintCondition;
  value: string;
  upperValue: string;
  priority: Priority;
  enabled: boolean;
};

type AdvisorWatchlist = {
  id: string;
  name: string;
  description: string;
  tone: Tone;
  notificationEmail: string;
  enabled: boolean;
  constraintJoin: ConstraintJoin;
  constraints: WatchConstraint[];
  items: SecurityItem[];
  createdAt: string;
  updatedAt: string;
};

type SharedWorkspaceWatchItem = {
  id: string;
  symbol: string;
  name: string;
  constraint: string;
  targetValue: string;
  note: string;
  source: "Manual" | "Custom Board";
};

type CustomBoardAlert = {
  id: string;
  symbol: string;
  tvSymbol: string;
  metricId: string;
  metricLabel: string;
  condition: string;
  threshold: string;
  upperThreshold?: string;
  note: string;
  priority?: Priority;
  createdAt: string;
  watchlistId: string;
};

type IntelligenceScan = {
  scannedAt: string;
  items?: Array<{
    id: string;
    title: string;
    summary: string;
    urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
    score: number;
    matchedTickers: string[];
    shouldAlert: boolean;
    sourceName: string;
    link: string;
  }>;
  alertCandidates?: Array<{
    id: string;
    title: string;
    summary: string;
    urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
    score: number;
    matchedTickers: string[];
    shouldAlert: boolean;
    sourceName: string;
    link: string;
  }>;
  sources?: Array<{
    id: string;
    name: string;
    ok: boolean;
    fetched: number;
  }>;
};

type QualificationEvent = {
  id: string;
  key: string;
  listId: string;
  listName: string;
  symbol: string;
  tvSymbol: string;
  metricId: MetricId;
  metricLabel: string;
  observedDisplay: string;
  condition: string;
  thresholdDisplay: string;
  priority: Priority;
  emailSent: boolean;
  emailSkippedReason?: string;
  message: string;
  createdAt: string;
};

type CheckResponse = {
  ok: boolean;
  checkedAt: string;
  checkedSymbols: number;
  triggered: QualificationEvent[];
  message: string;
};

const WATCHLISTS_KEY = "slice-workspace-watchlists-v1";
const WATCHLIST_EVENTS_KEY = "slice-workspace-watchlist-events-v1";
const SHARED_WATCHLIST_KEY = "slice-shared-watchlist-v1";
const CUSTOM_BOARD_ALERTS_KEY = "slice-custom-board-alerts-v1";
const INTELLIGENCE_SCAN_CACHE_KEY = "slice-workspace-intelligence-scan-v1";

const MAX_LIST_SECURITIES = 20;
const MAX_LIST_CONSTRAINTS = 2;

const metricOptions: Array<{
  id: MetricId;
  label: string;
  short: string;
  group: string;
  tone: Tone;
}> = [
  { id: "last-price", label: "Last Price", short: "Price", group: "Market", tone: "cyan" },
  { id: "change-pct", label: "Change %", short: "Move", group: "Market", tone: "cyan" },
  { id: "volume", label: "Volume", short: "Vol", group: "Liquidity", tone: "blue" },
  { id: "avg-volume", label: "Average Volume", short: "Avg Vol", group: "Liquidity", tone: "blue" },
  { id: "rsi-14", label: "RSI 14", short: "RSI", group: "Technical", tone: "purple" },
  { id: "macd", label: "MACD", short: "MACD", group: "Technical", tone: "purple" },
  { id: "sma-50", label: "50 SMA", short: "SMA50", group: "Technical", tone: "purple" },
  { id: "atr-14", label: "ATR 14", short: "ATR", group: "Risk", tone: "red" },
  { id: "market-cap", label: "Market Cap", short: "Mkt Cap", group: "Valuation", tone: "amber" },
  { id: "pe-ratio", label: "P/E Ratio", short: "P/E", group: "Valuation", tone: "amber" },
  { id: "dividend-yield", label: "Dividend Yield", short: "Yield", group: "Income", tone: "green" },
  { id: "news-score", label: "News Score", short: "News", group: "Intelligence", tone: "red" },
  { id: "regulatory-risk", label: "Regulatory Risk", short: "Reg", group: "Intelligence", tone: "red" },
  { id: "halt-risk", label: "Halt Risk", short: "Halt", group: "Intelligence", tone: "red" },
  { id: "intelligence-score", label: "Intelligence Score", short: "Intel", group: "Intelligence", tone: "cyan" },
];

const toneOptions: Tone[] = ["red", "green", "amber", "purple", "cyan", "blue", "slate"];

const defaultLists: AdvisorWatchlist[] = [
  {
    id: "growth-watch",
    name: "Growth Watch",
    description: "High-priority growth names where movement, liquidity, or momentum deserves immediate advisor review.",
    tone: "cyan",
    notificationEmail: "",
    enabled: true,
    constraintJoin: "OR",
    constraints: [
      {
        id: "constraint-growth-move",
        metricId: "change-pct",
        condition: "above",
        value: "3",
        upperValue: "",
        priority: "Important",
        enabled: true,
      },
      {
        id: "constraint-growth-rsi",
        metricId: "rsi-14",
        condition: "below",
        value: "35",
        upperValue: "",
        priority: "Monitor",
        enabled: true,
      },
    ],
    items: [
      stock("NASDAQ:NVDA", "NVDA", "AI concentration"),
      stock("NASDAQ:MSFT", "MSFT", "Cloud and AI"),
      stock("NASDAQ:AAPL", "AAPL", "Mega-cap quality"),
    ],
    createdAt: "Default",
    updatedAt: "Default",
  },
  {
    id: "risk-watch",
    name: "Risk Watch",
    description: "Names that should trigger review when market stress, news, or regulatory events appear.",
    tone: "red",
    notificationEmail: "",
    enabled: true,
    constraintJoin: "OR",
    constraints: [
      {
        id: "constraint-risk-news",
        metricId: "news-score",
        condition: "above",
        value: "75",
        upperValue: "",
        priority: "Critical",
        enabled: true,
      },
      {
        id: "constraint-risk-reg",
        metricId: "regulatory-risk",
        condition: "above",
        value: "50",
        upperValue: "",
        priority: "Critical",
        enabled: true,
      },
    ],
    items: [
      stock("AMEX:SPY", "SPY", "Market benchmark"),
      stock("AMEX:TLT", "TLT", "Rates / duration"),
      stock("NASDAQ:TSLA", "TSLA", "High beta"),
    ],
    createdAt: "Default",
    updatedAt: "Default",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function id(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowLabel() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function stock(tvSymbol: string, label: string, note = ""): SecurityItem {
  return {
    id: id("security"),
    symbol: label.toUpperCase(),
    tvSymbol,
    label: label.toUpperCase(),
    assetType: guessAssetType(tvSymbol),
    note,
    addedAt: nowLabel(),
  };
}

function guessAssetType(tvSymbol: string): SecurityItem["assetType"] {
  const symbol = tvSymbol.toUpperCase();

  if (symbol.includes("BINANCE:") || symbol.includes("BTC") || symbol.includes("ETH")) return "Crypto";
  if (symbol.includes("CME") || symbol.endsWith("1!")) return "Futures";
  if (symbol.includes("SP:") || symbol.includes("TVC:")) return "Index";
  if (symbol.includes("AMEX:")) return "ETF";

  return "Stock";
}

function parseTradingViewSymbol(raw: string) {
  const cleaned = raw.trim().replace(/\s+/g, "").toUpperCase();

  if (!cleaned) {
    return {
      symbol: "",
      tvSymbol: "",
      label: "",
    };
  }

  if (cleaned.includes(":")) {
    const [exchange, ...rest] = cleaned.split(":");
    const symbol = rest.join(":").replace(/[^A-Z0-9._/!\-$]/g, "");
    const cleanExchange = exchange.replace(/[^A-Z0-9._-]/g, "");

    return {
      symbol,
      tvSymbol: `${cleanExchange}:${symbol}`,
      label: symbol,
    };
  }

  const symbol = cleaned.replace(/[^A-Z0-9._/!\-$]/g, "");

  return {
    symbol,
    tvSymbol: `NASDAQ:${symbol}`,
    label: symbol,
  };
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function toneClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/25 bg-red-500/10 text-red-100 shadow-red-950/20",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
    purple: "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-100 shadow-blue-950/20",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
  };

  return tones[tone];
}

function dotClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "bg-red-400 shadow-red-400/50",
    green: "bg-emerald-400 shadow-emerald-400/50",
    amber: "bg-amber-400 shadow-amber-400/50",
    purple: "bg-purple-400 shadow-purple-400/50",
    cyan: "bg-cyan-400 shadow-cyan-400/50",
    blue: "bg-blue-400 shadow-blue-400/50",
    slate: "bg-slate-400 shadow-slate-400/50",
  };

  return tones[tone];
}

function priorityTone(priority: Priority): Tone {
  if (priority === "Critical") return "red";
  if (priority === "Important") return "amber";
  return "blue";
}

function metricLabel(metricId: MetricId) {
  return metricOptions.find((metric) => metric.id === metricId)?.label ?? metricId;
}

function constraintSentence(constraint: WatchConstraint) {
  const metric = metricLabel(constraint.metricId);

  if (constraint.condition === "between") {
    return `${metric} between ${constraint.value || "—"} and ${constraint.upperValue || "—"}`;
  }

  if (constraint.condition === "moves-by") {
    return `${metric} moves by ${constraint.value || "—"}`;
  }

  if (constraint.condition === "news-at-least") {
    return `${metric} at least ${constraint.value || "High"}`;
  }

  return `${metric} ${constraint.condition.replace("-", " ")} ${constraint.value || "—"}`;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-zinc-950/76 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", toneClass(tone))}>
      {children}
    </span>
  );
}

function buildCustomBoardList(): AdvisorWatchlist {
  const shared = loadJson<SharedWorkspaceWatchItem[]>(SHARED_WATCHLIST_KEY, []);
  const alerts = loadJson<CustomBoardAlert[]>(CUSTOM_BOARD_ALERTS_KEY, []);

  const alertItems = shared
    .filter((item) => item.source === "Custom Board")
    .slice(0, MAX_LIST_SECURITIES)
    .map((item) => stock(item.name || `NASDAQ:${item.symbol}`, item.symbol, item.constraint));

  const alertConstraints: WatchConstraint[] = alerts.slice(0, MAX_LIST_CONSTRAINTS).map((alert) => ({
    id: `constraint-custom-${alert.id}`,
    metricId: normalizeMetricId(alert.metricId),
    condition: normalizeCondition(alert.condition),
    value: alert.threshold || "",
    upperValue: alert.upperThreshold || "",
    priority: alert.priority || "Important",
    enabled: true,
  }));

  return {
    id: "custom-board-alerts",
    name: "Custom Board Alerts",
    description: "Separate list automatically derived from alert rules created on the Custom Board.",
    tone: "purple",
    notificationEmail: "",
    enabled: true,
    constraintJoin: "OR",
    constraints: alertConstraints.length
      ? alertConstraints
      : [
          {
            id: "constraint-custom-placeholder",
            metricId: "last-price",
            condition: "above",
            value: "",
            upperValue: "",
            priority: "Monitor",
            enabled: false,
          },
        ],
    items: alertItems,
    createdAt: "Custom Board",
    updatedAt: nowLabel(),
  };
}

function normalizeMetricId(value: string): MetricId {
  const candidate = value as MetricId;
  if (metricOptions.some((metric) => metric.id === candidate)) return candidate;
  if (value.includes("rsi")) return "rsi-14";
  if (value.includes("macd")) return "macd";
  if (value.includes("volume")) return "volume";
  if (value.includes("price")) return "last-price";
  return "last-price";
}

function normalizeCondition(value: string): ConstraintCondition {
  const candidate = value as ConstraintCondition;
  if (["above", "below", "between", "moves-by", "crosses-above", "crosses-below", "news-at-least"].includes(candidate)) {
    return candidate;
  }

  if (value.includes("below")) return "below";
  if (value.includes("between")) return "between";
  if (value.includes("cross")) return "crosses-above";

  return "above";
}

export default function WorkspaceWatchlistsPage() {
  const [lists, setLists] = useState<AdvisorWatchlist[]>(defaultLists);
  const [activeListId, setActiveListId] = useState(defaultLists[0]?.id ?? "");
  const [customBoardList, setCustomBoardList] = useState<AdvisorWatchlist>(() => buildCustomBoardList());
  const [newListName, setNewListName] = useState("");
  const [newListEmail, setNewListEmail] = useState("");
  const [newSymbol, setNewSymbol] = useState("");
  const [events, setEvents] = useState<QualificationEvent[]>([]);
  const [intelligence, setIntelligence] = useState<IntelligenceScan | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "checking" | "synced" | "error">("idle");
  const [autoCheck, setAutoCheck] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setLists(loadJson(WATCHLISTS_KEY, defaultLists));
    setEvents(loadJson(WATCHLIST_EVENTS_KEY, []));
    setIntelligence(loadJson(INTELLIGENCE_SCAN_CACHE_KEY, null));
    setCustomBoardList(buildCustomBoardList());
  }, []);

  useEffect(() => {
    saveJson(WATCHLISTS_KEY, lists);
  }, [lists]);

  useEffect(() => {
    saveJson(WATCHLIST_EVENTS_KEY, events.slice(0, 100));
  }, [events]);

  useEffect(() => {
    if (!autoCheck) return;

    const interval = window.setInterval(() => {
      void runAllChecks("auto");
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [autoCheck, lists, events]);

  const activeList = useMemo(
    () => lists.find((list) => list.id === activeListId) ?? lists[0] ?? defaultLists[0],
    [activeListId, lists],
  );

  const activeEvents = useMemo(
    () => events.filter((event) => event.listId === activeList?.id).slice(0, 8),
    [activeList?.id, events],
  );

  const intelligenceAlerts = useMemo(() => intelligence?.alertCandidates?.slice(0, 6) ?? [], [intelligence]);

  function updateList(listId: string, patch: Partial<AdvisorWatchlist>) {
    setLists((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              ...patch,
              updatedAt: nowLabel(),
            }
          : list,
      ),
    );
  }

  function createList() {
    const name = newListName.trim();

    if (!name) {
      setMessage("Name the list before creating it.");
      return;
    }

    const next: AdvisorWatchlist = {
      id: id("watchlist"),
      name,
      description: "Custom advisor watchlist.",
      tone: "cyan",
      notificationEmail: newListEmail.trim(),
      enabled: true,
      constraintJoin: "OR",
      constraints: [
        {
          id: id("constraint"),
          metricId: "change-pct",
          condition: "above",
          value: "3",
          upperValue: "",
          priority: "Important",
          enabled: true,
        },
      ],
      items: [],
      createdAt: nowLabel(),
      updatedAt: nowLabel(),
    };

    setLists((current) => [next, ...current]);
    setActiveListId(next.id);
    setNewListName("");
    setNewListEmail("");
    setMessage(`Created ${name}.`);
  }

  function deleteList(listId: string) {
    setLists((current) => current.filter((list) => list.id !== listId));

    if (activeListId === listId) {
      const next = lists.find((list) => list.id !== listId);
      setActiveListId(next?.id ?? "");
    }
  }

  function addSecurityToActiveList() {
    if (!activeList) return;

    if (activeList.items.length >= MAX_LIST_SECURITIES) {
      setMessage("This list already has 20 securities.");
      return;
    }

    const parsed = parseTradingViewSymbol(newSymbol);

    if (!parsed.symbol || !parsed.tvSymbol) {
      setMessage("Enter a valid symbol, such as NASDAQ:AAPL or AMEX:SPY.");
      return;
    }

    if (activeList.items.some((item) => item.tvSymbol === parsed.tvSymbol)) {
      setMessage(`${parsed.tvSymbol} is already in this list.`);
      return;
    }

    updateList(activeList.id, {
      items: [
        {
          id: id("security"),
          symbol: parsed.symbol,
          tvSymbol: parsed.tvSymbol,
          label: parsed.label,
          assetType: guessAssetType(parsed.tvSymbol),
          note: "Added manually",
          addedAt: nowLabel(),
        },
        ...activeList.items,
      ],
    });

    setNewSymbol("");
    setMessage(`Added ${parsed.tvSymbol}.`);
  }

  function removeSecurity(listId: string, securityId: string) {
    const list = lists.find((item) => item.id === listId);
    if (!list) return;

    updateList(listId, {
      items: list.items.filter((item) => item.id !== securityId),
    });
  }

  function addConstraint(listId: string) {
    const list = lists.find((item) => item.id === listId);
    if (!list) return;

    if (list.constraints.length >= MAX_LIST_CONSTRAINTS) {
      setMessage("Each list can have up to two constraints.");
      return;
    }

    updateList(listId, {
      constraints: [
        ...list.constraints,
        {
          id: id("constraint"),
          metricId: "rsi-14",
          condition: "below",
          value: "35",
          upperValue: "",
          priority: "Monitor",
          enabled: true,
        },
      ],
    });
  }

  function updateConstraint(listId: string, constraintId: string, patch: Partial<WatchConstraint>) {
    const list = lists.find((item) => item.id === listId);
    if (!list) return;

    updateList(listId, {
      constraints: list.constraints.map((constraint) =>
        constraint.id === constraintId
          ? {
              ...constraint,
              ...patch,
            }
          : constraint,
      ),
    });
  }

  function removeConstraint(listId: string, constraintId: string) {
    const list = lists.find((item) => item.id === listId);
    if (!list) return;

    updateList(listId, {
      constraints: list.constraints.filter((constraint) => constraint.id !== constraintId),
    });
  }

  async function syncIntelligence() {
    setScanStatus("checking");

    try {
      const response = await fetch("/api/intelligence/scan", { cache: "no-store" });
      if (!response.ok) throw new Error("Intelligence scan failed.");

      const payload = (await response.json()) as IntelligenceScan;
      setIntelligence(payload);
      saveJson(INTELLIGENCE_SCAN_CACHE_KEY, payload);
      setScanStatus("synced");
      setMessage("Intelligence scan synced into watchlists.");
    } catch (error) {
      setScanStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not sync Intelligence.");
    }
  }

  async function runListCheck(list: AdvisorWatchlist, source: "manual" | "auto") {
    setScanStatus("checking");

    try {
      const response = await fetch("/api/workspace/watchlists/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          list,
          intelligence,
          recentEvents: events.slice(0, 80),
          source,
        }),
      });

      if (!response.ok) throw new Error("Watchlist check failed.");

      const payload = (await response.json()) as CheckResponse;

      if (payload.triggered.length) {
        setEvents((current) => [...payload.triggered, ...current].slice(0, 100));
      }

      setScanStatus("synced");
      setMessage(payload.message);
    } catch (error) {
      setScanStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not check watchlist.");
    }
  }

  async function runAllChecks(source: "manual" | "auto") {
    setScanStatus("checking");

    const eligibleLists = lists.filter((list) => list.enabled && list.items.length && list.constraints.some((constraint) => constraint.enabled));

    if (!eligibleLists.length) {
      setMessage("No enabled lists with securities and constraints are ready to check.");
      setScanStatus("idle");
      return;
    }

    for (const list of eligibleLists) {
      await runListCheck(list, source);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.12),_transparent_36%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-4 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-4">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="absolute right-[-120px] top-[-160px] hidden h-[360px] w-[360px] rounded-full border border-red-500/10 xl:block">
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-24 rounded-full border border-white/10" />
          </div>

          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px] xl:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Workspace Watchlists</Pill>
                <Pill tone="cyan">Intelligence Connected</Pill>
                <Pill tone="purple">Custom Board Alerts</Pill>
                <Pill tone={autoCheck ? "green" : "amber"}>{autoCheck ? "Auto Check On" : "Manual Check"}</Pill>
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Advisor watchlist command center.
              </h1>

              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400 md:text-base">
                Create separate advisor watchlists, add up to 20 securities per list, assign up to two constraints per list,
                sync Intelligence, and send email notifications when a security qualifies.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  New List
                </div>
                <div className="mt-2 grid gap-2">
                  <input
                    value={newListName}
                    onChange={(event) => setNewListName(event.target.value)}
                    placeholder="List name, e.g. Earnings Watch"
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />
                  <input
                    value={newListEmail}
                    onChange={(event) => setNewListEmail(event.target.value)}
                    placeholder="Notification email for this list"
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={createList}
                    className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30"
                  >
                    Create List
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <a href="/workspace" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-center text-xs font-black text-white">
                  Workspace
                </a>
                <a href="/workspace/custom-board" className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-center text-xs font-black text-cyan-100">
                  Board
                </a>
                <a href="/intelligence" className="rounded-2xl border border-purple-500/25 bg-purple-500/10 px-4 py-3 text-center text-xs font-black text-purple-100">
                  Intelligence
                </a>
              </div>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm font-bold text-slate-200">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <Card className="h-fit p-3 xl:sticky xl:top-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                  Lists
                </div>
                <h2 className="mt-1 text-2xl font-black">Advisor lists</h2>
              </div>
              <Pill tone="cyan">{lists.length}</Pill>
            </div>

            <div className="mt-4 grid gap-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setActiveListId(list.id)}
                  className={cx(
                    "rounded-2xl border p-3 text-left transition",
                    activeListId === list.id
                      ? "border-white bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">{list.name}</div>
                      <div className={cx("mt-1 truncate text-[11px]", activeListId === list.id ? "text-slate-600" : "text-slate-500")}>
                        {list.items.length}/20 securities · {list.constraints.length}/2 constraints
                      </div>
                    </div>
                    <span className={cx("h-3 w-3 rounded-full shadow-lg", dotClass(list.tone))} />
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setCustomBoardList(buildCustomBoardList());
                  setActiveListId("custom-board-alerts");
                }}
                className={cx(
                  "rounded-2xl border p-3 text-left transition",
                  activeListId === "custom-board-alerts"
                    ? "border-white bg-white text-slate-950"
                    : "border-purple-500/25 bg-purple-500/10 text-purple-100 hover:bg-purple-500/15",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black">Custom Board Alerts</div>
                    <div className={cx("mt-1 truncate text-[11px]", activeListId === "custom-board-alerts" ? "text-slate-600" : "text-purple-200")}>
                      {customBoardList.items.length}/20 derived securities
                    </div>
                  </div>
                  <span className={cx("h-3 w-3 rounded-full shadow-lg", dotClass("purple"))} />
                </div>
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Rules
              </div>
              <div className="mt-2 grid gap-2 text-xs leading-5 text-slate-400">
                <div>• Max 20 securities per list.</div>
                <div>• Max 2 constraints per list.</div>
                <div>• Emails send when checks qualify.</div>
                <div>• Intelligence is synced from advisor tools.</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            {activeListId === "custom-board-alerts" ? (
              <WatchlistDetail
                list={customBoardList}
                readOnly
                onUpdate={() => undefined}
                onDelete={() => undefined}
                onAddSecurity={() => undefined}
                newSymbol={newSymbol}
                setNewSymbol={setNewSymbol}
                onRemoveSecurity={() => undefined}
                onAddConstraint={() => undefined}
                onUpdateConstraint={() => undefined}
                onRemoveConstraint={() => undefined}
                onRunCheck={() => runListCheck(customBoardList, "manual")}
              />
            ) : activeList ? (
              <WatchlistDetail
                list={activeList}
                onUpdate={(patch) => updateList(activeList.id, patch)}
                onDelete={() => deleteList(activeList.id)}
                onAddSecurity={addSecurityToActiveList}
                newSymbol={newSymbol}
                setNewSymbol={setNewSymbol}
                onRemoveSecurity={(securityId) => removeSecurity(activeList.id, securityId)}
                onAddConstraint={() => addConstraint(activeList.id)}
                onUpdateConstraint={(constraintId, patch) => updateConstraint(activeList.id, constraintId, patch)}
                onRemoveConstraint={(constraintId) => removeConstraint(activeList.id, constraintId)}
                onRunCheck={() => runListCheck(activeList, "manual")}
              />
            ) : null}
          </Card>

          <div className="grid h-fit gap-4 xl:sticky xl:top-4">
            <Card className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    Intelligence
                  </div>
                  <h2 className="mt-1 text-xl font-black">Signal feed</h2>
                </div>
                <Pill tone={scanStatus === "synced" ? "green" : scanStatus === "checking" ? "amber" : scanStatus === "error" ? "red" : "slate"}>
                  {scanStatus}
                </Pill>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={syncIntelligence}
                  className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-3 text-xs font-black text-cyan-100"
                >
                  Sync Intel
                </button>
                <button
                  type="button"
                  onClick={() => runAllChecks("manual")}
                  className="rounded-2xl border border-red-500/25 bg-red-500/10 px-3 py-3 text-xs font-black text-red-100"
                >
                  Check Lists
                </button>
              </div>

              <button
                type="button"
                onClick={() => setAutoCheck((current) => !current)}
                className={cx(
                  "mt-2 w-full rounded-2xl border px-3 py-3 text-xs font-black",
                  autoCheck ? toneClass("green") : toneClass("slate"),
                )}
              >
                {autoCheck ? "Auto Check Active" : "Turn On Auto Check"}
              </button>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-400">
                True closed-browser “instant” delivery should be wired to a Vercel Cron or worker calling the same check API. This page checks immediately while open and can be cron-wired later.
              </div>
            </Card>

            <Card className="p-3">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                Recent Triggers
              </div>
              <div className="mt-3 grid gap-2">
                {(activeEvents.length ? activeEvents : events.slice(0, 8)).map((event) => (
                  <div key={event.id} className={cx("rounded-2xl border p-3", toneClass(priorityTone(event.priority)))}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-black text-white">{event.symbol}</div>
                      <Pill tone={priorityTone(event.priority)}>{event.priority}</Pill>
                    </div>
                    <div className="mt-1 text-xs leading-5 text-slate-300">{event.message}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {event.emailSent ? "Email sent" : event.emailSkippedReason || "Email not sent"} · {event.createdAt}
                    </div>
                  </div>
                ))}

                {!events.length ? (
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-400">
                    No triggered securities yet.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="p-3">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                Intelligence Alerts
              </div>
              <div className="mt-3 grid gap-2">
                {intelligenceAlerts.map((item) => (
                  <div key={item.id} className={cx("rounded-2xl border p-3", toneClass(item.urgency === "Critical" ? "red" : item.urgency === "High" ? "amber" : "slate"))}>
                    <div className="text-xs font-black text-white">{item.title}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-300">{item.summary}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      {item.urgency} · {item.matchedTickers.join(", ") || "Market"}
                    </div>
                  </div>
                ))}

                {!intelligenceAlerts.length ? (
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-400">
                    Sync Intelligence to pull current alert candidates into the watchlist engine.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function WatchlistDetail({
  list,
  readOnly = false,
  onUpdate,
  onDelete,
  onAddSecurity,
  newSymbol,
  setNewSymbol,
  onRemoveSecurity,
  onAddConstraint,
  onUpdateConstraint,
  onRemoveConstraint,
  onRunCheck,
}: {
  list: AdvisorWatchlist;
  readOnly?: boolean;
  onUpdate: (patch: Partial<AdvisorWatchlist>) => void;
  onDelete: () => void;
  onAddSecurity: () => void;
  newSymbol: string;
  setNewSymbol: (value: string) => void;
  onRemoveSecurity: (securityId: string) => void;
  onAddConstraint: () => void;
  onUpdateConstraint: (constraintId: string, patch: Partial<WatchConstraint>) => void;
  onRemoveConstraint: (constraintId: string) => void;
  onRunCheck: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Pill tone={list.tone}>{readOnly ? "Derived List" : "Advisor List"}</Pill>
            <Pill tone={list.enabled ? "green" : "slate"}>{list.enabled ? "Enabled" : "Paused"}</Pill>
            <Pill tone="cyan">{list.items.length}/20 securities</Pill>
            <Pill tone="purple">{list.constraints.length}/2 constraints</Pill>
          </div>

          <input
            disabled={readOnly}
            value={list.name}
            onChange={(event) => onUpdate({ name: event.target.value })}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-3xl font-black text-white outline-none ring-red-500 disabled:opacity-100 focus:ring-2"
          />

          <textarea
            disabled={readOnly}
            value={list.description}
            onChange={(event) => onUpdate({ description: event.target.value })}
            rows={2}
            className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold leading-6 text-slate-300 outline-none ring-red-500 placeholder:text-slate-600 disabled:opacity-100 focus:ring-2"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:w-[340px] lg:grid-cols-1">
          <button
            type="button"
            onClick={onRunCheck}
            className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100"
          >
            Check This List Now
          </button>

          {!readOnly ? (
            <button
              type="button"
              onClick={() => onUpdate({ enabled: !list.enabled })}
              className={cx("rounded-2xl border px-4 py-3 text-xs font-black", list.enabled ? toneClass("green") : toneClass("slate"))}
            >
              {list.enabled ? "Pause List" : "Enable List"}
            </button>
          ) : null}

          {!readOnly ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-black text-slate-300 hover:text-white"
            >
              Delete List
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                  Securities
                </div>
                <div className="mt-1 text-sm font-bold text-slate-400">
                  Add stocks, ETFs, indices, crypto, futures, or other TradingView-style securities.
                </div>
              </div>

              {!readOnly ? (
                <div className="flex gap-2 lg:w-[420px]">
                  <input
                    value={newSymbol}
                    onChange={(event) => setNewSymbol(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onAddSecurity();
                    }}
                    placeholder="NASDAQ:AAPL, AMEX:SPY, SP:SPX..."
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={onAddSecurity}
                    className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.items.map((item) => (
                <div key={item.id} className="group rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-base font-black text-white">{item.symbol}</div>
                      <div className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                        {item.tvSymbol} · {item.assetType}
                      </div>
                    </div>

                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={() => onRemoveSecurity(item.id)}
                        className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black text-slate-300 hover:text-white"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>

                  {item.note ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.note}</p> : null}
                </div>
              ))}

              {!list.items.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-6 text-slate-400">
                  No securities added yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid h-fit gap-4">
          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                  List Constraints
                </div>
                <div className="mt-1 text-sm font-bold text-slate-400">
                  Up to two metrics per list.
                </div>
              </div>

              {!readOnly ? (
                <button
                  type="button"
                  onClick={onAddConstraint}
                  className="rounded-2xl border border-purple-500/25 bg-purple-500/10 px-3 py-2 text-xs font-black text-purple-100"
                >
                  Add
                </button>
              ) : null}
            </div>

            {!readOnly ? (
              <div className="mt-3 grid grid-cols-2 rounded-2xl border border-white/10 bg-black/25 p-1">
                {(["OR", "AND"] as ConstraintJoin[]).map((join) => (
                  <button
                    key={join}
                    type="button"
                    onClick={() => onUpdate({ constraintJoin: join })}
                    className={cx(
                      "rounded-xl px-3 py-2 text-xs font-black",
                      list.constraintJoin === join ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/[0.075] hover:text-white",
                    )}
                  >
                    {join}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-3 grid gap-3">
              {list.constraints.map((constraint) => (
                <ConstraintEditor
                  key={constraint.id}
                  constraint={constraint}
                  readOnly={readOnly}
                  onUpdate={(patch) => onUpdateConstraint(constraint.id, patch)}
                  onRemove={() => onRemoveConstraint(constraint.id)}
                />
              ))}

              {!list.constraints.length ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-400">
                  No constraints configured.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
              Email Delivery
            </div>

            <input
              disabled={readOnly}
              value={list.notificationEmail}
              onChange={(event) => onUpdate({ notificationEmail: event.target.value })}
              placeholder="advisor@firm.com"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 disabled:opacity-100 focus:ring-2"
            />

            <p className="mt-3 text-xs leading-5 text-slate-400">
              Notifications are sent by the server check route when securities qualify. For true always-on instant alerts, connect this same API route to a scheduled worker or Vercel Cron.
            </p>
          </div>

          <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Active Rules
            </div>
            <div className="mt-3 grid gap-2">
              {list.constraints.map((constraint) => (
                <div key={constraint.id} className={cx("rounded-2xl border p-3", toneClass(priorityTone(constraint.priority)))}>
                  <div className="text-xs font-black text-white">{constraintSentence(constraint)}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    {constraint.priority} · {constraint.enabled ? "Enabled" : "Paused"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConstraintEditor({
  constraint,
  readOnly,
  onUpdate,
  onRemove,
}: {
  constraint: WatchConstraint;
  readOnly: boolean;
  onUpdate: (patch: Partial<WatchConstraint>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={cx("rounded-2xl border p-3", toneClass(priorityTone(constraint.priority)))}>
      <div className="flex items-center justify-between gap-3">
        <Pill tone={priorityTone(constraint.priority)}>{constraint.priority}</Pill>
        {!readOnly ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black text-slate-300 hover:text-white"
          >
            ×
          </button>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        <select
          disabled={readOnly}
          value={constraint.metricId}
          onChange={(event) => onUpdate({ metricId: event.target.value as MetricId })}
          className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-white outline-none ring-red-500 disabled:opacity-100 focus:ring-2"
        >
          {metricOptions.map((metric) => (
            <option key={metric.id} value={metric.id}>
              {metric.label} · {metric.group}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select
            disabled={readOnly}
            value={constraint.condition}
            onChange={(event) => onUpdate({ condition: event.target.value as ConstraintCondition })}
            className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-white outline-none ring-red-500 disabled:opacity-100 focus:ring-2"
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
            <option value="between">Between</option>
            <option value="moves-by">Moves by</option>
            <option value="crosses-above">Cross above</option>
            <option value="crosses-below">Cross below</option>
            <option value="news-at-least">News at least</option>
          </select>

          <select
            disabled={readOnly}
            value={constraint.priority}
            onChange={(event) => onUpdate({ priority: event.target.value as Priority })}
            className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-white outline-none ring-red-500 disabled:opacity-100 focus:ring-2"
          >
            <option value="Monitor">Monitor</option>
            <option value="Important">Important</option>
            <option value="Critical">Critical</option>
          </select>
        </div>

        <div className={cx("grid gap-2", constraint.condition === "between" ? "grid-cols-2" : "grid-cols-1")}>
          <input
            disabled={readOnly}
            value={constraint.value}
            onChange={(event) => onUpdate({ value: event.target.value })}
            placeholder={constraint.condition === "news-at-least" ? "High, Critical, 75..." : "Threshold"}
            className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 disabled:opacity-100 focus:ring-2"
          />

          {constraint.condition === "between" ? (
            <input
              disabled={readOnly}
              value={constraint.upperValue}
              onChange={(event) => onUpdate({ upperValue: event.target.value })}
              placeholder="Upper"
              className="rounded-xl border border-white/10 bg-black/55 px-3 py-2 text-xs font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 disabled:opacity-100 focus:ring-2"
            />
          ) : null}
        </div>

        {!readOnly ? (
          <button
            type="button"
            onClick={() => onUpdate({ enabled: !constraint.enabled })}
            className={cx("rounded-xl border px-3 py-2 text-xs font-black", constraint.enabled ? toneClass("green") : toneClass("slate"))}
          >
            {constraint.enabled ? "Enabled" : "Paused"}
          </button>
        ) : null}
      </div>
    </div>
  );
}