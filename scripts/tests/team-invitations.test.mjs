import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createHash, webcrypto } from "node:crypto";
import ts from "typescript";

// Run production invitation services, HTTP boundaries, middleware and account
// acceptance routes. Only persistence/authentication/email dependencies are
// controlled. No actual database, email delivery, browser or external network.
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const { NextRequest, NextResponse } = nativeRequire("next/server");
const NOW = Date.parse("2026-11-19T18:00:00Z"), DAY = 86400000;
let checks = 0;
const clone = value => structuredClone(value);
const plain = value => JSON.parse(JSON.stringify(value));
const check = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const rejects = async (work, code) => { await assert.rejects(work, error => error.code === code, code); checks++; };
const throws = (work, code) => { assert.throws(work, error => error.code === code, code); checks++; };
const token = "AB".repeat(32), legacyToken = "CD".repeat(12);
const hashPassword = value => `fixture-hash:${createHash("sha256").update(value).digest("hex")}`;
const request = (body, pathname = "/api/team-invites", headers = {}) => new Request(`https://slice.test${pathname}`, { method: "POST", headers: { "content-type": "application/json", origin: "https://slice.test", ...headers }, body: JSON.stringify(body) });
async function errorResponse(work, status, code) {
  const response = await work, body = await response.json();
  check([response.status, body.error?.code ?? body.code], [status, code], JSON.stringify(body)); return body;
}

function matches(row, where = {}) {
  if (!row) return false;
  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true;
    if (key === "OR") return expected.some(value => matches(row, value));
    if (key === "AND") return (Array.isArray(expected) ? expected : [expected]).every(value => matches(row, value));
    if (key === "firmId_userId") return matches(row, expected);
    const value = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      return Object.entries(expected).every(([operator, operand]) => {
        if (operator === "in") return operand.includes(value);
        if (operator === "notIn") return !operand.includes(value);
        if (operator === "not") return value !== operand;
        if (operator === "mode") return true;
        if (operator === "contains") return String(value).toLowerCase().includes(String(operand).toLowerCase());
        if (operator === "gt") return value > operand;
        if (operator === "gte") return value >= operand;
        if (operator === "lt") return value < operand;
        if (operator === "lte") return value <= operand;
        return matches(value, { [operator]: operand });
      });
    }
    return value instanceof Date && expected instanceof Date ? value.getTime() === expected.getTime() : value === expected;
  });
}

