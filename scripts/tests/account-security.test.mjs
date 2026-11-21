import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createHash, pbkdf2Sync } from "node:crypto";
import ts from "typescript";

// Execute production crypto, authentication, and routes with a deterministic
// clock and an in-memory Prisma boundary. No browser, database, or network.
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
let now = Date.parse("2026-11-19T12:00:00Z"), checks = 0;
class Clock extends Date { constructor(...args) { if (args.length) super(...args); else super(now); } static now() { return now; } }
const clone = value => structuredClone(value);
const json = value => JSON.parse(JSON.stringify(value));
const check = (actual, expected, message) => { assert.deepEqual(json(actual), expected, message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const rejects = async (work, code) => { await assert.rejects(work, error => error.code === code, code); checks++; };
class ApiError extends Error { constructor(input) { super(input.message); Object.assign(this, input); } }
const api = { ApiError, apiJson: (body, init) => Response.json(body, init), withApiRoute: (_options, handler) => request => handler({ request, log: { error() {} } }) };
const quiet = { info() {}, warn() {}, error() {} };
const initialPassword = "a long unique test passphrase";
const initialHash = `fixture-salt:${pbkdf2Sync(initialPassword, "fixture-salt", 120000, 64, "sha512").toString("hex")}`;

function modules(mocks, env = {}) {
  const cache = new Map(), context = vm.createContext({ console, Date: Clock, Buffer, Request, Response, Headers, URL, AbortController, Uint8Array, TextDecoder, TextEncoder, process: { env }, setTimeout, clearTimeout, performance, structuredClone });
  function load(file) {
    let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
    if (!path.extname(absolute)) absolute += ".ts";
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load(name);
      if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), name));
      if (name.startsWith("node:") || name === "crypto") return nativeRequire(name);
      throw new Error(`Unexpected external dependency: ${name}`);
    };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename: absolute })(require, module, module.exports);
    return module.exports;
  }
  return load;
}
const scalar = value => value instanceof Date ? value.getTime() : value;
function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    if (key === "OR") return expected.some(part => matches(row, part));
    const value = row[key];
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      return Object.entries(expected).every(([operator, operand]) => {
        if (operator === "in") return operand.includes(value);
        if (operator === "not") return scalar(value) !== scalar(operand);
        if (value === null || value === undefined) return false;
        if (operator === "gt") return scalar(value) > scalar(operand);
        if (operator === "gte") return scalar(value) >= scalar(operand);
        if (operator === "lt") return scalar(value) < scalar(operand);
        if (operator === "lte") return scalar(value) <= scalar(operand);
        throw new Error(`Unsupported predicate ${operator}`);
      });
    }
    return scalar(value) === scalar(expected);
  });
}
function readRows(rows, query = {}) {
  let values = rows.filter(row => matches(row, query.where));
  if (query.orderBy) values = values.sort((a, b) => {
    for (const [key, direction] of Object.entries(query.orderBy)) if (scalar(a[key]) !== scalar(b[key])) return (scalar(a[key]) < scalar(b[key]) ? -1 : 1) * (direction === "desc" ? -1 : 1);
    return 0;
  });
  if (query.skip) values = values.slice(query.skip);
  if (query.take !== undefined) values = values.slice(0, query.take);
  return clone(values.map(row => query.select ? Object.fromEntries(Object.keys(query.select).filter(key => query.select[key]).map(key => [key, row[key]])) : row));
}
function harness() {
  const h = { env: { MFA_ENCRYPTION_KEY: "3b".repeat(32), NODE_ENV: "test" }, cookie: "current-browser-token", rows: { user: [], userSecuritySetting: [], userAuthenticator: [], session: [], auditLog: [] }, queries: [], limits: [], sequence: 0 };
  const defaults = model => model === "userAuthenticator" ? { secretEncrypted: null, pendingSecretEncrypted: null, pendingExpiresAt: null, enabledAt: null, lastUsedStep: null, recoveryCodeHashesJson: "[]" } : model === "userSecuritySetting" ? { mfaEnabled: false, sessionTimeoutMinutes: 720, idleTimeoutMinutes: 30, lastSecurityReviewAt: null, requireReauthForSensitiveActions: true, alertOnNewLogin: true, advisorModeEnabled: false } : {};
  const prisma = {};
  for (const model of Object.keys(h.rows)) {
    prisma[model] = {
      async findUnique(query) { if (h.schemaMissing && model === "userAuthenticator") throw { code: "P2021" }; h.queries.push({ model, action: "read", query: clone(query) }); return readRows(h.rows[model], { ...query, take: 1 })[0] ?? null; },
      async findFirst(query) {
        if (h.schemaMissing && model === "session") throw { code: "P2022" };
        const row = readRows(h.rows[model], { ...query, take: 1 })[0] ?? null;
        if (row && model === "session" && query.include?.user) {
          row.user = clone(h.rows.user.find(user => user.id === row.userId));
          row.user.securitySetting = clone(h.rows.userSecuritySetting.find(setting => setting.userId === row.userId) ?? null);
          const factor = h.rows.userAuthenticator.find(factor => factor.userId === row.userId);
          row.user.authenticator = factor ? { enabledAt: clone(factor.enabledAt) } : null;
        }
        return row;
      },
      async findMany(query = {}) { h.queries.push({ model, action: "read", query: clone(query) }); return readRows(h.rows[model], query); },
      async create({ data }) {
        if (model === "auditLog" && h.auditFails) throw new Error("Audit storage unavailable");
        const row = { ...defaults(model), id: `${model}-${++h.sequence}`, createdAt: new Date(now), updatedAt: new Date(now), ...clone(data) }; h.rows[model].push(row); return clone(row);
      },
      async updateMany(input) {
        await h.beforeUpdate?.(model, input);
        const rows = h.rows[model].filter(row => matches(row, input.where));
        for (const row of rows) Object.assign(row, clone(input.data));
        h.queries.push({ model, action: "update", query: clone(input), count: rows.length }); return { count: rows.length };
      },
      async update(input) { const result = await this.updateMany(input); if (result.count !== 1) throw new Error("Missing row"); return this.findUnique({ where: input.where }); },
      async upsert(input) {
        const row = h.rows[model].find(row => matches(row, input.where));
        if (row) { Object.assign(row, clone(input.update)); return clone(row); }
        return this.create({ data: input.create });
      },
      async deleteMany({ where }) { const before = h.rows[model].length; h.rows[model] = h.rows[model].filter(row => !matches(row, where)); h.queries.push({ model, action: "delete", query: clone(where) }); return { count: before - h.rows[model].length }; },
    };
  }
  prisma.firmMembership = { async findFirst() { return { id: "member-a", firmId: "firm-a", role: "Owner", firm: { id: "firm-a", name: "Example firm", platformStatus: "Active" } }; } };
  // Model transactional write-lock ordering so failed concurrent CAS operations
  // cannot roll back a competing transaction's committed state in this fixture.
  let transactionTail = Promise.resolve();
  prisma.$transaction = async work => {
    const previous = transactionTail; let release; transactionTail = new Promise(resolve => { release = resolve; }); await previous;
    const before = clone(h.rows);
    try { return await work(prisma); } catch (error) { h.rows = before; throw error; } finally { release(); }
  };
  prisma.$queryRaw = async (_query, userId) => { await h.beforeLock?.(userId); return [{ id: userId }]; };
  const mocks = {
    "@/lib/api-route": api,
    "@/lib/prisma": { prisma },
    "@/lib/logger": { createLogger: () => quiet },
    "@/lib/founder-access": { isFounderEmail: () => false, canUseTemporaryFounderBootstrap: () => false },
    "@/lib/audit": {
      async ensureUserSecuritySetting(userId) { return prisma.userSecuritySetting.upsert({ where: { userId }, create: { userId }, update: {} }); },
      async getDisclosureStatus() { return []; },
    },
    "next/headers": { async cookies() { return { get: name => name === "slice_session" && h.cookie ? { value: h.cookie } : undefined }; } },
    "next/server": { NextResponse: { json(body, init) { const response = Response.json(body, init); response.cookies = { set(name, value, options) { response.headers.append("set-cookie", `${name}=${value}; Expires=${options.expires.toUTCString()}; HttpOnly; SameSite=${options.sameSite}; Path=${options.path}${options.secure ? "; Secure" : ""}`); } }; return response; } } },
    "@/lib/rate-limit": {
      async consumeRateLimit(input) { h.limits.push(clone(input)); return { allowed: !h.blockRate, retryAfterSeconds: h.blockRate ? 900 : 0, remaining: 10, limit: input.limit, resetAt: new Date(now + 900000), scope: input.scope }; },
      rateLimitHeaders: () => ({ "x-ratelimit-limit": "10" }), async resetRateLimit() {},
    },
  };
  h.load = modules(mocks, h.env); h.auth = h.load("src/lib/auth.ts"); h.crypto = h.load("src/lib/account-security/crypto.ts"); h.service = h.load("src/lib/account-security/service.ts"); h.policy = h.load("src/lib/account-security/policy.ts");
  h.rows.user.push({ id: "owner-a", name: "Account owner", email: "owner@example.test", passwordHash: initialHash, platformStatus: "Active", createdAt: new Date(now - 600000) });
  h.rows.userSecuritySetting.push({ id: "setting-a", userId: "owner-a", ...defaults("userSecuritySetting") });
  h.session = (id, userId = "owner-a", options = {}) => ({ id, userId, tokenHash: createHash("sha256").update(id === "current" ? h.cookie : id).digest("hex"), createdAt: new Date(now - 300000), lastSeenAt: new Date(now - 5000), expiresAt: new Date(now + 3600000), mfaVerifiedAt: null, userAgent: "Firefox/Linux", ...options });
  h.rows.session = [h.session("current"), h.session("other"), h.session("foreign", "other-owner")];
  h.enroll = (userId = "owner-a") => {
    const secret = h.crypto.createAuthenticatorSecret(), recovery = h.crypto.createRecoveryCodes(userId);
    const record = { ...defaults("userAuthenticator"), id: `factor-${userId}`, userId, enabledAt: new Date(now - 200000), secretEncrypted: h.crypto.encryptAuthenticatorSecret(secret, userId), recoveryCodeHashesJson: JSON.stringify(recovery.hashes) };
    h.rows.userAuthenticator.push(record);
    for (const session of h.rows.session.filter(session => session.userId === userId)) session.mfaVerifiedAt = new Date(now - 100000);
    return { secret, recovery, record };
  };
  h.request = (body, options = {}) => new Request("https://slice.example/api/security/test", { method: "POST", headers: { "content-type": "application/json", origin: "https://slice.example", "sec-fetch-site": "same-origin", "user-agent": "Firefox/Linux", ...options.headers }, body: JSON.stringify(body), ...options });
  h.route = (name, body, method = "POST") => h.load(`src/app/api/security/${name}/route.ts`)[method](h.request(body, { method }));
  return h;
}

