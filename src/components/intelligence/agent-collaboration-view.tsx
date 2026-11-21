import Link from "next/link";
import { ArrowUpRight, BrainCircuit, Check, FileCheck2, LockKeyhole, MessageCircle, RefreshCw, Send } from "lucide-react";
import type { AgentBoardMessage, AgentCollaborationView, AgentLearningSummary, AgentTradeBrief } from "@/lib/agent-desk/collaboration-types";
import { AGENT_ROLES, AGENT_ROLE_LABELS, type AgentRole } from "@/lib/agent-desk/contracts";
import type { AgentCollaborationMode } from "./agent-collaboration";
import css from "./agent-desk.module.css";

const number = (value: number | null | undefined, digits = 1) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
const money = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "Not realized";
const time = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value} · date only` : new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : "Not recorded";
const actor = (role: AgentBoardMessage["from"] | AgentBoardMessage["to"]) => role === "team" ? "Team" : role === "founder" ? "You" : role === "system" ? "Execution & memory" : AGENT_ROLE_LABELS[role];
const graphHref = (symbol: string, researchRunId: string | null) => `/workspace/intelligence?${new URLSearchParams({ symbol, ...(researchRunId ? { researchRunId } : {}) })}`;
const messageAnchor = (id: string) => `agent-message-${encodeURIComponent(id)}`;

export type AgentCollaborationDashboardProps = {
  mode: AgentCollaborationMode; value: AgentCollaborationView | null; loading: boolean; error: string; notice: string; pending: string | null;
  body: string; to: AgentRole | "team"; onBody: (value: string) => void; onTo: (value: AgentRole | "team") => void; onMessage: () => void; onRead: (id: string) => void; onReload: () => void;
};

export default function AgentCollaborationDashboard(props: AgentCollaborationDashboardProps) {
  const { mode, value, loading, error, notice, pending } = props;
  return <div className={`${css.desk} ${css.collaboration}`} data-founder-agent-panel={mode}>
    <section className={css.section} aria-label={mode === "briefs" ? "Your private agent trade briefs" : "Private founder agent collaboration"}>
      <div className={css.sectionHead}><div><p className={css.eyebrow}><LockKeyhole size={13} aria-hidden />Founder access · private to your account</p><h2>{mode === "briefs" ? "Every paper trade. Explained." : mode === "board" ? "The team’s conversation." : "Shared context. Recorded lessons."}</h2><p>{mode === "briefs" ? "Your own fills, their rationale, and realized outcomes arrive here after they are recorded. A paper entry is an open position, not a profit." : "Inspect what each specialist found, how they challenged one another, and how the Chief consolidated the decision. Learning is grounded in recorded outcomes and sample counts."}</p></div><div className={css.actions}><Link href="/workspace/intelligence/agent-desk" prefetch={false} className={css.textButton}>Agent controls<ArrowUpRight size={13} aria-hidden /></Link><button className={css.secondary} type="button" onClick={props.onReload} disabled={Boolean(pending) || loading}><RefreshCw size={13} aria-hidden className={loading ? css.loading : undefined} />Refresh</button></div></div>
      {loading && !value && <p className={css.empty} role="status">Loading your private agent records…</p>}
      {error && <div className={css.notice} data-tone="negative" role="alert">{error}</div>}
      {notice && <p className={css.notice} data-tone="positive" role="status">{notice}</p>}
      {value && mode === "briefs" && <AgentTradeBriefList briefs={value.briefs} pending={pending} onRead={props.onRead} />}
      {value && mode !== "briefs" && <>
        <div className={css.neuralRoles} aria-label="Six agents share a recorded context">{AGENT_ROLES.map(role => <span key={role} data-agent={role}>{AGENT_ROLE_LABELS[role]}</span>)}</div>
        <p className={css.fine}>{mode === "desk" ? "A preview of the latest saved exchanges. Open the Team Board for the recent conversation." : `Showing the ${value.board.length} most recent saved messages in chronological order.`}</p>
        <AgentBoardTranscript messages={mode === "desk" ? value.board.slice(-8) : value.board} />
        {mode === "board" ? <form className={css.composer} onSubmit={event => { event.preventDefault(); props.onMessage(); }}>
          <label className={css.field}>Add a review note<textarea value={props.body} onChange={event => props.onBody(event.target.value)} maxLength={4000} rows={3} disabled={Boolean(pending)} placeholder="Ask the team to investigate a risk or review a past decision." /></label>
          <div className={css.composerActions}><label className={css.field}>Address to<select value={props.to} onChange={event => props.onTo(event.target.value as AgentRole | "team")} disabled={Boolean(pending)}><option value="team">Whole team</option>{AGENT_ROLES.map(role => <option key={role} value={role}>{AGENT_ROLE_LABELS[role]}</option>)}</select></label><button type="submit" className={css.button} disabled={Boolean(pending) || !props.body.trim()}><Send size={13} aria-hidden />{pending === "message" ? "Saving note…" : "Post to private channel"}</button></div><p className={css.fine}>Your note is stored under your signed-in identity. It does not place an order or change your execution safeguards.</p>
        </form> : <Link href="/workspace/team-board#founder-agent-channel" prefetch={false} className={css.textButton}>Open the full agent conversation<MessageCircle size={13} aria-hidden /></Link>}
      </>}
    </section>
    {value && mode !== "briefs" && <AgentLearningPanel learning={value.learning} />}
  </div>;
}

export function AgentBoardTranscript({ messages }: { messages: AgentBoardMessage[] }) {
  if (!messages.length) return <div className={css.empty}><strong>No agent messages yet</strong>Run a research cycle from the Agent Desk. Actual reports, challenges, replies, and the Chief’s decision will appear here.</div>;
  const visibleIds = new Set(messages.map(message => message.id));
  return <ol className={css.transcript} aria-label="Recorded agent conversation">{messages.map(message => <li id={messageAnchor(message.id)} key={message.id} className={css.transcriptMessage} data-phase={message.phase}>
    <header><div className={css.pills}><strong>{actor(message.from)}</strong><span className={css.pill}>{message.phase} · round {message.round}</span><span className={css.fine}>{message.symbol || "Team context"} → {actor(message.to)}</span></div><time dateTime={message.createdAt}>{time(message.createdAt)}</time></header>
    <p className={css.messageBody}>{message.body}</p>
    {message.replyToIds.length > 0 && <div className={css.messageReplies}><span>In reply to</span>{message.replyToIds.map((id, index) => visibleIds.has(id) ? <a key={id} href={`#${messageAnchor(id)}`} className={css.textButton}>Message {index + 1}<ArrowUpRight size={11} aria-hidden /></a> : <span key={id} className={css.fine}>Earlier message outside this view</span>)}</div>}
    {message.report && <details className={css.recordDetails}><summary>Recorded report · {message.report.status} · {message.report.stance}{message.report.veto ? " · veto" : ""}</summary>
      {message.report.findings.length > 0 && <ul>{message.report.findings.map((finding, index) => <li key={index}>{finding.claim}{finding.evidenceIds.length > 0 && <small>Evidence: {finding.evidenceIds.join(", ")}</small>}</li>)}</ul>}
      {message.report.risks.length > 0 && <p><strong>Risks:</strong> {message.report.risks.join(" · ")}</p>}
      {message.report.missingData.length > 0 && <p><strong>Missing evidence:</strong> {message.report.missingData.join(" · ")}</p>}
      {message.report.error && <p>{message.report.error}</p>}
      {message.report.toolCalls?.length ? <p><strong>Tools used:</strong> {message.report.toolCalls.map(call => `${call.tool} (${call.evidenceIds.length} records)`).join(" · ")}</p> : null}
      <p className={css.fine}>Model: {message.report.model || "Not recorded"} · Request: {message.report.requestId || "Not recorded"}</p>
    </details>}
    <footer className={css.messageFooter}>{message.researchRunId && <Link href={graphHref(message.symbol, message.researchRunId)} prefetch={false} className={css.textButton}>Inspect sources for this run<ArrowUpRight size={12} aria-hidden /></Link>}{message.evidenceIds.length > 0 && <span className={css.fine}>{message.evidenceIds.length} referenced evidence records</span>}<details className={css.recordDetails}><summary>Audit identifiers</summary><p>Cycle: {message.cycleId || "Founder review note"}</p>{message.sourceHash && <p>Source fingerprint: <code>{message.sourceHash}</code></p>}<p>Message: {message.id}</p>{message.evidenceIds.length > 0 && <p>Evidence IDs: {message.evidenceIds.join(", ")}</p>}</details></footer>
  </li>)}</ol>;
}

