# Slice beta intelligence update

## What this release changes

This release keeps the neural platform design and adds clearer investment research decisions, faster progressive market loading, a simpler historical testing workflow, and durable forward tracking. Beta is enabled by default when `SLICE_PULSE_BETA_UNCAPPED` is absent. An explicit `false` restores the configured application limits.

The update is cumulative from the original Slice source-update baseline. The ZIP includes the previous knowledge graph, neural workspace, and platform theme changes as well as this release. It replaces source files in an existing checkout; it is not a new standalone repository.

## Beta execution behavior

Slice's application API deadlines, first-party request deadlines, background-job execution deadlines, aggregate research scan cutoff, and aggregate AI Studio/email-generation deadlines are disabled in beta. Explicit Next route `maxDuration` declarations have been removed. Manual cancellation still works. Standard mode retains configured application deadlines.

Research normally uses a durable background job. A newly queued graph job is woken immediately, the page stores its identifier in the URL, and reload reconnects to that job. Temporary connection failures use retry backoff without the former beta retry cutoff. Missing or inaccessible jobs stop with an actionable message. A completed job must name the exact stock and saved research run; the interface does not silently replace it with the latest available result.

Expired worker leases can be recovered even after the former attempt limit. Ownership checks and transactional job updates prevent an expired worker from completing a newer attempt or overwriting cancellation. Authentication, invalid input, explicit cancellation, and genuine terminal failures are not turned into endless retries.

Provider connection limits, request protection, database transaction bounds, authentication/session rules, and recoverable leases remain. They protect shared resources and allow failed connections to recover. Hosting can still terminate a process at its own execution limit. Removing a Slice timer cannot change a hosting plan or provider entitlement. Next `after()` is used to wake work and archive optional snapshots; it is not an independent unlimited process. Durable job records plus a running worker or deployed scheduler provide recovery.

## Understanding the final score

Intelligence now presents an investment research view for the selected stock, research run, and forecast horizon. It explains the score, actual media/technical/economy weights, supporting and opposing drivers, contradictions, source concentration, source sensitivity, evidence coverage, and the selected forecast's downside range.

The existing scoring engine's decimal boundaries remain unchanged:

| Score / 100 | Meaning | Interpretation template |
| --- | --- | --- |
| 0–28 | Strongly bearish | Strong adverse evidence; avoid a new long position until the case materially improves. |
| Greater than 28 through 42 | Bearish | Risks outweigh support; review exposure and seek a stronger investment case. |
| Greater than 42 and below 58 | Neutral / mixed | No clear directional advantage; watch for corroborating evidence. |
| 58 and below 72 | Bullish | Supporting evidence leads; confirm the current data and selected forecast. |
| 72–100 | Strongly bullish | Strong favorable evidence; still review valuation, downside, source quality, and portfolio fit. |

The decision panel uses four explicit research stances: **Favorable for further investment review**, **Watch / wait for confirmation**, **Unfavorable for a new long investment**, and **Insufficient current evidence**. It does not place trades.

A favorable stance requires a score of at least 58, research confidence and coverage of at least 60, forecast confidence of at least 50, modeled price-gain probability of at least 55%, positive expected return, and no major source-sensitivity or disagreement flag. These are transparent review thresholds, not a newly validated predictive trading model. An unfavorable long-investment stance does not imply a recommendation to sell short.

### Score, probability, and risk are separate

A score of 80 describes strongly favorable recorded evidence. It does **not** mean an 80% chance of profit. The price-gain likelihood comes from the matching saved forecast for the selected horizon. It describes the modeled chance of a positive price return before fees, slippage, taxes, and investor-specific cash flows. It is not a net-profit probability or a demonstrated win rate.

For runs that pass the current-decision checks, the decision explanation includes modeled expected return, flat-or-lower price likelihood, and recorded downside concerns. The adjacent forecast details expose the full stored range and retain archived expected returns when the current decision is withheld. A forecast range is not a worst-case loss bound. The interpretation layer does not establish model calibration; settled forecast outcomes and genuinely out-of-sample results are the appropriate evidence for evaluating probability reliability.

Current stances and likelihoods are withheld when evidence is missing, weak, stale, mismatched, or unverified. Checks include a research run no older than 24 hours, valid provider timestamps, a usable observed price, a matching unexpired forecast target, and a successful point-in-time evidence audit. Short horizons additionally require a confirmed live observation within 15 minutes and an open market. These are evidence-freshness checks, not research execution time limits.

An audit marked `needs-review` means chronology was unsafe; `failed` means verification did not finish. Missing, pending, and unknown audit states also withhold the current decision. A passed chronology audit does not prove forecast accuracy. Archived estimates remain available for audit and outcome comparison. Returning to a hidden tab immediately rechecks expiration, and selected horizons are restored from the URL.

## Market data loading and refresh

Custom Board now obtains numeric prices and metrics directly from market provider data. It no longer waits for an OpenAI web-research result to populate prices. Quotes, historical series, and company information load independently, and the board requests only the sections needed for the selected metrics. A price-only board therefore avoids unrelated history and company requests.

Custom Board and Market Visuals share a cache scoped to the signed-in user and firm. Concurrent identical requests share work. Refresh retains the last successful snapshot, avoids overlapping requests, observes provider backoff, rejects older results, and clears scoped state when the session changes. Polling pauses while hidden or offline and resumes on return. Market Visuals bootstrap is inside a Suspense boundary so the shell can render while data loads.

