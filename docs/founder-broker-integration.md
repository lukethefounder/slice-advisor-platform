# Founder brokerage connection

The private founder agent network can connect to an individual Alpaca Trading API account. It starts disconnected in **paper** mode. Connecting credentials verifies an account; enabling new orders is a separate action. This integration does not guarantee profits, prevent every loss, or make delayed or incomplete research current by changing its score.

## Configuration

Only active users explicitly listed in `SLICE_FOUNDER_EMAILS`, in an active firm, may use these endpoints or worker capabilities. Ordinary firm owners, administrators, advisors, and other members do not gain access through their role.

Generate a dedicated server encryption key once:

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store the resulting 64 hexadecimal characters in the server's local environment or secret manager:

```dotenv
SLICE_BROKER_ENCRYPTION_KEY=<generated-64-hex-characters>
SLICE_BROKER_LIVE_ENABLED=false
```

Do not commit this key, reuse a database password, or regenerate it on each restart. Keep a secure backup: losing the encryption key makes previously saved broker credentials unreadable. The application does not fall back to plaintext storage or a weaker shared password. AES-256-GCM encryption binds credentials to the founder, firm, and selected paper/live environment.

Open **Settings → Connections → Founder broker**, select **Paper**, and enter the Alpaca **API key ID and API secret**, not the account's login password. Credentials are sent only to the private server route, encrypted before storage, and never returned to the browser or included in agent prompts, source evidence, board posts, or logs. The UI only receives a masked suffix.

Review the broker safeguards, refresh the account, choose founder approval or autonomous execution, and type the displayed paper confirmation. Start the durable worker with the existing `npm run beta:worker` command. Leaving a browser tab open alone does not provide continuous broker monitoring. Stopping the worker interrupts reconciliation, cancellation of partially filled entries, holding-time exits, and pre-close exits.

Live activation requires all of the following: a separately verified live account and its live API credentials, `SLICE_BROKER_LIVE_ENABLED=true` on the server, an entitled SIP consolidated data feed successfully probed through Alpaca, and the founder's explicit `ENABLE LIVE TRADING` acknowledgement. Enabling after a simulation-only review or changing broker safeguards invalidates old proposals; a new broker-targeted agent review is required. This feature is intended for the founder's own account. Distributing broker access to other users requires additional provider arrangements and is outside this integration.

## What can execute

Entries are restricted to approved, active US equity or ETF symbols, whole shares, one verified agent-owned position at a time. The adapter does not request leverage, short entries, options, cryptocurrency, withdrawals, transfers, or arbitrary provider URLs. It respects cash reserves, a USD order cap, a position percentage, broker restrictions, a daily equity-loss gate, and a maximum count of daily entry attempts. Broker buying power does not override the cash gate.

The server reads an immutable Chief cycle from this founder's firm; it does not accept an order, symbol, quantity, price, or model-supplied trading instruction from a browser approval request. A new entry requires the complete two-round six-agent review, successful helpers, verified evidence, configured confidence and coverage, no veto, the latest desk revision, the current broker revision, and the exact paper/live target researched by the team. The quote must be fresh, two-sided, within the permitted spread and price drift, and obtained directly from the broker at execution time. Streamed UI prices are informational and do not bypass these checks.

The broker's current clock controls regular-session eligibility. A second session check immediately before submission prevents a delayed closing sequence from quietly queuing a next-day market order. The system does not hardcode a permanent account eligibility threshold: Alpaca's current account restrictions and order rejections remain authoritative.

An entry uses a bounded limit price with a native take-profit and stop-loss bracket. A limit order can remain unfilled. Alpaca activates the protective bracket legs **after the entry is completely filled**. The worker cancels a partial or stale entry, reconciles the actual filled shares, and attempts a verified close of only those owned shares. Protective stop prices do not guarantee execution prices. Alpaca documents that both bracket exit legs can fill in extreme fast-market races; any inconsistent, short, or otherwise unexplained exposure is blocked from automatic management and requires review directly in the broker.

A completed, current Chief can recommend reducing a verified owned position even when evidence is insufficient for a new entry. Protective exits do not require a new investment thesis. Before a closing sale, the worker verifies the owned entry and actual position, cancels only its known protective orders, waits for broker confirmation and available shares, and submits a `sell_to_close` order. External positions or unrelated orders stop automatic management. A dedicated account avoids ambiguous ownership when manual or other applications' trades change the same symbol.

## Reservations and uncertain responses

Before an order request, one database transaction reserves the account's exposure slot and creates a permanent unique intent. Its client order ID is deterministic for the owner, firm, account, environment, and decision. Concurrent requests cannot reserve the same slot or replay a consumed decision.

