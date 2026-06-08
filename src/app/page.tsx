"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  LinkButton,
  Metric,
  Pill,
  Progress,
  SectionHeader,
  SliceBackground,
  SoftCard,
  TopNav,
  cx,
} from "@/components/slice-ui";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate" | "blue";

type ConsoleMode = "markets" | "clients" | "workflow" | "compliance";

type ActivityItem = {
  id: number;
  title: string;
  detail: string;
  tone: Tone;
};

type SymbolProfile = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  opportunity: number;
  risk: number;
  rsi: number;
  macd: number;
  trend: number;
  volumeSignal: number;
  support: number;
  resistance: number;
  role: string;
  clientFit: string;
  advisorAction: string;
  tone: Tone;
};

type SectorProfile = {
  name: string;
  short: string;
  change: number;
  breadth: number;
  opportunity: number;
  risk: number;
  note: string;
  action: string;
  holdings: string[];
};

type Signal = {
  title: string;
  category: string;
  confidence: number;
  impact: number;
  risk: number;
  action: string;
  clientLanguage: string;
  tone: Tone;
};

type ScannerRow = {
  symbol: string;
  company: string;
  sector: string;
  price: number;
  changePct: number;
  opportunity: number;
  risk: number;
  signal: string;
  volume: string;
  tone: Tone;
};

const chartColors = {
  red: "#ef4444",
  redSoft: "rgba(239,68,68,0.08)",
  green: "#22c55e",
  greenSoft: "rgba(34,197,94,0.08)",
  amber: "#f59e0b",
  purple: "#a855f7",
  cyan: "#06b6d4",
  grid: "rgba(255,255,255,0.08)",
  axis: "#64748b",
  tooltipBg: "#09090b",
};

const symbolProfiles: SymbolProfile[] = [
  {
    symbol: "SPY",
    name: "S&P 500 ETF",
    sector: "Broad Market",
    price: 534.18,
    change: 2.24,
    changePct: 0.42,
    opportunity: 72,
    risk: 46,
    rsi: 58,
    macd: 62,
    trend: 71,
    volumeSignal: 54,
    support: 520.4,
    resistance: 544.8,
    role: "Core U.S. equity beta",
    clientFit: "Balanced, growth, and core equity models.",
    advisorAction:
      "Use as the broad equity benchmark for model drift, core exposure, and client allocation review.",
    tone: "green",
  },
  {
    symbol: "QQQ",
    name: "Nasdaq 100 ETF",
    sector: "Growth Technology",
    price: 468.92,
    change: 3.18,
    changePct: 0.68,
    opportunity: 78,
    risk: 58,
    rsi: 64,
    macd: 69,
    trend: 79,
    volumeSignal: 61,
    support: 452.3,
    resistance: 481.6,
    role: "Growth and mega-cap technology",
    clientFit: "Growth and long-horizon taxable accounts.",
    advisorAction:
      "Monitor client concentration and duplicate exposure across growth models, direct holdings, and technology-heavy ETFs.",
    tone: "purple",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA",
    sector: "Semiconductors",
    price: 128.41,
    change: 1.57,
    changePct: 1.24,
    opportunity: 88,
    risk: 72,
    rsi: 71,
    macd: 82,
    trend: 88,
    volumeSignal: 76,
    support: 119.8,
    resistance: 136.5,
    role: "AI infrastructure bellwether",
    clientFit: "Aggressive growth and concentrated equity accounts.",
    advisorAction:
      "Review position-size limits and AI concentration before adding exposure for growth-oriented clients.",
    tone: "red",
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    sector: "Enterprise Software",
    price: 441.55,
    change: 1.37,
    changePct: 0.31,
    opportunity: 69,
    risk: 38,
    rsi: 56,
    macd: 59,
    trend: 66,
    volumeSignal: 45,
    support: 427.2,
    resistance: 454.9,
    role: "Enterprise AI and cloud",
    clientFit: "Core growth and quality compounder exposure.",
    advisorAction:
      "Use as a quality-growth anchor while monitoring valuation and mega-cap overlap.",
    tone: "blue",
  },
  {
    symbol: "TLT",
    name: "20+ Year Treasury ETF",
    sector: "Fixed Income",
    price: 91.84,
    change: -0.2,
    changePct: -0.22,
    opportunity: 61,
    risk: 54,
    rsi: 47,
    macd: 43,
    trend: 39,
    volumeSignal: 58,
    support: 88.7,
    resistance: 95.2,
    role: "Duration and rate sensitivity",
    clientFit: "Income, conservative, and balanced portfolios.",
    advisorAction:
      "Compare duration exposure against cash-flow needs, volatility tolerance, and rate sensitivity.",
    tone: "amber",
  },
  {
    symbol: "GLD",
    name: "Gold ETF",
    sector: "Real Assets",
    price: 221.63,
    change: 0.4,
    changePct: 0.18,
    opportunity: 57,
    risk: 33,
    rsi: 52,
    macd: 49,
    trend: 55,
    volumeSignal: 42,
    support: 214.1,
    resistance: 228.7,
    role: "Real asset hedge",
    clientFit: "Defensive ballast and alternative sleeve allocations.",
    advisorAction:
      "Use as a diversifier for inflation, geopolitical risk, and non-equity ballast.",
    tone: "amber",
  },
];

