# Knowledge graph research upgrade

## Experience

The intelligence overview puts the stock's research graph first. Stock selection and research controls are compact, while the forecast and source registry remain attached to the same saved research run. The home page introduces the graph with a clearly labelled illustration; the authenticated workspace shows the user's saved graph without starting a provider request on page load.

Open `/workspace/intelligence`, choose a stock, and expand **Next research run** to adjust the analytical agent count and media, technical, and economy weights. Building research saves those preferences for that user. The allocation accepts 30–10,000 pathways and preserves the requested total, including configurations with a zero-weight cohort. Existing users start at 600 agents with equal weights.

The graph, forecast panel, source registry, full graph workspace, and agent inspector share a research-run identifier. Links preserve that identifier so the evidence behind a displayed probability remains inspectable after a newer run is created.

The founder sign-in page has a dedicated constellation-style visual treatment, responsive layout, and reduced-motion support. Its existing authentication handler and redirect behavior are preserved.

## What 10,000 agents means

An agent is a locally evaluated analytical assignment with a cohort, specialty, research question, company/sector context, evidence links, and result. These assignments operate over retrieved market observations and news. They are not 10,000 independently browsing processes or 10,000 external model calls.

The collector retrieves the existing Alpha Vantage market, company, technical, news, and macroeconomic inputs, then adds a bounded set of ticker-and-topic news queries chosen from the research weights and sector. News selection requires the requested ticker, a usable publication timestamp, a valid source URL, and numeric sentiment and relevance. Fresh articles from different publishers are interleaved before the collection limit is applied.

The engine deduplicates repeated and syndicated articles, preserves alternate publisher links, and balances aggregate evidence by observed source domain. Different measurements from the same provider remain separate measurements, without masquerading as independent publishers. Increasing the agent count alone does not increase the research score or evidence confidence.

Each run records unique evidence and source counts, duplicate counts, unique versus reused evidence assignments, and coverage. Individual agent records identify shared evidence. A large workforce cannot guarantee that every assignment discovers a new fact; the interface reports actual coverage.

## Forecast interpretation

The outcome panel reads the existing canonical forecast saved with the graph. It shows the estimated probability of positive return and the complementary probability of zero or negative return across the canonical horizons, plus expected price, expected return, stored price range, confidence score, provider time, and target time.

The Slice sentiment score, confidence score, and outcome probability are different measures. Sentiment is not converted directly into an outcome percentage. Graph topology and repeated agents do not add artificial confidence to the forecast input. A stored model range does not imply a verified statistical coverage percentage.

This change improves evidence collection, traceability, consistency, and scale; it does not establish improved real-world prediction accuracy. Assess probability calibration and performance against settled outcomes in the existing forecast-history and evaluation workflows before describing the model as reliably predictive.

## Persistence and performance

- User research preferences use an existing per-user `BackendPlatformEvent` record. This change adds no Prisma migration.
- Canonical PostgreSQL storage retains the complete evidence archive and complete agent graph, together with integrity hashes. Agent details remain available even when their nodes are outside the visible projection.
- The canvas uses bounded overview, balanced, and full projections instead of drawing every node at once. Node lookup can select an agent outside the default overview.
- `/api/intelligence/research-sources` searches and pages the complete saved evidence archive. `/api/intelligence/research-agents` searches and pages saved analytical assignments. Both enforce user ownership, stock and optional exact-run matching, integrity checks, rate limits, and private no-store responses.
- The agent inspector requests 24 records per page; API page sizes are capped at 100. Build responses include bounded agent samples rather than all 10,000 detailed records.
- Completed-result caching is capped at four entries and 32 MiB of serialized payloads; oversized results are served and persisted without being retained in that cache. This budget measures serialized data, not total process heap usage. A redundant full-result memory store has been removed.
- Older saved runs may contain only the graph details originally retained. The interface identifies incomplete historical retention instead of inventing missing assignments or evidence.
- Source URLs are restricted to HTTP(S), with credentials and sensitive query parameters removed. Alternate publisher links receive the same validation.

The existing background-job system can run research independently of optional Neo4j graph synchronization. Selecting background execution still requires the existing worker to be operating. Synchronous execution remains available.

## Configuration

Existing database and Alpha Vantage configuration remains required. No new service key is introduced.

Optional setting:

```dotenv
INTELLIGENCE_RESEARCH_NEWS_QUERY_LIMIT="3"
```

This controls additional topic queries per fresh collection, from 0 to 6. The default is 3; a value of 0 uses the baseline news feed. Calls are cached and concurrency-limited, but additional fresh queries still consume the provider's quota. Increasing the analytical agent count does not multiply external collection requests.

## Verification and release

Run the targeted behavioral suites:

```bash
npm run test:knowledge-graph
```

They cover exact weighted allocations, zero-weight cohorts, the 10,000-agent bound, repeated-evidence confidence invariance, evidence sanitization and deduplication, graph projection budgets, persisted agent details, cache bounds and concurrent request cleanup, ticker-specific news, source diversity, archive pagination, ownership, and integrity checks. Fixtures are synthetic; timing measurements exclude external collection and database persistence.

Then run the normal TypeScript and production build gates with the project's existing environment configuration:

```bash
npm run typecheck
npm run build
```

Before merging or deploying, preview the home, authenticated workspace, intelligence graph, agent inspector, sources, and founder login at desktop and mobile widths. Exercise a live research build using the configured database and provider, open an original source, follow an agent into the graph, refresh a pinned run URL, and verify the existing founder sign-in flow. This environment did not provide live credentials or a reachable browser preview; those integration and visual checks remain explicit release checks.
