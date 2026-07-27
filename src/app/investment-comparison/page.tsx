"use client";

import { FormEvent, useState, type ReactNode } from "react";

type AssetType = "Stock" | "Bond" | "ETF" | "Fund";
type HoldingTerm = "Short Term" | "Medium Term" | "Long Term";
type RiskTolerance = "Conservative" | "Moderate" | "Aggressive";
type Objective = "Capital Preservation" | "Income" | "Balanced Growth" | "Growth";

type SecurityFormState = {
  symbol: string;
  name: string;
  assetType: AssetType;
  sector: string;
  marketCap: string;
  bondType: string;
  creditQuality: string;
  durationBucket: string;
  expectedReturnPct: string;
  yieldPct: string;
  volatilityPct: string;
  beta: string;
};

type AssetAnalysis = {
  symbol: string;
  name: string;
  assetType: AssetType;
  headline: string;
  riskScore: number;
  rewardScore: number;
  incomeScore: number;
  liquidityScore: number;
  volatilityRisk: number;
  durationRisk: number;
  creditRisk: number;
  rateSensitivity: number;
  timeHorizonFit: string;
  bestUseCase: string;
  riskProfile: string;
  rewardProfile: string;
  potentialRewards: string[];
  keyRisks: string[];
  whatToWatch: string[];
  termFit: {
    short: number;
    medium: number;
    long: number;
  };
};

