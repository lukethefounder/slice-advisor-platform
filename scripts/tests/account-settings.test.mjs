import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const require = createRequire(import.meta.url), ts = require("typescript");
const root = fileURLToPath(new URL("../..", import.meta.url));
let assertions = 0;
const check = (actual, expected, message) => { assert.deepEqual(JSON.parse(JSON.stringify(actual)), JSON.parse(JSON.stringify(expected)), message); assertions++; };
const clone = value => structuredClone(value);
const now = new Date("2026-11-19T12:00:00.000Z");
const user = { id: "owner", name: "Original Owner", email: "owner@example.com", passwordHash: "NEVER-PUBLIC", platformStatus: "Active", createdAt: now };
let state, authenticated, rateAllowed, mfa, reauthCalls, securityFailure, auditFailure, locks;
function reset() {
  state = { users: [clone(user), { ...clone(user), id: "other", email: "other@example.com" }], memories: [{ userId: "owner", memoryKey: "account.settings", value: JSON.stringify({ timezone: "America/New_York", phone: "555", futurePreference: { retain: true }, privacy: { analyticsEnabled: false, allowBrowserStorage: true, secretValue: "NEVER-PUBLIC" } }), updatedAt: now }], preferences: [], deliveries: [], firms: [], memberships: [], sessions: [{ id: "s1", userId: "owner" }, { id: "s2", userId: "owner" }, { id: "s3", userId: "other" }], audits: [], alerts: [], digests: [] };
  authenticated = "owner"; rateAllowed = true; mfa = false; reauthCalls = []; securityFailure = false; auditFailure = false; locks = [];
}
reset();
function matches(row, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return value.some(part => matches(row, part));
    if (key === "user") return matches(state.users.find(item => item.id === row.userId) ?? {}, value);
    const actual = row[key];
    if (value && typeof value === "object" && !(value instanceof Date)) {
      if ("in" in value) return value.in.includes(actual);
      if ("not" in value) return actual !== value.not;
      if ("gt" in value) return actual > value.gt;
      if ("gte" in value) return actual >= value.gte;
    }
    return actual === value;
  });
}
function select(row, fields) {
  if (!row) return null;
  if (!fields) return clone(row);
  return Object.fromEntries(Object.keys(fields).map(key => [key, clone(key === "firm" ? { name: state.firms.find(firm => firm.id === row.firmId)?.name || "Test Firm" } : row[key])]));
}
function rows(name, args = {}) { return state[name].filter(row => matches(row, args.where)).slice(0, args.take ?? Infinity).map(row => select(row, args.select)); }
let sequence = 0, transactionTail = Promise.resolve();
const db = {
  user: {
    findUnique: async args => select(state.users.find(row => matches(row, args.where)), args.select),
    update: async args => { const row = state.users.find(row => matches(row, args.where)); Object.assign(row, args.data); return clone(row); },
    delete: async args => { state.users = state.users.filter(row => !matches(row, args.where)); return {}; },
  },
  personalUserBotMemory: {
    findUnique: async args => select(state.memories.find(row => matches(row, args.where.userId_memoryKey)), args.select),
    upsert: async args => { let row = state.memories.find(row => matches(row, args.where.userId_memoryKey)); if (row) Object.assign(row, args.update, { updatedAt: now }); else { row = { ...args.create, updatedAt: now }; state.memories.push(row); } return clone(row); },
    deleteMany: async args => { state.memories = state.memories.filter(row => !matches(row, args.where)); return {}; },
  },
  userSecuritySetting: { findUnique: async () => ({ mfaEnabled: true, sessionTimeoutMinutes: 60, lastSecurityReviewAt: now, imaginarySecret: "NEVER-PUBLIC" }) },
  notificationPreference: {
    findMany: async args => rows("preferences", args),
    findFirst: async args => rows("preferences", args)[0] ?? null,
    upsert: async args => { let row = state.preferences.find(row => matches(row, args.where.userId_channel)); if (row) Object.assign(row, args.update); else { row = { id: `pref-${sequence++}`, ...clone(args.create) }; state.preferences.push(row); } return clone(row); },
  },
  notificationDelivery: {
    findMany: async args => rows("deliveries", args), findFirst: async args => rows("deliveries", args)[0] ?? null,
    create: async args => { const row = { id: `delivery-${sequence++}`, simulated: true, createdAt: new Date(), deliveredAt: null, ...clone(args.data) }; state.deliveries.push(row); return clone(row); },
    updateMany: async args => { const matched = state.deliveries.filter(row => matches(row, args.where)); for (const row of matched) Object.assign(row, clone(args.data)); return { count: matched.length }; },
  },
  firm: { count: async args => rows("firms", args).length },
  firmMembership: { findMany: async args => rows("memberships", args), count: async args => rows("memberships", args).length },
  session: { deleteMany: async args => { state.sessions = state.sessions.filter(row => !matches(row, args.where)); return {}; } },
  auditLog: { create: async args => { if (auditFailure) throw new Error("Audit unavailable"); state.audits.push(clone(args.data)); return clone(args.data); } },
  alertEvent: { findMany: async args => rows("alerts", args) },
  digestReport: { create: async args => { const row = { id: `digest-${sequence++}`, ...clone(args.data) }; state.digests.push(row); return clone(row); } },
  $queryRaw: async (_query, ...parameters) => { locks.push(parameters); return []; },
  $transaction: async callback => {
    const previous = transactionTail; let release; transactionTail = new Promise(done => { release = done; }); await previous;
    const before = clone(state); try { return await callback(db); } catch (error) { state = before; throw error; } finally { release(); }
  },
};
const logger = { info() {}, error() {}, warn() {}, child() { return this; } };
const modules = new Map();
function load(relative) {
  if (modules.has(relative)) return modules.get(relative).exports;
  const module = { exports: {} }; modules.set(relative, module);
  let source = readFileSync(resolve(root, relative), "utf8");
  if (relative === "src/lib/autonomous-triage.ts") source += "\nexport const __emailDecision = emailDeliveryDecision;";
  const compiled = ts.transpileModule(source, { fileName: relative, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, relative);
  function imports(path) {
    if (path === "server-only") return {};
    if (path.startsWith("node:") || path === "next/server") return require(path);
    if (path === "@/lib/prisma") return { prisma: db };
    if (path === "@/lib/logger") return { createLogger: () => logger };
    if (path === "@/lib/auth") return { SESSION_COOKIE: "slice_session", clearSessionCookieOptions: () => ({ path: "/", httpOnly: true, secure: true, maxAge: 0 }), getCurrentUser: async () => clone(state.users.find(row => row.id === authenticated) ?? null) };
    if (path === "@/lib/security") return { checkRateLimit: () => ({ allowed: rateAllowed, retryAfterSeconds: 60 }), getClientIp: () => "192.0.2.1", hashForSecurity: value => `hashed:${value}`, recordSecurityEvent: async event => { if (securityFailure) throw new Error("Audit unavailable"); state.audits.push(clone({ ...event, request: undefined })); } };
    if (path === "@/lib/account-security/service") return { accountHasMfa: async () => mfa, requireAccountReauthentication: async (id, password, factor) => {
      reauthCalls.push({ id, password, factor });
      if (password !== "correct current password" || (mfa && factor !== "123456")) throw new (load("src/lib/api-route.ts").ApiError)({ status: 403, code: "REAUTHENTICATION_REQUIRED", message: "Verify current password and factor." });
    } };
    if (["@/lib/api-route", "@/lib/research/beta-policy", "@/lib/account-settings/contracts", "@/lib/account-settings/notification-policy", "@/lib/notification-engine"].includes(path)) return load(`${path.replace("@/", "src/")}.ts`);
    if (path === "@/lib/integrations/email") return { sendEmail: () => { throw new Error("Tests must never send mail"); } };
    return {};
  }
  new Function("require", "module", "exports", compiled.outputText)(imports, module, module.exports);
  return module.exports;
}
const api = load("src/app/api/account-settings/route.ts"), contracts = load("src/lib/account-settings/contracts.ts");
const policy = load("src/lib/account-settings/notification-policy.ts"), engine = load("src/lib/notification-engine.ts");
async function post(body, options = {}) {
  const headers = { "content-type": "application/json", origin: "https://slice.test", ...options.headers };
  for (const key of Object.keys(headers)) if (headers[key] === null) delete headers[key];
  const request = new Request("https://slice.test/api/account-settings", { method: "POST", headers, body: options.raw ?? JSON.stringify(body) });
  const response = await api.POST(request); return { status: response.status, headers: response.headers, body: await response.json() };
}
const profile = { name: "New Owner", email: user.email, phone: "123 456", timezone: "Europe/London" };
const preferences = () => clone(contracts.DEFAULT_NOTIFICATIONS);
let result = await api.GET(new Request("https://slice.test/api/account-settings"));
let body = await result.json();
check([result.status, result.headers.get("cache-control"), body.account.id], [200, "private, no-store, max-age=0", "owner"], "Account reads require private non-cacheable responses");
check(body.security.mfaEnabled, false, "A historical MFA boolean cannot pretend an authenticator is enrolled");
check(JSON.stringify(body).includes("NEVER-PUBLIC"), false, "Account responses exclude authentication and unknown privacy fields");
check(body.notifications.map(item => item.channel), ["Dashboard", "Email", "SMS", "Push", "Digest"], "The console uses the channels understood by delivery workflows");
mfa = true;
body = await (await api.GET(new Request("https://slice.test/api/account-settings"))).json(); check(body.security.mfaEnabled, true, "Enrolled factor status is visible");
body = await (await api.GET(new Request("https://slice.test/api/account-settings?export=account-preferences"))).json();
check([body.format, Object.hasOwn(body, "security"), JSON.stringify(body).includes("NEVER-PUBLIC")], ["slice-account-preferences-v1", false, false], "A preference export excludes security material");
authenticated = null; result = await api.GET(new Request("https://slice.test/api/account-settings")); check(result.status, 401, "Anonymous account reads are rejected"); authenticated = "owner";
for (const headers of [{ origin: "https://other.test" }, { origin: null }, { "sec-fetch-site": "cross-site" }]) check((await post({ action: "saveProfile", account: profile }, { headers })).status, 403, "Cross-origin mutations are rejected");
check((await post({}, { headers: { "content-type": "text/plain" } })).status, 415, "JSON is required");
check((await post({}, { raw: "{" })).status, 400, "Malformed JSON is reported safely");
check((await post({}, { raw: JSON.stringify({ action: "saveProfile", padding: "x".repeat(25_000) }) })).status, 413, "The streamed body is bounded without Content-Length");
check((await post({}, { headers: { "content-length": "25000" } })).status, 413, "Oversized declared bodies are rejected");
rateAllowed = false; check((await post({ action: "saveProfile", account: profile })).status, 429, "Settings mutations honor the rate guard"); rateAllowed = true;
for (const action of ["saveAccountSettings", "requestPasswordReset"]) check((await post({ action, security: { mfaEnabled: true } })).status, 409, "Legacy fake security and reset actions are closed");
check((await post({ action: "saveProfile", account: { ...profile, email: "founder@example.com" } })).body.error.code, "EMAIL_VERIFICATION_REQUIRED", "A profile edit cannot replace an unverified sign-in identity");
check((await post({ action: "saveProfile", account: { ...profile, timezone: "Mars/Olympus" } })).status, 422, "Time zones must resolve to IANA zones");
check((await post({ action: "saveProfile", account: { ...profile, role: "Founder" } })).status, 422, "Privilege fields cannot be smuggled into profile data");
check((await post({ action: "saveAppearance", appearance: { ...contracts.DEFAULT_APPEARANCE, mode: "neon" }, allowBrowserStorage: true })).status, 422, "Unsupported display values are rejected");
check((await post({ action: "saveAppearance", appearance: contracts.DEFAULT_APPEARANCE, allowBrowserStorage: "false" })).status, 422, "String booleans cannot become enabled preferences");
for (const mutate of [items => { items[1].minScore = 101; }, items => { items[1].cooldownMinutes = -1; }, items => { items[1].quietHoursStart = "25:00"; }, items => { items[1].quietHoursEnd = null; }, items => { items[1].quietHoursEnd = items[1].quietHoursStart; }, items => { items[1].channel = "Dashboard"; }, items => { items[1].userId = "other"; }]) {
  const items = preferences(); mutate(items); check((await post({ action: "saveNotifications", notifications: items })).status, 422, "Invalid notification preferences cannot be stored");
}
check((await post({ action: "unknown" })).status, 400, "Unsupported actions do not silently succeed");
check(state.audits.length, 0, "Rejected payloads cannot partially mutate the account");
const appearance = { ...contracts.DEFAULT_APPEARANCE, mode: "light", motion: "reduced", textScale: "large" };
const [profileResult, appearanceResult] = await Promise.all([post({ action: "saveProfile", account: profile }), post({ action: "saveAppearance", appearance, allowBrowserStorage: false })]);
check([profileResult.status, appearanceResult.status], [200, 200], "Independent section updates can both complete");
const meta = JSON.parse(state.memories[0].value);
check([state.users[0].name, state.users[0].email, meta.phone, meta.timezone, meta.appearance.mode, meta.privacy.allowBrowserStorage, meta.futurePreference, meta.privacy.analyticsEnabled], ["New Owner", user.email, "123 456", "Europe/London", "light", false, { retain: true }, false], "Independent saves merge current metadata without erasing other sections or historical preferences");
check(state.users[1].name, "Original Owner", "A user cannot update another profile");
check(locks.length >= 2, true, "Writes lock the owning account before merging metadata");
const beforeFailedWrite = clone(state); auditFailure = true;
check((await post({ action: "saveProfile", account: { ...profile, name: "Should rollback" } })).status, 500, "Audit failure rejects the transaction");
check(state.users, beforeFailedWrite.users, "A failed transaction cannot leave a partial profile mutation"); auditFailure = false;
const items = preferences(); items[1].minScore = 91;
check((await post({ action: "saveNotifications", notifications: items })).status, 200, "Valid delivery preferences are saved");
check(state.preferences.every(row => row.userId === "owner") && state.preferences.find(row => row.channel === "Email").minScore === 91, true, "Channel updates stay scoped to the authenticated account");
reset(); mfa = true;
const close = { action: "deactivateAccount", confirmation: "DEACTIVATE", currentPassword: "correct current password", factorCode: "123456" };
check((await post({ ...close, confirmation: "deactivate" })).status, 422, "Account closure requires the exact confirmation");
check((await post({ ...close, currentPassword: "incorrect" })).status, 403, "Account closure requires the current password");
check((await post({ ...close, factorCode: "" })).status, 403, "Enrolled MFA cannot be bypassed for account closure");
check(state.sessions.length, 3, "Failed verification does not revoke any sessions");
state.firms.push({ id: "firm", name: "Shared Firm", createdByUserId: "owner" });
check((await post(close)).body.error.code, "FIRM_OWNERSHIP_REQUIRED", "Deleting a creator cannot cascade through a shared firm");
state.firms[0].createdByUserId = "other"; state.memberships.push({ id: "m1", firmId: "firm", userId: "owner", status: "Active", role: "Admin", canManageFirm: true });
check((await post(close)).body.error.code, "FIRM_ADMIN_REQUIRED", "The last active administrator cannot close their account");
state.memberships.push({ id: "m2", firmId: "firm", userId: "other", status: "Active", role: "Admin", canManageFirm: true });
result = await post(close);
check([result.status, result.body.redirectTo, state.users[0].platformStatus, state.sessions.map(row => row.id)], [200, "/founder-login", "Suspended", ["s3"]], "Successful deactivation suspends access and revokes all of that user's sessions");
check(result.headers.get("set-cookie").includes("Max-Age=0"), true, "Account closure clears the browser session cookie");
reset(); securityFailure = true;
result = await post({ action: "deleteAccount", confirmation: "DELETE MY ACCOUNT", currentPassword: "correct current password", factorCode: "" });
check([result.status, state.users.map(row => row.id), state.memories.length, state.sessions.map(row => row.id)], [200, ["other"], 0, ["s3"]], "Personal deletion removes account preferences and sessions even if the post-delete audit sink is unavailable");

// Saved times are interpreted in the account's zone, including midnight boundaries and daylight-saving changes.
check(policy.isWithinQuietHours("22:00", "07:00", "America/New_York", new Date("2026-11-19T03:00:00Z")), true, "Overnight quiet hours include their start in the user's zone");
check(policy.isWithinQuietHours("22:00", "07:00", "America/New_York", new Date("2026-11-19T12:00:00Z")), false, "Quiet hours end exactly at the chosen end time");
check(policy.isWithinQuietHours("09:00", "17:00", "Asia/Tokyo", new Date("2026-11-19T03:00:00Z")), true, "Daytime windows are evaluated independently of server time");
for (const instant of ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"]) check(policy.isWithinQuietHours("01:00", "02:00", "America/New_York", new Date(instant)), true, "Both occurrences of a repeated daylight-saving hour remain quiet");
check(policy.isWithinQuietHours(null, null, "UTC", now), false, "Empty quiet windows do not suppress delivery");
reset();
const email = { ...preferences()[1], quietHoursStart: null, quietHoursEnd: null };
state.deliveries.push({ id: "simulated", userId: "owner", channel: "Email", status: "Delivered", simulated: true, createdAt: new Date(now.getTime()-60_000) });
let decision = await engine.evaluateAccountNotificationDelivery({ userId: "owner", score: 99, urgency: "Critical", preference: email, now });
check(decision.allowed, true, "Simulated deliveries cannot throttle a real email");
state.deliveries.push({ id: "real", userId: "owner", channel: "Email", status: "Delivered", simulated: false, createdAt: new Date(now.getTime()-60_000) });
decision = await engine.evaluateAccountNotificationDelivery({ userId: "owner", score: 99, urgency: "Critical", preference: email, now });
check([decision.allowed, decision.reason], [false, "Cooldown active for this channel."], "Actual email delivery observes the saved cooldown");
state.deliveries[1].createdAt = new Date(now.getTime()-email.cooldownMinutes*60_000);
check((await engine.evaluateAccountNotificationDelivery({ userId: "owner", score: 99, urgency: "Critical", preference: email, now })).allowed, true, "Delivery resumes exactly at the cooldown boundary");
check((await engine.evaluateAccountNotificationDelivery({ userId: "owner", score: 99, urgency: "Critical", preference: preferences()[1], now: new Date("2026-11-19T03:30:00Z") })).reason, "Quiet hours active in America/New_York.", "The delivery path uses the saved account timezone");
reset();
state.deliveries = [
  { id: "app", userId: "owner", channel: "Dashboard", status: "Queued", simulated: true, createdAt: now },
  { id: "simulation", userId: "owner", channel: "Email", status: "Queued", simulated: true, createdAt: now },
  { id: "pending", userId: "owner", channel: "Email", status: "Queued", simulated: false, createdAt: now },
  { id: "other", userId: "other", channel: "Email", status: "Queued", simulated: true, createdAt: now },
];
check(await engine.processQueuedDeliveries("owner"), { processed: 2, simulated: 1, pendingProvider: 1 }, "Queue processing reports simulations separately from real pending delivery");
check(state.deliveries.map(row => [row.id,row.status,row.simulated]), [["app","Delivered",false],["simulation","Simulated",true],["pending","Queued",false],["other","Queued",true]], "A simulation cannot become confirmed external delivery or mutate another user");
check(state.deliveries[1].deliveredAt, null, "A simulated record has no delivery timestamp");
reset(); await engine.ensureNotificationPreferences("owner");
state.preferences.find(row => row.channel === "Digest").minUrgency = "High";
state.alerts = [
  { id: "a1", userId: "owner", title: "Low urgency", body: "", source: "Fixture", ticker: "TEST", status: "Unread", score: 99, urgency: "Low", createdAt: new Date() },
  { id: "a2", userId: "owner", title: "High urgency", body: "", source: "Fixture", ticker: "TEST", status: "Unread", score: 99, urgency: "High", createdAt: new Date() },
];
check((await engine.generateInvestorDigest("owner")).itemCount, 1, "Digests apply both the chosen score and urgency thresholds");
check([state.deliveries[0].channel,state.deliveries[0].simulated], ["Digest",false], "Generated digests are recorded as actual in-app summaries");
reset(); await engine.ensureNotificationPreferences("owner");
state.preferences.find(row => row.channel === "Email").quietHoursStart = null;
state.preferences.find(row => row.channel === "Email").quietHoursEnd = null;
state.deliveries.push({ id: "real", userId: "owner", channel: "Email", status: "Delivered", simulated: false, createdAt: new Date() });
const triage = load("src/lib/autonomous-triage.ts");
check((await triage.__emailDecision({ userId: "owner", score: 99, urgency: "Critical" })).allowed, false, "Autonomous real-email decisions cannot bypass the shared cooldown rules");
console.log(`Account settings runtime checks passed (${assertions} assertions): strict API scope, safe exports, section merging, transactional rollback, verified closure, timezone/quiet hours, cooldown, digest filters, and truthful simulation records. No live database or provider was contacted.`);