Acceptance is not treated as a fill. After a timeout, malformed success response, or ambiguous rejection, the worker queries Alpaca by the saved client order ID. A missing lookup alone does not prove that a delayed order cannot appear. The intent remains locked, and the worker does **not** blindly send another POST. A process crash between reservation and submission is handled the same way. If the broker cannot resolve the recorded intent, reconcile directly with Alpaca before an administrator considers clearing an exposure lock; reconnecting or refreshing is not a duplicate-submission workaround.

Explicit broker authorization or buying-power denials are recorded as rejected, while retaining the unique consumed intent. A rejected or partly filled exit may require the founder to resolve remaining exposure directly in Alpaca; it is not automatically replaced by an unbounded sequence of closing orders.

## Controls and observed results

**Pause** stops new entries; the worker continues reconciling existing intents and managing verified owned risk. Accepted native protection remains at Alpaca. **Disconnect** removes the saved credentials and disables new entries. It does not cancel accepted orders, close positions, erase receipts, or guarantee that an already in-flight request was not accepted. Inspect the broker account before disconnecting with exposure. Reconnection with recorded exposure is restricted to the same account and environment.

Confirmed fills and native child exits are stored separately as `broker-paper` or `broker-live` observations and posted to the founder's Team Board. Each observation records the broker's cumulative filled quantity for that order, average price, available fill time, and observation time. Repeated polling is deduplicated. Do not sum partial snapshots of the same order as independent fills.

Where an exit can be linked to a verified owned entry, the application can show gross realized P&L for those shares. Fees and net realized P&L remain explicitly unavailable until broker activity statements are reconciled. These observations do not enter the local paper ledger, are not presented as calibrated future win probabilities, and do not mean that model weights have been retrained.

## Provider choice and market data

Alpaca is the implemented choice for this private US-equity application because its personal API-key workflow, matching paper/live trading interface, bracket orders, and streaming stock data fit the existing TypeScript worker without a separate desktop gateway. This is an engineering choice, not a claim that a broker, AI model, or strategy has superior returns.

At the time of source verification, Alpaca's published Trading API market-data table lists a free Basic plan with real-time **IEX-only** coverage and 30 stock streaming symbols. It lists **Algo Trader Plus at $99/month** for consolidated all-exchange SIP coverage and unlimited stock streaming symbols. Free IEX is not a full-market NBBO feed. Subscription entitlements and fees must be checked in the actual account; the application does not purchase a plan. A persistent stream improves latency, but network, provider, trading venue, and processing delays remain.

Tradier is a viable personal-token alternative with consolidated live data for brokerage account holders. Its current documentation lists 15-minute-delayed sandbox data and no sandbox market-data stream, and its current pricing page lists $0.35 per stock trade on Lite or a $10/month Pro plan with zero listed stock commission before applicable fees. IBKR offers broad market coverage, but its documented individual Client Portal API gateway and brokerage-session requirements add operational work for this particular always-on personal application. Neither alternative adapter is implemented here.

Official references:

- [Alpaca Trading API](https://docs.alpaca.markets/us/v1.1/docs/trading-api)
- [Alpaca market-data subscriptions](https://docs.alpaca.markets/us/v1.1/docs/about-market-data-api)
- [Alpaca stock WebSocket streams](https://docs.alpaca.markets/us/v1.4.2/docs/real-time-stock-pricing-data)
- [Alpaca order and bracket behavior](https://docs.alpaca.markets/us/v1.1/docs/orders-at-alpaca)
- [Alpaca create-order reference](https://docs.alpaca.markets/us/reference/postorder)
- [Alpaca order lookup by client ID](https://docs.alpaca.markets/us/reference/getorderbyclientorderid)
- [Tradier API environments](https://docs.tradier.com/brokerage-api/overview/6a636f0bae3d967f7ae0a88c)
- [Tradier streaming and sandbox FAQ](https://docs.tradier.com/brokerage-api/overview/faq)
- [Tradier current stocks and options pricing](https://tradier.com/trade/stocks-and-options)
- [IBKR Web API documentation](https://www.interactivebrokers.com/campus/ibkr-api-page/webapi-doc/)

## Validation

Run `node scripts/tests/agent-broker.test.mjs`. The suite uses a fully mocked broker, database, founder authorization service, and board. It covers credential encryption and isolation; private views; strict policy and account parsing; immutable research and revision gates; quote, session and risk checks; concurrent order reservation; acceptance versus fill; cumulative fill deduplication; partial entries; protective exits racing cancellation; credential revocation during an exit; explicit live/SIP gates; and ambiguous-response reconciliation without resubmission. Tests do not connect to a real broker, execute trades, or access a real database. Real account entitlements and venue execution behavior still need to be verified by the founder in paper mode.
