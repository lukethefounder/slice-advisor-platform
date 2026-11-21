# Custom strategies, account protection, and team invitations

This release extends the existing Slice platform and retains the dark neural
homepage, workspace, intelligence graphs, source records, beta research
execution, historical-data preparation, and forward observation workflow.

## Custom Strategy Studio

Open `/workspace/strategy-lab`. The guided workflow now starts with **Build my
own**. Starter ideas remain available as a separate starting choice. A custom
draft is retained while browsing ideas; turning an idea into a custom strategy
is an explicit action.

### Supported metrics

Every metric has a searchable explanation, units, an example, and controls for
adding it to entry or exit conditions. The 15 metrics are:

| Category | Metrics |
| --- | --- |
| Momentum | Trailing price return; return minus the benchmark; simple-window RSI; closing position within the rolling high–low range |
| Trend | Distance from the simple moving average; distance from the exponential moving average; distance above the prior closing high; trend efficiency |
| Risk | Annualized trailing volatility; drawdown from a trailing closing high; average true range divided by close |
| Volume | Average daily dollar volume; volume relative to the preceding window's average |
| Price | As-traded close; distance from the rolling mean in population standard deviations |

Users choose lookback windows, thresholds, ranges, and crossovers; nest ALL and
ANY groups; and apply supported conditions to an instrument or its benchmark.
The benchmark market filter controls portfolio eligibility. The text summary
shows the current entry and exit logic.

Additional controls cover symbols or sector ETFs, benchmark, dates, capital,
ranking, equal or inverse-volatility weights, rebalance schedule, position and
group limits, maximum exposure, fees, commissions, slippage, and the rate used
in the Sharpe calculation. Idle capital remains cash. Position and group caps
apply to rebalance targets; later price movement can change actual weights.

### Custom exits and execution semantics

Metric exits may be combined with an average-entry stop-loss, an average-entry
take-profit, a trailing closing-price stop, a maximum holding period, a
portfolio drawdown stop, and a re-entry cooldown. Optional limits are disabled
by leaving their field blank.

These are daily historical and paper-tracking rules. They are evaluated from
completed observations and execute at the next observed open. An average-entry
stop is not an intraday exchange order and does not cap an overnight loss.
Average entry is weighted by purchase fills, adjusted for splits, and retained
after partial sales. Dividends, commissions, and exit costs affect measured
performance but are excluded from the entry-price exit trigger.

Exit precedence is portfolio stop, failed market filter, stop-loss,
take-profit, trailing stop, holding period, then metric rules. Exiting prevents
rebuying that instrument at the same session's open; the cooldown then skips
the configured number of following sessions. The portfolio drawdown stop leaves
the strategy in cash for the remainder of that test or forward observation
period. The comparison benchmark is unaffected by strategy-specific exits.

### Save, test, and track the same definition

1. Build the rules and choose the historical period and universe.
2. Save a named definition or load one that belongs to the current account.
3. Prepare and validate the historical observations.
4. Run the test and inspect performance, trades, costs, warnings, and source
   manifests.
5. Choose **Track forward** to register the same saved definition for future
   paper observations.

Saving an edited definition creates a new saved version. Existing historical
results and active forward registrations retain the definition they used.
New custom strategies use definition version 3 and engine
`slice-daily-event-ledger-3.0.0`. Versions 1 and 2 retain their original engine
identities and calculations. Opening an older saved strategy does not silently
upgrade it; the editor offers an explicit v3 copy.

Historical rules use recorded price and volume observations. Current news,
current financial statements, or today's index membership are not backfilled
into a historical test as though they were known then. The vendor's history
and supported universe still determine available coverage. These results are
hypothetical simulations and forward paper observations; this release does
not place brokerage orders or establish a probability of future profit.

Continuous local observations still require the running app and
`npm run beta:worker`, with the same configured `CRON_SECRET`. A deployed
scheduler can perform that role instead. See `beta-intelligence-upgrade.md`
for the existing worker and market-data requirements.

## Settings

Open `/workspace/settings`. The redesigned console has eight searchable
sections: Overview, Profile, Appearance, Alerts, Connections, Team & access,
Security, and Data & account. It uses the shared navy, mint, and cyan theme,
retains user-selected light/system modes, and supports reduced motion.

Profile, appearance, and notifications have separate save/discard behavior.
Saving one section preserves unsaved drafts in other sections. Preferences
include name, phone, IANA timezone, theme, density, text scale, sidebar and motion
options, channel thresholds, quiet hours, digest preferences, and cooldowns.

