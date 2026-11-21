# Founder agents, adaptive helpers, internet research and Alpaca

This release extends the existing Slice project. It adds a working brokerage adapter, controlled public web research, an inventory of authorized platform material, workload-based helpers and a persistent market-stream worker. Research agents propose decisions; deterministic server code validates the current account, policy, quote and immutable decision before an order can be submitted. No account is connected or trading enabled by installing the update.

The implemented broker scope is regular-session, long-only, whole-share US stocks and ETFs, with one agent-owned position at a time. Indices remain research instruments. Options, crypto, short sales, leveraged multi-position portfolios, external-position management and guaranteed returns are not implemented.

## What the six roles do

| Role | Tools and responsibilities |
| --- | --- |
| Chief | Reads the revised specialists, conflicts, lessons and selected account context; makes the final buy, sell or hold proposal. It cannot change policy or send a broker request. |
| Sentiment | Reads the Intelligence economy evidence and dated risk-appetite proxies; distinguishes observed participation from claims about investor willingness. |
| Scout | Reviews observed candidates from the configured research universe and watchlists, records why they deserve research and can queue Intelligence jobs. Discovery never expands the allowed trading symbols. |
| News | Reviews current media evidence, the shared public web-source inventory and relevant catalysts; explains contradictions and separate short/long horizons. |
| Skeptic | Reads saved strategies, historical scenarios and holdout results; challenges causal claims, sample size, costs, stale evidence and unsupported confidence. |
| Charts | Reads technical metrics and the data behind Market Visuals and Custom Board, including source receipts, timestamps and missing calculations. |

The two-round discussion remains twelve principal role reports: four initial specialists, Skeptic, Chief's questions, four revisions, final Skeptic and final Chief. Reports and addressed messages are saved on the private Team Board. Chief makes the proposal after the revision round. Role agreement is not independent evidence and does not add confidence points.

### Helpers

Groups with more than twelve distinct source records can be delegated in disjoint chunks of up to eight. Allocation rotates across overloaded roles. The default cap is four helpers with two concurrent; the founder may choose zero to twelve helpers and one to three concurrent requests, or disable helpers. Small workloads stay with the six main roles. Helpers return source-linked findings and are constrained to hold: they cannot nominate trades, modify safeguards or send orders. A failed helper is visible and blocks a new broker entry. Their source fingerprints and reports appear in the agent panel.

There is no implementation of ten thousand simultaneous independent expert models. That would multiply provider cost and duplicated evidence without proving predictive accuracy. This release counts actual work and observed sources, with bounded expansion for backlog.

## Internet and platform research

One owner-scoped hosted web-search request supplies a shared source inventory to all six roles and helpers. Economy mode requests one search allowance and responsive mode up to two. Results are cached for fifteen minutes within the owner/workspace scope; cache reads retain original retrieval and publication dates. Provider search receipts, consulted sources and actual token measurements are recorded. If access fails, the UI reports the error rather than generating pretend search results.

The finite read tools expose authorized research archives, knowledge-graph records, watchlists, saved Strategy Studio definitions/runs, registered forward scenarios, accessible Team Board context, personal Briefs and available Custom Board configuration. A capability inventory distinguishes available, empty, restricted and unavailable records. Browser-only unsaved settings cannot be read by a background server process and are reported as such.

Public pages can be opened only from the preloaded source inventory, with public-address DNS checks and a pinned HTTPS connection. Private IPs, embedded credentials, suspicious secret query strings, redirects and oversized bodies are rejected. Research text and other agents' messages remain untrusted data and cannot grant permissions. No model gets API keys, arbitrary SQL, filesystem access, unrestricted URLs, email delivery or account-administration tools.

### Research from other members

Settings → Data → Public research sharing provides an explicit opt-in and revocation control. The founder's agents may search public market-source projections from opted-in members. This does not expose other users' private portfolios, customer records, account credentials, private conversations or full licensed provider datasets. The founder's read switch does not opt other members in. New loads respect revoked sharing. Previously authorized source references already saved in an immutable research receipt remain part of that receipt's audit history.

## Continuous operation and cost

Run the app and `npm run beta:worker` continuously. A production worker needs an always-on Node process and a reachable authenticated application URL. A local terminal stops working when the computer sleeps, the process closes or its connection fails. A hosted website alone does not create a persistent background employee process.

The worker checks research jobs every fifteen seconds, agent monitoring every fifteen seconds, watchlists and forward strategies every minute, and forecast settlement every five minutes. These intervals start after the prior request completes; they are not guaranteed service latency. Protective monitoring and broker reconciliation run independently from AI deliberation.