function harness() {
  const h = { now: NOW, currentUser: "sender", env: { NEXT_PUBLIC_APP_URL: "https://slice.test", SLICE_FOUNDER_EMAILS: "founder@slice.test", NODE_ENV: "production" },
    data: { user: [], firm: [], firmMembership: [], firmInvite: [], userSecuritySetting: [], namedWatchlist: [], auditLog: [] },
    queries: [], emails: [], audits: [], reauths: [], rates: [], sessions: [], logs: [], factors: [], mfa: new Set(),
    emailResult: { ok: true, status: "sent", provider: "Controlled email" }, rateAllowed: true, factorValid: true, locks: 0, transactions: 0, queue: Promise.resolve() };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [h.now])); } static now() { return h.now; } }
  const logger = { info: (...v) => h.logs.push(v), warn: (...v) => h.logs.push(v), error: (...v) => h.logs.push(v) }; logger.child = () => logger;
  const joined = (model, row) => {
    if (!row) return row;
    const result = { ...row };
    if (model === "firmInvite") { result.firm = h.data.firm.find(item => item.id === row.firmId); result.sentBy = h.data.user.find(item => item.id === row.sentByUserId); }
    if (model === "firmMembership") { result.firm = h.data.firm.find(item => item.id === row.firmId); result.user = h.data.user.find(item => item.id === row.userId); }
    return result;
  };
  function projection(row, query = {}, model) {
    if (!row) return null;
    const related = model ? joined(model, row) : row;
    if (query.select) return Object.fromEntries(Object.entries(query.select).filter(([, selection]) => Boolean(selection)).map(([key, selection]) => [key, typeof selection === "object" ? projection(related[key], selection) : clone(related[key])]));
    const result = clone(row);
    for (const [key, options] of Object.entries(query.include ?? {})) result[key] = options === true ? clone(related[key]) : projection(related[key], options);
    return result;
  }
  function table(model) {
    h.data[model] ??= [];
    const rows = query => h.data[model].filter(row => matches(joined(model, row), query.where));
    const read = (query = {}) => {
      let result = rows(query); const ordering = query.orderBy ? Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy] : [];
      result = [...result].sort((a, b) => { for (const order of ordering) for (const [key, direction] of Object.entries(order)) { if (a[key] < b[key]) return direction === "desc" ? 1 : -1; if (a[key] > b[key]) return direction === "desc" ? -1 : 1; } return 0; });
      if (query.take !== undefined) result = result.slice(0, query.take);
      return result.map(row => projection(row, query, model));
    };
    return {
      async findFirst(query = {}) { h.queries.push({ model, action: "findFirst", query: clone(query) }); return read(query)[0] ?? null; },
      async findUnique(query = {}) { h.queries.push({ model, action: "findUnique", query: clone(query) }); return read(query)[0] ?? null; },
      async findMany(query = {}) { h.queries.push({ model, action: "findMany", query: clone(query) }); return read(query); },
      async count(query = {}) { return rows(query).length; },
      async create(query) {
        await h.beforeCreate?.(model, query);
        const row = { id: `${model}-${h.data[model].length + 1}`, createdAt: new Clock(), updatedAt: new Clock(), acceptedAt: null, platformStatus: "Active", ...clone(query.data) };
        h.data[model].push(row); return projection(row, query, model);
      },
      async updateMany(query) { await h.beforeUpdate?.(model, query); const values = rows(query); values.forEach(row => Object.assign(row, clone(query.data))); return { count: values.length }; },
      async update(query) { await h.beforeUpdate?.(model, query); const row = rows(query)[0]; if (!row) throw Error("Fixture update missing row"); for (const [key, value] of Object.entries(query.data)) if (value !== undefined) row[key] = clone(value); return projection(row, query, model); },
      async upsert(query) { const row = rows(query)[0]; if (row) { Object.assign(row, clone(query.update)); return projection(row, query, model); } return this.create({ data: query.create, ...query }); },
      async deleteMany(query) { const removed = rows(query), ids = new Set(removed.map(row => row.id)); h.data[model] = h.data[model].filter(row => !ids.has(row.id)); return { count: removed.length }; },
    };
  }
  const tables = new Map();
  const prisma = new Proxy({
    async $queryRaw() { h.locks++; return []; },
    async $transaction(work) {
      const previous = h.queue; let release; h.queue = new Promise(resolve => { release = resolve; }); await previous;
      h.transactions++; await h.beforeTransaction?.(); const snapshot = clone(h.data);
      try { return await work(prisma); } catch (error) { h.data = snapshot; throw error; } finally { release(); }
    },
  }, { get(target, key) { if (key in target) return target[key]; if (!tables.has(key)) tables.set(key, table(key)); return tables.get(key); } });
  const mocks = {
    "server-only": {}, "next/server": { NextRequest, NextResponse },
    "@/lib/prisma": { prisma },
    "@/lib/logger": { createLogger: () => logger },
    "@/lib/research/beta-policy": { researchBetaEnabled: () => true },
    "@/lib/security": { getClientIp: () => "192.0.2.9" },
    "@/lib/rate-limit": { consumeRateLimit: async value => { h.rates.push(clone(value)); return { allowed: h.rateAllowed, retryAfterSeconds: 90 }; } },
    "@/lib/account-security/service": {
      accountHasMfa: async id => h.mfa.has(id),
      requireAccountReauthentication: async (id, password, factor) => { h.reauths.push({ id, password, factor }); if (h.reauthFailure) throw h.reauthFailure; },
      verifyAccountSecondFactor: async (id, code) => { h.factors.push({ id, code }); return h.factorValid; },
    },
    "@/lib/integrations/email": { sendEmail: async value => { h.emails.push(clone(value)); if (h.emailFailure) throw h.emailFailure; return h.emailResult; } },
    "@/lib/audit": { recordAuditLog: async value => { if (h.auditFailure) throw h.auditFailure; h.audits.push(value); } },
    "@/lib/auth": {
      getCurrentUser: async () => h.data.user.find(row => row.id === h.currentUser && row.platformStatus === "Active") ?? null,
      hashPassword, verifyPassword: (password, stored) => hashPassword(password) === stored,
      publicUser: ({ id, name, email, createdAt }) => ({ id, name, email, createdAt }),
      SESSION_COOKIE: "slice_session", sessionCookieOptions: expires => ({ httpOnly: true, secure: true, sameSite: "strict", path: "/", expires }),
      createSession: async (userId, options) => { h.sessions.push({ userId, ...options }); return { token: "SESSION_SECRET_IN_COOKIE_ONLY", expiresAt: new Date(h.now + DAY) }; },
    },
  };
  const context = vm.createContext({ console, Date: Clock, Buffer, structuredClone, URL, URLSearchParams, Request, Response, Headers, AbortController, AbortSignal, DOMException, Uint8Array, performance, setTimeout, clearTimeout, crypto: webcrypto, process: { env: h.env } });
  const cache = new Map();
  h.load = file => {
    let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
    if (!path.extname(absolute)) absolute += ".ts";
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const output = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { fileName: absolute, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    assert.equal(output.diagnostics.filter(value => value.category === ts.DiagnosticCategory.Error).length, 0, absolute);
    const require = name => { if (Object.hasOwn(mocks, name)) return mocks[name]; if (name.startsWith("@/")) return h.load(name); if (name.startsWith(".")) return h.load(path.resolve(path.dirname(absolute), name)); if (name.startsWith("node:") || name === "crypto") return nativeRequire(name); throw Error(`Unexpected import: ${name}`); };
    vm.runInContext(`(function(require,module,exports){${output.outputText}\n})`, context, { filename: absolute })(require, module, module.exports);
    return module.exports;
  };
  h.contracts = h.load("src/lib/team/contracts.ts"); h.access = h.load("src/lib/access-control.ts"); h.service = h.load("src/lib/team/invitations.ts"); h.http = h.load("src/lib/team/http.ts");
  h.user = (id, email, extra = {}) => { const value = { id, email, name: id, passwordHash: hashPassword("legacy-password"), platformStatus: "Active", createdAt: new Clock(NOW - 30 * DAY), ...extra }; h.data.user.push(value); return value; };
  h.member = (userId, role = "Admin", extra = {}) => { const value = { id: `membership-${userId}`, firmId: "firm-a", userId, role, status: "Active", createdAt: new Clock(NOW - 10 * DAY), updatedAt: new Clock(), calendarColor: "#70e3d2", calendlyUrl: null, calendlyLabel: "Meeting", calendlyEnabled: false, ...h.contracts.teamRolePermissions(role), ...extra }; h.data.firmMembership.push(value); return value; };
  h.seedInvite = (extra = {}, code = token) => { const value = { id: `invite-${h.data.firmInvite.length + 1}`, firmId: "firm-a", sentByUserId: "sender", email: "recipient@example.test", role: "Investment Analyst", status: "Pending", createdAt: new Clock(), expiresAt: new Clock(NOW + 7 * DAY), acceptedAt: null, inviteCode: h.service.invitationHash(code), ...extra }; h.data.firmInvite.push(value); return value; };
  h.data.firm.push({ id: "firm-a", name: "Neural <Firm>", platformStatus: "Active", firmCode: "NOT_A_JOIN_CREDENTIAL" }, { id: "firm-b", name: "Other firm", platformStatus: "Active", firmCode: "OTHER" });
  h.user("sender", "sender@example.test", { name: "Owner <script>" }); h.user("recipient", "recipient@example.test"); h.member("sender");
  return h;
}