const sectors: SectorProfile[] = [
  {
    name: "Information Technology",
    short: "Tech",
    change: 1.18,
    breadth: 76,
    opportunity: 86,
    risk: 64,
    note: "Leadership remains concentrated in AI, semiconductors, cloud infrastructure, and high-quality software.",
    action:
      "Review position sizing, rebalance drift, and client concentration before adding exposure.",
    holdings: ["NVDA", "MSFT", "AAPL", "AVGO"],
  },
  {
    name: "Communication Services",
    short: "Comm",
    change: 0.74,
    breadth: 68,
    opportunity: 72,
    risk: 52,
    note: "Digital advertising, streaming scale, and platform profitability are driving relative strength.",
    action:
      "Compare exposure against Nasdaq concentration and identify client accounts with duplicated risk.",
    holdings: ["GOOGL", "META", "NFLX"],
  },
  {
    name: "Financials",
    short: "Banks",
    change: 0.38,
    breadth: 61,
    opportunity: 63,
    risk: 49,
    note: "Credit quality, yield curve movement, and deposit stability remain the key monitoring points.",
    action:
      "Check financial sector exposure against credit-sensitive holdings and regional bank overlap.",
    holdings: ["JPM", "BAC", "WFC"],
  },
  {
    name: "Health Care",
    short: "Health",
    change: -0.16,
    breadth: 44,
    opportunity: 55,
    risk: 42,
    note: "Defensive characteristics remain useful, but leadership is mixed across pharma, devices, and managed care.",
    action:
      "Use weakness to evaluate quality names, but avoid chasing without earnings confirmation.",
    holdings: ["LLY", "UNH", "JNJ"],
  },
  {
    name: "Consumer Discretionary",
    short: "Discr.",
    change: -0.42,
    breadth: 39,
    opportunity: 48,
    risk: 61,
    note: "Consumer resilience is uneven; rate sensitivity and discretionary spending pressure require closer review.",
    action:
      "Flag accounts with outsized exposure to high-beta retail, autos, and travel names.",
    holdings: ["AMZN", "TSLA", "HD"],
  },
  {
    name: "Energy",
    short: "Energy",
    change: -0.63,
    breadth: 35,
    opportunity: 51,
    risk: 68,
    note: "Commodity sensitivity, capital discipline, and geopolitical volatility are driving dispersion.",
    action:
      "Review dividend coverage and commodity sensitivity before increasing allocation.",
    holdings: ["XOM", "CVX", "COP"],
  },
];

const signals: Signal[] = [
  {
    title: "AI infrastructure leadership remains the primary growth driver",
    category: "Equity leadership",
    confidence: 88,
    impact: 84,
    risk: 66,
    action:
      "Review growth accounts for overlapping AI exposure across individual stocks, ETFs, and model allocations.",
    clientLanguage:
      "Technology leadership remains strong, but concentration and position size matter. We are reviewing exposure so participation stays aligned with your risk tolerance.",
    tone: "red",
  },
  {
    title: "Rate sensitivity still matters for income portfolios",
    category: "Rates and income",
    confidence: 81,
    impact: 71,
    risk: 58,
    action:
      "Compare bond sleeve duration against client cash flow needs and rebalance thresholds.",
    clientLanguage:
      "Bond exposure can still play a useful role, but long-duration positions may move sharply as rate expectations change.",
    tone: "amber",
  },
  {
    title: "Market breadth is the confirmation layer behind equity strength",
    category: "Risk appetite",
    confidence: 76,
    impact: 69,
    risk: 47,
    action:
      "Monitor whether participation expands beyond the largest technology and communication services names.",
    clientLanguage:
      "The market can look strong at the index level while underlying participation remains mixed. We are watching breadth before making broad allocation changes.",
    tone: "green",
  },
];

const scannerRows: ScannerRow[] = [
  {
    symbol: "NVDA",
    company: "NVIDIA",
    sector: "Semiconductors",
    price: 128.41,
    changePct: 1.24,
    opportunity: 88,
    risk: 72,
    signal: "AI leadership",
    volume: "Heavy",
    tone: "red",
  },
  {
    symbol: "MSFT",
    company: "Microsoft",
    sector: "Enterprise Software",
    price: 441.55,
    changePct: 0.31,
    opportunity: 69,
    risk: 38,
    signal: "Quality growth",
    volume: "Normal",
    tone: "blue",
  },
  {
    symbol: "AMZN",
    company: "Amazon",
    sector: "Consumer / Cloud",
    price: 184.72,
    changePct: -0.18,
    opportunity: 64,
    risk: 52,
    signal: "Margin watch",
    volume: "Normal",
    tone: "amber",
  },
  {
    symbol: "JPM",
    company: "JPMorgan",
    sector: "Financials",
    price: 201.14,
    changePct: 0.27,
    opportunity: 58,
    risk: 44,
    signal: "Credit quality",
    volume: "Light",
    tone: "green",
  },
  {
    symbol: "LLY",
    company: "Eli Lilly",
    sector: "Health Care",
    price: 884.39,
    changePct: -0.09,
    opportunity: 71,
    risk: 49,
    signal: "Defensive growth",
    volume: "Normal",
    tone: "purple",
  },
  {
    symbol: "XOM",
    company: "Exxon Mobil",
    sector: "Energy",
    price: 114.27,
    changePct: -0.63,
    opportunity: 51,
    risk: 68,
    signal: "Commodity pressure",
    volume: "Heavy",
    tone: "amber",
  },
];

