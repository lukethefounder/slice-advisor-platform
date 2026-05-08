"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

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
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

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
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

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
    return cryptoMarkets.reduce(
      (sum, coin) => sum + (coin.market_cap ?? 0),
      0
    );
  }, [cryptoMarkets]);

  const aggregateCryptoVolume = useMemo(() => {
    return cryptoMarkets.reduce(
      (sum, coin) => sum + (coin.total_volume ?? 0),
      0
    );
  }, [cryptoMarkets]);

  const cryptoBreadth = useMemo(() => {
    if (!cryptoMarkets.length) return 0;

    const positive = cryptoMarkets.filter(
      (coin) => (coin.price_change_percentage_24h ?? 0) > 0
    ).length;

    return Math.round((positive / cryptoMarkets.length) * 100);
  }, [cryptoMarkets]);

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
    if (!firm) return null;

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
      setMessage(`Penny stock status updated to ${status}.`);
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
              Alternative investments are tracked at the firm level so advisors
              can share the same crypto dashboard, penny stock watchlist, and
              venture monitor.
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
                href="/investment-comparison"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Compare
              </a>

              <button
                onClick={() => void loadData()}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40"
              >
                Refresh Live Data
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              ["overview", "Overview"],
              ["crypto", "Crypto Markets"],
              ["penny-stocks", "Penny Stocks"],
              ["venture", "Venture Monitor"],
              ["risk", "Risk Framework"],
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
          {activeView === "overview" ? (
            <>
              <Card className="relative p-5 md:p-6">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-600/18 to-transparent" />

                <div className="relative">
                  <SectionTitle
                    eyebrow="High-risk allocation layer"
                    title="Alternative investments for less risk-averse strategies."
                    description="This page highlights riskier investment segments with potential for higher return: crypto markets, crypto trade trends, penny-stock watchlists, and firm-controlled venture monitoring."
                    action={
                      <Pill tone="red">
                        Not suitable for conservative portfolios
                      </Pill>
                    }
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <MetricBubble
                      label="Tracked Crypto"
                      value={cryptoMarkets.length}
                      helper="Live market cards"
                      tone="purple"
                    />
                    <MetricBubble
                      label="Crypto Market Cap"
                      value={money(aggregateCryptoMarketCap)}
                      helper="Tracked basket"
                      tone="green"
                    />
                    <MetricBubble
                      label="24h Breadth"
                      value={`${cryptoBreadth}%`}
                      helper="Positive movers"
                      tone="amber"
                    />
                    <MetricBubble
                      label="Fear & Greed"
                      value={data?.crypto.fearGreed.value ?? "—"}
                      helper={data?.crypto.fearGreed.classification ?? "Unavailable"}
                      tone="red"
                    />
                  </div>
                </div>
              </Card>

              <section className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
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
                    <MetricBubble
                      label="Venture Deals"
                      value={data?.stats.ventureStats.count ?? 0}
                      helper="Firm added"
                      tone="purple"
                    />
                    <MetricBubble
                      label="Penny Stocks"
                      value={data?.stats.pennyStats.count ?? 0}
                      helper="Firm watchlist"
                      tone="red"
                    />
                    <MetricBubble
                      label="Avg Venture Valuation"
                      value={money(data?.stats.ventureStats.averageValuation ?? 0)}
                      helper="Tentative"
                      tone="green"
                    />
                    <MetricBubble
                      label="Avg Equity Offered"
                      value={`${numberFormat(
                        data?.stats.ventureStats.averageEquityOffered ?? 0
                      )}%`}
                      helper="Founder offer"
                      tone="amber"
                    />
                  </div>
                </Card>
              </section>

              <section className="grid gap-5 xl:grid-cols-3">
                {data?.riskFramework.map((item) => (
                  <Card key={item.label} className="p-5">
                    <Pill tone="red">{item.riskLevel}</Pill>
                    <h3 className="mt-4 text-2xl font-black">{item.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {item.primaryRisks}
                    </p>
                  </Card>
                ))}
              </section>
            </>
          ) : null}

          {activeView === "crypto" ? (
            <>
              <Card className="p-5 md:p-6">
                <SectionTitle
                  eyebrow="Crypto market dashboard"
                  title="Live crypto markets, trend signals, and trade risk."
                  description="Crypto data refreshes at runtime from public market data. Use this as a high-risk decision-support layer, not a standalone trade recommendation engine."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <MetricBubble
                    label="Basket Market Cap"
                    value={money(aggregateCryptoMarketCap)}
                    helper="Tracked assets"
                    tone="green"
                  />
                  <MetricBubble
                    label="Basket Volume"
                    value={money(aggregateCryptoVolume)}
                    helper="24h"
                    tone="purple"
                  />
                  <MetricBubble
                    label="Positive Breadth"
                    value={`${cryptoBreadth}%`}
                    helper="24h movers"
                    tone="amber"
                  />
                  <MetricBubble
                    label="Sentiment"
                    value={data?.crypto.fearGreed.classification ?? "—"}
                    helper={`${data?.crypto.fearGreed.value ?? "—"} / 100`}
                    tone="red"
                  />
                </div>
              </Card>

              <section className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
                <Card className="p-5">
                  <SectionTitle
                    eyebrow="Crypto watch grid"
                    title="Risk and opportunity by asset"
                    description="Scores are heuristic and designed for fast advisor review."
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {cryptoMarkets.map((coin) => (
                      <div
                        key={coin.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-3">
                              {coin.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={coin.image}
                                  alt={coin.name}
                                  className="h-8 w-8 rounded-full"
                                />
                              ) : null}
                              <div>
                                <h3 className="truncate text-lg font-black">
                                  {coin.name}
                                </h3>
                                <div className="text-xs font-bold uppercase text-slate-500">
                                  {coin.symbol}
                                </div>
                              </div>
                            </div>
                          </div>

                          <Pill tone={toneFromScore(coin.riskScore)}>
                            {coin.riskLevel}
                          </Pill>
                        </div>

                        <div className="mt-4">
                          <Sparkline values={coin.sparkline_in_7d?.price ?? []} />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          <SoftCard>
                            <div className="text-[10px] font-black uppercase text-slate-500">
                              Price
                            </div>
                            <div className="mt-1 text-xl font-black">
                              {money(coin.current_price)}
                            </div>
                          </SoftCard>

                          <SoftCard>
                            <div className="text-[10px] font-black uppercase text-slate-500">
                              24h
                            </div>
                            <div
                              className={cx(
                                "mt-1 text-xl font-black",
                                changeTone(coin.price_change_percentage_24h)
                              )}
                            >
                              {pct(coin.price_change_percentage_24h)}
                            </div>
                          </SoftCard>
                        </div>

                        <div className="mt-4 grid gap-3">
                          <div>
                            <div className="mb-2 flex justify-between text-[10px] font-black uppercase text-slate-500">
                              <span>Risk</span>
                              <span>{coin.riskScore}</span>
                            </div>
                            <ScoreBar
                              value={coin.riskScore}
                              tone={toneFromScore(coin.riskScore)}
                            />
                          </div>

                          <div>
                            <div className="mb-2 flex justify-between text-[10px] font-black uppercase text-slate-500">
                              <span>Opportunity</span>
                              <span>{coin.opportunityScore}</span>
                            </div>
                            <ScoreBar
                              value={coin.opportunityScore}
                              tone="green"
                            />
                          </div>

                          <div>
                            <div className="mb-2 flex justify-between text-[10px] font-black uppercase text-slate-500">
                              <span>Liquidity</span>
                              <span>{coin.liquidityScore}</span>
                            </div>
                            <ScoreBar
                              value={coin.liquidityScore}
                              tone="purple"
                            />
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs font-semibold leading-5 text-slate-400">
                          {coin.trendLabel}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="grid gap-5">
                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Momentum leaders"
                      title="Potential upside candidates"
                      description="Highest opportunity scores in the tracked crypto basket."
                    />

                    <div className="mt-5 grid gap-3">
                      {data?.crypto.leaders.map((coin, index) => (
                        <SoftCard key={coin.id}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-black">
                                #{index + 1} {coin.name}
                              </div>
                              <div className="mt-1 truncate text-xs text-slate-500">
                                {coin.trendLabel}
                              </div>
                            </div>
                            <Pill tone="green">{coin.opportunityScore}</Pill>
                          </div>
                        </SoftCard>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Risk leaders"
                      title="Highest risk names"
                      description="These names have the highest volatility/liquidity risk profile."
                    />

                    <div className="mt-5 grid gap-3">
                      {data?.crypto.highestRisk.map((coin, index) => (
                        <SoftCard key={coin.id}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-black">
                                #{index + 1} {coin.name}
                              </div>
                              <div className="mt-1 truncate text-xs text-slate-500">
                                {coin.riskLevel}
                              </div>
                            </div>
                            <Pill tone="red">{coin.riskScore}</Pill>
                          </div>
                        </SoftCard>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5">
                    <SectionTitle
                      eyebrow="Data sources"
                      title="Current data layer"
                      description="Crypto market information uses runtime public API calls."
                    />

                    <div className="mt-5 grid gap-3">
                      {data?.crypto.sources.map((source) => (
                        <SoftCard key={source}>
                          <div className="text-sm font-black">{source}</div>
                        </SoftCard>
                      ))}
                    </div>
                  </Card>
                </div>
              </section>
            </>
          ) : null}

          {activeView === "penny-stocks" ? (
            <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="Penny stock watchlist"
                  title="Add high-risk public microcap ideas."
                  description="This watchlist is firm-controlled. Live penny stock pricing should be connected later through a reliable equities data vendor."
                />

                {!canManage ? (
                  <div className="mt-5 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-200">
                    You can view this watchlist, but only firm managers can add
                    or update records.
                  </div>
                ) : (
                  <form onSubmit={createPennyStock} className="mt-5 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={pennyForm.ticker}
                        onChange={(event) =>
                          setPennyForm((current) => ({
                            ...current,
                            ticker: event.target.value,
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

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={pennyForm.sector}
                        onChange={(event) =>
                          setPennyForm((current) => ({
                            ...current,
                            sector: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Sector"
                      />

                      <select
                        value={pennyForm.status}
                        onChange={(event) =>
                          setPennyForm((current) => ({
                            ...current,
                            status: event.target.value,
                          }))
                        }
                        className={selectClass}
                      >
                        <option>Watching</option>
                        <option>Active Review</option>
                        <option>Passed</option>
                        <option>Do Not Touch</option>
                      </select>
                    </div>

                    <textarea
                      value={pennyForm.thesis}
                      onChange={(event) =>
                        setPennyForm((current) => ({
                          ...current,
                          thesis: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-24")}
                      placeholder="Thesis"
                    />

                    <textarea
                      value={pennyForm.catalyst}
                      onChange={(event) =>
                        setPennyForm((current) => ({
                          ...current,
                          catalyst: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-20")}
                      placeholder="Potential catalyst"
                    />

                    <textarea
                      value={pennyForm.riskNotes}
                      onChange={(event) =>
                        setPennyForm((current) => ({
                          ...current,
                          riskNotes: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-20")}
                      placeholder="Risk notes: dilution, liquidity, filings, promotion risk, etc."
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={pennyForm.targetEntry}
                        onChange={(event) =>
                          setPennyForm((current) => ({
                            ...current,
                            targetEntry: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Target entry notes"
                      />

                      <input
                        value={pennyForm.maxPositionPct}
                        onChange={(event) =>
                          setPennyForm((current) => ({
                            ...current,
                            maxPositionPct: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Max position %"
                      />
                    </div>

                    <button
                      disabled={saving}
                      className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                    >
                      Add Penny Stock
                    </button>
                  </form>
                )}
              </Card>

              <Card className="p-5">
                <SectionTitle
                  eyebrow="Watchlist"
                  title="Firm penny stock monitor"
                  description="Keep speculative public names separate from the standard portfolio lab."
                />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {pennyStocks.length ? (
                    pennyStocks.map((stock) => (
                      <div
                        key={stock.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-2xl font-black">
                              {stock.ticker}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-slate-400">
                              {stock.companyName}
                            </div>
                          </div>
                          <Pill tone="red">{stock.riskLevel}</Pill>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Pill tone="purple">{stock.sector}</Pill>
                          <Pill tone="amber">{stock.status}</Pill>
                          {stock.maxPositionPct !== null ? (
                            <Pill tone="slate">
                              Max {stock.maxPositionPct}% position
                            </Pill>
                          ) : null}
                        </div>

                        {stock.thesis ? (
                          <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">
                            {stock.thesis}
                          </p>
                        ) : null}

                        {stock.catalyst ? (
                          <SoftCard className="mt-4">
                            <div className="text-[10px] font-black uppercase text-slate-500">
                              Catalyst
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
                              {stock.catalyst}
                            </p>
                          </SoftCard>
                        ) : null}

                        {stock.riskNotes ? (
                          <SoftCard className="mt-4">
                            <div className="text-[10px] font-black uppercase text-red-300">
                              Risk notes
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
                              {stock.riskNotes}
                            </p>
                          </SoftCard>
                        ) : null}

                        {canManage ? (
                          <div className="mt-4 grid gap-2 md:grid-cols-2">
                            {["Watching", "Active Review", "Passed", "Do Not Touch"].map(
                              (status) => (
                                <button
                                  key={status}
                                  onClick={() => updatePennyStatus(stock.id, status)}
                                  disabled={saving}
                                  className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20 disabled:opacity-60"
                                >
                                  {status}
                                </button>
                              )
                            )}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No penny stocks added yet.
                    </div>
                  )}
                </div>
              </Card>
            </section>
          ) : null}

          {activeView === "venture" ? (
            <section className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="Venture monitor"
                  title="Add startups the firm wants to track."
                  description="Only firm-added ventures appear here. Each record captures founder background, problem solved, equity offered, tentative valuation, traction, thesis, and risk notes."
                />

                {!canManage ? (
                  <div className="mt-5 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm font-bold text-amber-200">
                    You can view venture records, but only firm managers can add
                    or update them.
                  </div>
                ) : (
                  <form onSubmit={createVenture} className="mt-5 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={ventureForm.startupName}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            startupName: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Startup name"
                      />

                      <input
                        value={ventureForm.founderName}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            founderName: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Founder name"
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <input
                        value={ventureForm.sector}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            sector: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Sector"
                      />

                      <select
                        value={ventureForm.stage}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            stage: event.target.value,
                          }))
                        }
                        className={selectClass}
                      >
                        <option>Idea</option>
                        <option>Pre-Seed</option>
                        <option>Seed</option>
                        <option>Series A</option>
                        <option>Series B</option>
                        <option>Growth</option>
                      </select>

                      <input
                        value={ventureForm.website}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            website: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Website"
                      />
                    </div>

                    <textarea
                      value={ventureForm.background}
                      onChange={(event) =>
                        setVentureForm((current) => ({
                          ...current,
                          background: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-24")}
                      placeholder="Short background"
                    />

                    <textarea
                      value={ventureForm.problemToSolve}
                      onChange={(event) =>
                        setVentureForm((current) => ({
                          ...current,
                          problemToSolve: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-24")}
                      placeholder="Problem to solve"
                    />

                    <textarea
                      value={ventureForm.solution}
                      onChange={(event) =>
                        setVentureForm((current) => ({
                          ...current,
                          solution: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-20")}
                      placeholder="Solution"
                    />

                    <div className="grid gap-3 md:grid-cols-3">
                      <input
                        value={ventureForm.equityOfferedPct}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            equityOfferedPct: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Equity offered %"
                      />

                      <input
                        value={ventureForm.tentativeValuation}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            tentativeValuation: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Tentative valuation $"
                      />

                      <input
                        value={ventureForm.amountSought}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            amountSought: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Amount sought $"
                      />
                    </div>

                    <textarea
                      value={ventureForm.traction}
                      onChange={(event) =>
                        setVentureForm((current) => ({
                          ...current,
                          traction: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-20")}
                      placeholder="Traction"
                    />

                    <textarea
                      value={ventureForm.thesis}
                      onChange={(event) =>
                        setVentureForm((current) => ({
                          ...current,
                          thesis: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-20")}
                      placeholder="Investment thesis"
                    />

                    <textarea
                      value={ventureForm.keyRisks}
                      onChange={(event) =>
                        setVentureForm((current) => ({
                          ...current,
                          keyRisks: event.target.value,
                        }))
                      }
                      className={cx(inputClass, "min-h-20")}
                      placeholder="Key risks"
                    />

                    <div className="grid gap-3 md:grid-cols-2">
                      <select
                        value={ventureForm.monitoringStatus}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            monitoringStatus: event.target.value,
                          }))
                        }
                        className={selectClass}
                      >
                        <option>Watching</option>
                        <option>Diligence</option>
                        <option>Negotiating</option>
                        <option>Invested</option>
                        <option>Passed</option>
                      </select>

                      <select
                        value={ventureForm.riskLevel}
                        onChange={(event) =>
                          setVentureForm((current) => ({
                            ...current,
                            riskLevel: event.target.value,
                          }))
                        }
                        className={selectClass}
                      >
                        <option>High</option>
                        <option>Very High</option>
                        <option>Extreme</option>
                      </select>
                    </div>

                    <button
                      disabled={saving}
                      className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                    >
                      Add Venture
                    </button>
                  </form>
                )}
              </Card>

              <Card className="p-5">
                <SectionTitle
                  eyebrow="Firm venture pipeline"
                  title="Tracked private opportunities"
                  description="This keeps venture ideas controlled, monitored, and separate from public-market workflows."
                />

                <div className="mt-5 grid gap-4">
                  {ventures.length ? (
                    ventures.map((venture) => (
                      <div
                        key={venture.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone="red">{venture.riskLevel}</Pill>
                              <Pill tone="purple">{venture.stage}</Pill>
                              <Pill tone="amber">{venture.monitoringStatus}</Pill>
                              <Pill tone="slate">{venture.sector}</Pill>
                            </div>

                            <h3 className="mt-4 text-2xl font-black">
                              {venture.startupName}
                            </h3>

                            {venture.founderName ? (
                              <div className="mt-1 text-sm font-semibold text-slate-500">
                                Founder: {venture.founderName}
                              </div>
                            ) : null}
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <SoftCard>
                              <div className="text-[10px] font-black uppercase text-slate-500">
                                Equity
                              </div>
                              <div className="mt-1 text-xl font-black">
                                {venture.equityOfferedPct}%
                              </div>
                            </SoftCard>

                            <SoftCard>
                              <div className="text-[10px] font-black uppercase text-slate-500">
                                Valuation
                              </div>
                              <div className="mt-1 text-xl font-black">
                                {money(venture.tentativeValuation)}
                              </div>
                            </SoftCard>

                            <SoftCard>
                              <div className="text-[10px] font-black uppercase text-slate-500">
                                Seeking
                              </div>
                              <div className="mt-1 text-xl font-black">
                                {money(venture.amountSought)}
                              </div>
                            </SoftCard>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-4 lg:grid-cols-2">
                          <SoftCard>
                            <div className="text-[10px] font-black uppercase text-slate-500">
                              Short background
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {venture.background}
                            </p>
                          </SoftCard>

                          <SoftCard>
                            <div className="text-[10px] font-black uppercase text-slate-500">
                              Problem to solve
                            </div>
                            <p className="mt-2 text-sm leading-6 text-slate-400">
                              {venture.problemToSolve}
                            </p>
                          </SoftCard>

                          {venture.solution ? (
                            <SoftCard>
                              <div className="text-[10px] font-black uppercase text-slate-500">
                                Solution
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {venture.solution}
                              </p>
                            </SoftCard>
                          ) : null}

                          {venture.traction ? (
                            <SoftCard>
                              <div className="text-[10px] font-black uppercase text-slate-500">
                                Traction
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {venture.traction}
                              </p>
                            </SoftCard>
                          ) : null}

                          {venture.thesis ? (
                            <SoftCard>
                              <div className="text-[10px] font-black uppercase text-emerald-300">
                                Thesis
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {venture.thesis}
                              </p>
                            </SoftCard>
                          ) : null}

                          {venture.keyRisks ? (
                            <SoftCard>
                              <div className="text-[10px] font-black uppercase text-red-300">
                                Key risks
                              </div>
                              <p className="mt-2 text-sm leading-6 text-slate-400">
                                {venture.keyRisks}
                              </p>
                            </SoftCard>
                          ) : null}
                        </div>

                        {canManage ? (
                          <div className="mt-5 grid gap-2 md:grid-cols-5">
                            {[
                              "Watching",
                              "Diligence",
                              "Negotiating",
                              "Invested",
                              "Passed",
                            ].map((status) => (
                              <button
                                key={status}
                                onClick={() =>
                                  updateVentureStatus(venture.id, status)
                                }
                                disabled={saving}
                                className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/20 disabled:opacity-60"
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No ventures added yet.
                    </div>
                  )}
                </div>
              </Card>
            </section>
          ) : null}

          {activeView === "risk" ? (
            <section className="grid gap-5">
              <Card className="p-5 md:p-6">
                <SectionTitle
                  eyebrow="Alternative investment risk framework"
                  title="This page is intentionally separated from standard portfolio work."
                  description="Crypto, penny stocks, and venture investments can produce outsized returns, but they can also lead to severe or total losses. This module should be used for tracking, research, and controlled advisor review."
                />

                <div className="mt-5 grid gap-5 lg:grid-cols-3">
                  {data?.riskFramework.map((item) => (
                    <SoftCard key={item.label}>
                      <Pill tone="red">{item.riskLevel}</Pill>
                      <h3 className="mt-4 text-2xl font-black">{item.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {item.primaryRisks}
                      </p>
                    </SoftCard>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle
                  eyebrow="Advisor guardrails"
                  title="Suggested controls before any high-risk allocation."
                  description="These guardrails are here to keep the platform useful without making risky investments look easy."
                />

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {[
                    "Require written thesis, catalyst, downside case, and exit conditions.",
                    "Cap position size according to the client’s risk tolerance and liquidity needs.",
                    "Separate speculative ideas from core portfolio holdings.",
                    "Document whether the investment is liquid, restricted, speculative, or illiquid.",
                    "Use source-backed data and avoid promotional material, social hype, and unverified claims.",
                    "For ventures, track founder quality, problem severity, market size, traction, dilution risk, and exit path.",
                    "For penny stocks, assume dilution, manipulation, and liquidity risk until proven otherwise.",
                    "For crypto, monitor custody, exchange, smart contract, regulatory, and volatility risk.",
                  ].map((item) => (
                    <SoftCard key={item}>
                      <p className="text-sm font-semibold leading-6 text-slate-300">
                        {item}
                      </p>
                    </SoftCard>
                  ))}
                </div>
              </Card>
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}