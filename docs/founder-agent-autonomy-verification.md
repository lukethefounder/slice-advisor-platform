# Founder agent autonomy — verification record

Verified for the November 20, 2026 release. This record describes the local source build and controlled automated tests. Real provider credentials, a live database, live brokerage accounts and financial orders were not used in this verification.

## Completed gates

- `npm run test:agent-autonomy`: **41 test suites passed**, including all earlier founder, research, strategy, security, invitations and neural-platform regressions.
- `npm run build`: **passed** with Next.js 16.2.11, React 19.2.4, Prisma 7.8.0 and Node 24.22.3; generated the Prisma client, compiled production output, completed TypeScript and generated the application routes.
- ESLint on the **56 changed TypeScript/JavaScript source and test files**: **zero errors**. Four pre-existing React hook warnings remain in the existing Settings and Brief pages; new modules/components passed their targeted checks.
- `git diff --check`: **passed**.

## New and expanded coverage

| Area | Verification |
| --- | --- |
| Adaptive operation and delegated workload | 65 checks: deterministic source groups, distinct metrics sharing one documentation URL, duplicate article handling, bounded concurrency, cancellation, no helper trading authority, material-change gates and measured usage aggregation. |
| Internet and research access | 194 checks: hosted search receipts, owner cache, public URL/address policy, DNS pinning, body/redirect restrictions, source fingerprints, account-wide opt-in/revocation, private-field exclusion, authorized platform context and source-grounded agent reads. |
| Agent orchestration | 1,541 checks: real production agents/store/service with controlled I/O, exact cycles, two-round review, helper publication, actual versus simulated balances, immutable broker submission identity, global pause despite broker-write failure, stale proposals, leases, cancellation, API routes and preserved native-index research. |
| Scheduler | 219 assertions: independent local/broker monitoring, lease recovery, changed-data gating, actual held-position priority, broker autonomy independent from local simulator activation, stale/closed sessions and founder revocation. |
| Market observations | 72 checks: quote age, original nanosecond timestamps, arrival ordering, heartbeats, stale/offline display, scoped persistence, credential rotation and no browser secret exposure. |
| Persistent stream worker | 14 scenarios / 81 assertions: fixed endpoints, authentication/subscriptions, account/feed socket reuse, scope-filtered fanout, quote coalescing, expired-payload omission, configuration changes, bounded retries, no overlapping writes and cleanup. |
| Stream routes | 9 scenarios / 64 assertions: worker authentication, bounded request input, founder gating, repeated session validation, revoked streams, request cancellation and slow-consumer buffering. |
| Broker adapter | 112 assertions: credential encryption/binding, current account and quotes, policy limits, durable intent reservation, concurrent submissions, ambiguous responses, partial entries, native protective exits, external-position mismatch, current session recheck and live/SIP activation gates. Includes activation racing a durable global pause. |
| Broker settings, approval, consent and stream UI | 21 scenarios / 166 assertions: exact revision/cycle requests, no automatic mutation retries, mode distinctions, source consent, scope remounting, malformed/late responses, logout clearing and stream lifecycle. |
| Main Agent Desk UI | 27 scenarios / 348 assertions: existing controls, refresh ownership, source/results rendering, separate brokerage targets and accurate pause/kill wording. |
| Actual brokerage trade briefs | 74 assertions: founder-only mounting, latest cumulative observation per order, gross/net provenance, visibility polling, no trade mutation, revoked access and stale-response fencing. |

Other inherited suites cover the 10,000-path graph projection, source provenance and scoring, private workspaces, seven-day research, historical backtests, forward tracking, security migration, account settings and invitations. Graph evaluation counts are local calculations over evidence, not claims of ten thousand independent paid AI models.

## Deployment checks that require the owner's environment

After installation, Settings verifies the owner's actual broker account and chosen data entitlement. The app and always-on worker must share the correct private worker secret and reachable application origin. Start with broker paper trading and inspect observed submissions, partial fills, native protection and recorded exits. Live market access, provider availability, exchange execution and investment returns cannot be established by mocked tests or a successful build.

The separate ZIP installer verification covers hashes, original and previous project baselines, existing-branch preservation, environment-file exclusion, rollback and restoration. Its manifest records the exact tested source commit. Installer tests run on Linux with controlled project fixtures; native Windows command launchers are included but were not executed on the user's PC.
