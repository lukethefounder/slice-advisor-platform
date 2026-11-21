import { ArrowUpRight, CircleHelp, ScanLine, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { SCORE_BANDS, type ScoreInterpretation } from "@/lib/intelligence/score-interpretation";
import { safeResearchSourceUrl } from "@/lib/intelligence/research-evidence";
import type { CurrentResearchReport } from "@/lib/intelligence/research-current-types";
import css from "./score-decision-panel.module.css";

const number = (value: number | null, digits = 1) => value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: digits });
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? `${new Date(value).toLocaleString("en-US", { timeZone: "UTC" })} UTC` : "Unavailable";
const COHORT_LABELS = { media: "Media & narrative", technical: "Technical & company", economy: "Economy & sectors" };

/** The recorded calculation is shown verbatim; this panel never raises confidence. */
export function ConfidenceCalculation({ audit }: { audit: ScoreInterpretation["confidenceAudit"] }) {
  if (!audit) return <p className={css.note}>This saved run has no detailed confidence calculation. Generate current research to record its exact inputs, penalties, and confidence cap.</p>;
  return <details className={css.details}>
    <summary>How the {number(audit.finalConfidence, 2)} / 100 confidence was calculated</summary>
    {audit.validInputs === false && <p role="alert">Confidence could not be calculated because one or more required numeric inputs were unavailable or invalid. This calculation returned 0; collect a new research run to inspect current evidence.</p>}
    <p>The research score describes evidence direction. This separate calculation measures how much support the recorded inputs provide. Agent agreement cannot replace missing observations.</p>
    <div className={css.tableWrap}><table className={css.table}>
      <caption>Recorded confidence calculation</caption>
      <thead><tr><th scope="col">Input</th><th scope="col">Value / 100</th><th scope="col">Weight</th><th scope="col">Confidence points</th></tr></thead>
      <tbody>{audit.components.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{number(row.value, 2)}</td><td>{number(row.weight * 100)}%</td><td>+{number(row.contribution, 2)}</td></tr>)}</tbody>
    </table></div>
    <dl className={css.confidenceMath}>
      <div><dt>Support before penalties</dt><dd>{number(audit.supportBeforePenalties, 2)}</dd></div>
      <div><dt>Cohort disagreement penalty</dt><dd>−{number(audit.contradictionPenalty, 2)}</dd></div>
      <div><dt>Market freshness penalty</dt><dd>−{number(audit.freshnessPenalty, 2)}</dd></div>
      <div><dt>Support after penalties</dt><dd>{number(audit.supportAfterPenalties, 2)}</dd></div>
      <div><dt>Weighted cohort confidence cap</dt><dd>{number(audit.confidenceCap, 2)}</dd></div>
      <div><dt>Final confidence · lower of support and cap</dt><dd>{number(audit.finalConfidence, 2)} / 100</dd></div>
    </dl>
    <div className={css.tableWrap}><table className={css.table}>
      <caption>How each research cohort contributes to the confidence cap</caption>
      <thead><tr><th scope="col">Cohort</th><th scope="col">Confidence</th><th scope="col">Weight</th><th scope="col">Contribution</th><th scope="col">Evidence / domains</th></tr></thead>
      <tbody>{audit.cohorts.map(row => <tr key={row.cohort}><th scope="row">{COHORT_LABELS[row.cohort]}</th><td>{number(row.confidence, 2)}</td><td>{number(row.weightPercent)}%</td><td>{number(row.contribution, 2)} pts</td><td>{number(row.evidenceCount, 0)} / {number(row.sourceCount, 0)}</td></tr>)}</tbody>
    </table></div>
    <div className={css.confidenceInputs}>{(["observed", "derived", "neutralized"] as const).map(key => <div key={key}><h5>{key === "observed" ? "Observed inputs" : key === "derived" ? "Calculated from observations" : "Unavailable or neutralized inputs"}</h5>{audit.inputs[key].length ? <ul>{audit.inputs[key].map((input, index) => <li key={`${input}:${index}`}>{input}</li>)}</ul> : <p>None recorded.</p>}</div>)}</div>
    <p className={css.note}>Calculation version: {audit.version}. Display values are rounded. Confidence is not a calibrated probability of a profitable trade.</p>
  </details>;
}

