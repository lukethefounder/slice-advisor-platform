import Link from "next/link";
import { ArrowUpRight, Cable, Check, CirclePause, KeyRound, LockKeyhole, Radio, RefreshCw, ShieldCheck, Unplug, Wallet } from "lucide-react";
import type { BrokerCommand, BrokerMode, BrokerPolicy, BrokerView } from "@/lib/agent-broker/contracts";
import css from "./broker-settings.module.css";

export type BrokerSettingsViewProps = {
  value: BrokerView | null; loading: boolean; pending: BrokerCommand["action"] | null; error: string; notice: string;
  mode: BrokerMode; apiKey: string; apiSecret: string; policy: BrokerPolicy; symbols: string; dirty: boolean; conflict: boolean;
  acknowledgement: string; autonomous: boolean;
  onReload: () => void; onMode: (value: BrokerMode) => void; onApiKey: (value: string) => void; onApiSecret: (value: string) => void;
  onConnect: () => void; onPolicy: (update: Partial<BrokerPolicy>) => void; onSymbols: (value: string) => void;
  onSave: () => void; onDiscard: () => void; onAcknowledgement: (value: string) => void; onAutonomous: (value: boolean) => void;
  onEnable: () => void; onAction: (action: "refresh" | "reconcile" | "pause" | "disconnect") => void;
};
const date = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }) + " ET" : "Not recorded";
const number = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—";
const usd = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";
type NumericPolicy = Exclude<keyof BrokerPolicy, "allowedSymbols" | "feed">;
const CAPITAL: Array<{ key: NumericPolicy; label: string; min: number; max: number; step: number }> = [
  { key: "maxOrderUsd", label: "Maximum entry (USD)", min: 1, max: 100000, step: 1 },
  { key: "maxPositionPct", label: "Maximum position (% equity)", min: .1, max: 20, step: .1 },
  { key: "minCashPct", label: "Minimum cash reserve (%)", min: 50, max: 99, step: .1 },
  { key: "maxDailyLossPct", label: "Daily loss stop (%)", min: .1, max: 5, step: .1 },
  { key: "maxTradesPerDay", label: "Maximum daily entries", min: 1, max: 20, step: 1 },
];
const EXITS: typeof CAPITAL = [
  { key: "stopLossPct", label: "Bracket stop loss (%)", min: .1, max: 10, step: .1 },
  { key: "takeProfitPct", label: "Bracket take profit (%)", min: .1, max: 30, step: .1 },
  { key: "maxHoldingMinutes", label: "Maximum holding time (minutes)", min: 1, max: 390, step: 1 },
  { key: "flattenBeforeCloseMinutes", label: "Close before session end (minutes)", min: 5, max: 60, step: 1 },
];
const QUALITY: typeof CAPITAL = [
  { key: "minResearchConfidence", label: "Minimum research confidence / 100", min: 40, max: 100, step: 1 },
  { key: "minEvidenceCoverage", label: "Minimum evidence coverage / 100", min: 40, max: 100, step: 1 },
  { key: "maxQuoteAgeSeconds", label: "Maximum quote age (seconds)", min: 1, max: 10, step: 1 },
  { key: "maxDecisionAgeSeconds", label: "Maximum decision age (seconds)", min: 10, max: 900, step: 1 },
  { key: "maxSpreadBps", label: "Maximum spread (basis points)", min: 1, max: 100, step: 1 },
  { key: "maxPriceDriftBps", label: "Maximum price drift (basis points)", min: 1, max: 100, step: 1 },
];

