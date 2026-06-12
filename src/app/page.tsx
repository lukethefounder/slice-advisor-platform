"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BrandMark,
  Card,
  LinkButton,
  Metric,
  Pill,
  Progress,
  SectionHeader,
  SliceBackground,
  SoftCard,
  cx,
} from "@/components/slice-ui";
import type { SliceTone } from "@/components/slice-ui";

type Tone = SliceTone;

type MainTab =
  | "market"
  | "platform"
  | "mission"
  | "about"
  | "workflow"
  | "compliance"
  | "roadmap";

type PlatformModule = {
  title: string;
  subtitle: string;
  description: string;
  details: string[];
  href: string;
  tone: Tone;
};

type MarketSignal = {
  symbol: string;
  company: string;
  sector: string;
  price: string;
  dayMove: string;
  trend: number;
  opportunity: number;
  risk: number;
  sourceQuality: number;
  advisorAction: string;
  complianceNote: string;
  tone: Tone;
};

type WorkflowStep = {
  step: string;
  title: string;
  description: string;
  output: string;
  tone: Tone;
};

type RoadmapItem = {
  title: string;
  detail: string;
  tone: Tone;
};

const ACCESS_HREF = "/founder-login";
const ACCESS_LABEL = "Login / Sign Up";

const chartColors = {
  red: "#ef4444",
  green: "#22c55e",
  amber: "#f59e0b",
  purple: "#a855f7",
  cyan: "#06b6d4",
  blue: "#38bdf8",
  slate: "#94a3b8",
  grid: "rgba(255,255,255,0.08)",
  axis: "#64748b",
  tooltipBg: "#09090b",
};

const tabConfig: Array<{ id: MainTab; label: string; helper: string }> = [
  { id: "market", label: "Market Console", helper: "Preview" },
  { id: "platform", label: "Platform", helper: "What Slice does" },
  { id: "mission", label: "Mission", helper: "Why it exists" },
  { id: "about", label: "About", helper: "Who it serves" },
  { id: "workflow", label: "Workflow", helper: "Daily advisor flow" },
  { id: "compliance", label: "Compliance", helper: "Review gates" },
  { id: "roadmap", label: "What’s Next", helper: "In store" },
];

const marketTrendData = [
  { period: "Jan", equity: 58, credit: 51, rates: 46, volatility: 42, opportunity: 62, reviewLoad: 31 },
  { period: "Feb", equity: 61, credit: 54, rates: 49, volatility: 48, opportunity: 65, reviewLoad: 35 },
  { period: "Mar", equity: 67, credit: 57, rates: 56, volatility: 61, opportunity: 71, reviewLoad: 44 },
  { period: "Apr", equity: 63, credit: 62, rates: 59, volatility: 68, opportunity: 69, reviewLoad: 49 },
  { period: "May", equity: 72, credit: 66, rates: 53, volatility: 55, opportunity: 78, reviewLoad: 42 },
  { period: "Jun", equity: 76, credit: 64, rates: 50, volatility: 51, opportunity: 82, reviewLoad: 39 },
];

const sectorRotationData = [
  { sector: "AI", opportunity: 88, risk: 74, clientImpact: 82 },
  { sector: "Broad equity", opportunity: 72, risk: 46, clientImpact: 76 },
  { sector: "Rates", opportunity: 61, risk: 58, clientImpact: 68 },
  { sector: "Credit", opportunity: 69, risk: 64, clientImpact: 73 },
  { sector: "Energy", opportunity: 56, risk: 44, clientImpact: 52 },
  { sector: "Alts", opportunity: 67, risk: 79, clientImpact: 63 },
  { sector: "Real assets", opportunity: 58, risk: 36, clientImpact: 47 },
];

const advisorPipelineData = [
  { stage: "Signals", count: 72 },
  { stage: "Source checked", count: 51 },
  { stage: "Client matched", count: 34 },
  { stage: "Advisor draft", count: 22 },
  { stage: "Compliance review", count: 11 },
  { stage: "Ready to discuss", count: 8 },
];

const riskHeatData = [
  { category: "Recommendation", low: 12, medium: 18, high: 9 },
  { category: "Performance", low: 7, medium: 13, high: 14 },
  { category: "Private alts", low: 5, medium: 9, high: 16 },
  { category: "PII", low: 10, medium: 8, high: 6 },
  { category: "Marketing", low: 6, medium: 12, high: 11 },
];

const commandQualityData = [
  { label: "Market source", score: 92 },
  { label: "Client match", score: 84 },
  { label: "Advisor action", score: 79 },
  { label: "Review readiness", score: 88 },
  { label: "Archive package", score: 76 },
];