/** Collection diagnostics are inspectable even when no forecast was published. */
export function ResearchReadinessPanel({ report, blockers = [], explanation, reasons = [] }: {
  report?: CurrentResearchReport | null;
  blockers?: string[];
  explanation?: string;
  reasons?: string[];
}) {
  return <section className={css.readiness} data-status={report?.status ?? (blockers.length ? "limited" : "covered")} aria-label="Research readiness">
    <div className={css.readinessHead}><h4>Research readiness</h4><span>{report ? "Latest 7 days" : "Recorded evidence checks"}</span></div>
    {explanation && <p>{explanation}</p>}
    {report && <>
      <p className={css.note}>Collection checked: <time dateTime={report.checkedAt}>{date(report.checkedAt)}</time><br />Current window: {date(report.windowStart)}–{date(report.checkedAt)}. Economic and financial release periods remain labeled as dated context when older.</p>
      <div className={css.readinessMetrics}>
        <div><strong>{number(report.currentEvidenceCount, 0)}</strong><span>Current scored observations</span></div>
        <div><strong>{number(report.contextEvidenceCount, 0)}</strong><span>Dated context observations</span></div>
        <div><strong>{number(report.scoredNewsCount, 0)}</strong><span>Scored news · {number(report.scoredPublisherCount, 0)} publishers</span></div>
        <div><strong>{number(report.discoveredNewsCount, 0)}</strong><span>Public discoveries · unscored</span></div>
      </div>
      <div className={css.readinessCohorts}>{report.cohorts.map(row => <div key={row.cohort} data-status={row.status}>
        <div><strong>{COHORT_LABELS[row.cohort]}</strong><span>{row.status === "not-weighted" ? "Not weighted" : row.status === "covered" ? "Evidence available" : row.status === "missing" ? "Missing evidence" : "Limited support"}</span></div>
        <p>{number(row.weightPercent)}% research weight · Confidence {number(row.confidence)} / 100</p>
        <p>{number(row.currentCount, 0)} current · {number(row.contextCount, 0)} context · {number(row.sourceCount, 0)} source domains</p>
      </div>)}</div>
    </>}
    {blockers.length > 0 && <div className={css.blockers}><strong>Before using this run for an investment decision</strong><ul>{blockers.map(reason => <li key={reason}>{reason}</li>)}</ul></div>}
    {report && report.gaps.length > 0 && <div className={css.readinessGaps}><h5>Recommended next steps</h5><ul>{report.gaps.map(gap => <li key={gap.code}><strong>{gap.description}</strong><span>{gap.action}</span></li>)}</ul></div>}
    {reasons.length > 0 && <details className={css.details}><summary>What is affecting research confidence?</summary><ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></details>}
    {report && <>
      <details className={css.details}>
        <summary>Collection attempts and provider availability · {report.collection.length}</summary>
        <p>These records show what was requested, whether cached data was used, and when it was retrieved. A successful request can still return no relevant current evidence.</p>
        <div className={css.tableWrap}><table className={css.table}>
          <caption>Provider queries for this recorded research run</caption>
          <thead><tr><th scope="col">Provider / query</th><th scope="col">Result</th><th scope="col">Accepted</th><th scope="col">Retrieved / cache</th></tr></thead>
          <tbody>{report.collection.map((row, index) => <tr key={`${row.provider}:${row.query}:${index}`}>
            <th scope="row">{row.provider}<code className={css.query}>{row.query}</code></th>
            <td>{row.status.replace(/-/g, " ")}<small className={css.query}>{row.detail}</small></td>
            <td>{number(row.acceptedCount, 0)}</td><td>{date(row.retrievedAt)}<small className={css.query}>{row.cacheState.replace(/-/g, " ")}</small></td>
          </tr>)}</tbody>
        </table></div>
        <p>{number(report.excludedEvidenceCount, 0)} observations excluded by scoring eligibility checks. Original publication and observation dates are preserved.</p>
      </details>
      {report.discoveries.length > 0 && <details className={css.details}>
        <summary>Explore recent public research · {report.discoveries.length} unscored articles</summary>
        <p>These discoveries broaden the source trail. They are not scored evidence and do not increase confidence or create a forecast. Publisher attribution from an aggregator is labeled below.</p>
        <ul className={css.discoveries}>{report.discoveries.map(article => {
          const href = safeResearchSourceUrl(article.url);
          return <li key={article.id}>
            {href ? <a href={href} target="_blank" rel="noopener noreferrer">{article.title}<ArrowUpRight size={13} aria-hidden="true" /></a> : <strong>{article.title}</strong>}
            <span>{article.publisher || article.publisherDomain || "Publisher unavailable"} · {article.linkKind === "aggregator" ? "Aggregator link" : "Publisher link"}{article.publisherAttribution === "feed-reported" ? " · Publisher reported by feed" : ""}</span>
            <span>Published <time dateTime={article.publishedAt}>{date(article.publishedAt)}</time><br />Retrieved <time dateTime={article.retrievedAt}>{date(article.retrievedAt)}</time></span>
            {article.summary && <p>{article.summary}</p>}
          </li>;
        })}</ul>
      </details>}
      {report.notes.length > 0 && <details className={css.details}><summary>Collection notes and data limits</summary><ul>{report.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></details>}
    </>}
  </section>;
}

export function ScoreBandGuide({ analysis }: { analysis?: ScoreInterpretation }) {
  return <details className={css.guide}>
    <summary><CircleHelp size={15} aria-hidden="true" />What makes a score good or bad?</summary>
    <p className={css.guideIntro}>These are the existing Slice score bands. Decimals use the exact boundaries below. They describe evidence direction; a favorable band alone does not authorize an investment.</p>
    <div className={css.tableWrap}><table className={css.table}>
      <caption>Slice score interpretation template</caption>
      <thead><tr><th scope="col">Score / 100</th><th scope="col">Meaning</th><th scope="col">How to use it</th></tr></thead>
      <tbody>{SCORE_BANDS.map(band => <tr key={band.id} data-tone={band.tone} data-current={analysis?.band?.id === band.id ? "true" : undefined}>
        <th scope="row">{band.range}{analysis?.band?.id === band.id && <span className={css.current}>Current band</span>}</th>
        <td>{band.label}</td><td>{band.description}</td>
      </tr>)}</tbody>
    </table></div>
    <p className={css.note}>Example: a score of 80 means strongly favorable evidence. It does not mean an 80% chance of profit. Forecast probability, confidence, source quality, and downside must be read separately.</p>
  </details>;
}

/** Pure presentation: the explanation uses the exact run and horizon selected by its parent. */
export default function ScoreDecisionPanel({ analysis, sourcesHref }: { analysis: ScoreInterpretation; sourcesHref?: string }) {
  const positive = analysis.stance === "favorable";
  return <section className={css.panel} data-stance={analysis.stance} aria-label="Investment research decision and score explanation">
    <header className={css.header}>
      <div><p className={css.eyebrow}><ScanLine size={14} aria-hidden="true" />{analysis.symbol} / investment research view</p><h3>{analysis.title}</h3></div>
      <div className={css.score}><span>Final research score</span><strong>{number(analysis.score, 2)}<small> / 100</small></strong><span>{analysis.band?.label ?? "Not available"}</span></div>
    </header>
    <p className={css.action}>{analysis.action}</p>
    <p className={css.summary}>{analysis.summary}</p>
    <div className={css.metrics}>
      <div><span>Modeled price-gain likelihood</span><strong>{analysis.gain.probability === null ? "Withheld" : `${number(analysis.gain.probability)}%`}</strong><small>{analysis.horizon} · before costs and taxes</small></div>
      <div><span>Research confidence</span><strong>{number(analysis.confidence)}<small> / 100</small></strong><small>Strength of support, not win rate</small></div>
      <div><span>Evidence coverage</span><strong>{number(analysis.coverage)}<small> / 100</small></strong><small>Completeness of the recorded inputs</small></div>
    </div>
    <p className={css.summary}>{analysis.gain.explanation}</p>
    <p className={css.note}>Probability reliability has not been established by this interpretation layer. Check settled forecasts and out-of-sample results before relying on an estimate.</p>
    <ResearchReadinessPanel report={analysis.currentResearch} blockers={analysis.blockers} explanation={analysis.confidenceExplanation} reasons={analysis.confidenceReasons} />
    <ConfidenceCalculation audit={analysis.confidenceAudit} />
    <div className={css.risk}><ShieldAlert size={17} aria-hidden="true" /><div><h4>{analysis.riskLabel}</h4><p>{analysis.riskDescription}</p></div></div>
    <div className={css.drivers}>
      <div data-tone="positive"><h4>What supports the case</h4>{analysis.supporting.length ? <ul>{analysis.supporting.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>No supporting driver was recorded.</p>}</div>
      <div data-tone="negative"><h4>What could go wrong</h4>{analysis.opposing.length ? <ul>{analysis.opposing.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}</ul> : <p>No specific adverse driver was recorded. Review source gaps and downside assumptions.</p>}</div>
    </div>
    <details className={css.details}>
      <summary>Evidence mix, cautions, and interpretation rules</summary>
      <div className={css.tableWrap}><table className={css.table}>
        <caption>Actual research weights for this run</caption>
        <thead><tr><th scope="col">Research</th><th scope="col">Weight</th><th scope="col">Score</th><th scope="col">Contribution</th><th scope="col">Evidence</th></tr></thead>
        <tbody>{analysis.cohorts.map(row => <tr key={row.key}><th scope="row">{row.label}</th><td>{number(row.weightPercent)}%</td><td>{row.weightPercent > 0 ? number(row.score) : "Not weighted"}</td><td>{number(row.contribution)} pts</td><td>{row.evidenceCount.toLocaleString()}</td></tr>)}</tbody>
      </table></div>
      {analysis.cautions.length > 0 && <><h4>Review these cautions</h4><ul>{analysis.cautions.map(reason => <li key={reason}>{reason}</li>)}</ul></>}
      {analysis.contradictions.length > 0 && <><h4>Recorded contradictions</h4><ul>{analysis.contradictions.map(reason => <li key={reason}>{reason}</li>)}</ul></>}
      {analysis.gain.status === "recorded-only" && analysis.gain.storedProbability !== null && <p>Archived estimate for this run: {number(analysis.gain.storedProbability)}% price-gain likelihood. It is retained for audit and outcome comparison, and is withheld from the current entry view.</p>}
      <p>Research recorded: {date(analysis.generatedAt)}<br />Provider observation: {date(analysis.providerAsOf)}<br />Selected target: {date(analysis.gain.targetAt)}</p>
      <p>The favorable stance requires score ≥58, research confidence and coverage ≥60, forecast confidence ≥50, modeled price-gain probability ≥55%, positive expected return, current usable evidence, and no major source-sensitivity or disagreement flag. These are transparent review rules, not a backtested guarantee. A bearish score or forecast can produce an unfavorable stance; opposing signals produce watch.</p>
      <p>Current decision checks require a research run from the last 24 hours, a provider observation within seven days, a successful point-in-time evidence audit, and a valid, unexpired horizon. Latest economic and financial releases retain their reporting-period dates. The audit checks input chronology; it does not validate forecast accuracy. Short-horizon decisions additionally require a confirmed live quote within 15 minutes and an open market.</p>
      <p className={css.note}>Interpretation version: {analysis.version}. This research stance does not evaluate personal suitability or execute trades.</p>
    </details>
    <ScoreBandGuide analysis={analysis} />
    <footer className={css.footer}><span>{positive ? "A favorable signal still needs an investment plan." : "Use the recorded evidence to decide what to investigate next."}</span>{sourcesHref && <Link href={sourcesHref} prefetch={false}>Review source evidence<ArrowUpRight size={13} aria-hidden="true" /></Link>}</footer>
  </section>;
}
