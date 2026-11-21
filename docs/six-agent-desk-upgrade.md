# Six-agent paper desk and confidence audit

For the current founder brokerage, delegated helpers and internet-research additions, see [Founder agent autonomy](./founder-agent-autonomy-upgrade.md). This page preserves the original local-paper foundation and its historical implementation boundaries.

This document records the original six-agent foundation and its verification. The current founder-only roles, two-round discussion, continuous Scout discovery, private Team Board, trade briefs, and learning behavior are described in [Founder agent network](./founder-agent-network-upgrade.md). Those later access and workflow rules supersede the original one-round role descriptions below.

## What this release delivers

Intelligence now has an authenticated Six-Agent Desk at `/workspace/intelligence/agent-desk`. Chief, Sentiment, Scout, News, Skeptic, and Charts are six separate AI calls with distinct responsibilities and a recorded evidence-reading trail. The four specialists work concurrently; Skeptic reviews them; Chief reconciles all five reports and proposes buy, sell, or hold. The existing knowledge graph remains the shared research archive.

The desk can execute **paper orders** after explicit manual approval or after the user enables autonomous paper trading. This release does not contain a live broker adapter, brokerage credentials, real-money order tool, or permission for a model to change safeguards. Research-only is the initial state. A market connection, model connection, and worker must be configured before autonomous paper operation is useful.

This is a testable operating foundation, not a claim of investment performance, calibrated win rates, universal source coverage, institutional superiority, or production certification. Real brokerage execution still needs a chosen broker, authenticated account authorization, order/position reconciliation, broker-native protective orders, handling of partial fills and rejected orders, and validation against actual broker observations.

## Why a score could remain 21

Saved runs are immutable. Reloading an old run retains the old observations and methodology; it does not recollect or rescore them. After installing this release, select the exact instrument and generate a **new research run**. The new scoring version is `slice-evidence-robust-2.2.0`; old 2.0/2.1 runs remain inspectable.

Two data-handling problems were corrected:

1. A daily quote could remain the reference price even when a newer, valid intraday bar was available. That made the run look end-of-day and applied an inappropriate freshness penalty. The current reference now uses the newer observed bar's own close, OHLCV, interval, timestamp, and volume scope. It remains explicitly a bar observation, not a bid or offer. A daily fallback is still labeled daily.
2. Missing values could become real-looking zeros or bearish defaults. Missing moving averages, insufficient volatility lookbacks, missing index volume, and absent company fundamentals now remain unavailable. Partially observed composites carry their observed component coverage and receive proportionally less support. Numeric neutral values required at the legacy forecast boundary are disclosed as neutralized inputs rather than treated as observations.

The reference-price comparison also retains provenance. When a previous session's close cannot be verified, the current price can remain available but no zero-percent return is presented as a measured factor. Current and previous prices cannot be combined from unrelated sessions.

The confidence explanation now shows weighted cohort confidence, each support component, contradiction and freshness penalties, the final confidence cap, and the resulting number. Observed, derived, and unavailable/neutralized inputs are listed. This permits a low score to be diagnosed from the recorded run rather than guessed from a generic warning.

The platform review threshold remains 40/100, and the existing favorable threshold remains 60/100. The score is not forced above either threshold. Directional evidence score and research confidence are different quantities; neither is a measured probability of making money. A source count, six model responses, or thousands of deterministic research paths cannot become independent information merely by being counted repeatedly.

The existing seven-day collection policy remains for current news and relevant market observations. Latest available monthly economic releases and quarterly statements remain dated historical context. They are not relabeled as new publications. Public news discovery retains its original publisher or aggregator URL and is unscored; feed titles and summaries are not advertised as full article text.

## Six roles and their capabilities

| Role | Responsibility |
| --- | --- |
| Chief | Reconcile the five reports, explain disagreement, and propose an action and allocation within the saved limit. |
| Sentiment | Inspect sourced tone, stock relevance, publisher independence, and conflicting coverage. |
| Scout | Investigate catalysts, gaps, and conditions that would invalidate the selected opportunity. |
| News | Review dated developments and distinguish original reporting from repeated stories. |
| Skeptic | Challenge the specialists and veto new exposure when the case is unsupported. |
| Charts | Interpret observed price structure and measured indicators, including missing lookbacks. |