const marketSignals: MarketSignal[] = [
  {
    symbol: "SPY",
    company: "S&P 500 ETF",
    sector: "Broad Market",
    price: "$534.18",
    dayMove: "+0.42%",
    trend: 71,
    opportunity: 72,
    risk: 46,
    sourceQuality: 92,
    advisorAction:
      "Use as a broad equity benchmark for model drift, client allocation review, and portfolio conversation context.",
    complianceNote:
      "Informational until tied to a client-specific recommendation.",
    tone: "green",
  },
  {
    symbol: "QQQ",
    company: "Nasdaq 100 ETF",
    sector: "Growth Technology",
    price: "$468.92",
    dayMove: "+0.68%",
    trend: 79,
    opportunity: 78,
    risk: 58,
    sourceQuality: 88,
    advisorAction:
      "Monitor growth concentration and overlap across direct holdings, models, and technology-heavy ETFs.",
    complianceNote:
      "Concentration discussion should be client-context reviewed before delivery.",
    tone: "purple",
  },
  {
    symbol: "NVDA",
    company: "NVIDIA",
    sector: "Semiconductors",
    price: "$128.41",
    dayMove: "+1.24%",
    trend: 88,
    opportunity: 88,
    risk: 72,
    sourceQuality: 86,
    advisorAction:
      "Flag position-size limits, AI concentration, volatility tolerance, and tax impact before any client action.",
    complianceNote:
      "High-risk if converted into buy/sell language without advisor review.",
    tone: "red",
  },
  {
    symbol: "TLT",
    company: "20+ Year Treasury ETF",
    sector: "Fixed Income",
    price: "$91.84",
    dayMove: "-0.22%",
    trend: 39,
    opportunity: 61,
    risk: 54,
    sourceQuality: 84,
    advisorAction:
      "Compare duration exposure against cash-flow needs, retirement income planning, and rate sensitivity.",
    complianceNote:
      "Suitable for planning context; recommendation requires client-specific review.",
    tone: "amber",
  },
  {
    symbol: "GLD",
    company: "Gold ETF",
    sector: "Real Assets",
    price: "$221.63",
    dayMove: "+0.18%",
    trend: 55,
    opportunity: 57,
    risk: 33,
    sourceQuality: 81,
    advisorAction:
      "Use as a diversifier discussion for inflation, geopolitical risk, and non-equity ballast.",
    complianceNote:
      "Keep framed as education unless tied to a client allocation change.",
    tone: "blue",
  },
];

const platformModules: PlatformModule[] = [
  {
    title: "Advisor Command Workspace",
    subtitle: "One command center",
    description:
      "The main advisor portal combines market signals, client intelligence, AI drafting, team tasks, briefings, compliance gates, and system health in one place.",
    details: [
      "Daily advisor overview",
      "Market and client signal cards",
      "Task and calendar visibility",
      "Compliance-aware action routing",
    ],
    href: "/workspace",
    tone: "red",
  },
  {
    title: "Market Visuals",
    subtitle: "Charts and trends",
    description:
      "A market console for watchlists, technical context, opportunity/risk scoring, sector rotation, and client discussion preparation.",
    details: [
      "Trend and opportunity charts",
      "Risk and volatility context",
      "Watchlist-style signal table",
      "Advisor action prompts",
    ],
    href: "/market-visuals",
    tone: "blue",
  },
  {
    title: "Opportunity Radar",
    subtitle: "Continuous scan",
    description:
      "A source-aware scanner that ranks developments by urgency, client relevance, credibility, and advisor action potential.",
    details: [
      "Source quality awareness",
      "Client impact scoring",
      "Issuer and market context",
      "Retained rationale for review",
    ],
    href: "/opportunity-radar",
    tone: "amber",
  },
  {
    title: "AI Studio",
    subtitle: "Advisor assistant",
    description:
      "AI helps create meeting prep, client emails, summaries, portfolio explanations, and briefing drafts while remaining review-first.",
    details: [
      "Draft-only output",
      "Client-ready language support",
      "Source and rationale reminders",
      "Advisor approval before use",
    ],
    href: "/workspace/personal-bot",
    tone: "cyan",
  },
  {
    title: "Client Intelligence",
    subtitle: "Relationship context",
    description:
      "A client layer for household context, notes, holdings symbols, preferences, suitability details, and review preparation.",
    details: [
      "Client profiles",
      "Household context",
      "Communication preparation",
      "Portfolio discussion notes",
    ],
    href: "/client-profiles",
    tone: "purple",
  },
  {
    title: "Compliance Guardrails",
    subtitle: "Review layer",
    description:
      "Compliance-aware gates for recommendations, trade language, testimonials, performance claims, private investments, PII, and marketing content.",
    details: [
      "No auto-send advice",
      "Human review before delivery",
      "Books-and-records package",
      "Marketing and performance controls",
    ],
    href: "/workspace?tab=compliance",
    tone: "green",
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    step: "01",
    title: "Scan",
    description:
      "Slice monitors market movement, watchlists, portfolio context, client notes, firm tasks, and pending communication needs.",
    output: "Advisor sees what changed.",
    tone: "cyan",
  },
  {
    step: "02",
    title: "Score",
    description:
      "Signals are scored by trend strength, opportunity, risk, source quality, client impact, urgency, and review sensitivity.",
    output: "Advisor sees what matters.",
    tone: "blue",
  },
  {
    step: "03",
    title: "Match",
    description:
      "The platform connects signals to client profiles, watchlists, portfolio exposure, planning needs, and team assignments.",
    output: "Advisor sees who may be affected.",
    tone: "purple",
  },
  {
    step: "04",
    title: "Prepare",
    description:
      "AI drafts talking points, briefing notes, client email language, meeting prep, and source-aware explanations.",
    output: "Advisor receives a draft.",
    tone: "amber",
  },
  {
    step: "05",
    title: "Review",
    description:
      "Compliance gates flag recommendation, performance, testimonial, private investment, PII, and trade-language risks.",
    output: "Advisor or compliance approves.",
    tone: "red",
  },
  {
    step: "06",
    title: "Retain",
    description:
      "The final output, prompt, sources, reviewer, approval, and delivery context should be preserved for records.",
    output: "Firm keeps a defensible package.",
    tone: "green",
  },
];