// Published RFC 6238 SHA-1 vectors, interoperable authenticator window, and replay.
{
  const h = harness(), c = h.crypto, secret = c.base32Encode(Buffer.from("12345678901234567890"));
  for (const [seconds, expected] of [[59,"94287082"],[1111111109,"07081804"],[1111111111,"14050471"],[1234567890,"89005924"],[2000000000,"69279037"],[20000000000,"65353130"]]) check(c.totpCode(secret, Math.floor(seconds / 30), 8), expected, "RFC 6238 published vector");
  check(c.base32Decode(secret).toString(), "12345678901234567890", "Base32 setup keys round trip");
  const step = Math.floor(now / 30000), code = c.totpCode(secret, step);
  check(c.matchingTotpStep(secret, code, now), step);
  check(c.matchingTotpStep(secret, c.totpCode(secret, step - 1), now), step - 1);
  check(c.matchingTotpStep(secret, c.totpCode(secret, step + 1), now), step + 1);
  check(c.matchingTotpStep(secret, code, now, step), null, "Consumed time steps cannot be replayed");
  check(c.matchingTotpStep(secret, c.totpCode(secret, step - 2), now), null);
  check(c.matchingTotpStep(secret, "12a456", now), null);
  check(c.matchingTotpStep(secret, "1".repeat(1000), now), null);
  const encrypted = c.encryptAuthenticatorSecret(secret, "owner-a");
  check(c.decryptAuthenticatorSecret(encrypted, "owner-a"), secret);
  ok(encrypted !== c.encryptAuthenticatorSecret(secret, "owner-a"), "Each encryption uses a fresh nonce");
  assert.throws(() => c.decryptAuthenticatorSecret(encrypted, "other-owner")); checks++;
  assert.throws(() => c.decryptAuthenticatorSecret(encrypted.slice(0, -2) + "ff", "owner-a")); checks++;
  h.env.MFA_ENCRYPTION_KEY = ""; check(c.mfaEncryptionConfigured(), false);
  assert.throws(() => c.encryptAuthenticatorSecret(secret, "owner-a"), error => error.code === "MFA_CONFIGURATION_REQUIRED"); checks++;
  h.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64"); check(c.mfaEncryptionConfigured(), true);
  const recovery = c.createRecoveryCodes("owner-a");
  check(new Set(recovery.codes).size, 10); ok(recovery.codes.every(value => /^[A-F0-9]{6}(-[A-F0-9]{6}){3}$/.test(value)));
  ok(recovery.hashes.every(value => /^[a-f0-9]{64}$/.test(value))); ok(c.recoveryCodeHash(recovery.codes[0], "owner-a") !== c.recoveryCodeHash(recovery.codes[0], "other-owner"));
  check(c.parseRecoveryHashes("[\"raw-code\"]"), []);
}

