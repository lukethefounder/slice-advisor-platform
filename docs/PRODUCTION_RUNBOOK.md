# Slice Production Runbook

This runbook is the operational companion to Phase 12. It does not replace the backup, incident-response, or access policies of the selected database, Vercel, email, storage, market-data, AI, or Neo4j providers.

## 1. Release gate

A production release is acceptable only after all of the following pass from a clean checkout:

```bash
npm ci
npm run validate:env -- --mode=production
npm run db:validate
npm run db:migrate:deploy
npm run db:generate
npm run validate:phase12 -- --mode=production
npm run test:phase12
npm run typecheck
npm run lint
npm run audit:production
npm run build
npm run test:smoke