const complianceControls = [
  {
    title: "Recommendation language",
    risk: "Buy, sell, hold, rebalance, allocate, increase, reduce, or switch language can become client-specific advice.",
    response:
      "Slice routes recommendation language to advisor review and requires client objectives, risk tolerance, time horizon, liquidity needs, restrictions, source support, and rationale.",
    tone: "red" as Tone,
  },
  {
    title: "Performance and backtests",
    risk: "Returns, model performance, projections, hypothetical results, and backtested data can be misleading without required assumptions and substantiation.",
    response:
      "Slice treats performance content as high-risk and routes it toward compliance review, calculation support, benchmark context, limitations, and retention.",
    tone: "amber" as Tone,
  },
  {
    title: "Testimonials, ratings, and marketing",
    risk: "Public-facing content, client reviews, endorsements, rankings, and prospect material require tighter disclosure and review.",
    response:
      "Slice flags testimonial, endorsement, rating, social, website, and marketing content before publication or client distribution.",
    tone: "purple" as Tone,
  },
  {
    title: "Books and records",
    risk: "Advisor communications and recommendation rationale need to be retrievable and defensible.",
    response:
      "Slice is designed to preserve AI prompts, draft history, sources, final content, approvals, reviewer identity, and delivery metadata.",
    tone: "green" as Tone,
  },
];

const roadmap: RoadmapItem[] = [
  {
    title: "Live market data wiring",
    detail:
      "Connect approved providers for real watchlists, pricing, volatility, sector movement, earnings, economic calendar, and market alerts.",
    tone: "blue",
  },
  {
    title: "Advisor-specific AI memory",
    detail:
      "Let every advisor operate with a personalized assistant that learns communication style, client preferences, and workflow patterns.",
    tone: "cyan",
  },
  {
    title: "Compliance approval console",
    detail:
      "Move flagged drafts, private opportunity notes, performance language, and public content through visible review status.",
    tone: "red",
  },
  {
    title: "Client briefing automation",
    detail:
      "Transform market signals, source links, portfolio context, and advisor notes into review-ready client briefings.",
    tone: "green",
  },
  {
    title: "Firm operating layer",
    detail:
      "Expand task routing, team calendar, internal notes, approvals, and advisor accountability into one daily workflow.",
    tone: "purple",
  },
  {
    title: "Investor-facing portals",
    detail:
      "Offer controlled client-facing views for approved reports, briefings, education, and advisor-approved messages.",
    tone: "amber",
  },
];

function AccessButton({ className = "" }: { className?: string }) {
  return (
    <LinkButton href={ACCESS_HREF} variant="primary" className={className}>
      {ACCESS_LABEL}
    </LinkButton>
  );
}

function chartTooltipStyle() {
  return {
    background: chartColors.tooltipBg,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    color: "#fff",
  };
}

function tonePanelClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/25 bg-red-500/10",
    green: "border-emerald-500/25 bg-emerald-500/10",
    amber: "border-amber-500/25 bg-amber-500/10",
    purple: "border-purple-500/25 bg-purple-500/10",
    blue: "border-sky-500/25 bg-sky-500/10",
    cyan: "border-cyan-500/25 bg-cyan-500/10",
    slate: "border-slate-500/20 bg-slate-500/10",
  };

  return tones[tone];
}