const consoleModes: Record<
  ConsoleMode,
  {
    label: string;
    title: string;
    body: string;
    tone: Tone;
    metrics: Array<{ label: string; value: string; helper: string; tone: Tone }>;
    actions: string[];
  }
> = {
  markets: {
    label: "Markets",
    title: "Market command center",
    body: "Live market context, heat maps, signal scoring, technical analysis, watchlists, and portfolio impact live inside one advisor-ready surface.",
    tone: "red",
    metrics: [
      { label: "Signals", value: "42", helper: "Ranked by materiality", tone: "red" },
      { label: "Watchlists", value: "8", helper: "Advisor-defined", tone: "amber" },
      { label: "Models", value: "5", helper: "Exposure mapped", tone: "green" },
      { label: "Briefings", value: "11", helper: "Ready for review", tone: "purple" },
    ],
    actions: [
      "Review sector heat map and breadth before tactical decisions.",
      "Compare client models against affected securities and ETFs.",
      "Prepare advisor-approved market notes from selected signals.",
    ],
  },
  clients: {
    label: "Clients",
    title: "Client-aware communication layer",
    body: "Slice converts advisor intelligence into client-ready language with tone, suitability, risk context, portfolio exposure, and approval controls.",
    tone: "green",
    metrics: [
      { label: "Households", value: "124", helper: "Segmented", tone: "green" },
      { label: "Drafts", value: "18", helper: "Advisor review", tone: "red" },
      { label: "Meetings", value: "9", helper: "Prep queued", tone: "purple" },
      { label: "Profiles", value: "Live", helper: "Preference-aware", tone: "cyan" },
    ],
    actions: [
      "Generate client-specific briefing language from a market signal.",
      "Identify accounts with relevant holdings or allocation drift.",
      "Keep sensitive outreach advisor-approved before delivery.",
    ],
  },
  workflow: {
    label: "Workflow",
    title: "Firm execution and task routing",
    body: "Signals become operating tasks, team assignments, meeting prep, calendar visibility, notes, retained rationale, and follow-up actions.",
    tone: "purple",
    metrics: [
      { label: "Tasks", value: "36", helper: "Open actions", tone: "red" },
      { label: "Reviews", value: "14", helper: "In progress", tone: "amber" },
      { label: "Complete", value: "71%", helper: "Weekly execution", tone: "green" },
      { label: "Team", value: "Synced", helper: "Shared board", tone: "purple" },
    ],
    actions: [
      "Route market movement into a team review task.",
      "Connect client notes, meetings, and follow-ups into one queue.",
      "Give advisors a daily surface that shows what matters first.",
    ],
  },
  compliance: {
    label: "Compliance",
    title: "Evidence and approval memory",
    body: "Slice retains source context, rationale, approvals, advisor edits, client-ready language, delivery records, and review trails.",
    tone: "amber",
    metrics: [
      { label: "Approvals", value: "Gated", helper: "Advisor-controlled", tone: "green" },
      { label: "Evidence", value: "Stored", helper: "Source-backed", tone: "purple" },
      { label: "Audit", value: "Ready", helper: "Action memory", tone: "amber" },
      { label: "Risk", value: "Reduced", helper: "Process discipline", tone: "red" },
    ],
    actions: [
      "Store source rationale behind every recommendation.",
      "Track advisor edits before communication is delivered.",
      "Build an evidence trail from signal to action to outcome.",
    ],
  },
};

const marketOverviewData = [
  { name: "9:30", sp500: 100, nasdaq: 100, dow: 100, russell: 100 },
  { name: "10:30", sp500: 100.3, nasdaq: 100.6, dow: 100.1, russell: 99.9 },
  { name: "11:30", sp500: 100.1, nasdaq: 100.8, dow: 100.2, russell: 100.1 },
  { name: "12:30", sp500: 100.5, nasdaq: 101.2, dow: 100.3, russell: 100.2 },
  { name: "1:30", sp500: 100.8, nasdaq: 101.6, dow: 100.4, russell: 100.4 },
  { name: "2:30", sp500: 100.7, nasdaq: 101.5, dow: 100.5, russell: 100.2 },
  { name: "3:30", sp500: 101.0, nasdaq: 101.9, dow: 100.7, russell: 100.6 },
];

const workflowData = [
  { day: "Mon", signals: 18, actions: 9, retained: 6 },
  { day: "Tue", signals: 24, actions: 14, retained: 10 },
  { day: "Wed", signals: 21, actions: 12, retained: 8 },
  { day: "Thu", signals: 29, actions: 19, retained: 13 },
  { day: "Fri", signals: 26, actions: 16, retained: 12 },
];

const impactData = [
  { model: "Growth", exposure: 84, sensitivity: 72, action: 88 },
  { model: "Balanced", exposure: 57, sensitivity: 44, action: 63 },
  { model: "Income", exposure: 38, sensitivity: 61, action: 58 },
  { model: "Conservative", exposure: 25, sensitivity: 49, action: 42 },
  { model: "Alts", exposure: 31, sensitivity: 36, action: 47 },
];

const sectorChartData = sectors.map((sector) => ({
  name: sector.short,
  breadth: sector.breadth,
  opportunity: sector.opportunity,
  risk: sector.risk,
}));

