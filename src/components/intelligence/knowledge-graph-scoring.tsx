import { Activity, Layers3, Scale, ScanLine } from "lucide-react";
import type { SliceAgenticScore } from "@/lib/intelligence/research-swarm-types";
import css from "./knowledge-graph-focus.module.css";

const COHORT_LABELS = { media: "Media & narrative", technical: "Technical & company", economy: "Economy & sectors" };
function number(value: number | null | undefined, digits = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
}

/** The score audit uses the immutable canonical bundle already loaded by Outcomes. */
export default function KnowledgeGraphScoring({ score }: { score: SliceAgenticScore }) {
  const method = score.methodology;
  if (!method) return <p className={css.fine}>This saved run predates the expanded score audit. Build a new research graph to record source sensitivity, evidence freshness, and factor contributions.</p>;
  return <div className={css.scoreAudit}>
    <div className={css.sectionHead}><div><p className={css.eyebrow}><ScanLine size={13}/>Evidence quality / score audit</p><h2>Pressure-test the signal.</h2><p>Source checks and factor grouping shape this run’s {number(score.overall)} / 100 research score. This measures the direction of the evidence; the forecast above estimates a defined future outcome.</p></div></div>
    <div className={css.auditGrid}>
      <div className={css.forecastStat}><span><Activity size={12}/>Source-removal stability</span><strong>{number(method.stabilityScore)} / 100</strong><small>Resilience when one publisher is removed</small></div>
      <div className={css.forecastStat}><span><Layers3 size={12}/>Effective source diversity</span><strong>{number(method.effectiveSourceCount, 2)}</strong><small>{number(method.sourceConcentrationPercent)}% concentration · shared domains grouped</small></div>
      <div className={css.forecastStat}><span><ScanLine size={12}/>Evidence freshness</span><strong>{number(method.freshnessScore)} / 100</strong><small>Adjusted for each factor’s reporting cadence</small></div>
      <div className={css.forecastStat}><span><Scale size={12}/>Largest source effect</span><strong>{number(method.maximumSourceImpact)} pts</strong><small>Maximum score change on source removal</small></div>
    </div>
    <details className={css.details}>
      <summary>Inspect weighting, source sensitivity, and exclusions</summary>
      <div className={css.detailBody}>
        <p><strong>{number(method.eligibleEvidenceCount, 0)} eligible evidence items</strong> across {number(method.factorFamilyCount, 0)} factor families; {number(method.excludedEvidenceCount, 0)} excluded from scoring. Excluded records remain available in the source archive.</p>
        <p>Removing a publisher produces scores from <strong>{number(method.sourceSensitivityBand.low)} to {number(method.sourceSensitivityBand.high)}</strong>. This is a source sensitivity range in score points, not a future price range or probability interval.</p>
        <div className={css.auditTableWrap}><table className={css.auditTable}>
          <caption>How each research cohort contributes to the score</caption>
          <thead><tr><th scope="col">Research cohort</th><th scope="col">Weight</th><th scope="col">Raw score</th><th scope="col">Adjusted score</th><th scope="col">Contribution</th><th scope="col">Neutral shrinkage</th></tr></thead>
          <tbody>{method.contributions.map(row=><tr key={row.cohort}><th scope="row">{COHORT_LABELS[row.cohort]}</th><td>{number(row.weightPercent)}%</td><td>{number(row.rawScore)}</td><td>{number(row.score)}</td><td>{number(row.contribution)} pts</td><td>{number(row.shrinkagePercent)}%</td></tr>)}</tbody>
        </table></div>
        <p>Related indicators are grouped before scoring. Extreme observations have bounded influence, thin evidence is pulled toward neutral, and conflicting findings reduce support.</p>
        {method.sourceInfluence.length>0&&<div className={css.auditTableWrap}><table className={css.auditTable}>
          <caption>Publishers with the largest effect on the score</caption>
          <thead><tr><th scope="col">Source domain</th><th scope="col">Evidence weight</th><th scope="col">Score without source</th><th scope="col">Score change</th></tr></thead>
          <tbody>{method.sourceInfluence.slice().sort((a,b)=>Math.abs(b.impact)-Math.abs(a.impact)).slice(0,8).map(row=><tr key={row.domain}><th scope="row">{row.domain}</th><td>{number(row.weightPercent)}%</td><td>{number(row.withoutSourceScore)}</td><td>{number(row.impact)} pts</td></tr>)}</tbody>
        </table></div>}
        {method.limitations.map((limitation,index)=><p key={index}>{limitation}</p>)}
        <p className={css.fine}>Methodology: {method.version} · Recorded: {method.evaluatedAt&&Number.isFinite(Date.parse(method.evaluatedAt))?new Date(method.evaluatedAt).toLocaleString():"Unavailable"}</p>
      </div>
    </details>
  </div>;
}