// Credential shape, normalization, hash-at-rest and old plaintext code support.
{
  const h = harness();
  check(h.service.invitationToken(` ${token.toLowerCase()} `), token);
  check(h.service.invitationHash(token), `sha256:${createHash("sha256").update(token).digest("hex")}`);
  for (const code of ["", "A".repeat(23), "A".repeat(65), "Z".repeat(64), "abcd;DROP TABLE", null]) throws(() => h.service.invitationToken(code), "INVALID_INVITATION");
  const old = h.seedInvite({ inviteCode: legacyToken, expiresAt: null, createdAt: new Date(NOW - DAY) }, legacyToken);
  check((await h.service.lookupInvitation(legacyToken.toLowerCase())).id, old.id, "Legacy 24-hex code remains redeemable");
  check(h.service.invitationExpiry(old).toISOString(), new Date(NOW + 6 * DAY).toISOString(), "Legacy missing expiry uses seven days from creation");
  const publicRow = h.service.publicInvitation(old);
  ok(!("inviteCode" in publicRow) && !JSON.stringify(publicRow).includes(legacyToken), "Ordinary list rows contain no bearer credential");
  h.now += 6 * DAY; check(h.service.publicInvitation(old).status, "Expired");
  await rejects(h.service.lookupInvitation(legacyToken), "INVITATION_EXPIRED");
  check(h.contracts.normalizeTeamEmail("  Recipient@Example.Test  "), "recipient@example.test");
  for (const email of ["<a@example.test>", "x\ny@example.test", "a@example.test;b@example.test", "missing-at", "a".repeat(250) + "@example.test"]) check(h.contracts.normalizeTeamEmail(email), "");
}

// Delegation is a permission subset, not an arbitrary role string or flag.
{
  const h = harness(), C = h.contracts, A = h.access;
  const access = role => ({ isFounder: false, permissions: A.permissionsForMembership({ role, ...C.teamRolePermissions(role) }) });
  ok(h.service.canGrantTeamRole(access("Admin"), "Associate Advisor"));
  ok(h.service.canGrantTeamRole(access("Admin"), "Admin"));
  check(h.service.canGrantTeamRole(access("Investment Analyst"), "Member"), false);
  check(h.service.canGrantTeamRole(access("Chief Compliance Officer"), "Admin"), false, "Invite permission alone cannot grant firm administration");
  check(h.service.canGrantTeamRole(access("Chief Compliance Officer"), "Associate Advisor"), false, "Delegation must include client-management authority too");
  ok(h.service.canGrantTeamRole(access("Chief Compliance Officer"), "Investment Analyst"));
  ok(C.TEAM_INVITE_ROLES.every(item => h.service.canGrantTeamRole({ isFounder: true, permissions: [] }, item.role)));
  check(C.normalizeTeamRole("Owner"), null); check(C.normalizeTeamRole("Founder"), null); check(C.normalizeTeamRole("advisor"), "Associate Advisor");
  const portfolio = A.permissionsForMembership({ role: "Portfolio Manager", ...C.teamRolePermissions("Portfolio Manager") });
  check(portfolio.includes("firm.manage") || portfolio.includes("members.invite"), false, "A portfolio-manager title does not imply firm administration");
  const member = h.data.firmMembership[0]; Object.assign(member, { role: "Member", ...C.teamRolePermissions("Member"), canInviteMembers: true });
  await rejects(h.service.manageTeamInvitation(request({}), { email: "new@example.test", role: "Admin" }), "ROLE_NOT_ALLOWED");
  check(h.data.firmInvite.length, 0);
  const low = await h.service.manageTeamInvitation(request({}), { email: "new@example.test", role: "Member", canManageFirm: true, canInviteMembers: true });
  check(low.invite.role, "Member", "Injected permission fields do not change delegated role");
}