// Security policy does not weaken an existing server limit and binds MFA sessions.
{
  const h = harness(), p = h.policy, session = h.session("current");
  check(p.passwordProblem("short"), "Use a password or passphrase with 15–128 characters. Spaces and password managers are supported.");
  check(p.passwordProblem("a much longer passphrase with spaces"), null);
  ok(p.passwordProblem(" ".repeat(20))); ok(p.passwordProblem("x".repeat(129)));
  check(p.sessionLifetimeMinutes(43200, 12), 720); check(p.sessionLifetimeMinutes(15, 12), 15); check(p.idleLifetimeMinutes(-1), 30);
  check(p.sessionIsExpired(session, {}, now), false);
  check(p.sessionIsExpired({ ...session, expiresAt: new Date(now) }, {}, now), true);
  check(p.sessionIsExpired({ ...session, createdAt: new Date(now - 16 * 60000) }, { sessionTimeoutMinutes: 15 }, now), true);
  check(p.sessionIsExpired({ ...session, lastSeenAt: new Date(now - 30 * 60000) }, {}, now), true);
  check(p.sessionIsExpired({ ...session, createdAt: new Date(now + 120000) }, {}, now), true);
  check(p.sessionIsExpired(session, { mfaEnabledAt: new Date(now - 1000) }, now), true);
  check(p.sessionIsExpired({ ...session, mfaVerifiedAt: new Date(now - 500) }, { mfaEnabledAt: new Date(now - 1000) }, now), false);
  check(p.sessionIsExpired({ ...session, mfaVerifiedAt: new Date("invalid") }, { mfaEnabledAt: new Date(now - 1000) }, now), true);
}