Quiet hours use the saved timezone, including overnight intervals. The real
autonomous email path uses the saved quiet-hour, urgency, score, digest, and
cooldown rules. Simulated activity is labelled as simulated and cannot throttle
real email delivery. Queuing a record is not reported as successful provider
delivery. Connections distinguishes configured integrations from confirmed
availability; it does not imply a provider was contacted just because a key
is configured.

Sign-in email is read-only until a verified email-change workflow exists.
Direct legacy requests cannot change it, set a fake MFA flag, or queue a fake
password reset. Account closure requires the current password, an enrolled
second factor, and typed confirmation. Firm creators cannot close their
accounts through this workflow because the existing schema would cascade
through their firms. Other applicable memberships require another active
administrator. Successful closure revokes all sessions.

The preference export contains selected profile and preference data. It
excludes passwords, sessions, authenticator material, and unknown historical
privacy fields. Historical privacy preferences are identified as preferences;
they are not represented as universal deletion or retention enforcement.

## Operational Security Center

Open `/security`. The neural design now surrounds controls backed by server
actions and recorded account state:

- Authenticator enrollment with a verified setup code, rather than a checkbox.
- TOTP authentication at login and existing-account invitation acceptance.
- Encrypted authenticator seeds in a separate `UserAuthenticator` table.
- Ten hashed, one-use recovery codes, with verified replacement and revocation.
- Atomic consumption of authenticator time steps and recovery codes.
- Password changes requiring the current password and enrolled factor,
  followed by revocation of all browser sessions.
- A device/session list, individual revocation, sign-out of other sessions, and
  sign-out everywhere. Device labels come from browser-reported information.
- Enforced idle and maximum session lifetimes, capped by the deployment's
  `SESSION_TTL_HOURS` setting.
- Account activity search, filtering, and export of the displayed recent events.
- Specific checks for enrollment, recovery availability, cookie configuration,
  encryption-key configuration, rate-limit configuration, and founder bootstrap.

Sensitive account actions require same-origin JSON requests, bounded request
bodies, authentication, rate checks, and reauthentication. Mandatory change
audits commit with their associated database writes. Session creation checks
current credentials and enrollment generation to reject a credential change
that occurs while sign-in is in progress. Sign-in email cannot be edited to
acquire a reserved founder identity.

Administrative role matching is exact. Titles such as Portfolio Manager or
Relationship Manager do not acquire firm management simply because they
contain the word “manager.” Legacy member-access routes now verify current
credentials and firm authority, protect ownership and self-access, and reject
granting permissions beyond the actor's own authority. Removed members' firm
bots are paused and their pending invitations are cancelled in the same
transaction. Member responses select public identity fields rather than
returning password hashes.

The displayed checks reflect implemented controls and configuration. They do
not constitute a penetration test, independent audit, security certification,
or a claim that every part of a deployment has been assessed. Existing
disclosure and compliance reference material remains in a separate reference
section and is not presented as live security findings.

### Required database upgrade

This release adds session metadata, `UserSecuritySetting.idleTimeoutMinutes`,
and `UserAuthenticator`. Stop the app and worker, install the files and
dependencies, then run:

```text
npm run db:security-upgrade
```

The scoped command applies only
`prisma/migrations/20261119060000_account_security_controls/migration.sql`.
It is additive, transactional, and rerunnable. It does not reset data, replay
earlier migrations, or invent a Prisma migration history for a database that
was previously initialized with `db push`. A previously checked MFA preference
without an enrolled authenticator is cleared because that preference never
provided second-factor verification. Enrolled authenticator records are kept.

The command reads the existing environment. Use the provider's direct or
session PostgreSQL connection as `DIRECT_URL`; transaction-pooling endpoints
are unsuitable for this schema operation. To inspect without applying changes,
run `npm run db:security-upgrade -- --check`; `--help` lists the available bounds
and schema option. A deployment already managing the complete Prisma
migration history can apply this migration through its normal deployment
process instead. Do not run a database reset.

The ZIP file installer does not execute SQL or edit local secrets. Its source
restore command restores files only; it does not remove additive database
columns or authenticator records. Never discard the encryption key or enrolled
authenticator data while rolling back source files. If users have enrolled MFA,
keep an older MFA-unaware release offline and repair forward; that older code
cannot enforce the new authenticator requirement.

### Authenticator configuration

Generate a key locally:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Add the generated value to the existing `.env.local`, or to server deployment
secrets, without a `NEXT_PUBLIC_` prefix:

```dotenv
MFA_ENCRYPTION_KEY="YOUR_64_CHARACTER_HEX_VALUE"
```