// Same-origin writes, streaming size enforcement and fail-closed throttling.
{
  const h = harness();
  for (const headers of [{ origin: "https://evil.test" }, { "sec-fetch-site": "cross-site" }, { origin: "null" }]) await rejects(h.http.readTeamJson(request({}, undefined, headers)), "ORIGIN_REJECTED");
  await rejects(h.http.readTeamJson(new Request("https://slice.test/api/team-invites", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })), "ORIGIN_REJECTED");
  check(await h.http.readTeamJson(new Request("https://slice.test/api/team-invites", { method: "POST", headers: { "content-type": "application/json", "sec-fetch-site": "same-origin" }, body: "{\"safe\":true}" })), { safe: true });
  await rejects(h.http.readTeamJson(request({}, undefined, { "content-type": "text/plain" })), "JSON_REQUIRED");
  await rejects(h.http.readTeamJson(request({}, undefined, { "content-length": "999999" })), "BODY_TOO_LARGE");
  await rejects(h.http.readTeamJson(request({ message: "x".repeat(17000) })), "BODY_TOO_LARGE");
  await rejects(h.http.readTeamJson(request([])), "INVALID_JSON");
  await rejects(h.http.readTeamJson(new Request("https://slice.test/api/team-invites", { method: "POST", headers: { origin: "https://slice.test", "content-type": "application/json" }, body: "{" })), "INVALID_JSON");
  h.rateAllowed = false; await rejects(h.http.guardTeamRate(request({}), "fixture", "user", 1), "TEAM_RATE_LIMIT");
  check(h.rates.at(-1).failOpen, false);
}

// Create/renew/revoke preserve scoped state and expose new credentials only in
// the deliberate one-time creation result, never overview, lookup or audit.
{
  const h = harness(), route = h.load("src/app/api/team-invites/route.ts");
  const created = await (await route.POST(request({ email: "New@Example.Test", role: "Analyst", delivery: "link" }))).json();
  check([created.ok, created.inviteCreated, created.emailDelivered, created.delivery.status], [true, true, false, "link-only"]);
  const issuedCode = created.invite.inviteCode, stored = h.data.firmInvite[0];
  ok(/^[A-F0-9]{64}$/.test(issuedCode)); check(stored.inviteCode, h.service.invitationHash(issuedCode));
  check(new URL(created.invite.inviteLink).origin, "https://slice.test"); check(h.emails.length, 0, "Copy-link mode does not email anyone");
  ok(!JSON.stringify(h.data).includes(issuedCode), "Raw invitation code is never persisted");
  const overviewResponse = await route.GET(new Request("https://slice.test/api/team-invites")), overview = await overviewResponse.json();
  ok(overviewResponse.headers.get("cache-control").includes("no-store"));
  ok(!JSON.stringify(overview).includes(issuedCode) && !JSON.stringify(overview).includes("sha256:") && !JSON.stringify(overview).includes("passwordHash"));
  await errorResponse(route.POST(request({ email: "new@example.test", role: "Analyst" })), 409, "INVITATION_EXISTS");
  const renewed = await h.service.manageTeamInvitation(request({}), { action: "renew", inviteId: stored.id, delivery: "link", role: "Admin", email: "changed@example.test" });
  check([renewed.invite.email, renewed.invite.role], ["new@example.test", "Investment Analyst"], "Renew cannot secretly change recipient or role");
  ok(renewed.invite.inviteCode !== issuedCode); check(h.data.firmInvite[0].status, "Replaced");
  await rejects(h.service.lookupInvitation(issuedCode), "INVITATION_UNAVAILABLE");
  await rejects(h.service.manageTeamInvitation(request({}), { action: "revoke", inviteId: renewed.invite.id, firmId: "firm-b" }), "ACTIVE_FIRM_REQUIRED");
  const revoked = await h.service.manageTeamInvitation(request({}), { action: "revoke", inviteId: renewed.invite.id });
  check(revoked.revoked, true); ok(!JSON.stringify(revoked).includes(renewed.invite.inviteCode));
  await rejects(h.service.lookupInvitation(renewed.invite.inviteCode), "INVITATION_UNAVAILABLE");
  check(h.data.firmInvite[1].status, "Cancelled");
  ok(!JSON.stringify(h.data.auditLog).includes(issuedCode) && !JSON.stringify(h.audits).includes(issuedCode));
  await errorResponse(route.POST(request({ email: "other@example.test", role: "Owner" })), 400, "INVALID_INVITATION");
  await errorResponse(route.POST(request({ email: "sender@example.test", role: "Member" })), 400, "SELF_INVITATION");
}

// Reauthentication precedes elevated grants, and race-time membership/firm
// changes are checked inside the locked transaction before issuing a token.
{
  const h = harness();
  const result = await h.service.manageTeamInvitation(request({}), { email: "admin@example.test", role: "Admin", currentPassword: "PRIVATE_PASSWORD", factorCode: "123456" });
  check(h.reauths, [{ id: "sender", password: "PRIVATE_PASSWORD", factor: "123456" }]);
  ok(!JSON.stringify(result).includes("PRIVATE_PASSWORD") && !JSON.stringify(h.data).includes("PRIVATE_PASSWORD"));
  h.beforeTransaction = () => { h.data.firmMembership[0].status = "Removed"; };
  await rejects(h.service.manageTeamInvitation(request({}), { email: "next@example.test", role: "Member" }), "MEMBERSHIP_REQUIRED");
  check(h.data.firmInvite.length, 1);
}
{
  const h = harness(); h.beforeTransaction = () => { h.data.firm[0].platformStatus = "Suspended"; };
  await rejects(h.service.manageTeamInvitation(request({}), { email: "next@example.test", role: "Member" }), "FIRM_UNAVAILABLE"); check(h.data.firmInvite.length, 0);
}
{
  const h = harness(); h.beforeTransaction = () => { Object.assign(h.data.firmMembership[0], { role: "Member", ...h.contracts.teamRolePermissions("Member") }); };
  await rejects(h.service.manageTeamInvitation(request({}), { email: "next@example.test", role: "Member" }), "ROLE_NOT_ALLOWED"); check(h.data.firmInvite.length, 0);
}