// Real service verifies atomically: concurrent attempts, recovery replay, ownership.
{
  const h = harness(), { secret, recovery } = h.enroll(), code = h.crypto.totpCode(secret, Math.floor(now / 30000));
  check(await h.service.accountHasMfa("owner-a"), true); check(await h.service.accountHasMfa("other-owner"), false);
  check((await Promise.all([h.service.verifyAccountSecondFactor("owner-a", code), h.service.verifyAccountSecondFactor("owner-a", code)])).sort(), [false,true], "A concurrent TOTP replay succeeds once");
  check(await h.service.verifyAccountSecondFactor("owner-a", code), false);
  check(await h.service.verifyAccountSecondFactor("other-owner", recovery.codes[0]), false);
  check((await Promise.all([h.service.verifyAccountSecondFactor("owner-a", recovery.codes[0]), h.service.verifyAccountSecondFactor("owner-a", recovery.codes[0])])).sort(), [false,true], "A concurrent recovery-code replay succeeds once");
  check(await h.service.verifyAccountSecondFactor("owner-a", recovery.codes[0]), false);
  check(h.crypto.parseRecoveryHashes(h.rows.userAuthenticator[0].recoveryCodeHashesJson).length, 9);
  h.env.MFA_ENCRYPTION_KEY = "";
  check(await h.service.verifyAccountSecondFactor("owner-a", recovery.codes[1]), true, "Recovery does not require decrypting a lost authenticator seed");
}