Economy mode uses a full review after an observed material change or a scheduled refresh, with a minimum interval of the greater of ten minutes and the saved desk interval and a maximum quiet-market interval of the greater of sixty minutes and the saved interval. The price trigger is a 0.75% movement from the last full review. Responsive mode uses five/ fifteen minutes and a 0.25% trigger. New cached public-source identities and changed account exposure can trigger review; manual research bypasses the review throttle. Fresh market observations are required for automatic reviews. An old proposal is never replayed because a new review was skipped.

New runs use one combined assigned-source read packet per report, with additional finite reads available when needed. This avoids repeatedly sending the same large context through six required sequential reads. The panel reports actual request/input/output/cached-token counts and flags responses for which usage was unavailable. These are measured counts, not a fabricated dollar bill; hosted-search charges, model rates, market subscriptions, hosting and database usage must be checked with the provider. The default model remains configurable with `OPENAI_AGENT_MODEL` and web research with `OPENAI_RESEARCH_MODEL`.

## Why Alpaca is the first supported provider

Alpaca's Trading API supports API-key access, paper and live environments with the same API specification, account/position/order reads, historical and streaming data, client order IDs and bracket orders. This fits a private founder connection with a straightforward Settings flow. The implementation uses the individual Trading API, not a multi-user brokerage business integration.

Current official data-plan documentation lists Basic as free with real-time IEX coverage and thirty websocket symbols. Algo Trader Plus is listed at $99/month with consolidated coverage from all US stock exchanges and unlimited symbol subscriptions. Slice currently caps each connection's active subscription list at thirty to keep workload and presentation bounded. Free IEX is one exchange, not the consolidated market; it is sufficient for initial paper integration checks, but this implementation requires a verified SIP entitlement for live entries.

For an individual IBKR integration, the official FAQ currently describes a local Client Portal Gateway and manual login/2FA, which makes it a less direct fit for this first credentials-in-Settings workflow. This is an integration choice, not a claim that any broker guarantees better returns. Live account eligibility, funding, account restrictions, data entitlements and any applicable fees are determined by the broker.

Primary references, checked for this release:

