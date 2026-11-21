# Founder agent network

This records the earlier collaborative agent release. For the current bounded helpers, public internet access, consented research reuse, continuous market stream and separate Alpaca paper/live connection, use [Founder agent autonomy](./founder-agent-autonomy-upgrade.md). The original local simulator described below remains distinct from brokerage execution.

## What changed

This release expands the six-agent paper desk into a private research and review network. It retains the existing dark interface, Intelligence knowledge graph, saved research, Strategy Studio, Custom Board, Market Visuals, and paper risk engine.

The agent feature is available only to an active account whose email is in the server's `SLICE_FOUNDER_EMAILS` allowlist and whose workspace is active. An administrator role, firm ownership, a client flag, or membership alone does not grant access. An empty allowlist disables the feature. Each founder's state, conversations, outcomes, briefs, and jobs are isolated by user and firm; one founder cannot inspect another founder's agent records.

The default account is still research-only. Continuous discovery and automatic candidate research are separate choices from arming or enabling paper trading. There is no live brokerage adapter in this release.

## Roles and the actual tools they use

| Agent | Work and inputs |
| --- | --- |
| Chief | Reads the complete team discussion, asks questions, reconciles revised specialist reports and observed lessons, and makes the final buy, sell, or hold proposal. Server safeguards independently decide whether a paper fill is permitted. |
| Sentiment | Reads Intelligence's dated economic indicators and broad-market momentum/volatility. Interprets financial conditions and investor risk appetite. Price-based measures are labeled proxies; the system does not invent survey or capital-flow measurements. |
| Scout | Scans provider market activity, the founder's watchlists, and a configurable research universe. Ranks observed candidates, reads previous outcomes, and uses an actual AI call to nominate a source-backed stock for further research. A nomination never grants trading permission. |
| News | Reviews the media evidence and dated discoveries for the selected stock. Distinguishes catalysts, repeated stories, uncertainty, and short- versus longer-horizon implications. |
| Skeptic | Reads real Strategy Studio simulations, applicable saved user strategies, and chronological historical analogues. Challenges missing inputs, weak samples, disagreement, selection effects, and the assumptions behind short and long trade cases. Its veto blocks new exposure. |
| Charts | Reads the same market data and metric calculations used by Custom Board and Market Visuals, together with Intelligence's technical evidence. Reviews trend, price structure, momentum, volume, volatility, and unavailable lookbacks. |

Deterministic helper services collect sources, calculate metrics, run historical tests, and reconcile outcomes. They are not additional independent opinions or extra confidence votes. This release does not claim thousands of independently researching AI workers.

All roles have the same finite set of authorized read tools: inspected evidence, market snapshot, policy and paper account, peer reports, economy, technical board, historical strategies, Scout candidates, private Team Board, and measured learning records. Their assigned module is a required read when the module is present. All roles must read the learning record, including an empty cold-start record, and must read shared discussion when peers or earlier notes exist. A model cannot finish a valid report by skipping those required reads.

Model output uses a strict JSON schema. Findings and horizon explanations must reference evidence actually returned to that role. Unknown sources, unread citations, invented lesson IDs, out-of-inventory Scout nominations, excessive allocations, and unsupported capabilities fail validation. Discovery is always hold-only. Chief's provisional round is also hold-only.