// Owner verification, rate-limit failure, same-origin, and streamed request bounds.
{
  const h = harness(), request = h.request({});
  await rejects(h.service.requireAccountReauthentication("owner-a", "wrong", null, request), "REAUTHENTICATION_FAILED");
  check(h.rows.auditLog.at(-1).eventType, "security.reauthentication.failed");
  await h.service.requireAccountReauthentication("owner-a", initialPassword, null, request); checks++;
  const { recovery } = h.enroll();
  await rejects(h.service.requireAccountReauthentication("owner-a", initialPassword, "wrong", request), "MFA_REQUIRED");
  await h.service.requireAccountReauthentication("owner-a", initialPassword, recovery.codes[0], request); checks++;
  ok(h.limits.every(input => input.failOpen === false), "Sensitive checks explicitly fail closed");
  h.blockRate = true; await rejects(h.service.requireAccountReauthentication("owner-a", initialPassword, recovery.codes[1], request), "SECURITY_RATE_LIMIT");
  check(h.crypto.parseRecoveryHashes(h.rows.userAuthenticator[0].recoveryCodeHashesJson).length, 9, "A blocked rate limit does not consume a factor");
  await rejects(h.service.securityContext(h.request({}, { headers: { origin: "https://attacker.example", "x-forwarded-host": "attacker.example", "content-type": "application/json" } }), true), "CROSS_SITE_REQUEST");
  await rejects(h.service.securityContext(h.request({}, { headers: { "content-type": "application/json" } }), true), "CROSS_SITE_REQUEST");
  check(await h.service.securityJson(request), {});
  await rejects(h.service.securityJson(new Request("https://slice.example", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" })), "JSON_REQUIRED");
  await rejects(h.service.securityJson(h.request({ large: "x".repeat(9000) })), "BODY_TOO_LARGE");
  await rejects(h.service.securityJson(h.request([])), "INVALID_BODY");
  h.schemaMissing = true; await rejects(h.service.accountHasMfa("owner-a"), "SECURITY_SCHEMA_UPGRADE_REQUIRED");
}

// Actual session auth strips private relations, enforces idle/MFA, and checks revocation.
{
  const h = harness(); let current = await h.auth.getCurrentSession();
  ok(current && !Object.hasOwn(current.user, "authenticator") && !Object.hasOwn(current.user, "securitySetting"));
  h.rows.session[0].lastSeenAt = new Date(now - 70000);
  current = await h.auth.getCurrentSession(); ok(current);
  check(h.rows.session[0].lastSeenAt.toISOString(), new Date(now).toISOString(), "Authenticated request refreshes last activity");
  h.rows.session[0].lastSeenAt = new Date(now - 31 * 60000);
  check(await h.auth.getCurrentSession(), null); ok(!h.rows.session.some(row => row.id === "current"));
  h.cookie = ""; check(await h.auth.getCurrentSession(), null);
  const m = harness(); m.enroll(); m.rows.session[0].mfaVerifiedAt = null;
  check(await m.auth.getCurrentSession(), null, "A pre-enrollment session does not bypass MFA");
  await rejects(m.auth.createSession("owner-a"), "MFA_REQUIRED");
  await m.auth.createSession("owner-a", { mfaVerified: true, authenticationStartedAt: new Date(now), request: m.request({}) });
  ok(m.rows.session.at(-1).mfaVerifiedAt); ok(!m.rows.session.at(-1).userAgent.includes("password"));
  const b = harness(); b.rows.user[0].platformStatus = "Suspended";
  check(await b.auth.getCurrentSession(), null); check(b.rows.session.map(row => row.id), ["foreign"]);
  const missing = harness(); missing.schemaMissing = true; await rejects(missing.auth.getCurrentSession(), "SECURITY_SCHEMA_UPGRADE_REQUIRED"); await rejects(missing.auth.createSession("owner-a"), "SECURITY_SCHEMA_UPGRADE_REQUIRED");
  const cookie = h.auth.sessionCookieOptions(new Date(now)); check([cookie.httpOnly, cookie.sameSite, cookie.path], [true,"strict","/"]);
  h.env.NODE_ENV = "production"; check(h.auth.sessionCookieOptions(new Date(now)).secure, true);
  const inactive = harness(); inactive.rows.user[0].platformStatus = "Deactivated"; check(await inactive.auth.getCurrentSession(), null);
  await rejects(inactive.auth.createSession("owner-a"), "ACCOUNT_UNAVAILABLE");
  const changed = harness(); changed.rows.user[0].passwordHash = "changed-by-password-request";
  await rejects(changed.auth.createSession("owner-a", { expectedPasswordHash: initialHash }), "CREDENTIALS_CHANGED"); check(changed.rows.session.length, 3);
  const replaced = harness(); replaced.enroll();
  await rejects(replaced.auth.createSession("owner-a", { mfaVerified: true, authenticationStartedAt: new Date(now - 300000) }), "MFA_REQUIRED");
  await rejects(replaced.auth.createSession("owner-a", { mfaVerified: true }), "MFA_REQUIRED", "A bare verification boolean does not issue an enrolled session");
}

// Enrollment only activates after proof; cancellation and failed audit roll back.
{
  const h = harness();
  await rejects(h.route("mfa", { action: "begin", currentPassword: "wrong" }), "REAUTHENTICATION_FAILED");
  check(h.rows.userAuthenticator.length, 0);
  const begin = await (await h.route("mfa", { action: "begin", currentPassword: initialPassword })).json();
  ok(begin.secret && begin.uri.startsWith("otpauth://totp/")); check(h.rows.userAuthenticator[0].enabledAt, null);
  ok(!JSON.stringify(h.rows).includes(begin.secret), "Setup key is not stored or audited in plaintext");
  await rejects(h.route("mfa", { action: "confirm", currentPassword: initialPassword, factorCode: "invalid" }), "MFA_CODE_INVALID");
  check(h.rows.userSecuritySetting[0].mfaEnabled, false);
  const code = h.crypto.totpCode(begin.secret, Math.floor(now / 30000));
  h.auditFails = true;
  await assert.rejects(h.route("mfa", { action: "confirm", currentPassword: initialPassword, factorCode: code }), /Audit storage/); checks++;
  check(h.rows.userAuthenticator[0].enabledAt, null, "Audit storage failure rolls back MFA activation");
  check(h.rows.session.map(row => row.id), ["current","other","foreign"]);
  h.auditFails = false;
  const confirmation = await (await h.route("mfa", { action: "confirm", currentPassword: initialPassword, factorCode: code })).json();
  check(confirmation.recoveryCodes.length, 10); check(h.rows.userSecuritySetting[0].mfaEnabled, true);
  check(h.rows.session.map(row => row.id), ["current","foreign"]);
  ok(h.rows.session[0].mfaVerifiedAt); ok(!JSON.stringify(h.rows).includes(confirmation.recoveryCodes[0]), "Recovery codes are stored only as hashes");
  check(await h.service.verifyAccountSecondFactor("owner-a", code), false, "Enrollment consumes its proof code");
  await rejects(h.route("mfa", { action: "disable", currentPassword: initialPassword, factorCode: "invalid" }), "MFA_REQUIRED");
  const replacement = await (await h.route("mfa", { action: "recovery", currentPassword: initialPassword, factorCode: confirmation.recoveryCodes[0] })).json();
  check(replacement.recoveryCodes.length, 10); check(await h.service.verifyAccountSecondFactor("owner-a", confirmation.recoveryCodes[1]), false, "Replacement invalidates every old recovery code");
  await h.route("mfa", { action: "disable", currentPassword: initialPassword, factorCode: replacement.recoveryCodes[0] });
  check(h.rows.userAuthenticator[0].secretEncrypted, null); check(h.rows.userAuthenticator[0].recoveryCodeHashesJson, "[]"); check(h.rows.userSecuritySetting[0].mfaEnabled, false);
  const cancel = harness(); await cancel.route("mfa", { action: "begin", currentPassword: initialPassword }); await cancel.route("mfa", { action: "cancel", currentPassword: initialPassword });
  check(cancel.rows.userAuthenticator[0].pendingSecretEncrypted, null); check(cancel.rows.userAuthenticator[0].enabledAt, null);
  const absent = harness(); absent.env.MFA_ENCRYPTION_KEY = ""; await rejects(absent.route("mfa", { action: "begin", currentPassword: initialPassword }), "MFA_CONFIGURATION_REQUIRED"); check(absent.rows.userAuthenticator.length, 0);
}

// Concurrent authorized recovery replacements return exactly one usable set.
{
  const h = harness(), { secret, recovery } = h.enroll();
  const attempts = await Promise.allSettled([
    h.route("mfa", { action: "recovery", currentPassword: initialPassword, factorCode: h.crypto.totpCode(secret, Math.floor(now / 30000)) }),
    h.route("mfa", { action: "recovery", currentPassword: initialPassword, factorCode: recovery.codes[0] }),
  ]);
  check(attempts.filter(value => value.status === "fulfilled").length, 1, "Only the winning recovery-code transaction returns codes");
  const failed = attempts.find(value => value.status === "rejected");
  check(failed.reason.code, "MFA_CHANGED", "Even two different valid factors cannot return competing replacement sets");
  const winner = await attempts.find(value => value.status === "fulfilled").value.json();
  check(await h.service.verifyAccountSecondFactor("owner-a", winner.recoveryCodes[0]), true, "The returned code set is the committed code set");
}

// Session controls cannot revoke another owner; password changes are transactional.
{
  const h = harness();
  await rejects(h.route("sessions", { action: "revoke", sessionId: "foreign", currentPassword: initialPassword }), "SESSION_NOT_FOUND");
  check(h.rows.session.length, 3);
  await h.route("sessions", { action: "revoke-others", currentPassword: initialPassword }); check(h.rows.session.map(row => row.id), ["current","foreign"]);
  const all = await h.route("sessions", { action: "revoke-all", currentPassword: initialPassword });
  check((await all.json()).signedOut, true); check(h.rows.session.map(row => row.id), ["foreign"]); ok(all.headers.get("set-cookie").includes("1970"));
  const p = harness();
  await rejects(p.route("password", { currentPassword: "wrong", newPassword: "A new secure passphrase for tests" }), "REAUTHENTICATION_FAILED");
  await rejects(p.route("password", { currentPassword: initialPassword, newPassword: "small" }), "PASSWORD_POLICY");
  await rejects(p.route("password", { currentPassword: initialPassword, newPassword: initialPassword }), "PASSWORD_UNCHANGED");
  p.auditFails = true; await assert.rejects(p.route("password", { currentPassword: initialPassword, newPassword: "A new secure passphrase for tests" }), /Audit storage/); checks++;
  check(p.rows.user[0].passwordHash, initialHash); check(p.rows.session.length, 3);
  p.auditFails = false; const response = await p.route("password", { currentPassword: initialPassword, newPassword: "A new secure passphrase for tests" });
  check((await response.json()).signedOut, true); check(p.rows.session.map(row => row.id), ["foreign"]);
  check(p.auth.verifyPassword(initialPassword, p.rows.user[0].passwordHash), false); check(p.auth.verifyPassword("A new secure passphrase for tests", p.rows.user[0].passwordHash), true);
  ok(!JSON.stringify(p.rows.auditLog).includes("passphrase"));
}

// Legacy boolean writes are blocked; overview exports no tokens, seeds, hashes, IP.
{
  const h = harness();
  await rejects(h.route("settings", { mfaEnabled: true }, "PATCH"), "SECURITY_SETTING_UNSUPPORTED");
  await rejects(h.route("settings", { requireReauthForSensitiveActions: false }, "PATCH"), "SECURITY_SETTING_UNSUPPORTED");
  await rejects(h.route("settings", { sessionTimeoutMinutes: 15, idleTimeoutMinutes: 60 }, "PATCH"), "INVALID_SESSION_POLICY");
  await h.route("settings", { currentPassword: initialPassword, sessionTimeoutMinutes: 240, idleTimeoutMinutes: 15 }, "PATCH");
  check([h.rows.userSecuritySetting[0].sessionTimeoutMinutes, h.rows.userSecuritySetting[0].idleTimeoutMinutes], [240,15]);
  h.enroll();
  h.rows.session[1].expiresAt = new Date(now - 1);
  h.rows.auditLog.push({ id: "foreign-log", userId: "foreign", title: "Do not expose", severity: "Critical", area: "Security", eventType: "test", createdAt: new Date(now) });
  const result = await h.load("src/lib/account-security/overview.ts").securityOverview(h.rows.user[0], "current");
  check(result.authenticator.enabled, true); check(result.authenticator.recoveryCodesRemaining, 10); check(result.sessions.map(row => row.id), ["current"]);
  const serialized = JSON.stringify(result);
  for (const field of ["tokenHash","passwordHash","secretEncrypted","pendingSecretEncrypted","recoveryCodeHashesJson","ipHash","Do not expose"]) ok(!serialized.includes(field), `Overview does not expose ${field}`);
}

// Real login issues no session until a second factor succeeds.
{
  const h = harness(), { recovery } = h.enroll(); h.rows.session = [];
  const login = h.load("src/app/api/auth/login/route.ts").POST;
  const pending = await login(h.request({ email: "owner@example.test", password: initialPassword }));
  check(pending.status, 401); check((await pending.json()).mfaRequired, true); check(h.rows.session.length, 0);
  const wrong = await login(h.request({ email: "owner@example.test", password: initialPassword, factorCode: "invalid" }));
  check(wrong.status, 401); check(h.rows.session.length, 0);
  const success = await login(h.request({ email: "owner@example.test", password: initialPassword, factorCode: recovery.codes[0] }));
  check(success.status, 200); check(h.rows.session.length, 1); ok(h.rows.session[0].mfaVerifiedAt); ok(success.headers.get("set-cookie").includes("HttpOnly"));
  const replay = await login(h.request({ email: "owner@example.test", password: initialPassword, factorCode: recovery.codes[0] }));
  check(replay.status, 401); check(h.rows.session.length, 1);
  const race = harness(); race.rows.session = [];
  race.beforeUpdate = async (model) => { if (model === "user") { race.rows.user[0].passwordHash = "concurrent-password-change"; race.beforeUpdate = undefined; } };
  await rejects(race.load("src/app/api/auth/login/route.ts").POST(race.request({ email: "owner@example.test", password: initialPassword })), "CREDENTIALS_CHANGED");
  check(race.rows.session.length, 0); check(race.rows.user[0].passwordHash, "concurrent-password-change", "A legacy rehash cannot overwrite a newer password");
}

// A title containing “manager” is not an administrative permission grant.
{
  const h = harness(), { permissionsForMembership } = h.load("src/lib/access-control.ts");
  const permissions = (role, canManageFirm = false) => permissionsForMembership({ role, canManageFirm, canAccessPortfolios: false, canManageProjects: false, canInviteMembers: false });
  ok(!permissions("Portfolio Manager").includes("firm.manage")); ok(!permissions("Relationship Manager").includes("members.invite"));
  ok(permissions("Owner").includes("firm.manage")); ok(permissions("Operations", true).includes("firm.manage"));
  ok(!permissions("Assistant to Administrator").includes("firm.manage")); ok(permissions("Firm_Admin").includes("firm.manage"));
}

console.log(`Account security: ${checks} behavioral checks passed.`);
