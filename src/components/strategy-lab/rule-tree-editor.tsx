"use client";
import { METRICS, type Rule, type RuleSet, type StrategySpec } from "@/lib/strategy-lab/contracts";
import { flattenRules } from "@/lib/strategy-lab/indicators";
import { METRIC_GUIDE, supportedMetrics, newMetricRule } from "@/lib/strategy-lab/custom-strategy";
import css from "./strategy-pro.module.css";
const fresh = (): Rule => ({ metric: "momentumPct", period: 63, comparator: ">", value: 0, subject: "instrument" });
export default function RuleTreeEditor({ title, value, onChange, version = 3, depth = 0, total = flattenRules(value).length }: { title: string; value: RuleSet; onChange: (s: RuleSet) => void; version?: StrategySpec["version"]; depth?: number; total?: number }) {
  function change(i: number, patch: Partial<Rule>) { onChange({ ...value, rules: value.rules.map((r, n) => n === i ? { ...r, ...patch } : r) }); }
  return <section className={css.ruleGroup} aria-label={title}>
    <div className={css.groupHead}><h3>{title}</h3><label>Match <select value={value.mode} onChange={e => onChange({ ...value, mode: e.target.value as RuleSet["mode"] })}><option value="all">ALL · AND</option><option value="any">ANY · OR</option></select></label></div>
    <div className={css.ruleRows}>{value.rules.map((rule, i) => <div className={css.ruleRow} key={i}>
      <label>Data for<select disabled={version === 1} value={rule.subject ?? "instrument"} onChange={e => change(i, { subject: e.target.value as Rule["subject"] })}><option value="instrument">This instrument</option><option value="benchmark">Benchmark</option></select></label>
      <label>Criterion<select value={rule.metric} onChange={e => { const metric = newMetricRule(e.target.value as Rule["metric"]); change(i, { metric: metric.metric, period: metric.period, value: metric.value, upper: rule.comparator === "between" ? metric.value : undefined }); }}>{supportedMetrics(version).map(m => <option value={m.id} key={m.id}>{m.label}</option>)}</select></label>
      <label>Sessions<input type="number" min={2} max={252} value={rule.period} onChange={e => change(i, { period: Number(e.target.value) })} /></label>
      <label>Condition<select value={rule.comparator} onChange={e => change(i, { comparator: e.target.value as Rule["comparator"], upper: e.target.value === "between" ? rule.value : undefined })}>{[[">", "Above"], [">=", "At least"], ["<", "Below"], ["<=", "At most"], ["between", "Between"], ...(version >= 2 ? [["crossesAbove", "Crosses above"], ["crossesBelow", "Crosses below"]] : [])].map(([v, text]) => <option key={v} value={v}>{text}</option>)}</select></label>
      <label>Threshold ({METRIC_GUIDE[rule.metric].unit})<input type="number" step="any" min={METRICS.find(metric => metric.id === rule.metric)?.min} max={METRICS.find(metric => metric.id === rule.metric)?.max} value={rule.value} onChange={e => change(i, { value: Number(e.target.value) })} /></label>
      {rule.comparator === "between" && <label>Upper<input type="number" step="any" value={rule.upper ?? rule.value} onChange={e => change(i, { upper: Number(e.target.value) })} /></label>}
      <button type="button" className={css.quiet} aria-label={`Remove ${title} criterion ${i + 1}`} onClick={() => onChange({ ...value, rules: value.rules.filter((_, n) => n !== i) })}>Remove</button>
      <small className={css.ruleHelp}>{METRIC_GUIDE[rule.metric].description}</small>
    </div>)}</div>
    {(value.groups ?? []).map((group, i) => <div key={i} className={css.nested}><RuleTreeEditor title={`${title} · group ${i + 1}`} value={group} version={version} depth={depth + 1} total={total} onChange={next => onChange({ ...value, groups: value.groups?.map((g, n) => n === i ? next : g) })} /><button type="button" className={css.quiet} onClick={() => onChange({ ...value, groups: value.groups?.filter((_, n) => n !== i) })}>Remove group {i + 1}</button></div>)}
    <div className={css.tools}><button type="button" disabled={total >= (version === 1 ? 20 : 40)} onClick={() => { const rule = fresh(); if (version === 1) delete rule.subject; onChange({ ...value, rules: [...value.rules, rule] }); }}>+ Criterion</button><button type="button" disabled={version === 1 || depth >= 3 || total >= 40 || (value.groups?.length ?? 0) >= 8} onClick={() => onChange({ ...value, groups: [...(value.groups ?? []), { mode: "any", rules: [fresh()] }] })}>+ AND / OR group</button><small>{flattenRules(value).length} criteria · completed prior-session data only</small></div>
    {!value.rules.length && !value.groups?.length && <p className={css.caption}>No filter in this section. Empty entry or regime allows eligibility; empty exit adds no rule-based exit.</p>}
  </section>;
}
