"use client";

import { useState } from "react";
import { BookOpen, GitBranch, ShieldCheck, SlidersHorizontal } from "lucide-react";
import type { Metric, StrategySpec } from "@/lib/strategy-lab/contracts";
import { METRIC_GUIDE, customizeSpec, describeRuleSet, newMetricRule, supportedMetrics } from "@/lib/strategy-lab/custom-strategy";
import { flattenRules } from "@/lib/strategy-lab/indicators";
import RuleTreeEditor from "./rule-tree-editor";
import AdvancedAllocation from "./advanced-allocation";
import css from "./custom-strategy.module.css";

function Numeric({ label, value, min, max, step = 1, optional, onChange }: {
  label: string; value: number | null | undefined; min?: number; max?: number; step?: number;
  optional?: boolean; onChange: (value: number | null) => void;
}) {
  return <label>{label}<input type="number" value={value ?? ""} min={min} max={max} step={step}
    placeholder={optional ? "Off — leave blank" : undefined}
    onChange={event => onChange(optional && event.target.value === "" ? null : Number(event.target.value))} /></label>;
}

/** A real StrategySpec editor shared by historical testing and registered forward replay. */
export default function CustomStrategyEditor({ spec, onChange }: { spec: StrategySpec; onChange: (value: StrategySpec) => void }) {
  const [search, setSearch] = useState("");
  const metrics = supportedMetrics(spec.version).filter(metric => `${metric.label} ${METRIC_GUIDE[metric.id].category} ${METRIC_GUIDE[metric.id].description}`.toLowerCase().includes(search.toLowerCase()));
  const patch = <K extends keyof StrategySpec>(key: K, value: StrategySpec[K]) => onChange({ ...spec, template: "custom", [key]: value });
  function add(metric: Metric, section: "entry" | "exit") {
    const rule = newMetricRule(metric); if (spec.version === 1) delete rule.subject;
    patch(section, { ...spec[section], rules: [...spec[section].rules, rule] });
  }
  return <div className={css.editor}>
    <div className={css.identity}><GitBranch size={18} /><div><strong>Your rules. Your decision process.</strong><p>Build any combination of supported metrics. This definition is used for both historical tests and future paper tracking.</p></div><span>Definition v{spec.version}</span></div>
    {spec.version < 3 && <div className={css.versionNotice}><p>This saved definition retains version {spec.version}. Its original results and active tracking stay unchanged.</p><button type="button" onClick={() => onChange(customizeSpec(spec))}>Create a v3 copy with new metrics and price exits</button></div>}
    <details className={css.catalog}>
      <summary><BookOpen size={15} />Explore the metric library <span>{supportedMetrics(spec.version).length} metrics</span></summary>
      <label className={css.search}>Find a metric<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Trend, volatility, volume, RSI…" /></label>
      <div className={css.metricGrid}>{metrics.map(metric => { const guide = METRIC_GUIDE[metric.id]; return <article key={metric.id}>
        <span>{guide.category} · {guide.unit}</span><h4>{metric.label}</h4><p>{guide.description}</p><small>{guide.example}</small>
        <div><button type="button" disabled={flattenRules(spec.entry).length >= (spec.version === 1 ? 20 : 40)} onClick={() => add(metric.id, "entry")}>+ Entry rule</button><button type="button" disabled={flattenRules(spec.exit).length >= (spec.version === 1 ? 20 : 40)} onClick={() => add(metric.id, "exit")}>+ Exit rule</button></div>
      </article>; })}</div>
      {!metrics.length && <p role="status">No matching metric. Try a price, trend, risk, or volume term.</p>}
      <p className={css.note}>All metrics use recorded daily observations. Historical financial statements, news sentiment, and changing index membership require verified data vintages and are not offered as historical rules.</p>
    </details>
    <section className={css.section}>
      <div className={css.sectionTitle}><span>01</span><div><h3>When should the strategy enter?</h3><p>ALL requires every condition. ANY needs one. Add groups for combinations such as trend AND (momentum OR volume).</p></div></div>
      <RuleTreeEditor title="Entry conditions" value={spec.entry} version={spec.version} onChange={value => patch("entry", value)} />
    </section>
    <section className={css.section}>
      <div className={css.sectionTitle}><span>02</span><div><h3>Define your exits</h3><p>Exit conditions and protective rules are checked every completed session, even between scheduled rebalances.</p></div></div>
      <RuleTreeEditor title="Exit conditions" value={spec.exit} version={spec.version} onChange={value => patch("exit", value)} />
      <div className={css.fields}>
        {spec.version === 3 && <><Numeric label="Stop-loss from average entry (%)" value={spec.stopLossPct} min={.1} max={99} step={.1} optional onChange={value => patch("stopLossPct", value)} />
          <Numeric label="Take-profit from average entry (%)" value={spec.takeProfitPct} min={.1} max={10000} step={.1} optional onChange={value => patch("takeProfitPct", value)} /></>}
        <Numeric label="Trailing stop from highest close (%)" value={spec.trailingStopPct} min={.1} max={99} step={.1} optional onChange={value => patch("trailingStopPct", value)} />
        <Numeric label="Maximum holding sessions" value={spec.maxHoldingSessions} min={1} max={2520} optional onChange={value => patch("maxHoldingSessions", value)} />
        <Numeric label="Portfolio drawdown stop (%)" value={spec.portfolioStopPct} min={.1} max={99} step={.1} optional onChange={value => patch("portfolioStopPct", value)} />
        <Numeric label="Re-entry cooldown sessions" value={spec.cooldownSessions} min={0} max={252} onChange={value => patch("cooldownSessions", value ?? 0)} />
      </div>
      <p className={css.note}>Leave optional exits blank to turn them off. Price exits trigger at a completed close and fill at the next observed open. Overnight gaps can exceed a stop. Average entry uses purchase fills and adjusts for splits; dividends, commissions, and exit costs are excluded from its trigger. The portfolio stop keeps the strategy in cash for the remainder of that test or forward observation period.</p>
    </section>
    <details className={css.advanced}>
      <summary><SlidersHorizontal size={15} />Position sizing, selection, and market filter</summary>
      <div className={css.fields}>
        <label>Rebalance schedule<select value={spec.rebalance} onChange={event => patch("rebalance", event.target.value as StrategySpec["rebalance"])}>{["once", "daily", "weekly", "monthly", "quarterly"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Choose eligible instruments by<select value={spec.ranking} onChange={event => patch("ranking", event.target.value as StrategySpec["ranking"])}><option value="alphabetical">Alphabetical — no performance ranking</option><option value="momentum">Highest trailing return</option><option value="relative-strength">Return versus benchmark</option><option value="low-volatility">Lowest trailing volatility</option></select></label>
        <Numeric label="Ranking / volatility window (sessions)" value={spec.rankingPeriod} min={2} max={252} onChange={value => patch("rankingPeriod", value ?? 63)} />
        <label>Weight eligible holdings<select value={spec.weighting} onChange={event => patch("weighting", event.target.value as StrategySpec["weighting"])}><option value="equal">Equal weight</option><option value="inverse-volatility">Inverse volatility</option></select></label>
        <Numeric label="Maximum holdings" value={spec.maxHoldings} min={1} max={Math.max(1, spec.symbols.length)} onChange={value => patch("maxHoldings", value ?? 1)} />
        <Numeric label="Maximum position target (%)" value={spec.maxPositionPct} min={1} max={100} onChange={value => patch("maxPositionPct", value ?? 100)} />
        <Numeric label="Maximum invested target (%)" value={spec.maxExposurePct} min={1} max={100} onChange={value => patch("maxExposurePct", value ?? 100)} />
        <Numeric label="Sharpe reference rate (% annually)" value={spec.riskFreeRatePct} min={-5} max={30} step={.1} onChange={value => patch("riskFreeRatePct", value ?? 0)} />
      </div>
      <p className={css.note}>Position and group caps apply to rebalance targets; weights can drift afterward. Unallocated money stays in cash. “Once” makes its only entry decision on the first test or forward session. If entry conditions fail then, it stays in cash; an exit does not create another entry.</p>
      {spec.version >= 2 && <><RuleTreeEditor title="Benchmark market filter" value={spec.regime ?? { mode: "all", rules: [] }} version={spec.version} onChange={value => patch("regime", value)} />
        <p className={css.note}>Every market-filter metric uses {spec.benchmark}. If the filter fails, held positions exit at the next open. New entries wait for a scheduled rebalance after the filter passes.</p>
        <AdvancedAllocation symbols={spec.symbols} groups={spec.allocationGroups ?? []} onChange={value => patch("allocationGroups", value)} /></>}
    </details>
    <details className={css.logic}>
      <summary><ShieldCheck size={15} />Read the exact decision logic</summary>
      <h4>Entry</h4><p>{describeRuleSet(spec.entry, spec.benchmark, "No entry filter: every selected instrument is eligible, subject to the schedule, ranking, and allocation controls.")}</p>
      <h4>Exit</h4><p>{describeRuleSet(spec.exit, spec.benchmark, "No metric-based exit. Position exits and scheduled ranking / allocation changes still apply.")}</p>
      <p>Exit precedence: portfolio stop, failed market filter, stop-loss, take-profit, trailing stop, maximum holding period, then metric rules. An exit blocks buying the same instrument at that session&apos;s open. A cooldown of {spec.cooldownSessions} skips that many following sessions before eligibility returns.</p>
    </details>
  </div>;
}
