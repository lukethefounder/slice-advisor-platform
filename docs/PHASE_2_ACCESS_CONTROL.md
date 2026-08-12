# Slice Phase 2 — Authentication, Authorization, and Firm Isolation

## Scope

Phase 2 strengthens the server-side access model without changing the Prisma schema or deleting existing data.

It adds:

- A centralized firm-permission model.
- Founder, firm-owner, lead-advisor, advisor, compliance, and staff access resolution.
- Active-user, active-membership, and active-firm checks.
- Firm-scoped client and advisor-inbox filters.
- Safer founder workspace initialization.
- Backward-compatible adoption of legacy personal clients that have no firm ID.
- Client portal sessions that become invalid when the firm or assigned advisor is inactive.
- Safe current-user access metadata at `/api/auth/me`.
- Login errors that no longer expose internal exception messages.
- Advisor assignment writes constrained to the current firm.
- Client portal idempotency keys derived on the server and bound to the current client.
- Protection against one portal client updating another client’s inbox event through a guessed source event ID.

## Files

### New

- `src/lib/access-control.ts`
- `scripts/validate-phase-2.mjs`
- `docs/PHASE_2_ACCESS_CONTROL.md`

### Full replacements

- `package.json`
- `src/lib/client-access.ts`
- `src/lib/client-portal-auth.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/advisor-routing/route.ts`
- `src/app/api/client-portal/access/route.ts`
- `src/app/api/client-portal/routing/route.ts`

## Permission behavior

Founder access is controlled through `SLICE_FOUNDER_EMAILS` and receives all Phase 2 firm permissions.

Firm-management permissions are derived from both the membership role and the existing boolean membership controls. Roles such as Owner, Principal, Managing Partner, Lead Advisor, Firm Admin, Admin, and Manager receive assignment and supervisory permissions when the membership is active.

Advisors can work with clients assigned to their membership. Compliance and approved supervisory roles can view firm-wide client and inbox records but do not automatically receive client-assignment mutation permission.

All client and inbox queries include `firmId`. Non-supervisory users also include `assignedAdvisorMembershipId`.

## Legacy clients

Existing personal clients with `firmId = null` are adopted only when:

- the authenticated user owns those records through `userId`, and
- the current membership can manage client routing.

The adoption sets the current firm and assigned membership. It does not touch another user’s clients.

## Client portal behavior

A portal session is valid only while all of these remain true:

- the portal session has not expired;
- the client has portal access enabled;
- the client still has a firm ID;
- the client still has an assigned advisor membership;
- the assigned membership is active and belongs to the same firm;
- the assigned advisor account is not banned or suspended;
- the firm is active.

Changing or disabling those records invalidates the portal session on its next request.

## Database migration

No database migration is required for Phase 2. It uses the firm, membership, client-assignment, portal-session, advisor-inbox, and audit models that are already present.

## Environment variables

No new environment variable is required.

The existing founder override requires:

```env
SLICE_FOUNDER_EMAILS="founder@example.com"