const operatingData = [
  { name: "Signals", value: 42, quality: 88 },
  { name: "Clients", value: 124, quality: 81 },
  { name: "Tasks", value: 36, quality: 74 },
  { name: "Briefings", value: 18, quality: 86 },
  { name: "Approvals", value: 29, quality: 91 },
];

const indexCards = [
  {
    label: "S&P 500",
    value: "5,342",
    helper: "+0.42% broad participation",
    tone: "green" as Tone,
  },
  {
    label: "Nasdaq 100",
    value: "18,912",
    helper: "+0.68% growth leadership",
    tone: "purple" as Tone,
  },
  {
    label: "Dow 30",
    value: "39,114",
    helper: "+0.24% steady cyclicals",
    tone: "green" as Tone,
  },
  {
    label: "VIX",
    value: "13.8",
    helper: "Risk calm, complacency watch",
    tone: "amber" as Tone,
  },
];

function signedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function dollars(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toneBorder(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/25 bg-red-500/[0.07]",
    green: "border-emerald-500/25 bg-emerald-500/[0.07]",
    amber: "border-amber-500/25 bg-amber-500/[0.07]",
    purple: "border-purple-500/25 bg-purple-500/[0.07]",
    cyan: "border-cyan-500/25 bg-cyan-500/[0.07]",
    blue: "border-sky-500/25 bg-sky-500/[0.07]",
    slate: "border-slate-500/20 bg-slate-500/[0.06]",
  };

  return tones[tone];
}

function heatStyle(change: number, selected: boolean) {
  const positive = change >= 0;
  const strength = Math.min(0.46, Math.max(0.1, Math.abs(change) / 2.6));
  const base = positive ? "16,185,129" : "239,68,68";
  const border = positive ? "rgba(16,185,129,0.34)" : "rgba(239,68,68,0.34)";

  return {
    background: `linear-gradient(145deg, rgba(${base},${strength}) 0%, rgba(9,9,11,0.86) 58%, rgba(0,0,0,0.58) 100%)`,
    borderColor: selected ? border : "rgba(255,255,255,0.10)",
  };
}

function makePriceData(symbol: SymbolProfile) {
  const movements = [-3.2, -1.7, -2.4, 0.8, 1.9, 0.4, 2.8, 3.7, 2.9, 4.1, 3.2, 5.4];
  const volatilityBoost = symbol.risk / 100;
  const base = symbol.price * 0.94;

  return movements.map((move, index) => {
    const close = base + move * volatilityBoost + index * (symbol.trend / 180);

    return {
      month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][index],
      close: Number(close.toFixed(2)),
      support: symbol.support,
      resistance: symbol.resistance,
    };
  });
}

function addLogItem(
  current: ActivityItem[],
  title: string,
  detail: string,
  tone: Tone
) {
  return [
    {
      id: Date.now(),
      title,
      detail,
      tone,
    },
    ...current.slice(0, 5),
  ];
}

const tooltipStyle = {
  background: chartColors.tooltipBg,
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "16px",
  color: "#fff",
};