Each role must actually read evidence when records are available. A final factual finding must cite a known record the role inspected. A fabricated or unread source identifier fails validation. Role outputs use a strict structured schema; incomplete responses, malformed values, unknown capabilities, and provider failures produce an explicit failed report rather than a fabricated result.

The finite tool set can inspect source records, read the market snapshot, read the user's paper policy/account, and read peer reports. It cannot browse arbitrary URLs, query arbitrary databases, reveal server credentials, edit settings, place broker orders, or send messages. Source and peer text are treated as untrusted material. The model receives the selected instrument, bounded source packet, safeguards, and paper-account context. It does not receive the user's email, password, broker credentials, or environment variables. Provider calls use `store: false` and a hashed owner safety identifier; this flag is not a claim of zero provider retention under all service policies.

The six roles may use the same model. Their opinions are correlated and their shared evidence is not six separate primary sources. The source room distinguishes scored observations, public discoveries, and the unscored execution reference. The full canonical research archive remains linked; role reports disclose which records were actually inspected.

## Paper execution and user safeguards

The first implementation holds at most one USD stock or ETF position, uses whole shares, and supports long positions only. Native indices are research-only. A stock/ETF still needs an actual provider currency record and a confirmed usable intraday observation; an unknown currency does not default to USD.

The server independently checks:

- Explicit paper arming; an approved exact proposal or enabled paper autonomy.
- Active owner and workspace membership at execution time.
- An allowed symbol and the exact instrument bound to the research and observation.
- A provider-confirmed real-time intraday price, its original observation and receipt times, an observed supported US listing venue, a recent market-status receipt, and the US regular-session window. USD currency alone cannot turn a foreign listing into a US-session instrument.
- Saved confidence and coverage floors; all six agents completed; no skeptic veto for a new entry.
- Maximum position and total exposure, minimum cash reserve, daily loss halt, daily entry/order limit, entry cooldown, and maximum price drift.
- Decision age measured from the saved research time, not from when an approval button was clicked.
- Stop-loss, optional take-profit/trailing stop, maximum holding time, and the configured pre-close exit window.
- Configured slippage, percentage fees, fixed commission, positive cash, and consistent ledger arithmetic.

Default settings are a $10,000 paper account; 10% maximum position; 30% maximum exposure; 50% minimum cash; 2% daily loss limit; eight orders per session; five-minute entry cooldown; 40/100 confidence and coverage floors; a five-minute quote-age limit; 15-minute decision-age limit; 50 basis points of permitted entry drift; five basis points of simulated slippage; 1% stop-loss; 2% take-profit; a 90-minute maximum hold; and a five-minute pre-close exit window. These are editable engineering defaults, not a personalized trading recommendation.

The account uses observed prices plus configured costs. It does not claim exchange execution, a guaranteed stop price, bid/ask spread measurement, queue position, fill probability, or unlimited liquidity. No price mark is created when observations are missing. The review and execution quotes are persisted separately so their prices, times, source kinds, currencies, and provider receipts can be inspected.

An entry's protective settings are frozen and may be tightened by a later policy; they cannot silently be loosened for the held position. Protective checks run independently of AI calls. Pause blocks new entries but keeps an armed position eligible for protective checks. The kill switch blocks every fill, including protective exits, until the user resumes and explicitly rearms. Resume alone does not restore autonomy.

If a position survives into a new session without a verified close, the desk halts for reconciliation rather than inventing a corporate-action adjustment or closing fill. Automated split/dividend reconciliation and a user-facing reconciliation workflow are not part of this release. For early market closes, provider market status prevents fills after closure, but the configured pre-close timer currently uses the regular 16:00 New York close. It is not an exchange holiday/early-close calendar. These are material boundaries to resolve before live brokerage use.

## Durable operation and concurrency

Desk state and cycle receipts use the existing `BackendPlatformEvent` storage, and model work uses the existing background-job queue. No new database table or migration is introduced by the six-agent feature.

Account state changes use an exact previous-value compare-and-set. The account update and unique immutable cycle receipt commit in one database transaction. A duplicate approval, replayed cycle, stale browser revision, or competing worker cannot commit a second fill from the same result. Model work carries an owner-scoped lease and server token; arbitrary job payloads do not grant authority. Pause, kill, setting changes, and protective fills invalidate older work before it can commit.