Restart the app after changing its environment. Keep this key stable and backed
up with the deployment's secrets after anyone enrolls. Changing it does not
automatically re-encrypt existing seeds. The Security Center shows enrollment
as unavailable when the key is missing. Account access without enrollment
continues to work after the database update; MFA is activated only when the
user completes verification.

Keep the existing production security-secret configuration as well. The
distributed rate limiter requires `SECURITY_PEPPER` or its configured secret
fallback in production; the new authenticator key does not replace that secret.

New passwords and passphrases accept 15–128 characters and spaces. Existing
passwords continue to authenticate. Save the recovery codes after enrollment;
the server cannot display their plaintext again.

Beta research has no application execution deadline by default. Session
expiration, one-use invitation expiry, credential verification cooldowns, and
database-operation safety bounds remain separate account protections.

## Simple team invitations

Open **Team & invitations** in the workspace sidebar or visit `/workspace/team`.
Settings, the Security Center, and the older firm page link to the same flow.

1. Enter a colleague's email.
2. Choose an available role and read its description.
3. Choose **Create a link to copy** or **Email invitation**.
4. For supervisory or administrative roles, verify the current password and
   enrolled authenticator/recovery code.
5. Copy the private link from the success panel, or inspect the provider's
   reported email result.

The directory lists members and invitation history, with search. Authorized
members can replace a pending link or revoke it. A replaced link stops working
and the new one receives a fresh seven-day expiry. A page shows at most the
latest 200 matching records; search can locate older matching records.

New invitation tokens contain 32 random bytes and are stored as SHA-256 hashes.
Listings do not expose usable tokens. The raw private link is returned only
when it is created; it can be replaced later. Existing legacy codes continue
to work within their valid, unused lifetime for supported roles; unsupported
legacy roles require an administrator to issue a new invitation. Invitations bind to the intended
email and active firm, allow one acceptance, and recheck the sender's authority
at acceptance. They never transfer ownership or overwrite an existing firm
membership. Creation, acceptance, revocation, and membership changes use a firm
transaction boundary to prevent conflicting requests from granting access.

The public `/team-invite` page permits account setup before workspace access.
An existing Slice user proves the password and enrolled second factor; a new
user supplies a name and password for the invited email. The previous
`/workspace/team-invite` URL redirects to this public page. All other workspace
pages retain their sign-in and active-firm checks.

### Link and email configuration

For colleagues on other computers, configure `NEXT_PUBLIC_APP_URL` or `APP_URL`
to the reachable HTTPS deployment URL. A localhost invitation is useful only
on the computer running that local app. Link generation does not trust an
arbitrary forwarded Host header.

Copying a link does not require an email provider. For platform-sent invitations,
configure `ENABLE_LIVE_EMAIL=true`, `RESEND_API_KEY`, and a verified `RESEND_FROM`.
`TEAM_INVITES_FROM_EMAIL` can optionally select another verified sender.
Provider acceptance is reported as provider acceptance, not proof the recipient
read or received the message. Disabled, simulated, and failed delivery are
distinguished; a usable invitation link remains available when email is not
confirmed. No real invitations or messages were sent during this implementation.

## Verification and operating requirements

Run the combined gate from the project root:

```text
npm run test:strategy-security-team
npm run build
```

The gate covers custom strategy mathematics and saved definitions, account
settings and notification behavior, authenticator vectors and concurrent code
consumption, session and credential controls, invitation and membership
permissions, the scoped migration runner with a fake PostgreSQL client, and
all prior beta/neural regression suites. Test database and email boundaries
are controlled; the suite does not contact real providers or a live database.

The production build uses the actual generated Prisma client and Next.js
compiler. Static CSS checks and form/event tests are included. No browser,
Windows desktop, real email delivery, live PostgreSQL migration, or live
market-data subscription was exercised in the implementation environment.
Verify those deployment-specific connections after installing and configuring
the application. Credentials are not included in the update archive.

### Release verification recorded

| Verification | Result |
| --- | --- |
| Custom strategy suite | 196 checks passed |
| Account settings suite | 64 checks passed |
| Account security suite | 167 checks passed |
| Invitations and legacy member-access suite | 238 checks passed |
| Scoped migration runner with controlled database clients | 130 checks passed |
| Combined command, including 14 earlier beta/neural suites | All 19 suites passed |
| Production Next.js build and generated Prisma client | Passed |
| ESLint on changed source and test files | No errors; 16 warnings in the affected source set |
| Changed CSS modules | All six parsed; referenced Team classes resolved |
| Git whitespace/error check and dependency lockfile match | Passed |