The schema and tool cycle use the existing OpenAI Responses integration. Reference: [OpenAI function-calling guide](https://developers.openai.com/api/docs/guides/function-calling). Strict schemas constrain output structure; the independent validation and execution checks remain necessary.

## Discussion before the decision

A full cycle produces twelve role reports across two rounds:

1. News, Scout, Sentiment, and Charts independently inspect their evidence and assigned tools.
2. Skeptic challenges the first four reports using the historical scenarios.
3. Chief consolidates the initial case and posts questions. This is not an execution proposal.
4. The four specialists read the discussion and revise their reports.
5. Skeptic reviews the revised case and records remaining objections.
6. Chief reads the final five reports and issues the single final proposal.

Each report and addressed message is written to the founder's private Team Board before later roles read it. Messages can address any role or the whole team and can link earlier messages in the same discussion. The board records the actual sender, phase, round, source identifiers, research run, and source fingerprint. It does not display a fabricated conversation while the models work elsewhere.

Founder review notes can be posted directly on Team Board. Notes are untrusted research context; they cannot change a policy, arm an account, grant a symbol permission, or act as an order. Prior-cycle notes can inform future discussion, while reply identifiers stay within the current cycle.

The final desk cards show the six revised reports. The Team Board retains the earlier claims, questions, and corrections. A failed role remains visibly failed. A complete twelve-report deliberation and available required research modules are needed for new exposure, alongside the existing evidence, policy, market, and account checks.

## Continuous Scout discovery

Scout has an independent on/off switch, automatic-research switch, a 5–240 minute interval, a research universe of up to 40 distinct equity symbols, and a 1–12 candidate display limit. Defaults are discovery off, automatic research off, 15 minutes, and eight candidates.

The observed inventory uses the provider's market activity and original timestamps. Configured and watchlist symbols are candidates for examination, not invented live observations. Missing or stale data produces an explicit issue. The scan excludes recently selected and already focused symbols where possible to broaden the search, but cannot guarantee a previously unseen stock every cycle.

An AI Scout nomination must cite that candidate's actual inventory record. The completed scan, selection, Team Board post, and pending research handoff commit atomically. The scheduler drains the saved handoff into a full Intelligence research cycle; a crash between discovery and research does not silently lose the handoff. Overlapping scans, replayed workers, stale revisions, and expired leases cannot overwrite current state or create duplicate work.

The scheduler gives a due held-position review priority. New candidates can be researched between those reviews, while a separate monitor continues checking the held position. A different candidate's price cannot close or replace the held stock. The paper account still holds at most one stock at a time, and the configured trading allowlist remains authoritative. When a permitted new candidate actually receives a paper entry, the desk's selected symbol follows the held position.

The worker's nominal desk cadence is 60 seconds; Scout's configured interval is separate. Provider latency, model usage, workload, hosting, and worker uptime affect actual timing. Automatic research can consume additional provider requests. The app and worker must both be running, or an authenticated hosted scheduler must call the equivalent cron endpoints.

## Historical comparisons and uncertainty

Skeptic uses the actual Strategy Studio engine and immutable dataset manifests. The helper runs fixed reference strategies and up to three applicable saved single-stock strategies, preserving the user's original strategy and exit rules. Saved results retain engine, input, and output hashes and remain available through Strategy Studio.

The separate analogue analysis compares past regimes with today's measured momentum, moving-average relationship, and volatility. It reports all fixed horizons: 1, 5, 20, 63, and 126 sessions. A fixed chronological development/validation split keeps validation outcomes out of the development threshold. The model sees development and validation counts separately, positive-return frequencies, average and worst outcomes, and Wilson sampling intervals. Sparse samples are labeled weak evidence.

These are descriptive historical frequencies, not calibrated probabilities that the next trade will profit. Analogue closing returns are before trading costs; the separate Strategy Studio event-ledger simulations include their configured fees and slippage. Historical price adjustments can be revised, a currently selected stock introduces selection effects, regimes change, and daily observations do not establish intraday execution performance. These limitations travel with the data and are shown in the interface.

Current Intelligence evidence continues to use its existing provenance and freshness rules. Research-tool outputs, macro proxies, repeated agent opinions, public discoveries, and Scout nominations do not inflate the underlying confidence score. Missing evidence can still lead to a hold or blocked entry. Generate a new research run to use newly collected information; old saved scores remain unchanged.

## Persistent learning and personal briefs

Every recorded paper fill creates an in-app brief for the owning founder in Workspace → Brief. A buy brief reports the open position and entry costs without claiming a realized profit. A close brief reports the exit, configured costs, net result, original entry linkage, and source observations. The owner can mark a brief as read. This implementation does not send email or external notifications.

The brief, entry attribution, closed outcome, and execution/learning board messages are written inside the same transaction as the paper account and cycle receipt. A rollback cannot leave a brief describing a fill that never committed. Replaying the same cycle cannot create another fill or outcome.

Learning preserves the original entry reports and conditions. A later close links to the exact position identity, including symbol, opening time, shares, entry price, and entry fees. Legacy positions without an original entry record remain explicitly unattributed; the system does not invent which agent supported them.

The current learning summary uses a bounded window of the most recent 200 closed paper trades, with total recorded count and truncation disclosed. It includes measured wins/losses, net results, participation by role, recurring entry conditions, cited losing cycles, and recent entry/exit comparisons. The complete immutable records remain stored. Participation statistics are not proof that one agent caused a result or independently predicted it.

All roles retrieve this record before future reviews and can discuss relevant lessons and corrected reasoning. This is persistent retrieval and outcome review. It does not retrain foundation-model weights, automatically loosen safeguards, or guarantee that a mistake or loss will never recur. A new account has no measured learning history until actual paper positions close.

## Access enforcement and data integrity

The founder rule is enforced on the server page, read and write APIs, job enqueueing, execution, progress checkpoints, approvals, monitoring, collaboration, and brief acknowledgments. Generic job listings and metrics exclude private agent work unless the viewer is the matching active founder and workspace; individual job reads and controls also check this boundary. Generic operational feeds exclude private agent artifacts where they would otherwise expose them.

Long-running roles recheck founder access and the exact server-issued lease before provider calls, tool reads, publication, and execution. Removing an account from the server allowlist revokes further agent authority after the server reloads that environment. The scheduler disarms and stops a now-ineligible desk. An old queued payload cannot manufacture an authorized lease.

Existing paper safeguards remain: explicit arming or approved proposals, symbol allowlist, actual currency and supported venue, verified fresh intraday observations, confidence and coverage floors, drift limits, position/cash/exposure limits, daily loss and order limits, cooldown, exit settings, session checks, and exact account revision checks. Independent protective monitoring does not wait for model deliberation. Kill blocks all paper fills, including exits; pausing paper entries and enabling Scout discovery are separate controls.

Checksums detect malformed or accidentally altered records. They are not a substitute for database access controls or proof against a database administrator. Source text, founder notes, historical outcomes, and peer conclusions are never treated as executable instructions. Models receive bounded research context and the owner's paper account/policy, not server credentials.

## Install and enable

Use the cumulative ZIP's `README_FIRST.txt` and `INSTALL_UPDATE.cmd`. The installer operates on the current local branch, validates the payload, and creates a source backup before applying it. It does not replace local secrets, push a branch, start trading, or run a database migration automatically.

Configure the actual founder login email in the existing server environment:

```dotenv
SLICE_FOUNDER_EMAILS=founder@example.com
OPENAI_AGENT_MODEL=gpt-5-mini
```

Use the account's actual sign-in email in place of the example. Separate multiple allowed addresses with commas. The existing `OPENAI_API_KEY`, `ALPHA_VANTAGE_API_KEY`, database settings, and private `CRON_SECRET` are also needed for their corresponding functions. `OPENAI_AGENT_MODEL` is optional. Keep private keys on the server. Restart the application after editing its environment.

From the existing repository:

```cmd
npm ci
npm run db:security-upgrade
npm run test:founder-agents
npm run build
npm run dev
```

In another Command Prompt in the same directory:

```cmd
npm run beta:worker
```

The rerunnable security database command is inherited from the cumulative security release. This agent-network upgrade adds no schema or migration of its own. The code tests use controlled responses, not live provider accounts. The production build verifies code integration; it does not verify the local database, actual provider entitlements, deployment uptime, or returns.

After signing in with the allowed account, open Intelligence → Agent Desk. Run a manual research cycle, inspect Team Board and its source trail, configure Scout's research choices, then enable continuous discovery if desired. Manual approvals and autonomous paper trading remain separate explicit controls. Trade briefs appear only after recorded fills; learning outcomes appear after a linked paper position closes.

## Release verification

The cumulative `test:founder-agents` command passed all 33 included suites in the development workspace. The production build, including TypeScript, passed. Scoped lint across 52 changed source and test files reported zero errors; warnings remain in the existing workspace components and test fixtures. No claim is made that repository-wide lint is completely clean.

The focused checks include 1,851 agent/store/service/API cases, 784 paper guardrail cases, 386 Scout lifecycle assertions, 146 research-tool assertions, 95 scheduler assertions, 210 learning/artifact checks, 220 collaboration-route checks, 111 founder-access assertions, 120 founder collaboration UI assertions, and 341 Agent Desk UI assertions. The cumulative command also reruns the confidence, source identity, strategy, account security, invitation, migration, runtime, and neural graph suites.

Database and provider boundaries were controlled test doubles. These results verify the implemented behavior and build, not live subscriptions, a customer's database migration state, browser screenshots, or investment performance.
