# Slice Phase 3 — Database and Prisma Performance

## Scope

Phase 3 improves database reliability and query-path performance without changing
business records, authentication behavior, tenant boundaries, client assignment,
or user-facing workflows.

## Verified problem areas

- Prisma ORM 7 uses the PostgreSQL driver adapter, so pool limits and timeouts
  must be configured through the `pg` driver rather than assumed from older
  Prisma defaults.
- The existing runtime created the adapter with only a connection string and did
  not define bounded pool or transaction timeouts or slow-operation telemetry.
- Common firm, client, advisor-inbox, notification, audit, task, document, and
  current-price queries relied mostly on single-column indexes even when they
  filter and sort on multiple fields.
- The existing client workspace still performs a large nested read. Phase 3
  prepares the database and instrumentation for that refactor; cursor pagination
  and narrow client-list payloads are Phase 4 so the current UI is not broken.

## Files replaced

- `.env.example`
- `package.json`
- `scripts/validate-env.mjs`
- `src/lib/env.ts`
- `src/lib/health.ts`
- `src/lib/prisma.ts`

## Files added

- `scripts/phase-3-indexes.mjs`
- `scripts/apply-phase-3-schema-indexes.mjs`
- `scripts/check-phase-3-database.mjs`
- `scripts/validate-phase-3.mjs`
- `prisma/migrations/20260804030000_phase_3_database_performance/migration.sql`
- `docs/PHASE_3_DATABASE_PERFORMANCE.md`

## Existing file modified by a preparation command