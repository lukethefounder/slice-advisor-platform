"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type View = "overview" | "crypto" | "penny-stocks" | "venture" | "risk";

type User = {
  id: string;
  name: string;
  email: string;
};

type Firm = {
  id: string;
  name: string;
  firmEmail: string | null;
  firmCode: string;
};

type Membership = {
  id: string;
  firmId: string;
  userId: string;
  role: string;
  status: string;
  canManageProjects: boolean;
  canManageFirm: boolean;
};

type EnrichedCryptoCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  sparkline_in_7d?: {
    price: number[];
  };
  last_updated?: string | null;
  trendLabel: string;
  riskScore: number;
  riskLevel: string;
  opportunityScore: number;
  liquidityScore: number;
  advisorNotes: string[];
};

type FearGreed = {
  source: string;
  value: number | null;
  classification: string;
  updatedAt: string | null;
  history: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
};

type AlternativeVenture = {
  id: string;
  startupName: string;
  founderName: string | null;
  sector: string;
  stage: string;
  website: string | null;
  background: string;
  problemToSolve: string;
  solution: string | null;
  equityOfferedPct: number;
  tentativeValuation: number;
  amountSought: number | null;
  traction: string | null;
  thesis: string | null;
  keyRisks: string | null;
  monitoringStatus: string;
  riskLevel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
};

type AlternativePennyStock = {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  thesis: string | null;
  catalyst: string | null;
  riskNotes: string | null;
  targetEntry: string | null;
  maxPositionPct: number | null;
  status: string;
  riskLevel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
};

type AlternativeData = {
  firms: Array<Firm & { membership: Membership }>;
  firm: Firm | null;
  membership: Membership | null;
  crypto: {
    markets: EnrichedCryptoCoin[];
    leaders: EnrichedCryptoCoin[];
    highestRisk: EnrichedCryptoCoin[];
    fearGreed: FearGreed;
    sentiment: {
      regime: string;
      riskComment: string;
    };
    fetchedAt: string;
    sources: string[];
  };
  pennyStocks: AlternativePennyStock[];
  ventures: AlternativeVenture[];
  stats: {
    ventureStats: {
      count: number;
      watching: number;
      diligence: number;
      passed: number;
      averageValuation: number;
      averageEquityOffered: number;
    };
    pennyStats: {
      count: number;
      watching: number;
      activeReview: number;
      passed: number;
    };
  };
  riskFramework: Array<{
    label: string;
    riskLevel: string;
    primaryRisks: string;
  }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  if (Math.abs(value) >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 10 ? 2 : 6,
  }).format(value);
}