| Data or behavior | Refresh/reuse policy |
| --- | --- |
| Eligible live quote view | Checks again about 15 seconds after the previous refresh completes |
| Delayed or end-of-day quote view | Checks about every 60 seconds after completion |
| Realtime quote server cache | 10-second reuse window |
| Delayed quote server cache | 60-second reuse window |
| Historical quote server cache | 15-minute reuse window |
| Intraday history / news | One-minute reuse window |
| Daily history / index reference | One-hour reuse window |
| Company fundamentals / earnings | Six-hour reuse window |

These are completion-based checks and cache windows, not guaranteed delivery latency. Cold requests still wait for the provider. Daily data does not become realtime because the page refreshes frequently. Provider observation time remains distinct from retrieval time. Daily indicators are labeled as such, and stale cached observations cannot be relabeled live by a new fetch timestamp.

The legacy automatic quote endpoint no longer invents demo prices when providers fail. Missing coverage remains unavailable and partial responses contain only genuine observations. Optional quote archival runs after the response and logs failures. Unsupported assets can still use the embedded chart where available, without fabricated board metrics.

The current integration uses polling rather than a tick-by-tick streaming feed. Realtime/delayed market access and full historical endpoints depend on the configured provider account. Confirm the entitlement and the returned observation timestamps before treating a feed as live.

## Simpler Strategy Studio

The primary studio opens in a guided three-step flow:

1. **Test an idea:** choose a strategy, instruments, and a historical period, including 1-, 3-, 5-, or 10-year presets.
2. **Review results:** prepare or reuse verified history, verify date coverage and warmup sessions, run the historical test, and open its saved result.
3. **Track forward:** start a paper observation record and inspect later completed-session outcomes.

Advanced tools are available in a disclosure instead of competing with the main flow. The guided draft survives switching tools. Progress, source details, saved dataset versions, costs, and manual stop controls remain visible.

Valid historical datasets for a closed period can be reused beyond the old six-hour freshness window. Reuse requires integrity, sufficient coverage, and warmup checks; an old import is never reused as if it were a new forward observation. A cached historical test can work without a provider key when no new download is needed. New downloads still require a valid account and the relevant historical endpoint entitlement.

The service reads small dataset manifests before hydrating the selected payload, shares matching imports within the same user scope, and prepares at most two instruments concurrently in beta. Matching owner-scoped run inputs can reuse a checksummed saved result after a retry. The backtest engine, formulas, and frozen historical outputs are unchanged.

## Continuous tracking

Forward scenario tracking is enabled by default in beta unless explicitly disabled. The scheduler selects the oldest due Watching scenarios, processes a bounded batch with at most two rows concurrently, and stores successful imports as it goes. Larger instrument sets resume from their saved import manifests rather than downloading completed instruments again. A stable shared hourly cycle lets multiple strategies reuse the same newly imported history.

Provider rate limits defer additional work; failed requests reschedule. Leases and version checks prevent stale workers from committing observations. Completed-session validation rejects incomplete, synthetic, or revised conflicting inputs. The original historical backtest stays frozen, while verified future sessions append to the observation journal. Live quotes remain separate from these daily paper checkpoints.

The deployed scenario cron now checks every five minutes; an individual fully checked scenario is normally due again after one hour in beta. Partial imports can become due sooner. This does not create new daily bars before the provider publishes them.

### Running locally on Windows

After installing the update, keep the app running in one Command Prompt:

```bat
cd /d "C:\Users\luker\Slice-Restart-2\slice-platform-github-push-final"
npm run dev
```

Set a strong `CRON_SECRET` in the project's existing `.env.local`, using the same value for the app and the local worker. Keep existing database/provider configuration. The installer preserves this file. Restart the app after changing it. Optional beta settings are:

```dotenv
SLICE_PULSE_BETA_UNCAPPED="true"
SLICE_SCENARIO_CRON_ENABLED="true"
SLICE_BETA_WORKER_URL="http://localhost:3000"
```

In a second Command Prompt:

```bat
cd /d "C:\Users\luker\Slice-Restart-2\slice-platform-github-push-final"
npm run beta:worker
```

The worker checks research jobs, watchlist observations, forward strategy observations, and forecast outcomes on independent completion-based loops. It does not overlap requests within a task, backs off on temporary failures, and stops an unauthorized loop with a configuration message. Ctrl+C stops it. Local tracking requires both terminals and the computer to remain running. For a deployed app, configure a supported scheduler and the same cron secret; browser tabs do not need to remain open. Remote worker URLs must use HTTPS, and credentials are not forwarded through redirects.

## Installation and validation

Use `Slice_Beta_Intelligence_Update.zip` and its `README_FIRST.txt`. The installer verifies all payload hashes before replacement, checks the existing project foundation, makes an external backup, and supports protected restore. It keeps the current Git branch and does not push to GitHub. No dependency or database schema change is introduced by this release.

After applying the files:

```bat
npm ci
npm run test:beta-intelligence
npm run build
code .
npm run dev
```

The combined regression command includes beta runtime and cancellation, score interpretation, actual Intelligence component lifecycles, progressive market loading, historical reuse and guided workflow, forward scheduling and replay, plus the previous neural platform suites. Tests use controlled transport and persistence boundaries; production compilation checks the actual TypeScript and CSS integration.

No real-provider latency benchmark, live database migration, authenticated browser session, or native Windows launcher execution is claimed by these checks. After installation, verify an entitled quote and its timestamp, run a small historical strategy, start forward watching, and inspect the worker output and saved observation journal. Missing keys or provider entitlements should produce clear unavailable states rather than invented financial data.

## Provider and hosting references

- Vercel function duration configuration: https://vercel.com/docs/functions/configuring-functions/duration
- Alpha Vantage endpoint and historical-data documentation: https://www.alphavantage.co/documentation/
- Alpha Vantage realtime data policy: https://www.alphavantage.co/realtime_data_policy/