// Email state is truthful, HTML is escaped, provider failures are sanitized, and
// links stay available even if a post-delivery audit service is unavailable.
for (const mode of ["sent", "simulated", "disabled", "failed", "throws"]) {
  const h = harness(); h.emailResult = { ok: mode === "sent", status: mode === "throws" ? "failed" : mode, provider: "Controlled email", error: mode === "failed" ? "SECRET_PROVIDER_ERROR" : undefined };
  if (mode === "throws") h.emailFailure = Error("SECRET_PROVIDER_ERROR");
  const result = await h.service.manageTeamInvitation(request({}), { email: "new@example.test", role: "Member", delivery: "email" });
  check(result.emailDelivered, mode === "sent"); check(result.delivery.status, mode === "throws" ? "failed" : mode);
  ok(result.invite.inviteLink && h.data.firmInvite.length === 1); check(h.emails.length, 1);
  ok(!h.emails[0].html.includes("<script>") && h.emails[0].html.includes("&lt;Firm&gt;"), "Email includes escaped display names");
  ok(!JSON.stringify(result).includes("SECRET_PROVIDER_ERROR"));
}
{
  const h = harness(); h.auditFailure = Error("Delivery audit offline");
  const result = await h.service.manageTeamInvitation(request({}), { email: "new@example.test", role: "Member", delivery: "email" });
  ok(result.invite.inviteLink && result.emailDelivered, "Post-email audit failure must not lose the only plaintext link");
}
{
  const h = harness(); h.beforeCreate = model => { if (model === "auditLog") throw Error("Transactional audit failure"); };
  await assert.rejects(h.service.manageTeamInvitation(request({}), { email: "new@example.test", role: "Member", delivery: "email" }), /Transactional audit failure/); checks++;
  check([h.data.firmInvite.length, h.emails.length], [0, 0], "Failed transactional creation audit rolls back before any email is submitted");
}

// Acceptance binds email, firm, role, sender's current authority and a single
// pending code. Suspended memberships are never silently reactivated.
for (const [alter, code] of [
  [h => { h.data.firm[0].platformStatus = "Suspended"; }, "FIRM_UNAVAILABLE"],
  [h => { h.data.user.find(u => u.id === "recipient").platformStatus = "Suspended"; }, "INVITATION_RECIPIENT_MISMATCH"],
  [h => { h.data.user.find(u => u.id === "recipient").email = "wrong@example.test"; }, "INVITATION_RECIPIENT_MISMATCH"],
  [h => { h.data.user.find(u => u.id === "sender").platformStatus = "Banned"; }, "INVITER_ACCESS_CHANGED"],
  [h => { h.data.firmMembership[0].status = "Removed"; }, "INVITER_ACCESS_CHANGED"],
  [h => { Object.assign(h.data.firmMembership[0], { role: "Member", ...h.contracts.teamRolePermissions("Member") }); }, "INVITER_ACCESS_CHANGED"],
  [h => { h.member("recipient", "Member", { status: "Removed" }); }, "MEMBER_EXISTS"],
  [h => { h.data.firmInvite[0].expiresAt = new Date(NOW); }, "INVITATION_EXPIRED"],
]) {
  const h = harness(); h.seedInvite(); alter(h);
  await rejects(h.service.acceptTeamInvitation({ code: token, userId: "recipient", request: request({}) }), code);
  check(h.data.firmInvite[0].status, "Pending", "Rejected acceptance does not consume invitation");
  check(h.data.firmMembership.filter(m => m.userId === "recipient" && m.status === "Active").length, 0);
}
{
  const h = harness(); h.seedInvite(); const attempts = await Promise.allSettled([1, 2].map(() => h.service.acceptTeamInvitation({ code: token, userId: "recipient", request: request({}) })));
  check(attempts.map(item => item.status).sort(), ["fulfilled", "rejected"], "Only one concurrent acceptance succeeds");
  check(h.data.firmMembership.filter(row => row.userId === "recipient").length, 1); check(h.data.firmInvite[0].status, "Accepted");
  check(h.data.namedWatchlist.length, 1); check(h.data.userSecuritySetting[0].advisorModeEnabled, true);
  await rejects(h.service.acceptTeamInvitation({ code: token, userId: "recipient", request: request({}) }), "INVITATION_UNAVAILABLE");
}
{
  const h = harness(); h.seedInvite(); h.beforeTransaction = () => { h.data.firmInvite[0].inviteCode = h.service.invitationHash("EF".repeat(32)); };
  await rejects(h.service.acceptTeamInvitation({ code: token, userId: "recipient", request: request({}) }), "INVITATION_CHANGED"); check(h.data.firmMembership.length, 1);
}
{
  const h = harness(); h.seedInvite({ email: "new@example.test" });
  h.beforeCreate = model => { if (model === "auditLog") throw Error("Audit failure"); };
  await assert.rejects(h.service.acceptTeamInvitation({ code: token, newAccount: { name: "New Person", passwordHash: hashPassword("new account passphrase") }, request: request({}) }), /Audit failure/); checks++;
  check([h.data.user.length, h.data.firmMembership.length, h.data.firmInvite[0].status, h.data.namedWatchlist.length], [2, 1, "Pending", 0], "Acceptance failure rolls back user, membership, invite claim and defaults together");
}

