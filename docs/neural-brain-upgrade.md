# Slice neural brain update

## What changes

The public homepage, intelligence view, and private workspace now share a neural visual language: a dark background, a bilateral brain structure, depth, travelling synaptic signals, and pulsing nodes. The public scene illustrates the research architecture. A scene backed by saved research draws the actual stored relationships and retains their source identities.

### Public homepage

`src/app/page.tsx` and `src/components/knowledge-graph/landing-hero.tsx` introduce the large moving brain, floating media/technical/economy/outcome/source cards, and dark sections explaining the research workflow. Public intelligence headlines still use the existing saved snapshot and freshness checks. They do not trigger an external research refresh while the homepage loads.

The homepage's private entry links lead to `/founder-login` or the existing client sign-in route. There is no direct workspace shortcut. `src/app/workspace/layout.tsx` also verifies the session and active firm on the server before rendering the private workspace. A request without valid access redirects to sign-in; merely supplying a session cookie is insufficient.

### Intelligence view

The graph animates by default, including saved runs. The earlier renderer tied visual motion to a live-data flag; those concerns are now separate. Neurons drift within bounded positions, signals travel over graph edges, and destination nodes emit firing halos. Search, filters, zoom, pan, selected evidence paths, original source links, and keyboard controls remain available. Hit testing uses the last drawn positions, so moving nodes remain selectable.

The page uses a dark, compact control area above the dominant graph. With no saved graph, an explicitly labelled illustrative brain provides the visual frame; it does not manufacture observations, source counts, or forecast probabilities. Actual research replaces that illustration after the user builds or loads a run.

Below the graph, the outcome and score audit panels load the canonical forecast bundle attached to the exact displayed research run. The source registry keeps its run-specific pagination, searches, original links, and source/evidence distinction.

### Daily-brief workspace

The workspace centers on the first valid security in the latest saved daily brief's `overallRankedSecurities` order. The stored ordering is preserved. A read-only, user-scoped query obtains the brief, its timestamp, rationale, source links, drivers, risks, and score. A newer brief belonging to another user cannot supply this user's highlight.

The central brain is surrounded by the daily-brief signal, catalysts and risks, research score, outcome horizon, selected-node information, source links, and connected workflow actions. The graph is loaded for the highlighted symbol; its forecast is requested and checked against that graph's exact run ID. The daily brief and graph can have different observation times, which the interface labels explicitly.

When no valid saved highlight exists, the user's selected instrument is labelled as the fallback. A switch allows deliberate movement between a brief highlight and the selected instrument. No hardcoded stock is presented as a brief recommendation.

Market charts, watchlist controls, tasks, scenarios, news requests, connection settings, and the customizer remain inside the expandable **Market tools & saved workflow panels** section. Opening the workspace reads saved research. Provider refreshes start with an explicit market action; a configured periodic refresh begins after that action. The **Refresh saved research** control reloads the stored brief, graph, and matching forecast.

## Evidence scoring methodology

New runs record `slice-evidence-robust-2.0.0` in `score.methodology`. The existing saved response schema remains readable, and previously saved scores are not silently recomputed.

The scorer combines the user's media, technical, and economy weights. Each cohort is evaluated through the following steps:

1. **Deduplicate evidence.** Canonical URL/content checks collapse repeated items and preserve related source references. Duplicate selection is deterministic and preserves one coherent input record: an undated duplicate cannot displace a valid dated one solely because it arrived first.
2. **Check provenance and timestamps.** Missing observation times, future-dated records, excessively old evidence, invalid source identities, nonfinite scores, and zero-quality inputs cannot contribute to scoring or analytical assignments. The archive retains retrieved records for inspection.
3. **Apply freshness decay.** Different reporting cadences have different half-lives and maximum ages. Intraday prices, daily technical history, news, company reports, and monthly or quarterly economic series are not all judged by the same clock. The evaluation time is frozen at the new run's start, so cached evidence keeps aging. Retrieval time does not replace the observation period.
4. **Group related factors within each source.** Trend, momentum, RSI, VWAP, and moving averages belong to a common price-structure family. Other families cover risk, liquidity, growth, valuation, financial quality, macroeconomic drivers, and narrative themes. A publisher repeating a price-derived signal does not earn extra independent votes.
5. **Bound extreme influence.** Iteratively reweighted robust estimates reduce the effect of extreme observations. Disagreement is measured before the outlier adjustment so contrary evidence remains visible as risk.
6. **Shrink weak evidence toward neutral.** Evidence quality, source diversity, and disagreement determine how strongly a cohort can depart from the neutral score of 50.
7. **Combine user weights.** Cohort contributions sum to the weighted research score, apart from displayed rounding. Zero-weight cohorts do not affect that score or its confidence.
8. **Remove each publisher and recalculate.** The audit removes a shared source across all weighted cohorts together, then records the resulting score, the largest absolute source effect, and the source sensitivity range.

