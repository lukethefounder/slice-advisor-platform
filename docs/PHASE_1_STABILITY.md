Phase 1 — Stability baseline and operational visibility

1. Problems verified

Repository inspection confirmed the following issues before implementation:

.gitignore contains accidental PowerShell transcript fragments, duplicated entries, and malformed ignore rules.

The repository has no committed .env.example, despite depending on PostgreSQL, provider credentials, cron authorization, storage, and encryption configuration.

package.json lacks dedicated TypeScript, environment, Prisma-schema, production-audit, and complete quality-gate commands.

The root App Router has no verified loading, not-found, route-error, or global-error states.

The existing public /api/system/health route performs three full table counts and returns raw database failure text.

No standard liveness/readiness split exists for deployment and monitoring systems.

API routes do not share a request-ID, timing, timeout, safe-error, or structured-logging foundation.

The repository README is still the default create-next-app document and does not describe Slice's real architecture or operating requirements.

No repository quality workflow exists at .github/workflows/quality.yml on the inspected main branch.

2. Why this matters

These problems make production failures harder to diagnose, allow deployment configuration drift, expose unnecessary operational information, create inconsistent error behavior, and leave later performance work without measurable request timing or repeatable quality gates.

Phase 1 deliberately avoids changing the Prisma schema, authentication implementation, permission model, client data, market-data calculations, email behavior, or user workflows. It establishes the guardrails required to improve those areas safely in later phases.

3. Files replaced

.gitignore
README.md
package.json
src/lib/env.ts
src/app/api/system/health/route.ts

4. Files added

.env.example
.nvmrc
.github/workflows/quality.yml
docs/PHASE_1_STABILITY.md
scripts/validate-env.mjs
scripts/validate-phase-1.mjs
src/instrumentation.ts
src/lib/logger.ts
src/lib/api-route.ts
src/lib/health.ts
src/components/system-state-screen.tsx
src/app/loading.tsx
src/app/error.tsx
src/app/global-error.tsx
src/app/not-found.tsx
src/app/api/health/route.ts
src/app/api/health/live/route.ts
src/app/api/health/ready/route.ts

5. Implementation

Environment contract

Documents server-only and public-safe settings.

Validates PostgreSQL URLs, application URLs, session bounds, Alpha Vantage entitlement, live email/SMS dependencies, Neo4j dependencies, logging options, and secret naming.

Rejects secret-looking values exposed through NEXT_PUBLIC_ names.

Supports gradual rollout through SLICE_STRICT_ENV.

Startup instrumentation

Runs once when a Node.js server instance starts.

Logs invalid or incomplete configuration using structured events.

Stops startup only when SLICE_STRICT_ENV=true.

Structured logging

Emits JSON records with timestamp, level, service, scope, event, and environment.

Redacts common credential and financial-identifier fields.

Limits depth, array size, object keys, and string length.

Omits production stack traces unless explicitly enabled.

API route wrapper

Generates or preserves a valid request ID.

Measures response time.

Adds server-timing, x-request-id, and x-response-time-ms headers.

Supports bounded route execution and abort signals.

Maps unexpected failures to safe error responses without exposing stack traces or provider internals.

Health checks

/api/health/live checks process liveness only.

/api/health/ready and /api/health validate configuration and PostgreSQL connectivity.

/api/system/health preserves compatibility with the current system page while removing table counts and raw exception text.

Detailed integration configuration requires an authorized health secret.

Root application states

Adds accessible root loading feedback.

Adds route-level and global error recovery.

Adds a branded not-found route.

Uses the existing Slice emerald/charcoal branding rather than introducing a separate design language.

CI quality gate

Uses Node 22 and clean PostgreSQL 16.

Validates file boundaries and environment rules.

Applies migrations to an empty database.

Generates Prisma.

Runs TypeScript, ESLint, dependency audit, and the production build.

6. Database migration

None. Phase 1 does not alter the Prisma schema or production data.

7. New environment variables

Optional operational settings:

SLICE_STRICT_ENV
SLICE_ENV_VALIDATION_MODE
LOG_LEVEL
LOG_INCLUDE_STACKS
HEALTHCHECK_SECRET
NEO4J_ENABLED

Existing production settings are now formally validated, including:

DATABASE_URL
CRON_SECRET
SLICE_SECRET_ENCRYPTION_KEY

8. Test and validation additions

scripts/validate-phase-1.mjs verifies required files, package scripts, global-error structure, logger redaction, and removal of unsafe legacy health behavior.

scripts/validate-env.mjs validates runtime configuration without printing secret values.

.github/workflows/quality.yml adds clean-environment migration, type, lint, audit, and build gates.

9. Verification commands

Run from the repository root:

npm ci
npm run validate:phase1
npm run validate:env
npm run db:validate
npm run db:migrate:deploy
npm run db:generate
npm run typecheck
npm run lint
npm run audit:production
npm run build

Or run the combined command:

npm run validate

Then test:

GET /api/health/live
GET /api/health/ready
GET /api/health
GET /api/system/health

10. Remaining limitations

Phase 1 does not yet convert every existing API route to the shared wrapper; adoption occurs as each workflow is audited in later phases.

Provider health checks in Phase 1 report safe configuration status, not live third-party calls. Live provider circuit breaking and failure telemetry belong to the integration and production-operations phases.

The complete repository build must run in the real checkout after placement because this artifact environment does not contain the repository's installed dependency tree or production database.