// Anonymous signup uses the same acceptance service, password policy and MFA
// gate. Credentials remain out of JSON responses, durable logs and list APIs.
{
  const h = harness(); h.seedInvite(); h.mfa.add("recipient");
  const route = h.load("src/app/api/auth/invite-register/route.ts");
  const post = patch => route.POST(request({ inviteCode: token, password: "legacy-password", ...patch }, "/api/auth/invite-register"));
  await errorResponse(post({ password: "wrong" }), 401, "ACCOUNT_VERIFICATION_FAILED");
  await errorResponse(post({}), 401, "MFA_REQUIRED"); h.factorValid = false;
  await errorResponse(post({ factorCode: "000000" }), 401, "MFA_INVALID");
  check([h.data.firmInvite[0].status, h.sessions.length], ["Pending", 0]); h.factorValid = true;
  const response = await post({ factorCode: "123456" }), body = await response.json();
  check(response.status, 200); check(h.sessions[0].mfaVerified, true); check(body.user.id, "recipient");
  check([h.sessions[0].expectedPasswordHash, h.sessions[0].authenticationStartedAt?.getTime()], [hashPassword("legacy-password"), NOW], "Session creation receives the password version and server-side authentication start");
  const cookie = response.headers.get("set-cookie") ?? "";
  ok(cookie.includes("slice_session=SESSION_SECRET_IN_COOKIE_ONLY") && /HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /SameSite=Strict/i.test(cookie));
  ok(!JSON.stringify(body).includes("SESSION_SECRET") && !JSON.stringify(body).includes("passwordHash") && !JSON.stringify(body).includes(token));
  ok(!JSON.stringify(h.data.auditLog).includes("legacy-password") && !JSON.stringify(h.logs).includes("legacy-password"));
  check(h.data.user.find(user => user.id === "recipient").passwordHash, hashPassword("legacy-password"), "Existing account credentials are never overwritten by acceptance");
}
{
  const h = harness(); h.seedInvite({ email: "new@example.test" }); const route = h.load("src/app/api/auth/invite-register/route.ts");
  const post = patch => route.POST(request({ inviteCode: token, password: "a valid long passphrase", name: "New Member", ...patch }, "/api/auth/invite-register"));
  await errorResponse(post({ password: "short" }), 400, "PASSWORD_REQUIREMENTS");
  await errorResponse(post({ password: "x".repeat(129) }), 400, "PASSWORD_REQUIREMENTS");
  await errorResponse(post({ password: " ".repeat(20) }), 400, "PASSWORD_REQUIREMENTS");
  await errorResponse(post({ name: "" }), 400, "NAME_REQUIRED");
  await errorResponse(post({ name: "Bad\u0000Name" }), 400, "NAME_REQUIRED");
  await errorResponse(post({ role: "Admin" }), 400, "INVALID_INPUT");
  const response = await post({}), body = await response.json(); check(response.status, 200);
  const user = h.data.user.find(item => item.email === "new@example.test");
  check(user.passwordHash, hashPassword("a valid long passphrase")); check(body.membership.role, "Investment Analyst"); check(h.sessions[0].mfaVerified, false);
  check([h.sessions[0].expectedPasswordHash, h.sessions[0].authenticationStartedAt?.getTime()], [user.passwordHash, NOW], "New-account sessions are also tied to their freshly stored credentials");
  ok(!JSON.stringify(body).includes("passphrase") && !JSON.stringify(body).includes("passwordHash"));
}
{
  const h = harness(); h.seedInvite({ email: "founder@slice.test" }); const route = h.load("src/app/api/auth/invite-register/route.ts");
  await errorResponse(route.POST(request({ inviteCode: token, password: "a valid long passphrase", name: "Founder" }, "/api/auth/invite-register")), 403, "RESERVED_ACCOUNT");
  await rejects(h.service.acceptTeamInvitation({ code: token, newAccount: { name: "Founder", passwordHash: hashPassword("a valid long passphrase") }, request: request({}) }), "RESERVED_ACCOUNT");
  check([h.data.user.length, h.data.firmInvite[0].status], [2, "Pending"]);
}
{
  const h = harness(); h.seedInvite();
  h.beforeTransaction = () => { h.data.user.find(user => user.id === "recipient").passwordHash = hashPassword("changed concurrently by owner"); };
  const route = h.load("src/app/api/auth/invite-register/route.ts");
  const response = await route.POST(request({ inviteCode: token, password: "legacy-password" }, "/api/auth/invite-register")), body = await response.json();
  check(body.error?.code, "ACCOUNT_CREDENTIALS_CHANGED", "Password rotation during invite acceptance rejects the earlier credential proof");
  ok(response.status === 401 || response.status === 409);
  check([h.data.firmInvite[0].status, h.data.firmMembership.length, h.sessions.length], ["Pending", 1, 0], "Concurrent credential changes do not consume the invite, add membership, or issue a session");
}