The audit exposes source-removal stability, effective source diversity, concentration, freshness, eligible/excluded counts, raw and adjusted cohort scores, neutral shrinkage, weighted contributions, and source influence. Source diversity uses weighted source domains as a proxy; it does not establish common-ownership or upstream-data independence.

Eligibility checks also constrain the model snapshot. Technical history, company reports, intraday observations, and news that fail the checks cannot re-enter through the forecast inputs or inflate evidence coverage. A new run requires an eligible observed quote as its market-price baseline, even when the user's research allocation assigns no weight to the technical cohort. An expired or unverifiable quote stops the build with an error rather than generating a price forecast.

The public score is still an evidence sentiment score on a 0–100 scale. Source-removal stability is an engineering diagnostic, and the source sensitivity range is expressed in score points. Neither is an estimated probability of a future return. Forecast probabilities remain separate, tied to a defined horizon and the matching stored forecast model.

### Research capacity and source coverage

The previous update's limit of 10,000 analytical assignments and personal research ratios is retained. These assignments examine distinct questions over the evidence actually retrieved. They are not 10,000 independent browser sessions. Increasing the assignment count does not create more sources or increase confidence merely through repetition. Unique evidence, reused assignments, source domains, and excluded records remain inspectable.

The canvas renders a bounded overview for responsiveness. The shared brain scene displays at most 680 research nodes while the full saved graph and paginated inspectors retain the rest. The interface distinguishes the displayed projection from full research totals.

### What is not established by this release

The scoring constants are transparent engineering choices, not fitted results from a new empirical study. This release makes no claim of outperforming an investment firm or of verified forecast calibration. An empirical claim would require point-in-time data, defined prediction targets, a held-out evaluation period, transaction-cost assumptions where relevant, benchmark comparisons, and calibration analysis of settled outcomes. A financial statement's fiscal period alone does not establish when that statement was historically public.

## Motion and accessibility

Motion can be paused. Operating-system reduced-motion preferences are respected; hidden tabs and offscreen canvases suspend animation. Geometry, canvas resolution, and animation frequency are bounded for lower-power devices. Animation does not update React state every frame. Mobile layouts stack the surrounding information panels and preserve readable controls. Keyboard users can select graph nodes without relying on pointer hit testing.

Motion illustrates connections. It does not imply incoming live market data or a neurological simulation of a biological brain.

## Install and validate

Use the accompanying Windows update ZIP's `README_FIRST.txt` and `INSTALL_UPDATE.cmd`. It applies complete replacement files to the existing project on the currently checked-out branch, verifies file hashes, and creates a backup outside the repository. The cumulative package includes the prior knowledge-graph and founder-login upgrade, so the earlier ZIP need not be applied first. Save open editor files and stop the development server before applying it.

No database schema migration or new package dependency is introduced by this neural update. Existing database and provider configuration is still required for real research. No credentials are included.

After installation:

```sh
npm ci
npm run test:neural-graph
npm run build
npm run dev
```

The targeted regression suite covers evidence duplicates and source attribution, 10,000-assignment invariance, scoring perturbations and timestamp exclusions, neural geometry and actual-edge preservation, saved-brief ownership and fallback behavior, and the workspace authentication boundary. These are deterministic code checks; they are not a performance benchmark for investment outcomes.

After starting the application, review `/`, `/founder-login`, `/workspace`, and `/workspace/intelligence`. Verify the dark homepage and sign-in path, pause/resume controls, a saved daily-brief highlight, graph node selection and source links, a new research run's score audit, and a narrow/mobile viewport. Older saved runs correctly lack the new audit until new research is built.

See `docs/knowledge-graph-upgrade.md` for the earlier source registry, personal research allocation, persistence, and forecast-run identity changes included in the cumulative package.
