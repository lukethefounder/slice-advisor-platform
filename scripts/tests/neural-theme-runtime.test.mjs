import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const repo = fileURLToPath(new URL("../..", import.meta.url));
const SETTINGS = "slice-workspace-settings-v5";
const MODE = "slice-theme-mode-v1";
const MIGRATION = "slice-neural-default-v1";
const GLOBAL = "slice-platform-settings:global:v4";
let assertions = 0;
function check(value, expected, message) { assert.deepEqual(JSON.parse(JSON.stringify(value)), expected, message); assertions += 1; }

function harness(initial = {}, options = {}) {
  const values = new Map(Object.entries(initial)), writes = [], styles = new Map(), classes = new Set(), effects = [];
  let dark = options.dark ?? true;
  const events = () => {
    const listeners = new Map();
    return {
      addEventListener(type, callback) { const set = listeners.get(type) ?? new Set(); set.add(callback); listeners.set(type, set); },
      removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
      dispatchEvent(event) { for (const callback of [...(listeners.get(event.type) ?? [])]) callback(event); return true; },
      count() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
    };
  };
  const storage = {
    getItem(key) { if (options.readBlocked) throw new Error("Storage disabled"); return values.get(key) ?? null; },
    setItem(key, value) { if (options.writeBlocked || (options.settingsWriteBlocked && key === SETTINGS)) throw new Error("Storage disabled"); writes.push([key, value]); values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const media = { ...events(), get matches() { return dark; } };
  const html = { dataset: {}, classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
    style: { colorScheme: "", setProperty(name, value) { styles.set(name, value); }, removeProperty(name) { styles.delete(name); } } };
  const window = { ...events(), matchMedia: () => media, location: { hash: "", pathname: "/workspace/settings", search: "" }, history: { state: null, replaceState() {} } };
  Object.defineProperty(window, "localStorage", { get() { if (options.storageBlocked) throw new Error("Storage denied"); return storage; } });
  const document = { ...events(), documentElement: html, visibilityState: "visible" };
  const context = createContext({ window, document, console, process: { env: { ...options.env } }, AbortController, structuredClone, Event: class Event { constructor(type) { this.type = type; } }, fetch: options.fetch ?? (() => { throw new Error("Theme changes must not fetch"); }) });
  let hookDriver = null;
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const file = resolve(repo, relative), module = { exports: {} };
    cache.set(relative, module);
    let source = readFileSync(file, "utf8");
    if (relative === "src/app/workspace/settings/page.tsx") {
      // Expose existing private actions to exercise the real asynchronous form lifecycle.
      source = source.replace("export default function WorkspaceSettingsPage() {", "export default function WorkspaceSettingsPage() { globalThis.__settingsActions = {saveSettings, updateAppearance, updatePrivacy, resetSection, loadSettings: () => loadSettings(), selectTab, getState: () => ({settings,saved,account,notice,dirty,loading}), setProfile: patch => setSettings(previous => ({...previous,account:{...previous.account,...patch}})), setNotification: (channel, patch) => setSettings(previous => ({...previous,notifications:previous.notifications.map(item => item.channel === channel ? {...item,...patch} : item)}))};");
      source += "\nexport const __settingsTest = { readLocalSettings, normalizeApiResponse, saveLocalSettings };";
    }
    const compiled = ts.transpileModule(source, { fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
    const imports = specifier => {
      if (specifier === "react") return {
        useEffect: (callback, dependencies) => hookDriver ? hookDriver.useEffect(callback, dependencies) : effects.push(callback),
        useState: initial => hookDriver.useState(initial), useRef: initial => hookDriver.useRef(initial),
        useMemo: (callback, dependencies) => hookDriver.useMemo(callback, dependencies),
        useCallback: (callback, dependencies) => hookDriver.useMemo(() => callback, dependencies),
      };
      if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (specifier.endsWith("/theme-bootstrap") || specifier === "./theme-bootstrap") return load("src/lib/workspace/theme-bootstrap.ts");
      if (specifier.endsWith("/appearance")) return load("src/lib/workspace/appearance.ts");
      if (specifier.endsWith("/platform-appearance")) return load("src/components/experience/platform-appearance.tsx");
      if (specifier === "@/lib/account-settings/contracts") return load("src/lib/account-settings/contracts.ts");
      if (specifier === "@/lib/research/beta-policy") return load("src/lib/research/beta-policy.ts");
      return { __esModule: true, default: function Stub() {} };
    };
    runInContext(`(function(require,module,exports){${compiled.outputText}\n})`, context, { filename: file })(imports, module, module.exports);
    return module.exports;
  }
  const bootstrap = load("src/lib/workspace/theme-bootstrap.ts");
  return { context, window, document, html, styles, classes, values, writes, effects, media, load,
    useHooks(driver) { hookDriver = driver; },
    paint() { runInContext(bootstrap.NEURAL_THEME_BOOTSTRAP, context); },
    system(isDark) { dark = isDark; media.dispatchEvent({ type: "change" }); },
    theme: () => ({ mode: html.dataset.sliceThemeMode, theme: html.dataset.sliceTheme, appearance: html.dataset.sliceAppearance, scheme: html.style.colorScheme, dark: classes.has("dark"), brand: html.dataset.sliceBrand }),
  };
}

function hooks() {
  const slots = [];
  let cursor = 0, pending = [], disposed = false;
  const changed = (previous, next) => !previous || !next || previous.length !== next.length || previous.some((value, index) => !Object.is(value, next[index]));
  return {
    useState(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => { if (!disposed) slots[index].value = typeof next === "function" ? next(slots[index].value) : next; }]; },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useMemo(callback, dependencies) { const index = cursor++; if (!slots[index] || changed(slots[index].dependencies, dependencies)) slots[index] = { value: callback(), dependencies }; return slots[index].value; },
    useEffect(callback, dependencies) { const index = cursor++; if (!slots[index] || changed(slots[index].dependencies, dependencies)) { const previous = slots[index]; slots[index] = { dependencies, cleanup: previous?.cleanup }; pending.push(() => { slots[index].cleanup?.(); slots[index].cleanup = callback(); }); } },
    render(component) { cursor = 0; pending = []; const result = component(); for (const effect of pending) effect(); return result; },
    unmount() { disposed = true; for (const slot of slots) slot.cleanup?.(); },
  };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const response = (payload, ok = true) => ({ ok, json: async () => payload });
function accountResponse(appearance = {}, overrides = {}) {
  return { ok: true, account: { id: "fixture-user", name: "Fixture User", email: "fixture@example.com", phone: "", timezone: "UTC", platformStatus: "Active", createdAt: "2026-11-19T00:00:00Z" },
    appearance: { mode: "dark", density: "comfortable", accent: "market-green", cardStyle: "glass", navigationStyle: "executive", motion: "full", textScale: "standard", compactSidebar: false, commandBarPinned: true, ...appearance },
    privacy: { allowBrowserStorage: true }, notifications: [], security: { mfaEnabled: false, lastSecurityReviewAt: null }, memberships: [], deliveries: [], revision: null, ...overrides };
}

const darkTheme = { mode: "dark", theme: "dark", appearance: "dark", scheme: "dark", dark: true, brand: "neural" };
const lightTheme = { mode: "light", theme: "light", appearance: "light", scheme: "light", dark: false, brand: "neural" };
const fresh = harness({}, { dark: false });
fresh.paint();
check(fresh.theme(), darkTheme, "First visit is neural dark even on a light OS");
check(fresh.values.get(MIGRATION), "complete");
const runtime = fresh.load("src/lib/workspace/appearance.ts");
fresh.styles.set("--slice-surface", "old-light-surface");
fresh.styles.set("--slice-rose-text", "old-status-color");
runtime.applyWorkspaceAppearance();
check(fresh.theme(), darkTheme, "Hydration agrees with the prepaint script");
check(fresh.styles.get("--slice-accent"), "#70e3d2");
check(fresh.styles.has("--slice-surface") || fresh.styles.has("--slice-rose-text"), false, "Inline legacy palettes cannot override the CSS theme");

const previous = { appearance: { mode: "light", density: "compact", motion: "reduced", textScale: "large", accent: "teal" }, workspace: { compactSidebar: true, autoSaveDrafts: false }, privacy: { maskClientNames: true }, ai: { requireApprovalForEmails: true } };
const migrated = harness({ [SETTINGS]: JSON.stringify(previous), [MODE]: "light", "slice-light-default-v1": "complete" });
migrated.paint();
const prepaintPreferences = () => ({ motion: migrated.html.dataset.sliceMotion, density: migrated.html.dataset.sliceDensity, textScale: migrated.html.dataset.sliceTextScale, scale: migrated.styles.get("--slice-text-scale") });
check(prepaintPreferences(), { motion: "reduced", density: "compact", textScale: "large", scale: "1.045" }, "Saved reduced motion and large text apply before hydration");
check(JSON.parse(migrated.values.get(SETTINGS)), { ...previous, appearance: { ...previous.appearance, mode: "dark" } }, "Migration only changes the old default mode");
const migratedRuntime = migrated.load("src/lib/workspace/appearance.ts");
migratedRuntime.applyWorkspaceAppearance();
check(prepaintPreferences(), { motion: "reduced", density: "compact", textScale: "large", scale: "1.045" }, "Hydration preserves prepaint accessibility and density");
check(migrated.html.dataset.sliceMotion, "reduced");
check(migrated.html.dataset.sliceTextScale, "large");
check(migrated.html.dataset.sliceDensity, "compact");
check(migrated.html.dataset.sliceSidebar, "compact");
const writesAfterMigration = migrated.writes.length;
migrated.paint(); migratedRuntime.applyWorkspaceAppearance();
check(migrated.writes.length, writesAfterMigration, "Migration is not rerun on navigation or hydration");

migrated.values.set(SETTINGS, JSON.stringify({ ...previous, appearance: { ...previous.appearance, mode: "light" } }));
migrated.paint(); migratedRuntime.applyWorkspaceAppearance();
check(migrated.theme(), lightTheme, "A deliberate later light preference survives the neural migration");
check(migrated.styles.get("--slice-accent-dark"), "#06494e", "Light mode uses a readable teal accent");
migrated.values.set(SETTINGS, JSON.stringify({ ...previous, appearance: { ...previous.appearance, mode: "system" } }));
const changes = [];
const unwatch = migratedRuntime.watchWorkspaceAppearance(value => changes.push(value.resolvedTheme));
check(migrated.theme(), { ...darkTheme, mode: "system" });
migrated.system(false);
check(migrated.theme(), { ...lightTheme, mode: "system" });
migrated.document.visibilityState = "hidden";
migrated.system(true);
check(migrated.theme(), { ...lightTheme, mode: "system" }, "Hidden pages defer cosmetic updates");
migrated.document.visibilityState = "visible";
migrated.document.dispatchEvent({ type: "visibilitychange" });
check(migrated.theme(), { ...darkTheme, mode: "system" });
const changesBeforeNoop = changes.length;
migrated.window.dispatchEvent({ type: "focus" });
check(changes.length, changesBeforeNoop, "Unchanged preferences do not trigger another application");
unwatch();
check([migrated.window.count(), migrated.document.count(), migrated.media.count()], [0, 0, 0], "Global listeners are fully cleaned up");

const beforePreview = migrated.values.get(SETTINGS);
migratedRuntime.previewWorkspaceAppearance({ mode: "light", motion: "full" });
check(migrated.theme(), lightTheme);
check(migrated.values.get(SETTINGS), beforePreview, "Live preview does not save preferences");
migratedRuntime.clearWorkspaceAppearancePreview();
check(migrated.theme(), { ...darkTheme, mode: "system" }, "Leaving Settings restores the saved mode");
migratedRuntime.rememberWorkspaceAppearanceForVisit({ mode: "light" });
migratedRuntime.applyWorkspaceAppearance();
check(migrated.theme(), lightTheme, "Storage opt-out still allows a choice for the current visit");
migratedRuntime.rememberWorkspaceAppearanceForVisit(null);

for (const corrupted of ["null", "[]", "not json", JSON.stringify({ appearance: null }), JSON.stringify({ appearance: "light" })]) {
  const h = harness({ [SETTINGS]: corrupted }); h.paint(); h.load("src/lib/workspace/appearance.ts").applyWorkspaceAppearance();
  check(h.theme(), darkTheme, "Malformed browser preferences cannot break theme initialization");
}
for (const options of [{ storageBlocked: true }, { readBlocked: true }, { writeBlocked: true }, { settingsWriteBlocked: true }]) {
  const h = harness({ [SETTINGS]: JSON.stringify(previous) }, options); h.paint(); h.load("src/lib/workspace/appearance.ts").applyWorkspaceAppearance();
  check(h.theme(), darkTheme, "Blocked browser storage falls back consistently");
}
const optedOut = harness({ [SETTINGS]: JSON.stringify({ ...previous, privacy: { allowBrowserStorage: false } }) });
optedOut.paint();
check(optedOut.writes.length, 0, "Migration respects a recorded browser-storage opt-out");
check(optedOut.theme(), darkTheme);

const legacy = fresh.load("src/components/user-theme-provider.tsx");
legacy.applySliceSettings({ ...legacy.DEFAULT_SLICE_PLATFORM_SETTINGS, appearance: "light", highContrast: true, focusOutlines: true, reduceMotion: true, maskClientData: true });
check(fresh.theme(), darkTheme, "Legacy automatic application cannot revive the previous light default");
check([fresh.html.dataset.sliceHighContrast, fresh.html.dataset.sliceFocusOutlines, fresh.html.dataset.sliceMaskClientData, fresh.html.dataset.sliceMotion], ["true", "true", "true", "reduced"], "Legacy accessibility and privacy flags remain intact");
legacy.saveSliceSettingsToStorage({ ...legacy.DEFAULT_SLICE_PLATFORM_SETTINGS, appearance: "light", density: "compact", largeText: true, highContrast: true });
legacy.applySliceSettings(legacy.loadSliceSettingsFromStorage(GLOBAL));
check(fresh.theme(), lightTheme, "An explicit legacy settings save updates the shared appearance authority");
check(runtime.readWorkspaceAppearance().textScale, "large");
check(runtime.readWorkspaceAppearance().density, "compact");

const rootLayout = fresh.load("src/app/layout.tsx");
const htmlTree = rootLayout.default({ children: "Fixture content" });
check([htmlTree.props["data-slice-theme"], htmlTree.props["data-slice-appearance"], htmlTree.props["data-slice-brand"]], ["dark", "dark", "neural"], "Server defaults match first paint");
check(htmlTree.props.className, "dark", "No-script rendering retains the dark Tailwind variant");
check(htmlTree.props["data-slice-beta"], "true", "The server advertises default beta access using the actual policy");
const standard = harness({}, { env: { SLICE_PULSE_BETA_UNCAPPED: "false" } });
const standardHtml = standard.load("src/app/layout.tsx").default({ children: "Standard-mode fixture" });
check([standardHtml.props["data-slice-beta"], standardHtml.props.className, standardHtml.props["data-slice-brand"]], ["false", "dark", "neural"], "Explicit standard mode disables beta without changing the neural theme");
const head = htmlTree.props.children.find(child => child.type === "head");
check(head.props.children.props.dangerouslySetInnerHTML.__html, fresh.load("src/lib/workspace/theme-bootstrap.ts").NEURAL_THEME_BOOTSTRAP, "Root layout executes the tested bootstrap exactly");
const platform = fresh.load("src/components/experience/platform-appearance.tsx");
platform.default();
const cleanup = fresh.effects.pop()();
check(typeof cleanup, "function", "The platform controller only registers the shared listener lifecycle");
cleanup();
// Failure of the existing account-settings service must not reset saved appearance.
const failureRequest = deferred();
const failure = harness({ [MIGRATION]: "complete", [SETTINGS]: JSON.stringify({ appearance: { mode: "light", motion: "reduced", textScale: "large", density: "compact" } }) }, { fetch: () => failureRequest.promise });
failure.paint();
const failureRuntime = failure.load("src/lib/workspace/appearance.ts"), failureHooks = hooks();
failure.useHooks(failureHooks);
const failureForm = failure.load("src/app/workspace/settings/page.tsx").default;
const stopFailureWatch = failureRuntime.watchWorkspaceAppearance();
failureHooks.render(failureForm);
failureRequest.resolve(response({ error: "Fixture settings service unavailable" }, false));
await flush(); failureHooks.render(failureForm);
check({ theme: failure.theme(), motion: failure.html.dataset.sliceMotion, scale: failure.html.dataset.sliceTextScale }, { theme: lightTheme, motion: "reduced", scale: "large" }, "A failed initial settings load preserves saved theme and accessibility");
failureHooks.unmount(); stopFailureWatch();

// Remembered opt-out preferences are saved for this visit, separate from a draft preview.
const visit = harness({ [MIGRATION]: "complete" }); visit.paint();
const visitRuntime = visit.load("src/lib/workspace/appearance.ts"), settingsHelpers = visit.load("src/app/workspace/settings/page.tsx").__settingsTest;
const stopVisitWatch = visitRuntime.watchWorkspaceAppearance();
const apiSettings = { appearance: { mode: "light", density: "Compact", accent: "Ruby" } };
const chosen = settingsHelpers.normalizeApiResponse(apiSettings, { appearance: { motion: "reduced", textScale: "large" }, privacy: { allowBrowserStorage: false } });
settingsHelpers.saveLocalSettings(chosen);
visitRuntime.previewWorkspaceAppearance({ mode: "dark", motion: "full", textScale: "standard" });
const reopened = settingsHelpers.normalizeApiResponse(apiSettings, settingsHelpers.readLocalSettings());
check({ mode: reopened.appearance.mode, motion: reopened.appearance.motion, scale: reopened.appearance.textScale, persistent: reopened.privacy.allowBrowserStorage }, { mode: "light", motion: "reduced", scale: "large", persistent: false }, "Reopening or resetting Settings restores the saved visit preference, not an unsaved preview or server omissions");
visitRuntime.clearWorkspaceAppearancePreview();
check({ theme: visit.theme(), motion: visit.html.dataset.sliceMotion, scale: visit.html.dataset.sliceTextScale }, { theme: lightTheme, motion: "reduced", scale: "large" });
stopVisitWatch();

// An intentional save can complete after navigation, but must not reopen its preview.
const saveRequest = deferred();
const lateSave = harness({ [MIGRATION]: "complete" }, { fetch: (_url, init) => init?.method === "POST" ? saveRequest.promise : Promise.resolve(response(accountResponse())) });
lateSave.paint();
const lateRuntime = lateSave.load("src/lib/workspace/appearance.ts"), lateHooks = hooks();
lateSave.useHooks(lateHooks);
const lateForm = lateSave.load("src/app/workspace/settings/page.tsx").default;
const stopLateWatch = lateRuntime.watchWorkspaceAppearance();
lateHooks.render(lateForm); await flush(); lateHooks.render(lateForm);
lateSave.context.__settingsActions.updateAppearance("mode", "light");
lateSave.context.__settingsActions.updateAppearance("motion", "reduced");
lateSave.context.__settingsActions.updateAppearance("textScale", "large");
lateHooks.render(lateForm);
const saving = lateSave.context.__settingsActions.saveSettings();
lateHooks.unmount();
check(lateSave.theme(), darkTheme, "Navigating away releases the unsaved preview while the request is pending");
saveRequest.resolve(response(accountResponse({mode: "light", motion: "reduced", textScale: "large"}))); await saving;
check({ theme: lateSave.theme(), motion: lateSave.html.dataset.sliceMotion, scale: lateSave.html.dataset.sliceTextScale }, { theme: lightTheme, motion: "reduced", scale: "large" }, "A successful late save notifies the shared controller after local persistence");
stopLateWatch();

// Saving one section must not erase drafts in unrelated sections.
let sectionApi = accountResponse({}, { notifications: [{ channel: "Email", enabled: true, minScore: 75, minUrgency: "High", digestOnly: false, quietHoursStart: "22:00", quietHoursEnd: "07:00", cooldownMinutes: 30 }] });
const isolated = harness({ [MIGRATION]: "complete" }, { fetch: (_url, init) => {
  if (init?.method === "POST") {
    const submitted = JSON.parse(init.body);
    if (submitted.action === "saveProfile") sectionApi = { ...sectionApi, account: { ...sectionApi.account, ...submitted.account } };
    return Promise.resolve(response(sectionApi));
  }
  return Promise.resolve(response(sectionApi));
} });
isolated.paint(); const isolatedHooks = hooks(); isolated.useHooks(isolatedHooks);
const isolatedForm = isolated.load("src/app/workspace/settings/page.tsx").default;
isolatedHooks.render(isolatedForm); await flush(); isolatedHooks.render(isolatedForm);
isolated.context.__settingsActions.setProfile({ name: "Renamed User" });
isolated.context.__settingsActions.updateAppearance("mode", "light");
isolated.context.__settingsActions.setNotification("Email", { minScore: 92 });
isolatedHooks.render(isolatedForm);
check(isolated.context.__settingsActions.getState().dirty, { profile: true, appearance: true, notifications: true }, "Each functional section owns its dirty state");
await isolated.context.__settingsActions.saveSettings("profile"); isolatedHooks.render(isolatedForm);
let isolatedState = isolated.context.__settingsActions.getState();
check([isolatedState.settings.account.name, isolatedState.settings.appearance.mode, isolatedState.settings.notifications[0].minScore], ["Renamed User", "light", 92], "Profile save preserves unsaved appearance and alert filters");
check(isolatedState.dirty, { profile: false, appearance: true, notifications: true }, "Only the saved section becomes clean");
isolated.context.__settingsActions.resetSection("appearance"); isolatedHooks.render(isolatedForm);
isolatedState = isolated.context.__settingsActions.getState();
check([isolatedState.settings.appearance.mode, isolatedState.settings.notifications[0].minScore], ["dark", 92], "Discarding one section leaves the other draft untouched");
isolatedHooks.unmount();

// Failure keeps a deliberate choice as a draft, without falsely persisting it.
const rejected = harness({ [MIGRATION]: "complete" }, { fetch: (_url, init) => Promise.resolve(init?.method === "POST" ? response({ok:false,error:{message:"Fixture save was rejected"}},false) : response(accountResponse())) });
rejected.paint(); const rejectedHooks = hooks(); rejected.useHooks(rejectedHooks);
const rejectedForm = rejected.load("src/app/workspace/settings/page.tsx").default;
rejectedHooks.render(rejectedForm); await flush(); rejectedHooks.render(rejectedForm);
rejected.context.__settingsActions.updateAppearance("mode", "light"); rejectedHooks.render(rejectedForm);
await rejected.context.__settingsActions.saveSettings(); rejectedHooks.render(rejectedForm);
const rejectedState = rejected.context.__settingsActions.getState();
check([rejectedState.settings.appearance.mode,rejectedState.dirty.appearance,rejectedState.notice.error], ["light",true,true], "A failed save preserves the draft and reports failure");
check(rejected.values.has(SETTINGS), false, "A rejected account save cannot overwrite local appearance");
rejectedHooks.unmount(); check(rejected.theme(), darkTheme, "Leaving a failed draft restores the saved theme");

// A slower previous load cannot replace a newer account response.
const olderRequest = deferred(), newerRequest = deferred(); let loadCount = 0;
const racing = harness({ [MIGRATION]: "complete" }, { fetch: () => (++loadCount === 1 ? olderRequest : newerRequest).promise });
racing.paint(); const racingHooks = hooks(); racing.useHooks(racingHooks);
const racingForm = racing.load("src/app/workspace/settings/page.tsx").default;
racingHooks.render(racingForm); const reloading = racing.context.__settingsActions.loadSettings();
newerRequest.resolve(response(accountResponse({}, {account:{...accountResponse().account,name:"Latest response"}}))); await reloading; racingHooks.render(racingForm);
olderRequest.resolve(response(accountResponse({}, {account:{...accountResponse().account,name:"Stale response"}}))); await flush(); racingHooks.render(racingForm);
check(racing.context.__settingsActions.getState().settings.account.name, "Latest response", "An aborted, late account fetch is fenced from current form state");
racingHooks.unmount();

// Browser storage failure still respects a successful account save and gives accurate feedback.
const blocked = harness({ [MIGRATION]: "complete" }, { writeBlocked: true, fetch: (_url, init) => Promise.resolve(response(accountResponse(init?.method === "POST" ? JSON.parse(init.body).appearance : {}))) });
blocked.paint(); const blockedHooks = hooks(); blocked.useHooks(blockedHooks);
const blockedForm = blocked.load("src/app/workspace/settings/page.tsx").default;
const blockedRuntime = blocked.load("src/lib/workspace/appearance.ts"), stopBlockedWatch = blockedRuntime.watchWorkspaceAppearance();
blockedHooks.render(blockedForm); await flush(); blockedHooks.render(blockedForm);
blocked.context.__settingsActions.updateAppearance("mode", "light"); blockedHooks.render(blockedForm);
await blocked.context.__settingsActions.saveSettings(); blockedHooks.render(blockedForm);
check(blocked.context.__settingsActions.getState().notice.text.includes("browser blocked local storage"), true, "Storage fallback is explained instead of claiming persistence");
blockedHooks.unmount(); check(blocked.theme(), lightTheme, "The saved visit choice survives Settings unmount even when local writes are blocked"); stopBlockedWatch();

console.log(`Neural theme runtime checks passed (${assertions} assertions): shared prepaint/hydration, one-time dark migration, retained settings, later light/system choice, blocked storage, preview restoration, listener cleanup, and legacy-provider consistency.`);