export default function BrokerSettingsView(props: BrokerSettingsViewProps) {
  const { value, pending, loading, policy } = props;
  const busy = Boolean(pending), executionActive = Boolean(value?.controls.enabled && !value.controls.paused);
  const disconnected = !value?.connected, needPhrase = value?.mode === "live" ? "ENABLE LIVE TRADING" : "ENABLE PAPER TRADING";
  const locked = busy || loading || !value;
  const canConnect = !locked && value?.encryptionConfigured && !executionActive && props.apiKey.trim() && props.apiSecret.trim();
  const canEnable = !locked && !props.dirty && !props.conflict && value?.connected && value.readiness.canEnable
    && (value.mode !== "live" || value.liveServerEnabled) && props.acknowledgement === needPhrase;
  const fields = (items: typeof CAPITAL) => <div className={css.fields}>{items.map(item => <label className={css.field} key={item.key}><span>{item.label}</span><input type="number" required min={item.min} max={item.max} step={item.step} value={Number.isFinite(policy[item.key]) ? policy[item.key] : ""} onChange={event => props.onPolicy({ [item.key]: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>)}</div>;
  return <section id="founder-broker" className={css.panel} aria-label="Founder brokerage connection">
    <header className={css.header}><div><p className={css.eyebrow}><Cable size={13} aria-hidden />FOUNDER / BROKER CONTROL</p><h2>A direct connection.<br /><em>Explicit trading limits.</em></h2><p>Connect your Alpaca API credentials, verify the account, and choose how your agents may submit orders. The broker’s acknowledgments and fills stay separate from Slice’s local simulation.</p></div><div className={css.orbit} aria-hidden><Wallet size={27} /><span /><span /></div></header>
    <div className={css.badges}><span><LockKeyhole size={12} aria-hidden />Founder only</span><span data-tone={value?.connected ? "positive" : "neutral"}>{value?.connected ? "Verified connection recorded" : "No broker connected"}</span><span>{value?.mode === "live" ? "Live brokerage account" : "Broker paper account"}</span><span data-tone={executionActive ? "caution" : "neutral"}>{executionActive ? value?.controls.autonomous ? "Autonomous submissions enabled" : "Manual approvals enabled" : "Broker submissions paused"}</span></div>
    {loading && !value && <p className={css.notice} role="status"><RefreshCw size={14} className={css.spin} aria-hidden />Loading your private connection status…</p>}
    {props.error && <div className={css.notice} data-tone="negative" role="alert"><strong>Connection needs attention</strong><p>{props.error}</p><button type="button" className={css.textButton} onClick={props.onReload} disabled={busy}>Reload saved status<RefreshCw size={12} aria-hidden /></button></div>}
    {props.notice && <p className={css.notice} data-tone="positive" role="status">{props.notice}</p>}
    {value && !value.encryptionConfigured && <p className={css.notice} data-tone="caution"><strong>Server encryption is required.</strong> Configure <code>SLICE_BROKER_ENCRYPTION_KEY</code> on the server before storing broker credentials. No connection can be saved until that server capability is ready.</p>}

    <div className={css.twoColumns}>
      <form className={css.card} autoComplete="off" onSubmit={event => { event.preventDefault(); props.onConnect(); }}>
        <h3><KeyRound size={17} aria-hidden />Connect Alpaca</h3><p>Use API keys from your own broker account. Enter the paper keys first to test the complete workflow with simulated brokerage funds.</p>
        <fieldset disabled={locked || !value?.encryptionConfigured || executionActive} className={css.formGroup}>
          <label className={css.field}><span>Account environment</span><select value={props.mode} onChange={event => props.onMode(event.target.value === "live" ? "live" : "paper")}><option value="paper">Paper · broker simulation</option><option value="live">Live · real brokerage account</option></select></label>
          <label className={css.field}><span>API key ID</span><input name="slice-broker-key" type="password" required autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={200} value={props.apiKey} onChange={event => props.onApiKey(event.target.value)} aria-describedby="broker-credential-handling" /></label>
          <label className={css.field}><span>Secret key</span><input name="slice-broker-secret" type="password" required autoComplete="new-password" autoCapitalize="none" spellCheck={false} maxLength={300} value={props.apiSecret} onChange={event => props.onApiSecret(event.target.value)} aria-describedby="broker-credential-handling" /></label>
        </fieldset>
        <p id="broker-credential-handling" className={css.small}>Keys are sent to the server for verification and encrypted storage. The status API returns no credentials. Submitted input fields clear immediately.</p>
        {executionActive && <p className={css.small}>Pause broker submissions before replacing this connection.</p>}
        {props.mode === "live" && <p className={css.notice} data-tone="caution">Connecting a live account does not enable trading. Live submissions require server permission, a verified SIP feed, and the separate activation step below.</p>}
        <div className={css.actions}><button type="submit" className={css.primary} disabled={!canConnect}>{pending === "connect" ? <RefreshCw size={14} className={css.spin} aria-hidden /> : <Cable size={14} aria-hidden />}{pending === "connect" ? "Verifying connection…" : "Connect & verify"}</button><a className={css.textButton} href="https://app.alpaca.markets" target="_blank" rel="noopener noreferrer">Open Alpaca<ArrowUpRight size={12} aria-hidden /></a></div>
        {value?.credentialsHint && <p className={css.small}>Saved key reference: <code>{value.credentialsHint}</code> · Connected {date(value.connectedAt)}.</p>}
      </form>

      <div className={css.card}>
        <h3><Radio size={17} aria-hidden />Account &amp; feed status</h3><p>The values below are the last broker snapshot, with the actual verification time. Refresh requests new account data.</p>
        <dl className={css.metrics}><div><dt>Broker status</dt><dd>{value?.account?.status || "Not verified"}</dd></div><div><dt>Market-data feed requested</dt><dd>{value?.policy.feed === "sip" ? "SIP · entitlement required" : "IEX · exchange-specific feed"}</dd></div><div><dt>Recorded account equity</dt><dd>{usd(value?.account?.equity)}</dd></div><div><dt>Recorded cash</dt><dd>{usd(value?.account?.cash)}</dd></div><div><dt>Broker buying power</dt><dd>{usd(value?.account?.buyingPower)}</dd></div><div><dt>Last broker check</dt><dd>{date(value?.lastCheckedAt)}</dd></div><div><dt>Broker session</dt><dd>{value?.clock ? value.clock.isOpen ? "Open at recorded check" : "Closed at recorded check" : "Not checked"}</dd></div><div><dt>Account reference</dt><dd>{value?.account?.numberMasked || "Not connected"}</dd></div></dl>
        {value?.account && (value.account.tradingBlocked || value.account.accountBlocked || value.account.tradeSuspended) && <p className={css.notice} data-tone="negative">The broker reports a restriction on this account. Resolve it with Alpaca before enabling submissions.</p>}
        {value?.lastError && <p className={css.notice} data-tone="negative">{value.lastError}</p>}
        <div className={css.actions}><button type="button" className={css.secondary} disabled={locked || disconnected} onClick={() => props.onAction("refresh")}><RefreshCw size={13} className={pending === "refresh" ? css.spin : undefined} aria-hidden />Refresh from broker</button><button type="button" className={css.textButton} disabled={locked || disconnected} onClick={() => props.onAction("reconcile")}>Reconcile order receipts<ArrowUpRight size={12} aria-hidden /></button></div>
        <p className={css.small}>Live eligibility uses the server’s checks, your feed entitlement, the saved evidence floors, and a fresh executable quote. Prices and execution times are never guaranteed.</p>
      </div>
    </div>

    <form className={css.card} onSubmit={event => { event.preventDefault(); props.onSave(); }}>
      <div className={css.sectionHead}><div><p className={css.eyebrow}>YOUR BROKER POLICY</p><h3>Set the boundaries before activation.</h3><p>Whole-share, long-only entries in allowed US equities. Slice manages one owned position at a time. Saving any change pauses new broker submissions.</p></div><span className={css.tag}>{props.dirty ? "Unsaved policy" : value ? `Revision ${value.revision}` : "Not loaded"}</span></div>
      {props.conflict && <p className={css.notice} data-tone="caution" role="alert">The policy changed in another session. Your draft is preserved. Discard it to review the current limits before saving again.</p>}
      <fieldset disabled={locked} className={css.formGroup}><legend>Capital &amp; instruments</legend><div className={css.fields}><label className={`${css.field} ${css.wide}`}><span>Allowed stock &amp; ETF symbols</span><input type="text" required autoComplete="off" maxLength={450} value={props.symbols} onChange={event => props.onSymbols(event.target.value.toUpperCase())} /><small>1–30 symbols separated by commas. Research coverage does not add trading permission.</small></label><label className={css.field}><span>Requested market-data feed</span><select value={policy.feed} onChange={event => props.onPolicy({ feed: event.target.value === "sip" ? "sip" : "iex" })}><option value="iex">IEX · paper testing</option><option value="sip">SIP · live execution requirement</option></select><small>The provider must authorize the selected feed. Selecting SIP does not purchase or grant an entitlement.</small></label></div>{fields(CAPITAL)}</fieldset>
      <fieldset disabled={locked} className={css.formGroup}><legend>Broker-native bracket &amp; monitored exits</legend>{fields(EXITS)}<p className={css.small}>A native bracket links the entry to a profit order and a protective stop at the broker. Gaps can fill a stop beyond its threshold. Holding-time and session-end exits require the running Slice worker.</p></fieldset>
      <details className={css.details}><summary>Evidence quality, freshness &amp; liquidity limits</summary><fieldset disabled={locked} className={css.formGroup}>{fields(QUALITY)}</fieldset></details>
      <div className={css.actions}><button type="submit" className={css.primary} disabled={locked || !props.dirty || props.conflict}><ShieldCheck size={14} aria-hidden />{pending === "settings" ? "Saving policy…" : "Save broker limits"}</button><button type="button" className={css.secondary} disabled={busy || !props.dirty} onClick={props.onDiscard}>Discard edits</button></div>
    </form>

    <div className={css.activation} data-live={value?.mode === "live"}>
      <div><p className={css.eyebrow}>SEPARATE EXECUTION PERMISSION</p><h3>{value?.mode === "live" ? "Authorize live brokerage submissions" : "Activate broker paper trading"}</h3><p>Connection alone never arms an agent. Your saved broker limits apply to every eligible proposal. The local paper ledger and the broker account remain separate.</p>{value && value.readiness.reasons.length > 0 && <ul className={css.reasons}>{value.readiness.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}{value?.mode === "live" && !value.liveServerEnabled && <p className={css.notice} data-tone="caution">Live execution is disabled on this server. The operator must explicitly configure <code>SLICE_BROKER_LIVE_ENABLED=true</code> before live activation is available.</p>}</div>
      <form onSubmit={event => { event.preventDefault(); props.onEnable(); }}>
        <fieldset disabled={locked || !value?.readiness.canEnable || props.dirty || props.conflict || (value?.mode === "live" && !value.liveServerEnabled)} className={css.formGroup}>
          <label className={css.toggle}><input type="checkbox" checked={props.autonomous} onChange={event => props.onAutonomous(event.target.checked)} /><span>Allow autonomous eligible submissions<small>Off keeps individual proposals subject to manual approval. The worker must run for continuous operation.</small></span></label>
          <label className={css.field}><span>Type {needPhrase} to activate</span><input type="text" autoComplete="off" spellCheck={false} value={props.acknowledgement} onChange={event => props.onAcknowledgement(event.target.value)} /></label>
        </fieldset>
        <div className={css.actions}><button type="submit" className={value?.mode === "live" ? css.liveButton : css.primary} disabled={!canEnable}><Check size={14} aria-hidden />{pending === "enable-live" || pending === "enable-paper" ? "Enabling…" : value?.mode === "live" ? "Enable live submissions" : "Enable broker paper submissions"}</button><button type="button" className={css.secondary} disabled={locked || disconnected} onClick={() => props.onAction("pause")}><CirclePause size={14} aria-hidden />Pause submissions</button></div>
      </form>
      <p className={css.small}>Pausing stops new entries. Broker-native protective orders remain active, and the running worker continues monitoring the position it owns. This screen does not cancel existing broker orders.</p>
    </div>

    {value?.pendingIntent && <div className={css.notice} data-tone="caution"><strong>Order receipt needs reconciliation · {value.pendingIntent.status}</strong><p>{value.pendingIntent.message}</p><p className={css.small}>{value.pendingIntent.side.toUpperCase()} {number(value.pendingIntent.quantity)} {value.pendingIntent.symbol} · Client order ID {value.pendingIntent.clientOrderId}. Do not infer a rejection from an interrupted request.</p></div>}
    <details className={css.details}><summary>Broker positions, orders &amp; execution receipts</summary>
      <p className={css.small}>Last broker check {date(value?.lastCheckedAt)}. An accepted order is not a completed fill. Broker-native child orders retain their own status.</p>
      {value?.recentFills?.length ? <div className={css.tableWrap}><table><caption>Actual broker-observed fill snapshots · cumulative quantities per order</caption><thead><tr><th scope="col">Execution</th><th scope="col">Cumulative filled</th><th scope="col">Average fill</th><th scope="col">Gross realized P&amp;L</th><th scope="col">Net result</th></tr></thead><tbody>{value.recentFills.map(fill => <tr key={fill.id}><th scope="row">{fill.side.toUpperCase()} {fill.symbol}<small>{fill.classification === "broker-live" ? "Live brokerage" : "Broker paper simulation"} · {date(fill.filledAt || fill.observedAt)}</small><small>{fill.clientOrderId}</small></th><td>{number(fill.cumulativeFilledQuantity)}<small>{fill.closedPosition ? "Owned position closed" : "Position may remain open"}</small></td><td>{usd(fill.averageFillPrice)}</td><td>{usd(fill.grossRealizedPnl)}<small>{fill.notes}</small></td><td>Not determined<small>Fees are not known; cumulative snapshots must not be summed.</small></td></tr>)}</tbody></table></div> : <p className={css.empty}>No broker-observed fills recorded. Accepted receipts below do not imply execution.</p>}
      {value?.positions.length ? <div className={css.tableWrap}><table><caption>Positions reported by the broker</caption><thead><tr><th scope="col">Instrument</th><th scope="col">Shares</th><th scope="col">Average entry</th><th scope="col">Unrealized P&amp;L</th><th scope="col">Slice ownership</th></tr></thead><tbody>{value.positions.map(position => <tr key={position.symbol}><th scope="row">{position.symbol}<small>{position.side}</small></th><td>{number(position.quantity)}</td><td>{usd(position.averageEntryPrice)}</td><td>{usd(position.unrealizedPnl)}</td><td>{position.symbol === value.activePositionSymbol ? "Recorded Slice position" : "Outside Slice ownership"}</td></tr>)}</tbody></table></div> : <p className={css.empty}>{value?.lastCheckedAt ? "No positions in the last broker snapshot." : "Positions have not been retrieved."}</p>}
      {value?.orders.length ? <div className={css.tableWrap}><table><caption>Broker order snapshot</caption><thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Filled / requested</th><th scope="col">Recorded fill price</th></tr></thead><tbody>{value.orders.map(order => <tr key={order.id}><th scope="row">{order.side.toUpperCase()} {order.symbol}<small>{order.orderClass} · {order.type}</small></th><td>{order.status}<small>{order.legs.map(leg => `${leg.type}: ${leg.status}`).join(" · ")}</small></td><td>{number(order.filledQuantity)} / {number(order.quantity)}</td><td>{usd(order.filledAveragePrice)}<small>{date(order.filledAt)}</small></td></tr>)}</tbody></table></div> : <p className={css.empty}>No orders in the saved snapshot.</p>}
      {value?.recentIntents.length ? <ol className={css.receipts}>{value.recentIntents.map(intent => <li key={intent.id}><strong>{intent.side.toUpperCase()} {number(intent.quantity)} {intent.symbol} · {intent.status}</strong><span>{intent.mode === "live" ? "Live account" : "Broker paper account"} · {date(intent.updatedAt)}</span><p>{intent.message}</p><code>{intent.clientOrderId}</code>{intent.order && <span>Broker: {intent.order.status} · Filled {number(intent.order.filledQuantity)} shares at {usd(intent.order.filledAveragePrice)}</span>}</li>)}</ol> : <p className={css.empty}>No Slice broker submission receipts recorded.</p>}
    </details>
    <div className={css.disconnect}><div><h3>Connection controls</h3><p>Disconnecting deletes the stored keys and pauses new submissions. It does not cancel orders or close positions at Alpaca. Review any active positions and orders with the broker before disconnecting.</p>{value?.limitations.length ? <details className={css.details}><summary>Current execution scope &amp; limitations</summary><ul className={css.reasons}>{value.limitations.map((limit, index) => <li key={index}>{limit}</li>)}</ul></details> : null}</div><button type="button" className={css.danger} disabled={locked || disconnected} onClick={() => props.onAction("disconnect")}><Unplug size={14} aria-hidden />Disconnect stored keys</button></div>
    <footer className={css.footer}><span>Private founder connection · API credentials never appear in returned account data.</span><Link href="/workspace/intelligence/agent-desk" prefetch={false}>Open Agent Desk<ArrowUpRight size={12} aria-hidden /></Link></footer>
  </section>;
}