Checksums detect accidental record corruption; they are not a claim of tamper resistance against a database administrator. Source and execution inputs remain in the stored receipt. The UI displays recent history and preserves the most recent actual team deliberation when a protective event becomes the latest decision.

The browser polls only while visible, avoids overlapping reads, preserves draft settings, and fences late requests after ownership/session changes. Only the most recent deliberation carries its complete evidence packet in repeated history responses. Older full records remain stored.

## Configuration and first run

Keep your existing secrets. The installer does not replace `.env`, `.env.local`, or deployment credentials. Relevant server settings are:

```dotenv
OPENAI_API_KEY=your-existing-server-key
OPENAI_AGENT_MODEL=gpt-5-mini
ALPHA_VANTAGE_API_KEY=your-existing-market-key
ALPHA_VANTAGE_ENTITLEMENT=realtime
CRON_SECRET=your-existing-private-worker-secret
```

These are placeholders, not credentials. Never prefix private keys with `NEXT_PUBLIC_`, include them in source control, or share them in chat. `OPENAI_AGENT_MODEL` is optional; a blank value uses the configured fast/default model and then `gpt-5-mini`. Configuration only indicates that a key is present; actual access and provider responses are checked at runtime.

The Alpha Vantage documentation distinguishes historical, delayed, and real-time entitlement. A configuration value does not grant a subscription or data entitlement. Multi-user/commercial use requires the provider's applicable access arrangement. Source: [Alpha Vantage API documentation](https://www.alphavantage.co/documentation/) and [market-data policies](https://www.alphavantage.co/realtime_data_policy/).

1. Install the cumulative ZIP into the existing project and run the commands in `README_FIRST.txt`.
2. Start the application and sign in. Open Intelligence → Six-Agent Desk.
3. Choose the exact symbol and review/save the safeguards. Start with a research cycle to inspect the evidence and provider status.
4. To use manual paper orders, enable manual approvals **before generating the proposal**. Changing controls changes the policy revision, so a proposal produced under an earlier revision must be regenerated.
5. Inspect each role, confidence audit, exact source dates, skeptic result, and recorded execution checks. Approve only the exact pending paper proposal shown by the desk, or explicitly enable autonomous paper trading.
6. In a second terminal, keep `npm run beta:worker` running. The application must also stay running. The hosted configuration includes `/api/cron/agent-desk`; an external scheduler can invoke that authenticated route with the configured bearer secret.

The worker checks paper desks on a nominal 60-second cadence in bounded batches and processes queued jobs separately. Actual elapsed intervals depend on load, provider availability, hosting limits, and worker uptime. It is not an always-on tick feed. New scheduled AI deliberations wait for the US regular-session window and an available open-market, real-time observation. Manual research can be run outside that window. Multiple model calls per cycle incur the configured provider's ordinary usage charges.

Beta still removes the existing overall application research deadlines and usage allowances. Individual transport bounds, response-size validation, cancellation, job leases, model-tool budgets, and data/decision-age limits remain because they govern connection recovery and whether a trade input is still valid.

## Verification

```cmd
npm ci
npm run db:security-upgrade
npm run test:agent-desk
npm run build
npm run dev
```

The security command is inherited from the cumulative package and is safely rerunnable when already applied. It is not a new six-agent migration. The source installer and rollback helper do not run database changes automatically.

`test:agent-desk` includes deterministic guardrails, actual agent/tool orchestration against controlled responses, durable-storage concurrency tests, authenticated route and worker checks, UI lifecycle tests, and the prior current-research/strategy/security/neural suites. These tests do not call live providers or submit real orders. A production build verifies integration. They do not verify a particular customer's provider entitlement, hosting uptime, or investment returns.

### Release verification results

The 26 included suites passed in the development workspace. The new paper risk engine passed 784 checks; agent/store/service/API/worker integration passed 613 checks; the desk UI passed 23 scenarios and 290 assertions. The updated provider/identity suite passed 209 assertions and score interpretation passed 190. The low-relevance confidence fixture remains below the unchanged review floor. TypeScript and the optimized production build passed; changed source files have no lint errors.

Repository-wide lint still reports five existing errors outside this update's changed files, in Scenario Workspace, Scenario Studio, Experience Controls, and Technical Workbench, plus existing warnings. Those findings are separate from the passing scoped checks and production build. This release does not claim the entire repository has a clean global lint result.
