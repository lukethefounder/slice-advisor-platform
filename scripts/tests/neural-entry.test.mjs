import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const temporary = await mkdtemp(join(tmpdir(), "slice-neural-entry-"));
const modules = {
  layout: "src/app/workspace/layout.tsx",
  access: "src/lib/instant-workspace/access.ts",
  home: "src/app/page.tsx",
  hero: "src/components/knowledge-graph/landing-hero.tsx",
};
const modulePaths = {
  "@/components/knowledge-graph/landing-hero": "./hero.mjs",
  "@/components/workspace/core/workspace-shell": "./shell.mjs",
  "@/components/connected-workspace/research-route-boundary": "./boundary.mjs",
  "next/link": "./link.mjs",
  "next/dynamic": "./dynamic.mjs",
  "lucide-react": "./icons.mjs",
};

try {
  await writeFile(join(temporary, "mocks.mjs"), `
    let layoutResult = { access: null, session: null }, layoutFailure = null, context = null, contextFailure = null;
    const events = [], accessOptions = [];
    export const setLayoutResult = value => { layoutResult = value; layoutFailure = null; };
    export const setLayoutFailure = value => { layoutFailure = value; };
    export const setContext = value => { context = value; contextFailure = null; };
    export const setContextFailure = value => { contextFailure = value; };
    export const getEvents = () => events;
    export const resetEvents = () => { events.length = 0; };
    export const getAccessOptions = () => accessOptions;
    export async function serverWorkspaceAccess() { events.push({ kind: "access" }); if (layoutFailure) throw layoutFailure; return layoutResult; }
    export function redirect(location) { events.push({ kind: "redirect", location }); const error = new Error("NEXT_REDIRECT"); error.location = location; throw error; }
    export async function requireCurrentAccessContext(options) { accessOptions.push(options); if (contextFailure) throw contextFailure; return context; }
    export const isAgentDeskFounder = email => typeof email === "string" && email.trim().toLowerCase() === "fixture-founder@example.test";
    export const cache = callback => callback;
    export const Suspense = Symbol.for("test.Suspense"), Fragment = Symbol.for("test.Fragment");
    export const WorkspaceShell = Symbol.for("test.WorkspaceShell"), ResearchRouteBoundary = Symbol.for("test.ResearchRouteBoundary");
    export const AdvisorRoutingDock = Symbol.for("test.AdvisorRoutingDock"), Link = Symbol.for("test.Link");
    export function jsx(type, props, key) { events.push({ kind: "jsx", type }); return { type, props: props ?? {}, key }; }
    export const jsxs = jsx;
    export const useAmbientMotion = () => ({ ref: null, moving: false, paused: true, toggle() {} });
    export const DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS = 86400000, DEFAULT_PUBLIC_EDITION_MAX_AGE_MS = 86400000;
    export const isTimestampWithin = () => false;
    export const freshenPublicSnapshot = () => { throw new Error("Public feed must remain a separate async boundary"); };
    export const getPublicIntelligence = async () => { throw new Error("Navigation tests must not request public evidence"); };
    export const safeResearchSourceUrl = () => "";
  `);
  for (const [file, exported] of [["shell", "WorkspaceShell"], ["boundary", "ResearchRouteBoundary"], ["link", "Link"]]) {
    await writeFile(join(temporary, `${file}.mjs`), `export { ${exported} as default } from "./mocks.mjs";`);
  }
  await writeFile(join(temporary, "styles.mjs"), "export default new Proxy({}, { get: (_target, key) => String(key) });");
  await writeFile(join(temporary, "dynamic.mjs"), "export default function dynamic() { return Symbol.for('test.DynamicScene'); }");

  const iconNames = new Set();
  for (const [name, path] of Object.entries(modules)) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
    const syntax = ts.createSourceFile(path, source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    for (const statement of syntax.statements) {
      if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text === "lucide-react") {
        for (const element of statement.importClause?.namedBindings?.elements ?? []) iconNames.add(element.propertyName?.text ?? element.name.text);
      }
    }
    const compiled = ts.transpileModule(source.replace(/^import ["']server-only["'];?\s*$/m, ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }, fileName: path, reportDiagnostics: true,
    });
    assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} must transpile`);
    const output = compiled.outputText.replace(/from (["'])([^"']+)\1/g, (_match, _quote, specifier) => `from "${specifier.endsWith(".module.css") ? "./styles.mjs" : modulePaths[specifier] ?? "./mocks.mjs"}"`);
    await writeFile(join(temporary, `${name}.mjs`), output);
  }
  await writeFile(join(temporary, "icons.mjs"), [...iconNames].map(name => `export const ${name} = Symbol.for(${JSON.stringify(`test.icon.${name}`)});`).join("\n"));

  const load = name => import(pathToFileURL(join(temporary, `${name}.mjs`)).href);
  const mocks = await load("mocks");
  const { default: WorkspaceLayout } = await load("layout");
  const { serverWorkspaceAccess: actualAccess } = await load("access");
  const { default: HomePage } = await load("home");
  const { default: LandingHero } = await load("hero");

  const session = { loading: false, error: "", user: { id: "owner-a", name: "Fixture Advisor" }, firm: { id: "firm-a", name: "Fixture Firm" }, role: "Advisor", agentDeskFounder: false };
  const access = { userId: "owner-a", firmId: "firm-a", context: { user: { ...session.user, email: "fixture-member@example.test", platformStatus: "Active" }, firm: { ...session.firm, platformStatus: "Active" }, membership: { role: "Advisor" } } };
  const privateChild = { type: "private-fixture-route", props: { secret: "private-child-marker" } };

  for (const absent of [null, undefined]) {
    // A non-null session-shaped payload is insufficient; the server access decision controls entry.
    mocks.setLayoutResult({ access: absent, session }); mocks.resetEvents();
    await assert.rejects(() => WorkspaceLayout({ children: privateChild }), error => error.message === "NEXT_REDIRECT" && error.location === "/founder-login");
    assert.deepEqual(mocks.getEvents().map(event => event.kind), ["access", "redirect"], "Reject access before constructing the private shell, route boundary, children, or navigation");
  }
  const accessFailure = new Error("Fixture access check failure");
  mocks.setLayoutFailure(accessFailure); mocks.resetEvents();
  await assert.rejects(() => WorkspaceLayout({ children: privateChild }), error => error === accessFailure);
  assert.deepEqual(mocks.getEvents().map(event => event.kind), ["access"], "An access-check exception must not render the workspace");

  mocks.setLayoutResult({ access, session }); mocks.resetEvents();
  const authorized = await WorkspaceLayout({ children: privateChild });
  assert.equal(authorized.type, mocks.WorkspaceShell);
  assert.equal(authorized.props.initialSession, session, "Pass the validated server session intact to the private shell");
  assert.equal(mocks.getEvents()[0].kind, "access", "Authorization must run before JSX construction");
  assert.equal(mocks.getEvents().some(event => event.kind === "redirect"), false);
  const nodes = value => {
    if (Array.isArray(value)) return value.flatMap(nodes);
    if (!value || typeof value !== "object" || !("props" in value)) return [];
    return [value, ...nodes(value.props.children)];
  };
  const privateTree = nodes(authorized);
  const boundary = privateTree.find(node => node.type === mocks.ResearchRouteBoundary);
  assert.equal(boundary?.props.children, privateChild, "Preserve the exact authorized child route inside its research boundary");
  assert.ok(privateTree.some(node => node.type === mocks.Suspense));
  assert.ok(privateTree.some(node => node.type === mocks.AdvisorRoutingDock));

  // Exercise the actual helper too: require firm access and discard incomplete/failed identities.
  for (const context of [null, { user: session.user, firm: null }, { user: null, firm: session.firm }]) {
    mocks.setContext(context);
    const unavailable = await actualAccess();
    assert.equal(unavailable.access, null);
    assert.equal(unavailable.session.user, null);
    assert.equal(unavailable.session.firm, null);
    assert.equal(unavailable.session.agentDeskFounder, false, "An unavailable identity must not retain founder capability");
  }
  mocks.setContextFailure(new Error("Fixture expired session"));
  assert.equal((await actualAccess()).access, null);
  mocks.setContext(access.context);
  const permitted = await actualAccess();
  assert.deepEqual(permitted.access, access);
  assert.deepEqual(permitted.session, session);
  assert.ok(mocks.getAccessOptions().length >= 5);
  assert.ok(mocks.getAccessOptions().every(options => options.requireFirm === true), "Every helper resolution must require active firm access");
  mocks.setContext({ ...access.context, membership: null });
  assert.equal((await actualAccess()).session.role, "Firm access");

  mocks.setContext({ ...access.context, isFounder: true, membership: { role: "Founder" } });
  assert.equal((await actualAccess()).session.agentDeskFounder, false, "A role or broader founder flag must not substitute for the email capability");
  const founderContext = { ...access.context, user: { ...access.context.user, email: " FIXTURE-FOUNDER@EXAMPLE.TEST " } };
  mocks.setContext(founderContext);
  const founderSession = (await actualAccess()).session;
  assert.equal(founderSession.agentDeskFounder, true, "Serialize the active configured founder capability for navigation");
  assert.equal(JSON.stringify(founderSession).includes("fixture-founder"), false, "The shell receives a boolean, not the allowlist or a founder email disclosure");
  for (const context of [
    { ...founderContext, user: { ...founderContext.user, platformStatus: "Suspended" } },
    { ...founderContext, firm: { ...founderContext.firm, platformStatus: "Suspended" } },
    { ...founderContext, user: { ...founderContext.user, email: undefined } },
  ]) {
    mocks.setContext(context);
    assert.equal((await actualAccess()).session.agentDeskFounder, false, "Inactive or incomplete access cannot expose the founder agents");
  }

  function visibleText(value) {
    if (Array.isArray(value)) return value.map(visibleText).join(" ");
    if (typeof value === "string" || typeof value === "number") return String(value);
    return value && typeof value === "object" && "props" in value ? visibleText(value.props.children) : "";
  }
  const base = "https://slice.example";
  function navigation(tree) {
    return nodes(tree).filter(node => node.type === mocks.Link || node.type === "a").map(node => {
      assert.equal(typeof node.props.href, "string", "Public entry destinations should be concrete navigation URLs");
      const url = new URL(node.props.href, base);
      return { href: node.props.href, path: decodeURIComponent(url.pathname), internal: url.origin === base, label: visibleText(node.props.children) };
    });
  }
  const homeLinks = navigation(await HomePage()), heroLinks = navigation(LandingHero());
  for (const [name, links] of [["public home", homeLinks], ["landing hero", heroLinks]]) {
    assert.ok(links.length > 0, `${name} must expose navigation`);
    assert.equal(links.some(link => link.internal && /^\/workspace(?:\/|$)/i.test(link.path)), false, `${name} must not link directly into a workspace route`);
    assert.ok(links.some(link => link.path === "/founder-login"), `${name} must retain a sign-in entry`);
    for (const link of links.filter(link => /sign\s*in|workspace/i.test(link.label))) {
      assert.equal(link.path, "/founder-login", `${name}'s private-workspace entry must go through sign-in`);
    }
  }
  assert.ok(homeLinks.some(link => link.path === "/client-login"), "Keep the separate client sign-in entry available");
  assert.ok(heroLinks.filter(link => !link.href.startsWith("#")).every(link => link.path === "/founder-login"), "The hero's platform-entry action must only lead to sign-in");
  assert.ok(homeLinks.some(link => link.href.startsWith("#")), "Public exploration remains available without entering a workspace");

  console.log("Neural entry checks passed: server guard before private render, authenticated session/children continuity, required firm access, fail-closed founder capability serialization, incomplete identity handling, and sign-in-only public workspace entry.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
