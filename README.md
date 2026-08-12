Slice Advisor Platform

Slice is a Next.js financial-advisor operating platform that connects market intelligence, client workflows, advisor operations, communications, documents, notifications, firm controls, and knowledge-graph capabilities in one application.

Current stack

Next.js App Router

React and TypeScript

PostgreSQL

Prisma ORM with the PostgreSQL adapter

Tailwind CSS

Alpha Vantage market data

OpenAI-powered workflows

Vercel Blob object storage

Optional Neo4j knowledge graph

Vercel deployment and scheduled routes

Local setup

1. Use the repository Node version

The repository includes .nvmrc with Node 22.

nvm use

2. Install the locked dependency graph

npm ci

3. Create local environment configuration

Copy the committed template:

cp .env.example .env.local

Windows PowerShell:

Copy-Item .env.example .env.local

Set DATABASE_URL and DIRECT_URL to development PostgreSQL connection strings. Keep real credentials only in .env.local or the deployment provider's secret store.

4. Validate configuration

npm run validate:env

5. Prepare Prisma

For a migration-managed environment:

npm run db:migrate:deploy
npm run db:generate

Use npm run db:push only for disposable local development. Do not substitute it for reviewed production migrations.

6. Start Slice

npm run dev

Open http://localhost:3000.

Quality commands

npm run validate:phase1
npm run validate:env
npm run db:validate
npm run db:generate
npm run typecheck
npm run lint
npm run audit:production
npm run build

Combined checks:

npm run quality
npm run validate

npm run quality validates the Phase 1 foundation, runtime configuration, Prisma schema, generated client, TypeScript, and ESLint. npm run validate additionally runs the production build.

Health endpoints

Slice exposes separate liveness and readiness checks:

GET /api/health/live
GET /api/health/ready
GET /api/health
GET /api/system/health

Liveness verifies that the web process can answer requests. It does not require PostgreSQL.

Readiness validates required configuration and performs a bounded PostgreSQL connectivity check.

/api/system/health remains available for the existing system-readiness interface, but no longer returns database row counts or raw server errors.

Responses include x-request-id, x-response-time-ms, and server-timing headers.

Detailed provider configuration is returned only when a valid HEALTHCHECK_SECRET or CRON_SECRET is supplied as a bearer token or x-health-secret header.

Environment conventions

Server-only values must never use the NEXT_PUBLIC_ prefix. The committed .env.example separates required runtime settings from optional provider configuration.

Production-critical values include:

DATABASE_URL
APP_URL or NEXT_PUBLIC_APP_URL or VERCEL_URL
CRON_SECRET
SLICE_SECRET_ENCRYPTION_KEY

Provider credentials are required only when the corresponding live feature is enabled.

SLICE_STRICT_ENV controls whether startup instrumentation stops the server when required configuration is invalid. Keep it disabled during initial adoption, then enable it in CI and production once the environment is complete.

Repository structure

src/app/                 App Router pages, layouts, states, and API routes
src/components/          Shared interface and feature components
src/lib/                 Server services, integrations, data access, and utilities
src/instrumentation.ts   Startup environment validation and structured logging
prisma/                  Prisma schema and migrations
scripts/                 Repository validation and maintenance scripts
.github/workflows/       Automated quality gates

Operational logging

Server infrastructure should use:

src/lib/logger.ts

The logger emits structured JSON, redacts common credential fields, limits payload size, and supports scoped child loggers.

New or refactored API routes can adopt:

src/lib/api-route.ts

for request IDs, route timings, bounded execution, safe error responses, and consistent no-store behavior.

CI quality gate

The GitHub Actions workflow starts a clean PostgreSQL service and runs:

Locked dependency installation

Phase 1 structure validation

Environment validation

Prisma schema validation

Migration deployment against clean PostgreSQL

Prisma client generation

TypeScript validation

ESLint

Production dependency audit

Next.js production build

Security expectations

Never commit secrets.

Never expose provider keys to client components.

Enforce authorization in server code, not only in the interface.

Preserve firm, advisor, and client data boundaries.

Use reviewed migrations for production database changes.

Keep email, document, notification, approval, and assignment actions auditable.

Do not log request bodies, client records, email contents, document contents, or provider credentials.

Do not describe Slice as unhackable; use layered controls, monitoring, and recovery.

See docs/PHASE_1_STABILITY.md for the exact Phase 1 scope and verification record.