type ComparisonResult = {
  generatedAt: string;
  holdingTerm: HoldingTerm;
  riskTolerance: RiskTolerance;
  objective: Objective;
  analyses: {
    assetA: AssetAnalysis;
    assetB: AssetAnalysis;
  };
  comparison: {
    preferredSymbol: string;
    alternateSymbol: string;
    decisionScoreA: number;
    decisionScoreB: number;
    shortTermPick: string;
    mediumTermPick: string;
    longTermPick: string;
    riskWinner: string;
    rewardWinner: string;
    incomeWinner: string;
    liquidityWinner: string;
    summary: string;
    termCommentary: string;
    objectiveCommentary: string;
    decisionFactors: string[];
    caveats: string[];
  };
  dataMode: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-emerald-950/20 backdrop-blur-xl",
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
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Investment Comparison
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2";

function defaultSecurity(assetType: AssetType): SecurityFormState {
  return {
    symbol: "",
    name: "",
    assetType,
    sector: "Unknown",
    marketCap: "Unknown",
    bondType: "Unknown",
    creditQuality: "Unknown",
    durationBucket: "Unknown",
    expectedReturnPct: "",
    yieldPct: "",
    volatilityPct: "",
    beta: "",
  };
}

function scoreTone(score: number): "red" | "green" | "amber" | "slate" {
  if (score >= 70) return "red";
  if (score >= 50) return "amber";
  if (score >= 30) return "slate";
  return "green";
}

function rewardTone(score: number): "red" | "green" | "amber" | "slate" {
  if (score >= 70) return "green";
  if (score >= 50) return "amber";
  if (score >= 30) return "slate";
  return "red";
}

function ScoreBar({
  label,
  value,
  tone = "red",
}: {
  label: string;
  value: number;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const fills = {
    red: "from-emerald-700 to-emerald-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    slate: "from-slate-700 to-slate-300",
    purple: "from-purple-700 to-purple-300",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-black/50">
        <div
          className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function SecurityEditor({
  title,
  value,
  onChange,
}: {
  title: string;
  value: SecurityFormState;
  onChange: (next: SecurityFormState) => void;
}) {
  function update<K extends keyof SecurityFormState>(
    key: K,
    nextValue: SecurityFormState[K]
  ) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  const isBond = value.assetType === "Bond";
  const isEquityLike =
    value.assetType === "Stock" || value.assetType === "ETF" || value.assetType === "Fund";

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Pill tone={isBond ? "green" : "red"}>{value.assetType}</Pill>
          <h2 className="mt-4 text-3xl font-black">{title}</h2>
        </div>
      </div>

      <div className="mt-6 grid gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={value.symbol}
            onChange={(event) => update("symbol", event.target.value)}
            className={inputClass}
            placeholder="Ticker, bond name, or label"
          />

          <input
            value={value.name}
            onChange={(event) => update("name", event.target.value)}
            className={inputClass}
            placeholder="Optional full name"
          />
        </div>

        <select
          value={value.assetType}
          onChange={(event) => update("assetType", event.target.value as AssetType)}
          className={selectClass}
        >
          <option>Stock</option>
          <option>Bond</option>
          <option>ETF</option>
          <option>Fund</option>
        </select>

        {isEquityLike ? (
          <div className="grid gap-4 md:grid-cols-2">
            <select
              value={value.sector}
              onChange={(event) => update("sector", event.target.value)}
              className={selectClass}
            >
              <option>Unknown</option>
              <option>Technology</option>
              <option>Communication</option>
              <option>Consumer Discretionary</option>
              <option>Consumer Staples</option>
              <option>Financials</option>
              <option>Healthcare</option>
              <option>Industrials</option>
              <option>Energy</option>
              <option>Utilities</option>
              <option>Real Estate</option>
              <option>Materials</option>
            </select>

            <select
              value={value.marketCap}
              onChange={(event) => update("marketCap", event.target.value)}
              className={selectClass}
            >
              <option>Unknown</option>
              <option>Mega Cap</option>
              <option>Large Cap</option>
              <option>Mid Cap</option>
              <option>Small Cap</option>
              <option>Micro Cap</option>
            </select>
          </div>
        ) : null}

        {isBond ? (
          <div className="grid gap-4 md:grid-cols-3">
            <select
              value={value.bondType}
              onChange={(event) => update("bondType", event.target.value)}
              className={selectClass}
            >
              <option>Unknown</option>
              <option>Treasury</option>
              <option>Municipal</option>
              <option>Investment Grade Corporate</option>
              <option>High Yield Corporate</option>
              <option>TIPS</option>
              <option>International</option>
            </select>

            <select
              value={value.creditQuality}
              onChange={(event) => update("creditQuality", event.target.value)}
              className={selectClass}
            >
              <option>Unknown</option>
              <option>Treasury / Government</option>
              <option>AAA</option>
              <option>AA</option>
              <option>A</option>
              <option>BBB</option>
              <option>High Yield / Below Investment Grade</option>
            </select>

            <select
              value={value.durationBucket}
              onChange={(event) => update("durationBucket", event.target.value)}
              className={selectClass}
            >
              <option>Unknown</option>
              <option>Ultra Short</option>
              <option>Short</option>
              <option>Intermediate</option>
              <option>Long</option>
            </select>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-4">
          <input
            value={value.expectedReturnPct}
            onChange={(event) => update("expectedReturnPct", event.target.value)}
            className={inputClass}
            placeholder="Expected return %"
          />

          <input
            value={value.yieldPct}
            onChange={(event) => update("yieldPct", event.target.value)}
            className={inputClass}
            placeholder="Yield / dividend %"
          />

          <input
            value={value.volatilityPct}
            onChange={(event) => update("volatilityPct", event.target.value)}
            className={inputClass}
            placeholder="Volatility %"
          />

          <input
            value={value.beta}
            onChange={(event) => update("beta", event.target.value)}
            className={inputClass}
            placeholder="Beta"
          />
        </div>

        <p className="text-xs leading-5 text-slate-500">
          Optional metrics make the comparison sharper. If left blank, Slice uses
          a conservative heuristic model based on asset type, sector, market cap,
          credit quality, and duration.
        </p>
      </div>
    </Card>
  );
}

function AnalysisPanel({
  title,
  analysis,
}: {
  title: string;
  analysis: AssetAnalysis;
}) {
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Pill tone={analysis.assetType === "Bond" ? "green" : "red"}>
            {analysis.assetType}
          </Pill>

          <h2 className="mt-4 text-3xl font-black">
            {title}: {analysis.symbol}
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-400">
            {analysis.name}
          </p>
        </div>

        <Pill tone={scoreTone(analysis.riskScore)}>{analysis.headline}</Pill>
      </div>

      <div className="mt-6 grid gap-4">
        <ScoreBar
          label="Risk Score"
          value={analysis.riskScore}
          tone={scoreTone(analysis.riskScore)}
        />

        <ScoreBar
          label="Reward Score"
          value={analysis.rewardScore}
          tone={rewardTone(analysis.rewardScore)}
        />

        <ScoreBar
          label="Income Score"
          value={analysis.incomeScore}
          tone="green"
        />

        <ScoreBar
          label="Liquidity Score"
          value={analysis.liquidityScore}
          tone="purple"
        />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-black uppercase text-slate-500">
            Short Term Fit
          </div>
          <div className="mt-1 text-2xl font-black">
            {analysis.termFit.short}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-black uppercase text-slate-500">
            Medium Term Fit
          </div>
          <div className="mt-1 text-2xl font-black">
            {analysis.termFit.medium}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-black uppercase text-slate-500">
            Long Term Fit
          </div>
          <div className="mt-1 text-2xl font-black">
            {analysis.termFit.long}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5">
        <h3 className="text-xl font-black">Risk profile</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {analysis.riskProfile}
        </p>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-5">
        <h3 className="text-xl font-black">Reward profile</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {analysis.rewardProfile}
        </p>
      </div>

      <div className="mt-4 rounded-3xl border border-white/10 bg-black/30 p-5">
        <h3 className="text-xl font-black">Best use case</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {analysis.bestUseCase}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {analysis.timeHorizonFit}
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-black text-emerald-200">
            Potential rewards
          </h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
            {analysis.potentialRewards.map((item) => (
              <li key={item} className="rounded-2xl bg-emerald-500/5 p-3">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-black text-emerald-200">Key risks</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
            {analysis.keyRisks.map((item) => (
              <li key={item} className="rounded-2xl bg-emerald-500/5 p-3">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-black">What to watch</h3>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
          {analysis.whatToWatch.map((item) => (
            <li key={item} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

export default function InvestmentComparisonPage() {
  const [assetA, setAssetA] = useState<SecurityFormState>(() =>
    defaultSecurity("Stock")
  );
  const [assetB, setAssetB] = useState<SecurityFormState>(() =>
    defaultSecurity("Bond")
  );

  const [holdingTerm, setHoldingTerm] = useState<HoldingTerm>("Long Term");
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("Moderate");
  const [objective, setObjective] = useState<Objective>("Balanced Growth");
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function runComparison(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/investment-comparison", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetA,
          assetB,
          holdingTerm,
          riskTolerance,
          objective,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Comparison failed.");
        return;
      }

      setResult(payload);
    } catch {
      setMessage("Unable to run comparison.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-4 z-40 rounded-[2rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-emerald-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
              >
                Workspace
              </a>

              <a
                href="/portfolio-lab"
                className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white hover:bg-white/20"
              >
                Portfolio Lab
              </a>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <Card className="p-6">
            <Pill tone="purple">Decision-support comparison</Pill>

            <h1 className="mt-4 text-5xl font-black leading-tight tracking-tight">
              Compare two investments side by side.
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
              Enter two stocks, a stock and a bond, two bonds, ETFs, or funds.
              Slice will outline risk profiles, reward potential, liquidity,
              income profile, time horizon fit, and which option appears better
              aligned with your selected holding term.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase text-slate-500">
                  Short term
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-300">
                  Liquidity, volatility, downside risk, and timing matter most.
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase text-slate-500">
                  Medium term
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-300">
                  Balance valuation, income, quality, and drawdown tolerance.
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-black uppercase text-slate-500">
                  Long term
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-300">
                  Compounding, quality, growth, and inflation protection matter.
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <Pill tone="amber">Important limitation</Pill>

            <h2 className="mt-4 text-3xl font-black">
              First version works without live market data.
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              This version uses your inputs plus a risk/reward heuristic model.
              It is not personalized financial advice. Later, this can be
              upgraded with live prices, valuation, volatility, yield-to-maturity,
              analyst estimates, credit data, and news signals.
            </p>
          </Card>
        </section>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
            {message}
          </div>
        ) : null}

        <form onSubmit={runComparison} className="mt-6 grid gap-6">
          <section className="grid gap-6 lg:grid-cols-2">
            <SecurityEditor
              title="Investment A"
              value={assetA}
              onChange={setAssetA}
            />

            <SecurityEditor
              title="Investment B"
              value={assetB}
              onChange={setAssetB}
            />
          </section>

          <Card className="p-6">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Preferred holding term
                </label>
                <select
                  value={holdingTerm}
                  onChange={(event) =>
                    setHoldingTerm(event.target.value as HoldingTerm)
                  }
                  className={cx(selectClass, "mt-2")}
                >
                  <option>Short Term</option>
                  <option>Medium Term</option>
                  <option>Long Term</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Risk tolerance
                </label>
                <select
                  value={riskTolerance}
                  onChange={(event) =>
                    setRiskTolerance(event.target.value as RiskTolerance)
                  }
                  className={cx(selectClass, "mt-2")}
                >
                  <option>Conservative</option>
                  <option>Moderate</option>
                  <option>Aggressive</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Primary objective
                </label>
                <select
                  value={objective}
                  onChange={(event) =>
                    setObjective(event.target.value as Objective)
                  }
                  className={cx(selectClass, "mt-2")}
                >
                  <option>Capital Preservation</option>
                  <option>Income</option>
                  <option>Balanced Growth</option>
                  <option>Growth</option>
                </select>
              </div>

              <button
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-6 py-4 font-black text-white shadow-lg shadow-emerald-950/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Comparing..." : "Compare"}
              </button>
            </div>
          </Card>
        </form>

        {result ? (
          <section className="mt-6 grid gap-6">
            <Card className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Pill tone="green">Comparison result</Pill>

                  <h2 className="mt-4 text-4xl font-black">
                    Preferred fit: {result.comparison.preferredSymbol}
                  </h2>

                  <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-400">
                    {result.comparison.summary}
                  </p>
                </div>

                <div className="grid min-w-72 gap-3">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      Investment A Score
                    </div>
                    <div className="mt-1 text-3xl font-black">
                      {result.comparison.decisionScoreA}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="text-xs font-black uppercase text-slate-500">
                      Investment B Score
                    </div>
                    <div className="mt-1 text-3xl font-black">
                      {result.comparison.decisionScoreB}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Best short term fit
                  </div>
                  <div className="mt-1 text-2xl font-black">
                    {result.comparison.shortTermPick}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Best medium term fit
                  </div>
                  <div className="mt-1 text-2xl font-black">
                    {result.comparison.mediumTermPick}
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Best long term fit
                  </div>
                  <div className="mt-1 text-2xl font-black">
                    {result.comparison.longTermPick}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-xl font-black">Holding-term logic</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {result.comparison.termCommentary}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-xl font-black">Objective logic</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {result.comparison.objectiveCommentary}
                  </p>
                </div>
              </div>
            </Card>

            <section className="grid gap-6 lg:grid-cols-2">
              <AnalysisPanel
                title="Investment A"
                analysis={result.analyses.assetA}
              />

              <AnalysisPanel
                title="Investment B"
                analysis={result.analyses.assetB}
              />
            </section>

            <Card className="p-6">
              <h2 className="text-3xl font-black">Decision factors</h2>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div>
                  <h3 className="text-xl font-black">Why Slice scored it this way</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                    {result.comparison.decisionFactors.map((factor) => (
                      <li
                        key={factor}
                        className="rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-black">Caveats</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
                    {result.comparison.caveats.map((caveat) => (
                      <li
                        key={caveat}
                        className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-amber-100"
                      >
                        {caveat}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-black/40 p-5 text-sm font-semibold leading-6 text-slate-400">
                {result.dataMode}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}