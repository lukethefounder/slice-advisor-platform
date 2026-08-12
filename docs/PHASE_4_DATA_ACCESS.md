# Phase 4 — Bounded Data Access, Cursor Pagination, and On-Demand Client Sections

## Problem found

The existing `GET /api/clients` implementation loads every client available to the signed-in advisor together with every holding, note, task, review, and document for every client. It then calculates summary metrics in application memory.

That pattern grows in two dimensions at the same time:

1. More clients increase the number of parent rows.
2. More client activity increases every nested collection.

It creates oversized responses, unnecessary decryption work, high memory use, slower rendering, and a growing risk of timeouts.

## Why it matters

Client information is one of Slice's highest-use and most sensitive datasets. It must remain firm scoped and advisor scoped while also remaining fast as a firm grows. A list screen should not retrieve complete client histories.

## Files changed

### Replaced

- `package.json`
- `src/app/api/clients/route.ts`
- `src/app/api/clients/[id]/route.ts`

### Created

- `src/lib/pagination.ts`
- `src/lib/clients/contracts.ts`
- `src/lib/clients/repository.ts`
- `src/lib/clients/mutations.ts`
- `src/app/api/clients/[id]/sections/[section]/route.ts`
- `scripts/validate-phase-4.mjs`
- `scripts/tests/phase-4-pagination.test.mjs`
- `docs/PHASE_4_DATA_ACCESS.md`

## Implementation

### 1. Opaque cursor pagination

Pagination cursors are:

- Base64url encoded
- HMAC signed
- Bound to the exact firm, advisor scope, filters, search, sort, and direction
- Rejected when reused with a different query
- Compared with a timing-safe signature check

The cursor is an application token containing only a stable record ID and a query-scope hash. It does not contain client names, email addresses, notes, financial values, or section content, and callers must treat it as opaque.

### 2. Paginated client directory mode

Use:

```text
GET /api/clients?mode=list&limit=25