function SectionBlock({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="grid gap-5">
      <SectionHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      {children}
    </section>
  );
}

function MiniProgress({ value, tone }: { value: number; tone: Exclude<Tone, "slate"> }) {
  return <Progress value={value} tone={tone} />;
}

function GlassPanel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.75rem] border bg-white/[0.045] p-4 shadow-2xl shadow-black/20",
        tonePanelClass(tone),
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function PremiumTicker() {
  const items = [
    ["SPY", "+0.42%", "green"],
    ["QQQ", "+0.68%", "purple"],
    ["NVDA", "+1.24%", "red"],
    ["TLT", "-0.22%", "amber"],
    ["GLD", "+0.18%", "blue"],
    ["Credit", "Review", "cyan"],
    ["Alts", "Gated", "red"],
    ["AI Drift", "Flagged", "amber"],
  ] as Array<[string, string, Tone]>;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex gap-2 overflow-x-auto p-3">
        {items.map(([label, value, tone]) => (
          <div
            key={`${label}-${value}`}
            className={cx(
              "flex min-w-[150px] items-center justify-between rounded-2xl border px-4 py-3",
              tonePanelClass(tone),
            )}
          >
            <span className="text-sm font-black text-white">{label}</span>
            <Pill tone={tone}>{value}</Pill>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MarketSignalRow({ signal }: { signal: MarketSignal }) {
  const progressTone = signal.tone === "slate" ? "red" : (signal.tone as Exclude<Tone, "slate">);

  return (
    <div className="group rounded-[1.5rem] border border-white/10 bg-black/35 p-4 transition hover:-translate-y-0.5 hover:border-red-400/30 hover:bg-red-500/[0.06]">
      <div className="grid gap-4 xl:grid-cols-[170px_1fr_260px] xl:items-center">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-black text-white">{signal.symbol}</div>
            <Pill tone={signal.tone}>{signal.dayMove}</Pill>
          </div>
          <div className="mt-1 text-sm font-bold text-slate-400">{signal.company}</div>
          <div className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {signal.sector}
          </div>
          <div className="mt-2 text-lg font-black text-white">{signal.price}</div>
        </div>

        <div>
          <p className="text-sm leading-6 text-slate-300">{signal.advisorAction}</p>
          <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">
              Review note
            </div>
            <p className="mt-1 text-xs leading-5 text-red-50">{signal.complianceNote}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {[
            ["Trend", signal.trend, progressTone],
            ["Opportunity", signal.opportunity, progressTone],
            ["Risk", signal.risk, "amber" as Exclude<Tone, "slate">],
            ["Source quality", signal.sourceQuality, "green" as Exclude<Tone, "slate">],
          ].map(([label, value, tone]) => (
            <div key={label as string}>
              <div className="mb-1 flex items-center justify-between text-xs font-black text-slate-400">
                <span>{label}</span>
                <span>{value}%</span>
              </div>
              <MiniProgress value={value as number} tone={tone as Exclude<Tone, "slate">} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MarketConsole() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Market intelligence preview
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                Opportunity, risk, and review pressure
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                Sample data preview showing how Slice can display market trend strength, volatility,
                opportunity scoring, and advisor review workload in one console. This page uses
                illustrative demo data until wired to approved live data.
              </p>
            </div>
            <Pill tone="amber">Illustrative data</Pill>
          </div>

          <div className="h-[390px] rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={marketTrendData}>
                <defs>
                  <linearGradient id="opportunityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.red} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={chartColors.red} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="volFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartColors.cyan} stopOpacity={0.32} />
                    <stop offset="95%" stopColor={chartColors.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="period" stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle()} />
                <Area
                  type="monotone"
                  dataKey="opportunity"
                  name="Opportunity score"
                  stroke={chartColors.red}
                  fill="url(#opportunityFill)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="volatility"
                  name="Volatility pressure"
                  stroke={chartColors.cyan}
                  fill="url(#volFill)"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="reviewLoad"
                  name="Review load"
                  stroke={chartColors.amber}
                  strokeWidth={3}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-400">
              Cross-asset pulse
            </div>
            <h2 className="mt-2 text-3xl font-black text-white">Trend strength by sleeve</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              Slice should help advisors compare equity, credit, rates, and volatility context before
              drafting client-facing commentary.
            </p>
          </div>

          <div className="h-[390px] rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={marketTrendData}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="period" stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle()} />
                <Line type="monotone" dataKey="equity" name="Equity" stroke={chartColors.red} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="credit" name="Credit" stroke={chartColors.green} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="rates" name="Rates" stroke={chartColors.blue} strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <div className="mb-5">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
              Sector rotation
            </div>
            <h2 className="mt-2 text-3xl font-black text-white">
              Opportunity, risk, and client impact
            </h2>
          </div>

          <div className="h-[350px] rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sectorRotationData}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="sector" stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle()} />
                <Bar dataKey="opportunity" name="Opportunity" fill={chartColors.red} radius={[10, 10, 0, 0]} />
                <Bar dataKey="risk" name="Risk" fill={chartColors.amber} radius={[10, 10, 0, 0]} />
                <Bar dataKey="clientImpact" name="Client impact" fill={chartColors.cyan} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-5">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-emerald-400">
              Advisor pipeline
            </div>
            <h2 className="mt-2 text-3xl font-black text-white">
              From signal to review-ready action
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              The goal is not just market data. The goal is turning market movement into reviewed,
              source-backed, client-relevant advisor action.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
            <div className="h-[320px] rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={advisorPipelineData} layout="vertical">
                  <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                  <XAxis type="number" stroke={chartColors.axis} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stage" type="category" stroke={chartColors.axis} tickLine={false} axisLine={false} width={120} />
                  <Tooltip contentStyle={chartTooltipStyle()} />
                  <Bar dataKey="count" name="Count" fill={chartColors.green} radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid gap-3">
              <Metric label="Signals" value="72" helper="Detected inputs" tone="red" />
              <Metric label="Reviewed" value="11" helper="Compliance path" tone="amber" />
              <Metric label="Ready" value="8" helper="Advisor discussion" tone="green" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="p-5">
          <SectionHeader
            eyebrow="Risk control view"
            title="Compliance risk by content type"
            description="A richer preview of how Slice can make risk visible before a draft becomes client-facing."
          />

          <div className="mt-5 h-[330px] rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskHeatData}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="category" stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle()} />
                <Bar dataKey="low" name="Low" fill={chartColors.green} radius={[10, 10, 0, 0]} />
                <Bar dataKey="medium" name="Medium" fill={chartColors.amber} radius={[10, 10, 0, 0]} />
                <Bar dataKey="high" name="High" fill={chartColors.red} radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionHeader
            eyebrow="Quality stack"
            title="What must be strong before communication"
            description="The homepage should show that Slice is not just flashy. It is designed to weigh market source quality, client matching, advisor action clarity, review readiness, and archive completeness."
          />

          <div className="mt-5 grid gap-3">
            {commandQualityData.map((item, index) => {
              const tone: Exclude<Tone, "slate"> =
                index === 0 ? "green" : index === 1 ? "cyan" : index === 2 ? "amber" : index === 3 ? "red" : "purple";

              return (
                <SoftCard key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    <span>{item.label}</span>
                    <span>{item.score}%</span>
                  </div>
                  <Progress value={item.score} tone={tone} />
                </SoftCard>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeader
          eyebrow="Watchlist intelligence"
          title="Sample advisor signal table"
          description="This is the homepage sneak peek. In production, this should be wired to approved data providers, firm-approved watchlists, client context, and retained source packages."
          action={<LinkButton href="/market-visuals" variant="secondary">Open Market Visuals</LinkButton>}
        />

        <div className="mt-5 grid gap-3">
          {marketSignals.map((signal) => (
            <MarketSignalRow key={signal.symbol} signal={signal} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function HeroPreview() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
            Premium preview
          </div>
          <h2 className="mt-2 text-2xl font-black text-white">
            Advisor intelligence in motion
          </h2>
        </div>
        <Pill tone="green">Review-first</Pill>
      </div>

      <div className="grid gap-4">
        <div className="h-[260px] rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={marketTrendData}>
              <defs>
                <linearGradient id="heroTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.red} stopOpacity={0.45} />
                  <stop offset="95%" stopColor={chartColors.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="period" stroke={chartColors.axis} tickLine={false} axisLine={false} />
              <YAxis stroke={chartColors.axis} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={chartTooltipStyle()} />
              <Area
                type="monotone"
                dataKey="opportunity"
                name="Opportunity"
                stroke={chartColors.red}
                fill="url(#heroTrend)"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="reviewLoad"
                name="Review load"
                stroke={chartColors.cyan}
                strokeWidth={3}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <GlassPanel tone="red">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Latest sample signal
            </div>
            <div className="mt-2 text-lg font-black text-white">AI concentration drift</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Growth-heavy households may need review before any communication.
            </p>
          </GlassPanel>

          <GlassPanel tone="cyan">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Required action
            </div>
            <div className="mt-2 text-lg font-black text-white">Advisor review</div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Client-specific allocation language is gated before delivery.
            </p>
          </GlassPanel>
        </div>
      </div>
    </Card>
  );
}

function PlatformModuleCard({ module }: { module: PlatformModule }) {
  return (
    <Card className="group p-5 transition hover:-translate-y-1 hover:border-red-400/30 hover:bg-red-500/[0.035]">
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", tonePanelClass(module.tone))} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Pill tone={module.tone}>{module.subtitle}</Pill>
            <h3 className="mt-3 text-2xl font-black text-white">{module.title}</h3>
          </div>
          <span
            className={cx(
              "mt-1 h-3 w-3 rounded-full shadow-lg",
              module.tone === "blue"
                ? "bg-sky-400 shadow-sky-400/40"
                : module.tone === "green"
                  ? "bg-emerald-400 shadow-emerald-400/40"
                  : module.tone === "cyan"
                    ? "bg-cyan-400 shadow-cyan-400/40"
                    : module.tone === "purple"
                      ? "bg-purple-400 shadow-purple-400/40"
                      : module.tone === "amber"
                        ? "bg-amber-400 shadow-amber-400/40"
                        : "bg-red-400 shadow-red-400/40",
            )}
          />
        </div>

        <p className="mt-4 text-sm leading-7 text-slate-400">{module.description}</p>

        <div className="mt-5 grid gap-2">
          {module.details.map((detail) => (
            <div
              key={detail}
              className="rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2.5 text-sm font-semibold text-slate-300"
            >
              {detail}
            </div>
          ))}
        </div>

        <LinkButton href={module.href} variant="secondary" className="mt-5 w-full">
          Open
        </LinkButton>
      </div>
    </Card>
  );
}

function ResearchTabs({ activeTab, setActiveTab }: { activeTab: MainTab; setActiveTab: (tab: MainTab) => void }) {
  return (
    <Card className="p-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-7">
        {tabConfig.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cx(
              "rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5",
              activeTab === tab.id
                ? "border-white/25 bg-white text-slate-950 shadow-xl shadow-red-950/20"
                : "border-white/10 bg-white/[0.055] text-white hover:border-red-400/40 hover:bg-red-500/10",
            )}
          >
            <div className="text-sm font-black">{tab.label}</div>
            <div className={cx("mt-1 text-xs leading-5", activeTab === tab.id ? "text-slate-600" : "text-slate-500")}>
              {tab.helper}
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function MarketTab() {
  return (
    <SectionBlock
      eyebrow="Market console"
      title="A homepage that feels like the platform is already alive."
      description="This version keeps the richer educational content but brings back the original market-console energy: trend charts, signal tables, opportunity/risk scoring, and a clear preview of what advisors can expect inside Slice."
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Demo watchlist" value="72" helper="Assets monitored" tone="red" />
        <Metric label="Signals" value="19" helper="Ranked this week" tone="cyan" />
        <Metric label="Review gates" value="6" helper="Advisor safeguards" tone="amber" />
        <Metric label="Ready items" value="8" helper="Advisor discussion" tone="green" />
      </div>

      <MarketConsole />
    </SectionBlock>
  );
}

function PlatformTab() {
  return (
    <SectionBlock
      eyebrow="Platform"
      title="Slice is a single operating system for the modern wealth advisor."
      description="The platform brings together advisor productivity, market monitoring, AI drafting, client intelligence, opportunity scanning, communication preparation, team execution, compliance guardrails, and record awareness."
    >
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {platformModules.map((module) => (
          <PlatformModuleCard key={module.title} module={module} />
        ))}
      </div>
    </SectionBlock>
  );
}

function MissionTab() {
  return (
    <SectionBlock
      eyebrow="Mission"
      title="Help advisors act faster, communicate better, and stay review-ready."
      description="Slice exists because advisor work is fragmented. Market data, client notes, email, compliance, tasks, and AI output should not live in separate disconnected places when client needs move quickly."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Make speed safer",
            text: "Slice is designed to help advisors move quickly without skipping source review, client context, approval gates, or recordkeeping.",
            tone: "red" as Tone,
          },
          {
            title: "Unify the advisor day",
            text: "The platform brings AI, clients, markets, team tasks, communication, compliance, and records into one daily operating flow.",
            tone: "cyan" as Tone,
          },
          {
            title: "Turn signals into action",
            text: "A market move only matters if it becomes a relevant advisor action with clear client impact and review status.",
            tone: "amber" as Tone,
          },
          {
            title: "Preserve trust",
            text: "The system is built around review-first AI, source packages, approval trails, and defensible advisor communication.",
            tone: "green" as Tone,
          },
        ].map((item) => (
          <Card key={item.title} className={cx("p-6", tonePanelClass(item.tone))}>
            <h3 className="text-2xl font-black text-white">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">{item.text}</p>
          </Card>
        ))}
      </div>
    </SectionBlock>
  );
}

function AboutTab() {
  return (
    <SectionBlock
      eyebrow="About"
      title="Built for advisory firms that want one calm command center."
      description="Slice is intended for wealth managers, RIAs, advisor teams, and compliance-conscious firms that need better daily visibility without turning the platform into a maze."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["Independent RIAs", "A cleaner way to coordinate client communication, market intelligence, task execution, and review workflows."],
          ["Advisor teams", "Shared visibility into opportunities, delegated work, calendar items, client prep, and communication status."],
          ["Wealth managers", "Client-specific preparation, portfolio context, market explanation, and source-backed communication at scale."],
          ["Compliance operators", "A workflow that makes AI output, communications, sources, approvals, and records easier to supervise."],
        ].map(([title, text], index) => (
          <Card key={title} className="p-6">
            <Pill tone={["red", "purple", "green", "cyan"][index] as Tone}>{title}</Pill>
            <h3 className="mt-4 text-2xl font-black text-white">{title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-400">{text}</p>
          </Card>
        ))}
      </div>
    </SectionBlock>
  );
}

function WorkflowTab() {
  return (
    <SectionBlock
      eyebrow="Workflow"
      title="From market signal to advisor action to retained record."
      description="Slice is not just a homepage or dashboard. It is a workflow for taking fragmented intelligence and turning it into reviewable, client-relevant action."
    >
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {workflowSteps.map((step) => (
          <Card key={step.step} className="p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="text-5xl font-black text-white/15">{step.step}</div>
              <Pill tone={step.tone}>{step.title}</Pill>
            </div>
            <h3 className="mt-5 text-2xl font-black text-white">{step.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-400">{step.description}</p>
            <SoftCard className="mt-5">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Output
              </div>
              <p className="mt-2 text-sm font-black text-white">{step.output}</p>
            </SoftCard>
          </Card>
        ))}
      </div>
    </SectionBlock>
  );
}

function ComplianceTab() {
  return (
    <SectionBlock
      eyebrow="Compliance"
      title="Review-first by design, not compliance theater."
      description="Slice should never be marketed as a legal guarantee or replacement for a CCO, legal counsel, written policies, or supervisory procedures. The value is that compliance-aware thinking is visible inside the workflow."
    >
      <Card className="p-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_420px] xl:items-center">
          <div>
            <Pill tone="red">Core rule</Pill>
            <h3 className="mt-4 text-3xl font-black text-white">
              AI prepares. Advisors and supervisors approve.
            </h3>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              Slice should not auto-send investment advice, trade instructions, public marketing,
              testimonials, performance claims, private investment opportunities, or client-specific
              recommendation language. It creates reviewable preparation, not uncontrolled advice.
            </p>
          </div>

          <div className="grid gap-3">
            {[
              "No auto-send advice",
              "No unsupervised trade instructions",
              "No unsupported performance claims",
              "No unreviewed marketing content",
              "No unmanaged testimonial/rating language",
              "No record deletion before retention review",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm font-black text-red-50">
                {item}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {complianceControls.map((control) => (
          <Card key={control.title} className={cx("p-6", tonePanelClass(control.tone))}>
            <h3 className="text-2xl font-black text-white">{control.title}</h3>
            <SoftCard className="mt-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">Risk</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{control.risk}</p>
            </SoftCard>
            <SoftCard className="mt-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">Slice response</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{control.response}</p>
            </SoftCard>
          </Card>
        ))}
      </div>
    </SectionBlock>
  );
}

function RoadmapTab() {
  return (
    <SectionBlock
      eyebrow="What is in store"
      title="The next stage is a full advisor intelligence engine."
      description="The homepage should give advisors a preview of where Slice is going: live market integrations, personalized AI, approval workflows, client-ready briefings, and a unified firm operating layer."
    >
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {roadmap.map((item) => (
          <Card key={item.title} className={cx("p-6", tonePanelClass(item.tone))}>
            <Pill tone={item.tone}>Planned</Pill>
            <h3 className="mt-4 text-2xl font-black text-white">{item.title}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-300">{item.detail}</p>
          </Card>
        ))}
      </div>
    </SectionBlock>
  );
}

function ActiveTab({ activeTab }: { activeTab: MainTab }) {
  if (activeTab === "platform") return <PlatformTab />;
  if (activeTab === "mission") return <MissionTab />;
  if (activeTab === "about") return <AboutTab />;
  if (activeTab === "workflow") return <WorkflowTab />;
  if (activeTab === "compliance") return <ComplianceTab />;
  if (activeTab === "roadmap") return <RoadmapTab />;
  return <MarketTab />;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<MainTab>("market");

  const selectedTab = useMemo(
    () => tabConfig.find((tab) => tab.id === activeTab) ?? tabConfig[0],
    [activeTab],
  );

  return (
    <SliceBackground>
      <div className="mx-auto grid max-w-[1900px] gap-5 px-4 py-5 md:px-6">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/72 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <a href="#top" className="block">
              <BrandMark subtitle="Advisor Intelligence Platform" />
            </a>

            <nav className="flex flex-wrap gap-2">
              {tabConfig.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    "rounded-2xl border px-3 py-2 text-xs font-black transition",
                    activeTab === tab.id
                      ? "border-white/25 bg-white text-slate-950 shadow-lg shadow-red-950/20"
                      : "border-white/10 bg-white/[0.055] text-white hover:border-red-400/40 hover:bg-red-500/10",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            <div className="shrink-0">
              <AccessButton />
            </div>
          </div>
        </header>

        <PremiumTicker />

        <section id="top" className="grid gap-5 pt-4 2xl:grid-cols-[1fr_0.78fr] 2xl:items-center">
          <div className="grid gap-5">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Market-console homepage</Pill>
                <Pill tone="cyan">AI-assisted</Pill>
                <Pill tone="green">Review-first</Pill>
                <Pill tone="amber">Demo trend data</Pill>
              </div>

              <h1 className="mt-6 max-w-6xl text-5xl font-black tracking-tight text-white md:text-7xl 2xl:text-8xl">
                The command center for modern wealth management.
              </h1>

              <p className="mt-6 max-w-5xl text-lg leading-9 text-slate-300 md:text-xl">
                Slice brings together market intelligence, opportunity scoring, AI drafting,
                client context, advisor workflow, team execution, communication preparation,
                compliance review gates, security controls, and record awareness in one
                premium advisor portal.
              </p>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400 md:text-base">
                The main page now feels more like the original market-focused platform while keeping
                the richer explanation advisors need before joining. The market visuals below are
                illustrative demo data until wired to approved live providers.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <AccessButton />
                <LinkButton href="/workspace" variant="secondary">
                  Open Demo Workspace
                </LinkButton>
                <button
                  type="button"
                  onClick={() => setActiveTab("platform")}
                  className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-center text-sm font-black leading-none text-white shadow-lg shadow-black/20 transition hover:scale-[1.01] hover:border-red-400/40 hover:bg-red-500/10"
                >
                  Research Platform
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Demo watchlist" value="72" helper="Assets monitored" tone="red" />
              <Metric label="Opportunity score" value="82%" helper="Sample current pulse" tone="cyan" />
              <Metric label="Review gates" value="6" helper="Advisor safeguards" tone="amber" />
              <Metric label="Access route" value="/founder-login" helper="Login / Sign Up" tone="green" />
            </div>
          </div>

          <HeroPreview />
        </section>

        <MarketConsole />

        <section className="grid gap-5 pt-6">
          <SectionHeader
            eyebrow="Research center"
            title={selectedTab.label}
            description={selectedTab.helper}
            action={<AccessButton className="hidden md:inline-flex" />}
          />

          <ResearchTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          <ActiveTab activeTab={activeTab} />
        </section>

        <section className="grid gap-5 pt-6">
          <SectionHeader
            eyebrow="Complete platform summary"
            title="Everything an advisor should understand before entering the portal."
            description="Slice is a market-aware advisor operating system. It gives firms a visual way to understand market movement, client impact, advisor action, AI-assisted drafting, review status, and record readiness before using the workspace."
          />

          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
            {[
              {
                title: "What it is",
                text: "A central advisor portal for markets, clients, AI, tasks, communication, compliance, and records.",
                tone: "red" as Tone,
              },
              {
                title: "What it shows",
                text: "Trend charts, sector movement, opportunity/risk scoring, advisor action prompts, and review status.",
                tone: "cyan" as Tone,
              },
              {
                title: "Why it matters",
                text: "Advisors need to move quickly while keeping context, review, source quality, and communication discipline intact.",
                tone: "amber" as Tone,
              },
              {
                title: "How to enter",
                text: "There is one public access path: Login / Sign Up. The button routes to the founder login page.",
                tone: "green" as Tone,
              },
            ].map((item) => (
              <Card key={item.title} className={cx("p-6", tonePanelClass(item.tone))}>
                <h3 className="text-2xl font-black text-white">{item.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-300">{item.text}</p>
              </Card>
            ))}
          </div>
        </section>

        <footer className="rounded-[1.75rem] border border-white/10 bg-black/72 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <BrandMark subtitle="Advisor Intelligence Platform" />
              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-500">
                Slice is software infrastructure for advisor workflow, intelligence, communication preparation,
                compliance review support, and operational visibility. It is not a replacement for a registered
                adviser, registered representative, CCO, legal counsel, firm policy, supervisory procedure, or
                regulatory obligation. Market data shown on this homepage is illustrative demo data until connected
                to approved live data sources.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <AccessButton />
              <LinkButton href="/workspace" variant="secondary">
                Demo Workspace
              </LinkButton>
            </div>
          </div>
        </footer>
      </div>
    </SliceBackground>
  );
}