function numberFormat(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toneFromScore(score: number): "red" | "green" | "amber" | "slate" | "purple" {
  if (score >= 85) return "red";
  if (score >= 70) return "amber";
  if (score >= 55) return "purple";
  if (score >= 40) return "green";
  return "slate";
}

function toneForStatus(status: string): "red" | "green" | "amber" | "slate" | "purple" {
  const lower = status.toLowerCase();

  if (lower.includes("pass") || lower.includes("blocked") || lower.includes("extreme")) return "red";
  if (lower.includes("active") || lower.includes("diligence")) return "green";
  if (lower.includes("watch") || lower.includes("review")) return "amber";
  if (lower.includes("venture") || lower.includes("crypto")) return "purple";
  return "slate";
}

function changeTone(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-slate-400";
  if (value > 0) return "text-emerald-300";
  if (value < 0) return "text-red-300";
  return "text-slate-400";
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
          Alternative Investments
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
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

function ScoreBar({
  value,
  tone = "red",
}: {
  value: number;
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const fills = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return (
      <div className="flex h-16 items-center justify-center rounded-2xl bg-black/30 text-xs font-bold text-slate-600">
        No sparkline
      </div>
    );
  }

  const width = 220;
  const height = 64;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-16 w-full rounded-2xl bg-black/30"
      role="img"
      aria-label="7 day price sparkline"
    >
      <polyline
        fill="none"
        stroke={isUp ? "rgb(110 231 183)" : "rgb(252 165 165)"}
        strokeWidth="3"
        points={points}
      />
    </svg>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition focus:ring-2";

const viewTabs: Array<{ id: View; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "Alternative dashboard" },
  { id: "crypto", label: "Crypto Markets", description: "Live crypto data" },
  { id: "penny-stocks", label: "Penny Stocks", description: "Speculative equities" },
  { id: "venture", label: "Venture Monitor", description: "Startup opportunities" },
  { id: "risk", label: "Risk Framework", description: "Suitability guardrails" },
];

export default function AlternativeInvestmentsPage() {
  const [data, setData] = useState<AlternativeData | null>(null);
  const [activeView, setActiveView] = useState<View>("overview");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ventureForm, setVentureForm] = useState({
    startupName: "",
    founderName: "",
    sector: "Technology",
    stage: "Seed",
    website: "",
    background: "",
    problemToSolve: "",
    solution: "",
    equityOfferedPct: "",
    tentativeValuation: "",
    amountSought: "",
    traction: "",
    thesis: "",
    keyRisks: "",
    monitoringStatus: "Watching",
    riskLevel: "Very High",
    notes: "",
  });

  const [pennyForm, setPennyForm] = useState({
    ticker: "",
    companyName: "",
    sector: "Unknown",
    thesis: "",
    catalyst: "",
    riskNotes: "",
    targetEntry: "",
    maxPositionPct: "",
    status: "Watching",
    riskLevel: "Extreme",
    notes: "",
  });

  const firm = data?.firm ?? null;
  const membership = data?.membership ?? null;
  const canManage =
    membership?.role === "Owner" ||
    Boolean(membership?.canManageProjects) ||
    Boolean(membership?.canManageFirm);

  const cryptoMarkets = data?.crypto.markets ?? [];
  const ventures = data?.ventures ?? [];
  const pennyStocks = data?.pennyStocks ?? [];

  const aggregateCryptoMarketCap = useMemo(() => {
    return cryptoMarkets.reduce((sum, coin) => sum + (coin.market_cap ?? 0), 0);
  }, [cryptoMarkets]);

  const aggregateCryptoVolume = useMemo(() => {
    return cryptoMarkets.reduce((sum, coin) => sum + (coin.total_volume ?? 0), 0);
  }, [cryptoMarkets]);

  const cryptoBreadth = useMemo(() => {
    if (!cryptoMarkets.length) return 0;
    const positive = cryptoMarkets.filter((coin) => (coin.price_change_percentage_24h ?? 0) > 0).length;
    return Math.round((positive / cryptoMarkets.length) * 100);
  }, [cryptoMarkets]);

  function setView(view: View) {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState({}, "", url.toString());
  }

  async function loadData() {
    const response = await fetch("/api/alternative-investments", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load alternative investments.");
      return;
    }

    setData(payload);
  }

  async function postAction(body: Record<string, unknown>) {
    if (!firm) {
      setMessage("A firm workspace is required before saving alternative investments.");
      return null;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/alternative-investments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firmId: firm.id,
          ...body,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Action failed.");
        return null;
      }

      setData(payload);
      return payload;
    } finally {
      setSaving(false);
    }
  }

  async function createVenture(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createVenture",
      ...ventureForm,
    });

    if (payload) {
      setVentureForm({
        startupName: "",
        founderName: "",
        sector: "Technology",
        stage: "Seed",
        website: "",
        background: "",
        problemToSolve: "",
        solution: "",
        equityOfferedPct: "",
        tentativeValuation: "",
        amountSought: "",
        traction: "",
        thesis: "",
        keyRisks: "",
        monitoringStatus: "Watching",
        riskLevel: "Very High",
        notes: "",
      });
      setView("venture");
      setMessage("Venture added to firm monitor.");
    }
  }

  async function updateVentureStatus(ventureId: string, monitoringStatus: string) {
    const payload = await postAction({
      action: "updateVentureStatus",
      ventureId,
      monitoringStatus,
    });

    if (payload) {
      setView("venture");
      setMessage(`Venture status updated to ${monitoringStatus}.`);
    }
  }

  async function createPennyStock(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createPennyStock",
      ...pennyForm,
    });

    if (payload) {
      setPennyForm({
        ticker: "",
        companyName: "",
        sector: "Unknown",
        thesis: "",
        catalyst: "",
        riskNotes: "",
        targetEntry: "",
        maxPositionPct: "",
        status: "Watching",
        riskLevel: "Extreme",
        notes: "",
      });
      setView("penny-stocks");
      setMessage("Penny stock added to watchlist.");
    }
  }

  async function updatePennyStatus(pennyStockId: string, status: string) {
    const payload = await postAction({
      action: "updatePennyStockStatus",
      pennyStockId,
      status,
    });

    if (payload) {
      setView("penny-stocks");
      setMessage(`Penny stock status updated to ${status}.`);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view") as View | null;

    if (view && viewTabs.some((tab) => tab.id === view)) {
      setActiveView(view);
    }

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
            Loading alternative investment workspace...
          </div>
        </div>
      </main>
    );
  }

  if (!firm) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <div className="mx-auto max-w-4xl">
          <Logo />

          <Card className="mt-8 p-6">
            <Pill tone="amber">Firm required</Pill>
            <h1 className="mt-4 text-3xl font-black">
              Create or join a firm first.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Alternative investments are tracked at the firm level so advisors can share the same crypto dashboard, penny-stock watchlist, and venture monitor.
            </p>

            <a
              href="/workspace"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
            >
              Open Workspace
            </a>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-[10px] font-black uppercase text-slate-500">
                  Firm
                </div>
                <div className="max-w-[190px] truncate text-sm font-black">
                  {firm.name}
                </div>
              </div>

              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>

              <a
                href="/market-visuals"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Market Visuals
              </a>

              <button
                onClick={() => void loadData()}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40"
              >
                Refresh Live Data
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === tab.id
                    ? "bg-white text-slate-950 shadow-lg shadow-red-950/30"
                    : "bg-white/[0.055] text-white hover:bg-white/[0.09]"
                )}
              >
                <div className="truncate text-sm font-black">{tab.label}</div>
                <div
                  className={cx(
                    "mt-1 truncate text-[10px] font-semibold",
                    activeView === tab.id ? "text-slate-600" : "text-slate-500"
                  )}
                >
                  {tab.description}
                </div>
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
          {activeView === "overview" ? (
            <>
              <Card className="relative p-5 md:p-6">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-600/18 to-transparent" />

                <div className="relative">
                  <SectionTitle
                    eyebrow="High-risk allocation layer"
                    title="Alternative investments for less risk-averse strategies."
                    description="Crypto, penny stocks, and venture opportunities are isolated from safer client portfolios while still giving the firm a serious monitoring layer."
                    action={<Pill tone="red">High risk only</Pill>}
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <MetricBubble label="Tracked Crypto" value={cryptoMarkets.length} helper="Live market cards" tone="purple" />
                    <MetricBubble label="Crypto Market Cap" value={money(aggregateCryptoMarketCap)} helper="Tracked basket" tone="green" />
                    <MetricBubble label="24h Breadth" value={`${cryptoBreadth}%`} helper="Positive movers" tone="amber" />
                    <MetricBubble label="Fear & Greed" value={data?.crypto.fearGreed.value ?? "—"} helper={data?.crypto.fearGreed.classification ?? "Unavailable"} tone="red" />
                  </div>
                </div>
              </Card>

              <div className="grid gap-5 xl:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setView("crypto")}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
                >
                  <Pill tone="purple">Crypto</Pill>
                  <h3 className="mt-4 text-2xl font-black">Crypto Markets</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Live crypto prices, sentiment, volatility, liquidity, and opportunity scoring.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setView("penny-stocks")}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
                >
                  <Pill tone="red">Extreme Risk</Pill>
                  <h3 className="mt-4 text-2xl font-black">Penny Stocks</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Track speculative tickers, catalysts, thesis, entry ideas, and risk notes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setView("venture")}
                  className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
                >
                  <Pill tone="amber">Venture</Pill>
                  <h3 className="mt-4 text-2xl font-black">Venture Monitor</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Track startups, founders, valuation, equity offered, traction, thesis, and diligence status.
                  </p>
                </button>
              </div>

              <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
                <Card className="p-5">
                  <SectionTitle
                    eyebrow="Market sentiment"
                    title={data?.crypto.sentiment.regime ?? "Sentiment unavailable"}
                    description={data?.crypto.sentiment.riskComment}
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <SoftCard>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Sentiment Source
                      </div>
                      <div className="mt-2 text-xl font-black">
                        {data?.crypto.fearGreed.source}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        Updated: {shortDate(data?.crypto.fearGreed.updatedAt)}
                      </div>
                    </SoftCard>

                    <SoftCard>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                        Volume
                      </div>
                      <div className="mt-2 text-xl font-black">
                        {money(aggregateCryptoVolume)}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        Tracked 24h crypto volume
                      </div>
                    </SoftCard>
                  </div>

                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-xs font-black uppercase text-slate-500">
                      <span>Fear</span>
                      <span>Greed</span>
                    </div>
                    <ScoreBar
                      value={data?.crypto.fearGreed.value ?? 0}
                      tone={toneFromScore(data?.crypto.fearGreed.value ?? 0)}
                    />
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionTitle
                    eyebrow="Firm alternative book"
                    title="Internal risk inventory"
                    description="Firm-added penny stocks and venture opportunities stay visible without being mixed into safer client portfolios."
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <MetricBubble label="Venture Deals" value={data?.stats.ventureStats.count ?? 0} helper="Firm added" tone="purple" />
                    <MetricBubble label="Penny Stocks" value={data?.stats.pennyStats.count ?? 0} helper="Firm watchlist" tone="red" />
                    <MetricBubble label="Avg Venture Valuation" value={money(data?.stats.ventureStats.averageValuation ?? 0)} helper="Tentative" tone="green" />
                    <MetricBubble label="Avg Equity Offered" value={`${numberFormat(data?.stats.ventureStats.averageEquityOffered ?? 0)}%`} helper="Founder offer" tone="amber" />
                  </div>
                </Card>
              </div>
            </>
          ) : null}

          {activeView === "crypto" ? (
            <>
              <Card className="p-5 md:p-6">
                <SectionTitle
                  eyebrow="Crypto Markets"
                  title="Live crypto monitoring"
                  description="Crypto is treated as a high-risk, high-volatility segment. This dashboard shows price, liquidity, risk score, opportunity score, and 7-day momentum."
                  action={<Pill tone="purple">{data?.crypto.sources.join(" · ")}</Pill>}
                />

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <MetricBubble label="Market Cap" value={money(aggregateCryptoMarketCap)} helper="Tracked coins" tone="green" />
                  <MetricBubble label="Volume" value={money(aggregateCryptoVolume)} helper="Tracked 24h" tone="amber" />
                  <MetricBubble label="Breadth" value={`${cryptoBreadth}%`} helper="Positive 24h movers" tone="purple" />
                  <MetricBubble label="Sentiment" value={data?.crypto.fearGreed.classification ?? "—"} helper={`${data?.crypto.fearGreed.value ?? "—"}/100`} tone="red" />
                </div>
              </Card>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {cryptoMarkets.map((coin) => (
                  <Card key={coin.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {coin.image ? (
                          <img src={coin.image} alt="" className="h-10 w-10 rounded-full" />
                        ) : null}
                        <div className="min-w-0">
                          <div className="truncate text-xl font-black">{coin.name}</div>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                            {coin.symbol} · Rank {coin.market_cap_rank ?? "—"}
                          </div>
                        </div>
                      </div>
                      <Pill tone={toneFromScore(coin.riskScore)}>{coin.riskLevel}</Pill>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <MetricBubble label="Price" value={money(coin.current_price)} helper="Current" tone="purple" />
                      <MetricBubble label="24h" value={pct(coin.price_change_percentage_24h)} helper="Move" tone={(coin.price_change_percentage_24h ?? 0) >= 0 ? "green" : "red"} />
                    </div>

                    <div className="mt-4">
                      <Sparkline values={coin.sparkline_in_7d?.price ?? []} />
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] font-black uppercase text-slate-500">
                          <span>Opportunity</span>
                          <span>{coin.opportunityScore}/100</span>
                        </div>
                        <ScoreBar value={coin.opportunityScore} tone="green" />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] font-black uppercase text-slate-500">
                          <span>Risk</span>
                          <span>{coin.riskScore}/100</span>
                        </div>
                        <ScoreBar value={coin.riskScore} tone={toneFromScore(coin.riskScore)} />
                      </div>
                      <div>
                        <div className="mb-1 flex justify-between text-[10px] font-black uppercase text-slate-500">
                          <span>Liquidity</span>
                          <span>{coin.liquidityScore}/100</span>
                        </div>
                        <ScoreBar value={coin.liquidityScore} tone="purple" />
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-sm font-black text-white">{coin.trendLabel}</div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {coin.advisorNotes[0]}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          ) : null}

          {activeView === "penny-stocks" ? (
            <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="Penny Stocks"
                  title="Add speculative equity watch"
                  description="Track ultra-high-risk tickers separately from client portfolios."
                />

                {canManage ? (
                  <form onSubmit={createPennyStock} className="mt-5 grid gap-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={pennyForm.ticker}
                        onChange={(event) =>
                          setPennyForm((current) => ({
                            ...current,
                            ticker: event.target.value.toUpperCase(),
                          }))
                        }
                        className={inputClass}
                        placeholder="Ticker"
                      />
                      <input
                        value={pennyForm.companyName}
                        onChange={(event) =>
                          setPennyForm((current) => ({
                            ...current,
                            companyName: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Company name"
                      />
                    </div>

                    <input
                      value={pennyForm.sector}
                      onChange={(event) =>
                        setPennyForm((current) => ({ ...current, sector: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Sector"
                    />

                    <textarea
                      value={pennyForm.thesis}
                      onChange={(event) =>
                        setPennyForm((current) => ({ ...current, thesis: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Thesis"
                      rows={3}
                    />

                    <textarea
                      value={pennyForm.catalyst}
                      onChange={(event) =>
                        setPennyForm((current) => ({ ...current, catalyst: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Catalyst"
                      rows={3}
                    />

                    <textarea
                      value={pennyForm.riskNotes}
                      onChange={(event) =>
                        setPennyForm((current) => ({ ...current, riskNotes: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Risk notes"
                      rows={3}
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={pennyForm.targetEntry}
                        onChange={(event) =>
                          setPennyForm((current) => ({ ...current, targetEntry: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Target entry"
                      />
                      <input
                        value={pennyForm.maxPositionPct}
                        onChange={(event) =>
                          setPennyForm((current) => ({ ...current, maxPositionPct: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Max position %"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <select
                        value={pennyForm.status}
                        onChange={(event) =>
                          setPennyForm((current) => ({ ...current, status: event.target.value }))
                        }
                        className={selectClass}
                      >
                        <option>Watching</option>
                        <option>Active Review</option>
                        <option>Passed</option>
                      </select>

                      <select
                        value={pennyForm.riskLevel}
                        onChange={(event) =>
                          setPennyForm((current) => ({ ...current, riskLevel: event.target.value }))
                        }
                        className={selectClass}
                      >
                        <option>Extreme</option>
                        <option>Very High</option>
                        <option>High</option>
                      </select>
                    </div>

                    <button
                      disabled={saving}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                    >
                      Add Penny Stock
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                    You need project-management or firm-admin permission to add penny stocks.
                  </div>
                )}
              </Card>

              <div className="grid gap-4">
                {pennyStocks.length ? (
                  pennyStocks.map((stock) => (
                    <Card key={stock.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-2xl font-black">{stock.ticker}</div>
                          <div className="mt-1 text-sm text-slate-400">{stock.companyName}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={toneForStatus(stock.status)}>{stock.status}</Pill>
                          <Pill tone="red">{stock.riskLevel}</Pill>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <MetricBubble label="Sector" value={stock.sector} helper="Market area" tone="purple" />
                        <MetricBubble label="Target Entry" value={stock.targetEntry ?? "—"} helper="Internal view" tone="amber" />
                        <MetricBubble label="Max Position" value={stock.maxPositionPct ? `${stock.maxPositionPct}%` : "—"} helper="Risk cap" tone="red" />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <SoftCard>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Thesis</div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{stock.thesis ?? "No thesis recorded."}</p>
                        </SoftCard>
                        <SoftCard>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Risks</div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{stock.riskNotes ?? "No risk notes recorded."}</p>
                        </SoftCard>
                      </div>

                      {canManage ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {["Watching", "Active Review", "Passed"].map((status) => (
                            <button
                              key={`${stock.id}-${status}`}
                              type="button"
                              onClick={() => updatePennyStatus(stock.id, status)}
                              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10"
                            >
                              Mark {status}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center">
                    <Pill tone="amber">No penny stocks</Pill>
                    <h3 className="mt-4 text-2xl font-black">No speculative equities added yet.</h3>
                    <p className="mt-2 text-sm text-slate-400">Use the form to add the first firm-level penny stock record.</p>
                  </Card>
                )}
              </div>
            </div>
          ) : null}

          {activeView === "venture" ? (
            <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="Venture Monitor"
                  title="Add startup opportunity"
                  description="This tab now works as a direct firm-level venture tracker. Add startups, founder details, background, valuation, equity offered, traction, thesis, and risk notes."
                />

                {canManage ? (
                  <form onSubmit={createVenture} className="mt-5 grid gap-3">
                    <input
                      value={ventureForm.startupName}
                      onChange={(event) =>
                        setVentureForm((current) => ({ ...current, startupName: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Startup name"
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={ventureForm.founderName}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, founderName: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Founder name"
                      />
                      <input
                        value={ventureForm.website}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, website: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Website"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={ventureForm.sector}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, sector: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Sector"
                      />
                      <select
                        value={ventureForm.stage}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, stage: event.target.value }))
                        }
                        className={selectClass}
                      >
                        <option>Idea</option>
                        <option>Pre-Seed</option>
                        <option>Seed</option>
                        <option>Series A</option>
                        <option>Growth</option>
                      </select>
                    </div>

                    <textarea
                      value={ventureForm.background}
                      onChange={(event) =>
                        setVentureForm((current) => ({ ...current, background: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Short background"
                      rows={3}
                    />

                    <textarea
                      value={ventureForm.problemToSolve}
                      onChange={(event) =>
                        setVentureForm((current) => ({ ...current, problemToSolve: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Problem to solve"
                      rows={3}
                    />

                    <textarea
                      value={ventureForm.solution}
                      onChange={(event) =>
                        setVentureForm((current) => ({ ...current, solution: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Solution"
                      rows={3}
                    />

                    <div className="grid gap-3 md:grid-cols-3">
                      <input
                        value={ventureForm.equityOfferedPct}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, equityOfferedPct: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Equity offered %"
                      />
                      <input
                        value={ventureForm.tentativeValuation}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, tentativeValuation: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Tentative valuation"
                      />
                      <input
                        value={ventureForm.amountSought}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, amountSought: event.target.value }))
                        }
                        className={inputClass}
                        placeholder="Amount sought"
                      />
                    </div>

                    <textarea
                      value={ventureForm.traction}
                      onChange={(event) =>
                        setVentureForm((current) => ({ ...current, traction: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Traction"
                      rows={3}
                    />

                    <textarea
                      value={ventureForm.thesis}
                      onChange={(event) =>
                        setVentureForm((current) => ({ ...current, thesis: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Investment thesis"
                      rows={3}
                    />

                    <textarea
                      value={ventureForm.keyRisks}
                      onChange={(event) =>
                        setVentureForm((current) => ({ ...current, keyRisks: event.target.value }))
                      }
                      className={inputClass}
                      placeholder="Key risks"
                      rows={3}
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <select
                        value={ventureForm.monitoringStatus}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, monitoringStatus: event.target.value }))
                        }
                        className={selectClass}
                      >
                        <option>Watching</option>
                        <option>Diligence</option>
                        <option>Passed</option>
                      </select>

                      <select
                        value={ventureForm.riskLevel}
                        onChange={(event) =>
                          setVentureForm((current) => ({ ...current, riskLevel: event.target.value }))
                        }
                        className={selectClass}
                      >
                        <option>Extreme</option>
                        <option>Very High</option>
                        <option>High</option>
                      </select>
                    </div>

                    <button
                      disabled={saving}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                    >
                      Add Venture
                    </button>
                  </form>
                ) : (
                  <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
                    You need project-management or firm-admin permission to add ventures.
                  </div>
                )}
              </Card>

              <div className="grid gap-4">
                {ventures.length ? (
                  ventures.map((venture) => (
                    <Card key={venture.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-2xl font-black">{venture.startupName}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {venture.founderName ?? "Unknown founder"} · {venture.sector} · {venture.stage}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={toneForStatus(venture.monitoringStatus)}>{venture.monitoringStatus}</Pill>
                          <Pill tone="red">{venture.riskLevel}</Pill>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <MetricBubble label="Valuation" value={money(venture.tentativeValuation)} helper="Tentative" tone="green" />
                        <MetricBubble label="Equity" value={`${numberFormat(venture.equityOfferedPct)}%`} helper="Offered" tone="amber" />
                        <MetricBubble label="Amount" value={money(venture.amountSought)} helper="Sought" tone="purple" />
                        <MetricBubble label="Updated" value={shortDate(venture.updatedAt)} helper="Last review" tone="slate" />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <SoftCard>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Background</div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{venture.background}</p>
                        </SoftCard>
                        <SoftCard>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Problem</div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{venture.problemToSolve}</p>
                        </SoftCard>
                        <SoftCard>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Thesis</div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{venture.thesis ?? "No thesis recorded."}</p>
                        </SoftCard>
                        <SoftCard>
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Risks</div>
                          <p className="mt-2 text-sm leading-6 text-slate-300">{venture.keyRisks ?? "No risks recorded."}</p>
                        </SoftCard>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {venture.website ? (
                          <a
                            href={venture.website.startsWith("http") ? venture.website : `https://${venture.website}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                          >
                            Open Website
                          </a>
                        ) : null}

                        {canManage ? (
                          <>
                            {["Watching", "Diligence", "Passed"].map((status) => (
                              <button
                                key={`${venture.id}-${status}`}
                                type="button"
                                onClick={() => updateVentureStatus(venture.id, status)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10"
                              >
                                Mark {status}
                              </button>
                            ))}
                          </>
                        ) : null}
                      </div>
                    </Card>
                  ))
                ) : (
                  <Card className="p-8 text-center">
                    <Pill tone="amber">No ventures</Pill>
                    <h3 className="mt-4 text-2xl font-black">No venture opportunities added yet.</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Use the form to add the first startup to the firm’s venture monitor.
                    </p>
                  </Card>
                )}
              </div>
            </div>
          ) : null}

          {activeView === "risk" ? (
            <div className="grid gap-5">
              <Card className="p-5 md:p-6">
                <SectionTitle
                  eyebrow="Risk Framework"
                  title="Alternative-investment guardrails"
                  description="This section keeps high-risk investments clearly separated from core advisor workflows and conservative client portfolios."
                />
              </Card>

              <div className="grid gap-5 xl:grid-cols-3">
                {data?.riskFramework.map((item) => (
                  <Card key={item.label} className="p-5">
                    <Pill tone="red">{item.riskLevel}</Pill>
                    <h3 className="mt-4 text-2xl font-black">{item.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {item.primaryRisks}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}