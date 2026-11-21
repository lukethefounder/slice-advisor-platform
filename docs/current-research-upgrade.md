# Current research and confidence upgrade

This update addresses the Intelligence warning that research confidence is below the current-interpretation threshold. It improves collection, makes missing inputs inspectable, and corrects an extra confidence penalty. It does not set a minimum confidence by fiat or claim that every symbol has enough public information for a dependable investment conclusion.

## What changed

- A requested research refresh now reaches the underlying market, news, economic, and public-discovery collectors. Cache hits retain their original successful fetch timestamps. Failed forced economic refreshes do not silently fall back to old data.
- Alpha Vantage news searches request the latest seven days, sorted by publication time, with a ticker-only query before targeted topic searches. The collector reports provider access, rate-limit, unsupported-data, and transport failures separately. A just-failed base query is not immediately repeated as an expansion.
- Public Google News RSS discovery can add up to three bounded, adaptive searches when scored news has insufficient article or publisher coverage. It searches the company or resolved index identity and the research mix. Duplicate stories, irrelevant results, unsafe links, missing publication dates, future dates, and articles older than 168 hours are excluded.
- Public discovery records are **unscored reading material**. They preserve publication and fetch timestamps, publisher attribution, related links, and whether a link goes to the publisher or an aggregator. No invented headline sentiment enters the scoring pipeline. Counts of articles or analytical agents do not become independent evidence automatically.
- Native indices use an explicit identity and the provider's native index endpoint. `INDEX:SPX`, `INDEX:NDX`, `INDEX:DJI`, `INDEX:COMP`, `INDEX:RUT`, and `INDEX:VIX` are supported identities when the provider supplies entitled data. Known aliases such as `^GSPC` and `^IXIC` normalize to the corresponding index. Bare `COMP` remains a stock symbol. Unknown caret aliases remain unresolved; there is no silent ETF substitution.
- An index quote is a completed daily index level, in index points, with no invented traded volume. Stock quote prices keep their own observed dates; a separate intraday timestamp can no longer make an older quote look live.
- Forecast targets start at the actual research decision time. The model snapshot keeps the original price observation time separately, and a newly generated decision never makes an old price pass the existing staleness gate.
- Scoring methodology `slice-evidence-robust-2.1.0` removes the final, second publisher-concentration multiplier. The per-cohort source caps, relevance, freshness, contradiction, related-factor, and source-removal checks remain. Overall confidence remains capped by weighted cohort confidence. Older saved methodology 2.0 runs are unchanged.
- The new **Research readiness** panel explains current evidence, historical context, per-cohort support, collection outcomes, and specific gaps. It distinguishes limited support from a provider outage or a lack of current scored news. Confidence is not presented as a probability of profit.
- When a weighted cohort has no usable scored evidence, the research graph, source archive, and report are now stored as `ResearchOnly`. No forecast engine, target, or forecast probability is created for that record. It remains inspectable and can be refreshed later. The selected research weights are preserved.

## Freshness means original observation time

The current-research window is 168 hours. News, quotes, and technical observations beyond that window are excluded from current scoring; some intraday and social inputs have tighter limits. A recent download does not refresh an old publication date.

Financial statements and economic series have different release schedules. A quarterly statement or monthly economic value cannot honestly be required to have a new observation every week. The panel separates these latest-available historical inputs from current-week evidence and retains their original reporting periods. Availability and quality checks continue to apply; older context is never relabeled as a current-week observation.

Current investment interpretation has additional gates. The recorded research must be no more than 24 hours old, its forecast horizon must remain open, the point-in-time audit must pass, and scored evidence, coverage, and forecast support must be usable. The engine's existing 36-hour snapshot-staleness rule is preserved. Short-horizon decisions still require a confirmed live quote within 15 minutes and an open market. Daily index observations are not advertised as live intraday trading data.

## Understanding the confidence correction

The earlier implementation already discounted publisher concentration inside each cohort and then applied another concentration multiplier to the final weighted confidence. Removing that final multiplier fixes the double penalty without changing evidence direction. A controlled, well-supported fixture produced the same directional score and the same per-cohort confidence before and after the change, while its overall confidence increased from 56.88 to 64.52. A low-relevance fixture still remained below 40. These are test fixtures, not a claim about a user's saved stock research or realized investment performance.

The minimum research-confidence threshold of 40 and favorable threshold of 60 remain. Strongly concentrated sources can still prevent a favorable stance. Conflicting or weakly relevant information can legitimately produce low confidence even when every observation is recent. The new explanation shows those reasons instead of presenting only an unexplained threshold.

## Source access and operational requirements

The application still requires its configured Alpha Vantage key and a working research database. Endpoint availability depends on provider coverage, subscription entitlements, rate limits, and service availability. Public discovery does not grant access to paywalled full text and is not a replacement for market-price entitlements. Empty results are distinguished from query failures wherever the provider supplies that distinction.

Provider documentation: <https://www.alphavantage.co/documentation/>. The documented `NEWS_SENTIMENT` parameters support publication windows and latest-first ordering; native index history uses `INDEX_DATA`. Consult the provider for the account's current access rather than assuming that every endpoint is included.

Transport deadlines, response-size limits, cancellation, failure cooldowns, and access control remain in effect. They prevent a failed external request from hanging a research run. The existing beta policy for overall research-job duration remains unchanged.

## Installation and verification

Use the accompanying cumulative Windows ZIP installer and `README_FIRST.txt` from the existing project folder. The installer preserves the current branch and local environment files and records a source backup. The cumulative package includes the earlier account-security migration; if that migration is already installed, the upgrade command can be rerun.

```cmd
npm ci
npm run db:security-upgrade
npm run test:current-research
npm run build
npm run dev
```

After signing in, open Intelligence, select the exact stock or index, and generate current research. A saved run retains its original evidence and methodology; reload alone does not recollect it. Inspect Research readiness and the source archive, then open the publisher or aggregator links for the original material. The query log identifies any provider access or coverage gap that still needs attention.

The verification suite uses controlled provider responses and database doubles. It checks freshness boundaries, duplicate/relevance rejection, exact index identity, forced-cache refreshes, confidence invariants, stored partial research, source ownership/integrity, and UI run selection. It does not prove that a particular live provider account has the required entitlements or that a forecast predicts realized returns.