export function AgentTradeBriefList({ briefs, pending, onRead }: { briefs: AgentTradeBrief[]; pending: string | null; onRead: (id: string) => void }) {
  if (!briefs.length) return <div className={css.empty}><strong>No paper trade briefs yet</strong>A private in-app brief is recorded when an actual simulated fill completes. Holds and blocked entries remain in the Team Board and decision history.</div>;
  const unread = briefs.filter(brief => !brief.readAt).length;
  return <><div className={css.pills}><span className={css.pill}><FileCheck2 size={12} aria-hidden />{briefs.length} recent recorded briefs</span><span className={css.pill}>{unread} unread in this view</span><span className={css.pill}>Private in-app delivery · paper simulation</span></div><div className={css.briefGrid}>{briefs.map(brief => <article key={brief.id} className={css.tradeBrief} data-unread={!brief.readAt}>
    <header><span className={css.pill} data-tone={brief.side === "SELL" ? "caution" : "positive"}>{brief.side} · {brief.symbol}</span><time dateTime={brief.createdAt}>{time(brief.createdAt)}</time></header><h3>{brief.title}</h3><p>{brief.summary}</p>
    <dl className={css.briefMetrics}><div><dt>Simulated fill</dt><dd>{number(brief.fill.quantity, 0)} shares @ {money(brief.fill.fillPrice)}</dd></div><div><dt>Fees / slippage</dt><dd>{money(brief.fill.fees)} / {money(brief.fill.slippageCost)}</dd></div><div><dt>{brief.realized ? "Net realized P&L" : "Outcome"}</dt><dd>{brief.realized ? money(brief.netPnl) : "Open · not realized"}</dd></div><div><dt>Net return</dt><dd>{brief.realized && brief.netReturnPct !== null ? `${number(brief.netReturnPct, 2)}%` : "Pending exit"}</dd></div></dl>
    <p className={css.fine}>Observed {money(brief.fill.observedPrice)} at {time(brief.fill.observedAt)}. Filled {time(brief.fill.filledAt)} using the observed price plus configured simulation costs.</p>
    {brief.attribution === "legacy-entry-unavailable" && <p className={css.warningText}>The matching entry’s research record is unavailable. This outcome cannot be attributed to a complete entry-to-exit agent history.</p>}
    <details className={css.recordDetails}><summary>Trade rationale and audit</summary><p>{brief.fill.reason}</p><p>Cycle: {brief.cycleId}</p><p>Entry cycle: {brief.entryCycleId || "Not linked"}</p><p>Source fingerprint: <code>{brief.sourceHash}</code></p>{brief.contextQuote && <p>Research observation: {money(brief.contextQuote.price)} at {time(brief.contextQuote.observedAt)}.</p>}{brief.executionQuote && <p>Execution observation: {money(brief.executionQuote.price)} at {time(brief.executionQuote.observedAt)}.</p>}</details>
    <div className={css.actions}>{brief.researchRunId && <Link href={graphHref(brief.symbol, brief.researchRunId)} prefetch={false} className={css.textButton}>Research sources<ArrowUpRight size={12} aria-hidden /></Link>}{brief.readAt ? <span className={css.fine}><Check size={12} aria-hidden />Read {time(brief.readAt)}</span> : <button type="button" className={css.secondary} disabled={Boolean(pending)} onClick={() => onRead(brief.id)}><Check size={12} aria-hidden />{pending === brief.id ? "Saving…" : "Mark as read"}</button>}</div>
  </article>)}</div></>;
}