// Public token lookup exposes only useful invitation context, and ordinary
// anonymous GET requests cannot turn the public lookup route into a team list.
{
  const h = harness(); h.seedInvite(); h.mfa.add("recipient"); h.currentUser = null;
  const route = h.load("src/app/api/team-invites/send/route.ts");
  const response = await route.GET(new Request(`https://slice.test/api/team-invites/send?code=${token}`)), body = await response.json();
  check(body.invite.emailMasked, "re***@example.test"); check([body.invite.existingAccount, body.invite.mfaRequired], [true, true]);
  ok(!JSON.stringify(body).includes("recipient@example.test") && !JSON.stringify(body).includes(token) && !JSON.stringify(body).includes("passwordHash"));
  check(response.headers.get("referrer-policy"), "no-referrer");
  await errorResponse(route.GET(new Request("https://slice.test/api/team-invites/send")), 401, "AUTHENTICATION_REQUIRED");
}

// Middleware permits invitation redemption before an account exists, protects
// writes, preserves legacy links and keeps credentials out of referrer headers.
{
  const h = harness(), { middleware } = h.load("src/middleware.ts");
  const invoke = (pathname, options = {}) => middleware(new NextRequest(`https://slice.test${pathname}`, options));
  const page = invoke(`/team-invite?code=${token}`); check(page.status, 200); check(page.headers.get("referrer-policy"), "no-referrer"); ok(page.headers.get("cache-control").includes("no-store"));
  const old = invoke(`/workspace/team-invite?code=${legacyToken}`); check(old.status, 307); check(new URL(old.headers.get("location")).pathname, "/team-invite"); check(new URL(old.headers.get("location")).searchParams.get("code"), legacyToken);
  check(invoke(`/api/team-invites/send?code=${token}`).status, 200);
  check(invoke("/api/team-invites").status, 401);
  check(invoke("/api/team-invites/send", { method: "POST", headers: { origin: "https://slice.test" } }).status, 401);
  check(invoke("/api/auth/invite-register", { method: "POST", headers: { origin: "https://slice.test" } }).status, 200);
  check(invoke("/api/auth/invite-register", { method: "POST", headers: { origin: "https://evil.test" } }).status, 403);
  check(new URL(invoke("/workspace").headers.get("location")).pathname, "/founder-login");
}

// Existing firm routes go through the same invitation boundary. Their payloads
// contain selected public user fields and never reusable invite credentials.
for (const routeFile of ["src/app/api/firm-workspace/route.ts", "src/app/api/firm-workspace/access/route.ts"]) {
  const h = harness(); h.seedInvite(); const route = h.load(routeFile);
  const response = await route.GET(new Request("https://slice.test/api/firm-workspace?firmId=firm-a")), body = await response.json();
  check(response.status, 200);
  ok(!JSON.stringify(body).includes("passwordHash") && !JSON.stringify(body).includes(token) && !JSON.stringify(body).includes("sha256:"), "Legacy team listings no longer expose passwords or reusable invitations");
  await errorResponse(route.POST(request({ firmId: "firm-a", action: routeFile.includes("/access/") ? "inviteFirmUser" : "inviteMember", email: "new@example.test", role: "Owner" })), 400, "INVALID_INVITATION");
  const crossOrigin = await route.POST(request({ firmId: "firm-a", action: "inviteMember", email: "new@example.test" }, undefined, { origin: "https://evil.test" })); check(crossOrigin.status, 403);
}

// Misconfigured public origins fail safely, and revocation must recheck active
// authority/firm status inside the same lock as creation and acceptance.
{
  const h = harness();
  for (const origin of ["https://", "javascript:alert(1)", "http://public.example.test", "https://user:password@slice.test", "https://slice.test?leak=1"]) {
    h.env.NEXT_PUBLIC_APP_URL = origin;
    throws(() => h.service.invitationOrigin(request({})), "APP_URL_REQUIRED");
  }
  delete h.env.NEXT_PUBLIC_APP_URL;
  throws(() => h.service.invitationOrigin(request({})), "APP_URL_REQUIRED");
  check(h.service.invitationOrigin(new Request("http://localhost:3000/api/team-invites")), "http://localhost:3000");
}
for (const [alter, code] of [
  [h => { h.data.firm[0].platformStatus = "Suspended"; }, "MEMBERSHIP_REQUIRED"],
  [h => { h.data.firmMembership[0].status = "Removed"; }, "MEMBERSHIP_REQUIRED"],
]) {
  const h = harness(); const invite = h.seedInvite(); h.beforeTransaction = () => alter(h);
  await rejects(h.service.manageTeamInvitation(request({}), { action: "revoke", inviteId: invite.id }), code);
  check(h.data.firmInvite[0].status, "Pending"); ok(h.locks > 0);
}