- [Alpaca data plans and API authentication](https://docs.alpaca.markets/us/docs/about-market-data-api)
- [Alpaca paper trading and simulation limits](https://docs.alpaca.markets/us/docs/paper-trading)
- [Alpaca orders and bracket behavior](https://docs.alpaca.markets/us/docs/orders-at-alpaca)
- [Alpaca streaming market data](https://docs.alpaca.markets/docs/streaming-market-data)
- [IBKR individual Web API access](https://www.interactivebrokers.com/support/faq/content/apply-rest-web-api-29950119)

## Settings setup

Keep your existing database/session/security environment values. Do not replace `.env.local` with `.env.example` and do not rotate an existing MFA encryption key for this upgrade.

Add the following server-only values to `.env.local` as needed:

```dotenv
SLICE_FOUNDER_EMAILS=your-exact-login-email@example.com
OPENAI_API_KEY=your-existing-provider-key
OPENAI_AGENT_MODEL=gpt-5-mini
ALPHA_VANTAGE_API_KEY=your-existing-market-key
SLICE_BROKER_ENCRYPTION_KEY=your-new-64-character-hex-key
SLICE_BROKER_LIVE_ENABLED=false
CRON_SECRET=your-existing-or-new-worker-secret
SLICE_BETA_WORKER_URL=http://localhost:3000
```

Generate the dedicated broker encryption key once:

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste it into `SLICE_BROKER_ENCRYPTION_KEY`, preserve it in your server secret backup, and restart the app and worker. Changing this key without re-encrypting stored credentials makes them unreadable. Generate a separate random value for `CRON_SECRET` if you do not already have one; never reuse a broker API secret as the worker secret. The app and worker must use the same CRON secret. Remote worker targets must use HTTPS.

Use Node 22.12+ or Node 24+ for the persistent WebSocket worker. Older supported application runtimes without built-in WebSocket report streaming offline; no synthetic price stream is substituted.

1. Log in with an active email included in `SLICE_FOUNDER_EMAILS`.
2. Open Settings → Connections → Founder brokerage, or `/workspace/settings#founder-broker`.
3. Select **Alpaca paper** and enter the paper API key and secret obtained from Alpaca. These are API credentials, not your brokerage login password. Connection verifies the actual account and starts with execution paused.
4. Set the allowed symbols, order cap, position percentage, cash reserve, daily loss limit, entry-attempt limit, required confidence/coverage, quote age, spread/drift, stop, target and time/closing exits.
5. Explicitly enable the selected environment, choosing manual approval or autonomous execution. The required acknowledgment names the environment. A connection alone never enables orders.
6. Start a fresh Intelligence agent cycle. The cycle records the selected brokerage mode and broker-control revision; a cycle researched for the simulator or an earlier broker configuration cannot be used to submit a new order.
7. In manual mode, use the separate broker approval control for that exact saved proposal. In autonomous mode the server evaluates eligible proposals after they are durably saved. Both paths apply the same current broker safeguards.
8. Inspect receipts, confirmed fills, stream health and private Team Board discussion. Keep paper and live observations separate when assessing performance.

Live mode is separately gated by `SLICE_BROKER_LIVE_ENABLED=true`, verified live credentials, current SIP access, explicit **ENABLE LIVE TRADING** acknowledgment, current founder authorization and the saved risk policy. Changing mode, account or policy pauses execution and invalidates older broker-targeted decisions. Keep live disabled during initial setup and reconciliation testing. No real trades are placed during the included automated tests.

## Stream behavior

The Node worker authenticates directly with `wss://stream.data.alpaca.markets/v2/iex` or `/sip`, subscribes to selected equities and coalesces quote bursts into at most one snapshot batch per second. The application sends sanitized observations to the founder browser through a private SSE connection. Original source timestamps, transport lag, quote age and bid/ask spread are preserved. Quotes are informational: each actual order separately fetches and validates a current entitled REST quote and current account state.

The UI marks old quotes stale and missed heartbeats offline. An authenticated socket is not proof that an instrument has traded recently. Closed sessions, quiet instruments, entitlement errors, provider limits, network problems or an offline worker can all prevent fresh data. Transport reconnects use bounded backoff and recheck authorization/configuration. Credentials are sent only to the authenticated server worker and Alpaca, never to the browser, model prompts, public graph, board or logs.

## Execution, reconciliation and learning

The server reserves a unique order intent before a network submission. Only the worker that wins the reservation sends that order. An ambiguous timeout is looked up by client order ID; even a subsequent 404 is not treated as permission to submit again. Uncertain intents block new exposure until reconciled. Acceptance is never reported as a fill.

New entries use a marketable limit with native stop/target bracket legs, current cash and exposure limits, exact instrument validation, a fresh quote, spread and price-drift limits, current market hours, confidence/coverage thresholds and the required completed team review. Only the configured long US equity/ETF universe is eligible. Models cannot expand it or modify safeguards.

Alpaca activates bracket exits after the entry is fully filled. A partial entry freezes additional entries, cancels the remaining parent quantity and reconciles a verified owned-position exit. Time and pre-close exits require the worker; the server cancels owned protective orders and verifies their cancellation and available long quantity before submitting a close. External positions and unrelated orders cause a review block rather than being silently managed. A missing or uncertain receipt stays blocked for manual broker review.

Pause disables new entries while reconciling existing exposure. The global desk pause/kill also disables broker entry authority. Accepted native protection remains at the broker. Disconnecting removes stored credentials; it does not liquidate holdings or cancel existing brokerage orders. The panel explicitly tells you to review outstanding exposure in Alpaca. A disconnected or revoked account cannot be automatically managed by this application.

Confirmed parent and protective-child fills create private, deduplicated broker observations and Team Board messages. The broker trade brief shows account mode, cumulative filled quantity, average price, provider fill time and gross realized P&L when attributable. Fees and net P&L remain unavailable until reconciled from broker activity statements. Multiple cumulative snapshots of one order must never be summed as separate executions.

Agents read the existing measured local-paper lessons and separately labeled recent brokerage observations when available. This is persistent retrieval and review, not retraining model weights, guaranteed expertise or a promise that the same error cannot happen twice. Historical performance, conditional frequencies, research confidence and calibrated future profit probabilities are different quantities. The original 40/100 review standard and stronger configured broker thresholds remain meaningful; the update never raises a score merely to enable trading.

## Installation and verification

The cumulative ZIP contains an integrity-checked Windows installer, rollback helper and this guide. It applies to the currently checked-out branch in the existing project. It preserves local environment files and does not automatically migrate the database, install packages, commit, push or start trading. The inherited additive account-security migration remains included; no new schema is required by these agent additions.

After applying the package:

```cmd
npm ci
npm run db:security-upgrade
npm run test:agent-autonomy
npm run build
npm run dev
```

In a second terminal in the same project:

```cmd
npm run beta:worker
```

The database command is rerunnable. If the security upgrade was never applied, it fixes the earlier login-blocking schema message. Production/direct migration credentials must use the database's direct or session connection, not a transaction pooler. Existing backup and restore procedures still apply; the ZIP's source rollback is not a database rollback.

The deterministic suites use controlled model, network, database and broker boundaries. They verify founder isolation, source provenance/consent, private-address rejection, delegated hold-only reports, adaptive scheduling, token accounting, stale feed handling, credential binding, idempotency, ambiguous sends, native exits, UI controls and installer recovery. A successful build and those tests do not verify a real account's entitlements, exchange connectivity or trading profitability. Those remain observable setup and paper-operation checks on the owner's deployment.