export function AgentLearningPanel({ learning }: { learning: AgentLearningSummary }) {
  return <section className={css.section} aria-label="Outcome-based agent learning"><div className={css.sectionHead}><div><p className={css.eyebrow}><BrainCircuit size={13} aria-hidden />Shared outcome memory</p><h2>Learn from the record.</h2><p>The team can review stored outcomes and observed patterns. These records support future review; they do not retrain model weights or prove what will happen next.</p></div><span className={css.pill}>{learning.version}</span></div>
    <div className={css.learningMetrics}><div className={css.stat}><span>Closed paper trades</span><strong>{number(learning.closedTrades, 0)}</strong><small>{number(learning.linkedTrades, 0)} linked to entry research · {number(learning.unattributedTrades, 0)} without an entry link</small></div><div className={css.stat}><span>Observed win rate</span><strong>{learning.observedWinRatePct === null ? "No sample" : `${number(learning.observedWinRatePct)}%`}</strong><small>{learning.wins} wins · {learning.losses} losses · {learning.breakeven} breakeven</small></div><div className={css.stat}><span>Net realized outcome</span><strong>{money(learning.netPnl)}</strong><small>Recorded simulation costs included · {learning.closedTrades} closed trades</small></div></div>
    <p className={css.fine}>Sample: {learning.sampleWindow.totalRecordedTrades} recorded closed trades{learning.sampleWindow.truncated ? `; showing the most recent ${learning.sampleWindow.limit}` : " in the available history"}. Window: {time(learning.sampleWindow.oldestClosedAt)} to {time(learning.sampleWindow.newestClosedAt)}. Updated {time(learning.generatedAt)}. Historical observed win rates are not forecasts of profit.</p>
    {learning.lessons.length ? <div className={css.lessonGrid}>{learning.lessons.map(lesson => <article className={css.lesson} key={lesson.id}><span className={css.pill}>{lesson.status === "review-candidate" ? "Review candidate" : "Observed pattern"} · {lesson.sampleCount} trade{lesson.sampleCount === 1 ? "" : "s"}</span><h3>{lesson.title}</h3><p>{lesson.description}</p><p className={css.fine}>{lesson.lossCount} losses · {money(lesson.netPnl)} net outcome · Memory version {lesson.version}. Last observed {time(lesson.lastObservedAt)}.</p><details className={css.recordDetails}><summary>Supporting record</summary><p>Condition: {lesson.condition}</p><p>Related cycles: {lesson.relatedCycleIds.join(", ") || "Not linked"}</p><p>Advisory observation. It cannot override execution safeguards.</p></details></article>)}</div> : <div className={css.empty}><strong>No lessons asserted yet</strong>Patterns appear when saved closed trades provide an evidence sample. A new account does not contain invented performance or training history.</div>}
    <details className={css.recordDetails}><summary>Role-associated outcomes and limitations</summary><p className={css.fine}>Each role is associated with the same trades it reviewed. These are not independent returns or a measurement of the role’s causal contribution.</p><div className={css.tableWrap}><table className={css.table}><caption>Recorded trades reviewed by each role</caption><thead><tr><th scope="col">Role</th><th scope="col">Trades</th><th scope="col">Win rate</th><th scope="col">Net outcome</th></tr></thead><tbody>{learning.byRole.map(row => <tr key={row.role}><th scope="row">{AGENT_ROLE_LABELS[row.role]}</th><td>{row.reviewedTrades}</td><td>{row.observedWinRatePct === null ? "No sample" : `${number(row.observedWinRatePct)}%`}</td><td>{money(row.netPnl)}</td></tr>)}</tbody></table></div>{learning.limitations.length > 0 && <ul>{learning.limitations.map((limitation, index) => <li key={index}>{limitation}</li>)}</ul>}</details>
  </section>;
}