export default function LandingPage() {
  const [consoleMode, setConsoleMode] = useState<ConsoleMode>("markets");
  const [selectedSector, setSelectedSector] = useState(sectors[0]);
  const [selectedSymbol, setSelectedSymbol] = useState(symbolProfiles[0]);
  const [selectedSignal, setSelectedSignal] = useState(signals[0]);
  const [savedSymbols, setSavedSymbols] = useState<string[]>(["SPY", "QQQ"]);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([
    {
      id: 1,
      title: "Home command center loaded",
      detail:
        "All visuals are internal and ready: symbol chart, technical summary, heatmap, market overview, and equity scanner.",
      tone: "green",
    },
  ]);

  const activeConsole = consoleModes[consoleMode];
  const selectedPriceData = useMemo(
    () => makePriceData(selectedSymbol),
    [selectedSymbol]
  );

  function chooseSector(sector: SectorProfile) {
    setSelectedSector(sector);
    setActivityLog((current) =>
      addLogItem(
        current,
        "Sector selected",
        `${sector.name} loaded with advisor action, holdings, breadth, opportunity, and risk.`,
        sector.change >= 0 ? "green" : "red"
      )
    );
  }

  function chooseSymbol(symbol: SymbolProfile) {
    setSelectedSymbol(symbol);
    setActivityLog((current) =>
      addLogItem(
        current,
        "Symbol selected",
        `${symbol.symbol} loaded into the internal price chart and technical summary.`,
        symbol.tone
      )
    );
  }

  function saveSymbol(symbol: SymbolProfile) {
    if (!savedSymbols.includes(symbol.symbol)) {
      setSavedSymbols((current) => [symbol.symbol, ...current]);
      setActivityLog((current) =>
        addLogItem(
          current,
          "Watchlist updated",
          `${symbol.symbol} added to the advisor watchlist preview.`,
          "green"
        )
      );
      return;
    }

    setActivityLog((current) =>
      addLogItem(
        current,
        "Watchlist already tracking",
        `${symbol.symbol} is already saved in the advisor watchlist preview.`,
        "amber"
      )
    );
  }

  function chooseSignal(signal: Signal) {
    setSelectedSignal(signal);
    setActivityLog((current) =>
      addLogItem(
        current,
        "Signal selected",
        `${signal.category} intelligence loaded into the advisor briefing preview.`,
        signal.tone
      )
    );
  }

  function queueBriefing() {
    setActivityLog((current) =>
      addLogItem(
        current,
        "Briefing queued",
        `${selectedSignal.category} briefing prepared for advisor review.`,
        "red"
      )
    );
  }

  function queueClientMessage() {
    setActivityLog((current) =>
      addLogItem(
        current,
        "Client message drafted",
        `Client-ready language prepared from ${selectedSignal.category}.`,
        "green"
      )
    );
  }

  return (
    <SliceBackground>
      <div className="mx-auto grid max-w-[1660px] gap-6 px-5 py-5">
        <TopNav />

        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {[
              ["S&P 500", "+0.42%", "green"],
              ["Nasdaq 100", "+0.68%", "green"],
              ["Dow 30", "+0.24%", "green"],
              ["Russell 2000", "+0.31%", "green"],
              ["VIX", "-1.12%", "red"],
              ["10Y Yield", "+0.03", "amber"],
              ["Gold", "+0.18%", "green"],
              ["Oil", "-0.63%", "red"],
            ].map(([label, value, tone]) => (
              <div
                key={label}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3"
              >
                <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </div>
                <div
                  className={cx(
                    "mt-1 text-lg font-black",
                    tone === "green"
                      ? "text-emerald-300"
                      : tone === "red"
                        ? "text-red-300"
                        : "text-amber-300"
                  )}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] xl:items-stretch">
          <Card className="p-6 md:p-8">
            <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-red-500/10 via-red-500/[0.04] to-transparent" />

            <div className="relative">
              <Pill tone="red">Advisor intelligence operating system</Pill>

              <h1 className="mt-6 max-w-6xl text-5xl font-black leading-[0.94] tracking-tight md:text-6xl xl:text-7xl">
                The command layer for modern wealth advisors.
              </h1>

              <p className="mt-6 max-w-4xl text-base leading-8 text-slate-300 md:text-lg">
                Slice consolidates the portal, market dashboard, client
                intelligence, workflow routing, evidence memory, and advisor
                communication layer into one polished home page.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <LinkButton
                  href="/advisor-signup"
                  variant="primary"
                  className="px-6 py-4"
                >
                  Create Advisor Account
                </LinkButton>
                <LinkButton
                  href="/founder-login"
                  variant="danger"
                  className="px-6 py-4"
                >
                  Login
                </LinkButton>
                <LinkButton
                  href="/workspace"
                  variant="secondary"
                  className="px-6 py-4"
                >
                  Open Workspace
                </LinkButton>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric
                  label="Home"
                  value="Unified"
                  helper="Portal consolidated"
                  tone="red"
                />
                <Metric
                  label="Markets"
                  value="Visible"
                  helper="Internal visuals"
                  tone="amber"
                />
                <Metric
                  label="Clients"
                  value="Mapped"
                  helper="Impact and language"
                  tone="green"
                />
                <Metric
                  label="Memory"
                  value="Retained"
                  helper="Evidence and approvals"
                  tone="purple"
                />
              </div>
            </div>
          </Card>

          <div className="grid gap-5">
            <Card className="p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Pill tone={activeConsole.tone}>{activeConsole.label}</Pill>
                  <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                    {activeConsole.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {activeConsole.body}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {activeConsole.metrics.map((metric) => (
                  <Metric
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    helper={metric.helper}
                    tone={metric.tone}
                  />
                ))}
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-4">
                {(Object.keys(consoleModes) as ConsoleMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setConsoleMode(mode);
                      setActivityLog((current) =>
                        addLogItem(
                          current,
                          "Console changed",
                          `${consoleModes[mode].label} operating layer selected.`,
                          consoleModes[mode].tone
                        )
                      );
                    }}
                    className={cx(
                      "rounded-2xl border px-3 py-3 text-sm font-black transition hover:scale-[1.01]",
                      consoleMode === mode
                        ? toneBorder(consoleModes[mode].tone)
                        : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-red-400/30 hover:bg-white/[0.065]"
                    )}
                  >
                    {consoleModes[mode].label}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Pill tone="green">Action log</Pill>
                  <h2 className="mt-3 text-2xl font-black tracking-tight">
                    Working preview
                  </h2>
                </div>
                <LinkButton href="/workspace" variant="secondary">
                  Workspace
                </LinkButton>
              </div>

              <div className="mt-5 grid max-h-[260px] gap-3 overflow-auto pr-1">
                {activityLog.map((item) => (
                  <SoftCard key={item.id}>
                    <Pill tone={item.tone}>{item.title}</Pill>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {item.detail}
                    </p>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
          <Card className="p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <Pill tone={selectedSymbol.tone}>{selectedSymbol.symbol}</Pill>
                <h2 className="mt-3 text-2xl font-black tracking-tight">
                  {selectedSymbol.name}
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  {selectedSymbol.role} • {selectedSymbol.clientFit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => saveSymbol(selectedSymbol)}
                className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-white transition hover:border-red-400/30 hover:bg-white/[0.07]"
              >
                Track Symbol
              </button>
            </div>

            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Price"
                value={dollars(selectedSymbol.price)}
                helper={signedPercent(selectedSymbol.changePct)}
                tone={selectedSymbol.changePct >= 0 ? "green" : "red"}
              />
              <Metric
                label="Opportunity"
                value={`${selectedSymbol.opportunity}/100`}
                helper="Advisor priority"
                tone="green"
              />
              <Metric
                label="Risk"
                value={`${selectedSymbol.risk}/100`}
                helper="Sizing discipline"
                tone="amber"
              />
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {symbolProfiles.map((symbol) => (
                <button
                  key={symbol.symbol}
                  type="button"
                  onClick={() => chooseSymbol(symbol)}
                  className={cx(
                    "rounded-2xl border px-4 py-2 text-sm font-black transition",
                    selectedSymbol.symbol === symbol.symbol
                      ? toneBorder(symbol.tone)
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-red-400/30 hover:bg-white/[0.065]"
                  )}
                >
                  {symbol.symbol}
                </button>
              ))}
            </div>

            <div className="h-[420px] md:h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={selectedPriceData}>
                  <defs>
                    <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.red} stopOpacity={0.34} />
                      <stop offset="95%" stopColor={chartColors.red} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="month" stroke={chartColors.axis} fontSize={12} />
                  <YAxis stroke={chartColors.axis} fontSize={12} domain={["dataMin - 4", "dataMax + 4"]} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) =>
                      typeof value === "number" ? dollars(value) : value
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={chartColors.red}
                    fill="url(#priceFill)"
                    strokeWidth={3}
                  />
                  <Line
                    type="monotone"
                    dataKey="support"
                    stroke={chartColors.green}
                    strokeDasharray="5 5"
                    strokeOpacity={0.8}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="resistance"
                    stroke={chartColors.amber}
                    strokeDasharray="5 5"
                    strokeOpacity={0.8}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="grid gap-5">
            <Card className="p-5 md:p-6">
              <div className="mb-5">
                <Pill tone={selectedSymbol.tone}>Technical summary</Pill>
                <h2 className="mt-3 text-2xl font-black tracking-tight">
                  {selectedSymbol.symbol} technical summary
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  A fully internal summary, so the section stays visible and fast.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  ["RSI", selectedSymbol.rsi, "Momentum balance", "amber"],
                  ["MACD", selectedSymbol.macd, "Trend confirmation", "purple"],
                  ["Trend", selectedSymbol.trend, "Price direction", "green"],
                  ["Volume", selectedSymbol.volumeSignal, "Participation", "cyan"],
                ].map(([label, value, helper, tone]) => (
                  <SoftCard key={String(label)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">
                          {label}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {helper}
                        </div>
                      </div>
                      <div className="text-lg font-black text-white">
                        {value}
                      </div>
                    </div>
                    <div className="mt-3">
                      <Progress
                        value={Number(value)}
                        tone={tone as Exclude<Tone, "slate">}
                      />
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>

            <Card className="p-5 md:p-6">
              <div className="mb-5">
                <Pill tone="green">Saved watchlist</Pill>
                <h2 className="mt-3 text-2xl font-black tracking-tight">
                  Session watchlist
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {savedSymbols.map((symbol) => (
                  <span
                    key={symbol}
                    className="rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-4 py-2 text-sm font-black text-emerald-100"
                  >
                    {symbol}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid gap-3">
                {symbolProfiles.map((symbol) => (
                  <button
                    key={symbol.symbol}
                    type="button"
                    onClick={() => {
                      chooseSymbol(symbol);
                      saveSymbol(symbol);
                    }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-red-400/30 hover:bg-white/[0.065]"
                  >
                    <div>
                      <div className="text-sm font-black text-white">
                        {symbol.symbol}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {symbol.role}
                      </div>
                    </div>
                    <div
                      className={cx(
                        "text-sm font-black",
                        symbol.changePct >= 0 ? "text-emerald-300" : "text-red-300"
                      )}
                    >
                      {signedPercent(symbol.changePct)}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
          <Card className="p-6">
            <SectionHeader
              eyebrow="Internal market heatmap"
              title="Market pressure with advisor context."
              description="Click a sector to update holdings, action items, breadth, opportunity, and risk."
            />

            <div className="mt-6 grid auto-rows-[150px] gap-3 md:grid-cols-3">
              {sectors.map((sector) => {
                const selected = selectedSector.name === sector.name;

                return (
                  <button
                    key={sector.name}
                    type="button"
                    onClick={() => chooseSector(sector)}
                    style={heatStyle(sector.change, selected)}
                    className={cx(
                      "rounded-[1.5rem] border p-4 text-left shadow-lg shadow-black/20 transition hover:scale-[1.01]",
                      selected && "ring-2 ring-white/20"
                    )}
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
                            {sector.short}
                          </div>
                          <div className="mt-1 text-xl font-black text-white">
                            {sector.name}
                          </div>
                        </div>
                        <div
                          className={cx(
                            "rounded-full px-3 py-1 text-sm font-black",
                            sector.change >= 0
                              ? "bg-emerald-400/12 text-emerald-100"
                              : "bg-red-400/12 text-red-100"
                          )}
                        >
                          {signedPercent(sector.change)}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs font-bold text-white/75">
                        <div>
                          <div className="text-white/45">Breadth</div>
                          <div>{sector.breadth}</div>
                        </div>
                        <div>
                          <div className="text-white/45">Opp.</div>
                          <div>{sector.opportunity}</div>
                        </div>
                        <div>
                          <div className="text-white/45">Risk</div>
                          <div>{sector.risk}</div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <Pill tone={selectedSector.change >= 0 ? "green" : "red"}>
              {selectedSector.name}
            </Pill>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              Advisor sector panel
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              {selectedSector.note}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric
                label="Move"
                value={signedPercent(selectedSector.change)}
                helper="Sector direction"
                tone={selectedSector.change >= 0 ? "green" : "red"}
              />
              <Metric
                label="Opportunity"
                value={`${selectedSector.opportunity}/100`}
                helper="Research potential"
                tone="green"
              />
              <Metric
                label="Risk"
                value={`${selectedSector.risk}/100`}
                helper="Suitability review"
                tone="amber"
              />
            </div>

            <div className="mt-5 grid gap-3">
              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Advisor action
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {selectedSector.action}
                </p>
              </SoftCard>

              <SoftCard>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Related holdings
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSector.holdings.map((holding) => (
                    <span
                      key={holding}
                      className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-black text-white"
                    >
                      {holding}
                    </span>
                  ))}
                </div>
              </SoftCard>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="p-6">
            <SectionHeader
              eyebrow="Intelligence blocks"
              title="Click a signal to create an advisor-ready preview."
              description="Each block updates client language, risk, confidence, impact, and suggested action."
            />

            <div className="mt-6 grid gap-3">
              {signals.map((signal) => {
                const selected = selectedSignal.title === signal.title;

                return (
                  <button
                    key={signal.title}
                    type="button"
                    onClick={() => chooseSignal(signal)}
                    className={cx(
                      "rounded-[1.5rem] border p-4 text-left transition hover:scale-[1.005]",
                      selected
                        ? `${toneBorder(signal.tone)} ring-2 ring-white/15`
                        : "border-white/10 bg-white/[0.04] hover:border-red-400/30 hover:bg-white/[0.065]"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Pill tone={signal.tone}>{signal.category}</Pill>
                        <h3 className="mt-3 text-lg font-black text-white">
                          {signal.title}
                        </h3>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-right">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Confidence
                        </div>
                        <div className="text-lg font-black text-emerald-300">
                          {signal.confidence}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl bg-black/20 p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Impact
                        </div>
                        <div className="mt-1 text-lg font-black text-white">
                          {signal.impact}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Risk
                        </div>
                        <div className="mt-1 text-lg font-black text-amber-200">
                          {signal.risk}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-black/20 p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                          Status
                        </div>
                        <div className="mt-1 text-lg font-black text-emerald-200">
                          Actionable
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <Pill tone={selectedSignal.tone}>{selectedSignal.category}</Pill>
            <h2 className="mt-4 text-3xl font-black tracking-tight">
              Advisor briefing preview
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              {selectedSignal.action}
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Metric
                label="Confidence"
                value={`${selectedSignal.confidence}/100`}
                helper="Source strength"
                tone="green"
              />
              <Metric
                label="Impact"
                value={`${selectedSignal.impact}/100`}
                helper="Portfolio relevance"
                tone="red"
              />
              <Metric
                label="Risk"
                value={`${selectedSignal.risk}/100`}
                helper="Suitability review"
                tone="amber"
              />
            </div>

            <SoftCard className="mt-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Client-ready language
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                {selectedSignal.clientLanguage}
              </p>
            </SoftCard>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={queueBriefing}
                className="rounded-2xl border border-red-400/25 bg-red-500/[0.12] px-4 py-3 text-sm font-black text-red-50 shadow-lg shadow-red-950/20 transition hover:scale-[1.01] hover:bg-red-500/[0.16]"
              >
                Prepare Briefing
              </button>
              <button
                type="button"
                onClick={queueClientMessage}
                className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-black text-white shadow-lg shadow-black/20 transition hover:border-emerald-400/30 hover:bg-white/[0.065]"
              >
                Draft Client Message
              </button>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="p-6">
            <SectionHeader
              eyebrow="Market overview"
              title="Indices, ETFs, and macro context."
              description="A reliable internal chart and metric panel for broad market context."
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {indexCards.map((card) => (
                <Metric
                  key={card.label}
                  label={card.label}
                  value={card.value}
                  helper={card.helper}
                  tone={card.tone}
                />
              ))}
            </div>

            <div className="mt-6 h-[330px] md:h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={marketOverviewData}>
                  <defs>
                    <linearGradient id="spFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.red} stopOpacity={0.26} />
                      <stop offset="95%" stopColor={chartColors.red} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="ndxFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColors.purple} stopOpacity={0.22} />
                      <stop offset="95%" stopColor={chartColors.purple} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="name" stroke={chartColors.axis} fontSize={12} />
                  <YAxis stroke={chartColors.axis} fontSize={12} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="sp500"
                    stroke={chartColors.red}
                    fill="url(#spFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="nasdaq"
                    stroke={chartColors.purple}
                    fill="url(#ndxFill)"
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="dow" stroke={chartColors.green} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="russell" stroke={chartColors.amber} strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader
              eyebrow="Portfolio impact matrix"
              title="Translate signals into model-level decisions."
              description="Exposure, sensitivity, and action priority appear together."
            />

            <div className="mt-6 h-[360px] md:h-[430px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={impactData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="model" stroke={chartColors.axis} fontSize={12} />
                  <YAxis stroke={chartColors.axis} fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine y={70} stroke={chartColors.red} strokeDasharray="4 4" strokeOpacity={0.7} />
                  <Bar dataKey="exposure" fill={chartColors.red} fillOpacity={0.72} radius={[10, 10, 0, 0]} />
                  <Bar dataKey="sensitivity" fill={chartColors.amber} fillOpacity={0.72} radius={[10, 10, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="action"
                    stroke={chartColors.green}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="p-6">
            <SectionHeader
              eyebrow="Operating analytics"
              title="Everything important stays visible."
              description="The page includes enough platform visibility to feel useful before workspace entry."
            />

            <div className="mt-6 h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={operatingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="name" stroke={chartColors.axis} fontSize={12} />
                  <YAxis stroke={chartColors.axis} fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {operatingData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          entry.quality >= 85
                            ? chartColors.green
                            : entry.quality >= 75
                              ? chartColors.purple
                              : chartColors.red
                        }
                        fillOpacity={0.72}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="quality"
                    stroke={chartColors.amber}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader
              eyebrow="Sector breadth"
              title="Breadth, opportunity, and risk."
              description="The chart is tied to the heatmap so visual context and actionable data stay together."
            />

            <div className="mt-6 h-[330px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectorChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="name" stroke={chartColors.axis} fontSize={12} />
                  <YAxis stroke={chartColors.axis} fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="breadth" radius={[10, 10, 0, 0]}>
                    {sectorChartData.map((entry) => (
                      <Cell
                        key={`breadth-${entry.name}`}
                        fill={entry.breadth >= 55 ? chartColors.green : chartColors.red}
                        fillOpacity={0.72}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="opportunity" fill={chartColors.purple} fillOpacity={0.72} radius={[10, 10, 0, 0]} />
                  <Bar dataKey="risk" fill={chartColors.amber} fillOpacity={0.72} radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </section>

        <Card className="p-6">
          <SectionHeader
            eyebrow="Equity scanner"
            title="Research discovery surface."
            description="Click a row to load that symbol into the chart, technical summary, and watchlist workflow."
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="overflow-x-auto rounded-[1.5rem] border border-white/10">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[0.75fr_1.3fr_1fr_0.8fr_0.8fr_1fr] gap-2 bg-white/[0.045] px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <div>Symbol</div>
                  <div>Company</div>
                  <div>Sector</div>
                  <div>Move</div>
                  <div>Score</div>
                  <div>Signal</div>
                </div>

                <div className="divide-y divide-white/10">
                  {scannerRows.map((row) => (
                    <button
                      key={row.symbol}
                      type="button"
                      onClick={() => {
                        const profile = symbolProfiles.find(
                          (symbol) => symbol.symbol === row.symbol
                        );

                        if (profile) {
                          chooseSymbol(profile);
                          saveSymbol(profile);
                        }
                      }}
                      className="grid w-full grid-cols-[0.75fr_1.3fr_1fr_0.8fr_0.8fr_1fr] gap-2 px-4 py-4 text-left text-sm transition hover:bg-white/[0.055]"
                    >
                      <div className="font-black text-white">{row.symbol}</div>
                      <div className="font-semibold text-slate-300">{row.company}</div>
                      <div className="font-semibold text-slate-400">{row.sector}</div>
                      <div
                        className={cx(
                          "font-black",
                          row.changePct >= 0 ? "text-emerald-300" : "text-red-300"
                        )}
                      >
                        {signedPercent(row.changePct)}
                      </div>
                      <div className="font-black text-white">{row.opportunity}</div>
                      <div className="font-semibold text-slate-300">{row.signal}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[360px] md:h-[410px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scannerRows}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="symbol" stroke={chartColors.axis} fontSize={12} />
                  <YAxis stroke={chartColors.axis} fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="opportunity" radius={[10, 10, 0, 0]}>
                    {scannerRows.map((row) => (
                      <Cell
                        key={`opp-${row.symbol}`}
                        fill={
                          row.opportunity >= 75
                            ? chartColors.green
                            : row.opportunity >= 60
                              ? chartColors.purple
                              : chartColors.amber
                        }
                        fillOpacity={0.72}
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="risk"
                    stroke={chartColors.red}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <section className="grid gap-5 py-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card className="p-6">
            <SectionHeader
              eyebrow="Advisor experience"
              title="One premium command center."
              description="The home page acts as the unified entry point for market view, advisor intelligence, workflow preview, charts, heatmaps, and account access."
            />

            <div className="mt-6 grid gap-3">
              {activeConsole.actions.map((item) => (
                <SoftCard key={item}>
                  <div className="text-sm font-semibold leading-6 text-slate-300">
                    {item}
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader
              eyebrow="Access"
              title="Simple navigation. Clear next steps."
              description="The top navigation is intentionally limited to Home, Login, and Sign Up. Everything else is consolidated into this home command page or available after login."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <Metric
                label="Top Nav"
                value="3 Tabs"
                helper="Home / Login / Sign Up"
                tone="red"
              />
              <Metric
                label="Portal"
                value="Unified"
                helper="Redirects to home"
                tone="green"
              />
              <Metric
                label="Visuals"
                value="Loaded"
                helper="No external widget dependency"
                tone="purple"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/" variant="secondary">
                Home
              </LinkButton>
              <LinkButton href="/founder-login" variant="danger">
                Login
              </LinkButton>
              <LinkButton href="/advisor-signup" variant="primary">
                Sign Up
              </LinkButton>
            </div>
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}