// Both old member-control panels now call the central, reauthenticated access
// service. Own/owner permissions and grants beyond the actor are protected.
{
  const h = harness(), members = h.load("src/lib/team/memberships.ts");
  const current = { role: "Investment Analyst", ...h.contracts.teamRolePermissions("Investment Analyst") };
  check(members.planMemberUpdate(current, { calendarColor: "#ffffff" }), current, "Unrelated display edits do not reset permissions");
  throws(() => members.planMemberUpdate(current, { role: "Owner" }), "ROLE_NOT_ALLOWED");
  throws(() => members.planMemberUpdate(current, { role: "Founder" }), "ROLE_NOT_ALLOWED");
  throws(() => members.planMemberUpdate(current, { role: "Arbitrary executive title" }), "ROLE_NOT_ALLOWED");
  throws(() => members.planMemberUpdate(current, { canManageFirm: "true" }), "INVALID_PERMISSION");
  h.member("recipient", "Investment Analyst");
  const invoke = (patch, action = "update") => members.changeTeamMember(request({}), { firmId: "firm-a", membershipId: "membership-recipient", currentPassword: "REAUTH_SECRET", factorCode: "123456", ...patch }, action);
  const result = await invoke({ canManageProjects: true, calendarColor: "#aabbcc" });
  check([result.canManageProjects, result.calendarColor], [true, "#aabbcc"]); check(h.reauths.length, 1);
  ok(!JSON.stringify(result).includes("passwordHash") && !JSON.stringify(h.data.auditLog).includes("REAUTH_SECRET"));
  await rejects(invoke({ membershipId: "membership-sender" }), "SELF_ACCESS_PROTECTED");
  h.data.firmMembership.find(row => row.userId === "recipient").role = "Owner";
  await rejects(invoke({}, "remove"), "OWNER_PROTECTED");
  h.data.firmMembership.find(row => row.userId === "recipient").role = "Investment Analyst";
  h.data.firm[0].createdByUserId = "recipient";
  await rejects(invoke({ canManageFirm: true }), "OWNER_PROTECTED");
  delete h.data.firm[0].createdByUserId;
  h.beforeTransaction = () => { h.data.firm[0].platformStatus = "Suspended"; };
  await rejects(invoke({ canManageFirm: true }), "FIRM_UNAVAILABLE");
}
{
  const h = harness(), members = h.load("src/lib/team/memberships.ts");
  Object.assign(h.data.firmMembership[0], { role: "Member", canAccessPortfolios: true, canManageProjects: true, canManageFirm: true, canInviteMembers: true });
  h.member("recipient", "Member");
  await rejects(members.changeTeamMember(request({}), { firmId: "firm-a", membershipId: "membership-recipient", role: "Associate Advisor" }, "update"), "ROLE_NOT_ALLOWED", "A limited firm manager cannot grant missing client-management authority");
  h.data.firmMembership.find(row => row.userId === "recipient").role = "Associate Advisor";
  await rejects(members.changeTeamMember(request({}), { firmId: "firm-a", membershipId: "membership-recipient" }, "remove"), "ROLE_NOT_ALLOWED", "A manager cannot remove a target whose permissions exceed theirs");
}
{
  const h = harness(), members = h.load("src/lib/team/memberships.ts");
  h.member("recipient", "Chief Compliance Officer");
  const sent = h.seedInvite({ sentByUserId: "recipient", email: "future@example.test" });
  h.data.personalAdvisorBot = [{ id: "same-firm", userId: "recipient", firmId: "firm-a", status: "Active" }, { id: "other-firm", userId: "recipient", firmId: "firm-b", status: "Active" }];
  const result = await members.changeTeamMember(request({}), { firmId: "firm-a", membershipId: "membership-recipient" }, "remove");
  check([result.status, result.canInviteMembers, result.canManageFirm], ["Removed", false, false]);
  check(h.data.firmInvite.find(row => row.id === sent.id).status, "Cancelled");
  check(h.data.personalAdvisorBot.map(row => row.status), ["Paused", "Active"], "Removal affects bots and pending invitations only in the selected firm");
}
{
  const h = harness(), members = h.load("src/lib/team/memberships.ts"); h.member("recipient", "Member"); h.seedInvite({ sentByUserId: "recipient" });
  h.data.personalAdvisorBot = [{ id: "bot", userId: "recipient", firmId: "firm-a", status: "Active" }];
  h.beforeCreate = model => { if (model === "auditLog") throw Error("Access audit unavailable"); };
  await assert.rejects(members.changeTeamMember(request({}), { firmId: "firm-a", membershipId: "membership-recipient" }, "remove"), /Access audit unavailable/); checks++;
  check([h.data.firmMembership.find(row => row.userId === "recipient").status, h.data.firmInvite[0].status, h.data.personalAdvisorBot[0].status], ["Active", "Pending", "Active"], "Removal and related revocations roll back together if mandatory audit fails");
}
for (const [file, action] of [["src/app/api/firm-workspace/route.ts", "updateMember"], ["src/app/api/firm-workspace/access/route.ts", "updateMemberAccess"]]) {
  const h = harness(); h.member("recipient", "Member"); const route = h.load(file);
  await errorResponse(route.POST(request({ action, firmId: "firm-a", membershipId: "membership-recipient", role: "Owner", currentPassword: "REAUTH_SECRET" })), 400, "ROLE_NOT_ALLOWED");
  check(h.reauths[0].password, "REAUTH_SECRET", "Legacy mutation uses central reauthentication");
  const response = await route.POST(request({ action, firmId: "firm-a", membershipId: "membership-recipient", role: "Investment Analyst", canAccessPortfolios: true, currentPassword: "REAUTH_SECRET" }));
  check(response.status, 200); check(h.data.firmMembership.find(row => row.userId === "recipient").role, "Investment Analyst");
  h.beforeTransaction = () => { h.data.firmMembership.find(row => row.userId === "sender").status = "Removed"; };
  await errorResponse(route.POST(request({ action, firmId: "firm-a", membershipId: "membership-recipient", canManageFirm: true })), 403, "MEMBERSHIP_REQUIRED");
}

console.log(`Team invitations: ${checks} deterministic checks passed.`);
