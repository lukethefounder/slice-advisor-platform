import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";

const requireFromHere = createRequire(import.meta.url);
const ts = requireFromHere("typescript");
const root = process.cwd();

function loadTsModule(file, imports = {}) {
  const source = readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    console,
    URL,
    setTimeout,
    clearTimeout,
    require(id) {
      if (id in imports) return imports[id];
      throw new Error(`Unexpected test import: ${id}`);
    },
  };
  vm.runInNewContext(compiled, sandbox, { filename: file });
  return module.exports;
}

const promptModule = loadTsModule(
  resolve(root, "src/lib/email-center/prompt.ts"),
);

const cases = [
  {
    prompt:
      "Prepare a calm, concise email explaining recent market volatility, reassure the client that we are monitoring their plan rather than reacting to headlines, avoid predictions, and invite them to schedule a review if they have questions.",
    type: "Market Update",
    subjectIncludes: "Market Volatility",
  },
  {
    prompt:
      "Write a warm follow-up email after our retirement planning meeting. Recap that we discussed cash flow and beneficiary updates, avoid legal conclusions, and ask the client to upload the requested statements.",
    type: "Meeting Follow-up",
    subjectIncludes: "Follow-Up",
  },
  {
    prompt:
      "Create a professional email requesting the latest tax return and brokerage statement for the annual planning review. Explain that the documents should be uploaded through the secure portal.",
    type: "Document Request",
    subjectIncludes: "Documents",
  },
  {
    prompt:
      "Draft a measured email about NVDA concentration in the portfolio. Explain that we are reviewing diversification and risk, do not recommend an automatic sale, and invite the client to discuss options.",
    type: "Portfolio Review",
    subjectIncludes: "NVDA",
  },
  {
    prompt:
      "Prepare an email to schedule our annual review and ask the client to choose a time using the advisor scheduling link.",
    type: "Scheduling",
    subjectIncludes: "Scheduling",
  },
];

let assertions = 0;
for (const [index, testCase] of cases.entries()) {
  const plan = promptModule.compileEmailPrompt({
    prompt: testCase.prompt,
    tone: "Professional",
  });
  const draft = promptModule.buildImmediateEmailDraft({
    plan,
    advisorName: "Alex Advisor",
    client: {
      id: `client-${index}`,
      fullName: "Jordan Client",
      householdName: "Client Household",
      email: "jordan@example.com",
      emailMissing: false,
      clientType: "Private Client",
      riskProfile: "Balanced",
      status: "Active",
      assignedAdvisorMembershipId: "advisor-1",
      holdingSymbols: ["NVDA", "SPY"],
    },
  });
  const assessment = promptModule.assessGeneratedEmail({ plan, ...draft });

  assert.equal(plan.messageType, testCase.type);
  assert.match(draft.subject, new RegExp(testCase.subjectIncludes, "i"));
  assert.ok(draft.body.length > 320);
  assert.ok(!draft.body.toLowerCase().includes("write an email"));
  assert.ok(!draft.body.toLowerCase().includes("prepare a calm"));
  assert.ok(assessment.acceptable);
  assertions += 6;
}

const echoedPlan = promptModule.compileEmailPrompt({
  prompt: "Write an email explaining current market volatility and invite the client to reply.",
});
const echoed = promptModule.assessGeneratedEmail({
  plan: echoedPlan,
  subject: "Email",
  body: "Write an email explaining current market volatility and invite the client to reply.",
});
assert.equal(echoed.acceptable, false);
assertions += 1;

const detailedPrompt =
  "Create a detailed client email about the ABC income strategy. " +
  "On August 8, 2026, the distribution rate changed to 4.2%. " +
  "Explain that the change does not guarantee future income, " +
  "note that the client holds ABC and SPY, and ask them to schedule " +
  "a review before September 1, 2026.";

const detailedPlan =
  promptModule.compileEmailPrompt({
    prompt: detailedPrompt,
    tone: "Professional",
  });

const detailedDraft =
  promptModule.buildImmediateEmailDraft({
    plan: detailedPlan,
    advisorName: "Alex Advisor",
    client: {
      id: "detailed-client",
      fullName: "Jordan Client",
      householdName: "Client Household",
      email: "jordan@example.com",
      emailMissing: false,
      clientType: "Private Client",
      riskProfile: "Balanced",
      status: "Active",
      assignedAdvisorMembershipId: "advisor-1",
      holdingSymbols: ["ABC", "SPY"],
    },
  });

const detailedAssessment =
  promptModule.assessGeneratedEmail({
    plan: detailedPlan,
    ...detailedDraft,
  });

assert.equal(
  detailedPlan.messageType,
  "Portfolio Review",
);
assert.ok(
  detailedPlan.keyFacts.some((fact) =>
    fact.includes("August 8, 2026"),
  ),
);
assert.ok(
  detailedPlan.keyFacts.some((fact) =>
    fact.includes("4.2%"),
  ),
);
assert.ok(
  detailedPlan.keyFacts.some((fact) =>
    /ABC.*SPY/i.test(fact),
  ),
);
assert.ok(
  detailedPlan.supportingDetails.some((detail) =>
    /does not guarantee future income/i.test(detail),
  ),
);
assert.equal(
  detailedPlan.informationArchitecture.length,
  4,
);
assert.match(
  detailedDraft.subject,
  /ABC.*Portfolio|Portfolio.*ABC/i,
);
assert.match(
  detailedDraft.body,
  /August 8, 2026/,
);
assert.match(
  detailedDraft.body,
  /4\.2%/,
);
assert.ok(
  !detailedDraft.body
    .toLowerCase()
    .includes("create a detailed client email"),
);
assert.ok(
  detailedAssessment.acceptable,
);

const secondDetailedPlan =
  promptModule.compileEmailPrompt({
    prompt:
      "Create a detailed email requesting the client's 2025 tax return " +
      "and July 2026 brokerage statement through the secure portal by " +
      "August 20, 2026. Explain that the records are needed to update " +
      "cash-flow and tax-planning assumptions.",
    tone: "Professional",
  });
const secondDetailedDraft =
  promptModule.buildImmediateEmailDraft({
    plan: secondDetailedPlan,
    advisorName: "Alex Advisor",
    client: {
      id: "document-client",
      fullName: "Jordan Client",
      householdName: "Client Household",
      email: "jordan@example.com",
      emailMissing: false,
      clientType: "Private Client",
      riskProfile: "Balanced",
      status: "Active",
      assignedAdvisorMembershipId: "advisor-1",
      holdingSymbols: [],
    },
  });

assert.notEqual(
  detailedDraft.subject,
  secondDetailedDraft.subject,
);
assert.notEqual(
  detailedDraft.body,
  secondDetailedDraft.body,
);

const missingFactPlan =
  promptModule.compileEmailPrompt({
    prompt:
      "Write a client email about the latest market news and explain " +
      "what it means for the plan without inventing facts.",
  });
assert.ok(
  missingFactPlan.missingInformation.length > 0,
);

const serviceSource = readFileSync(
  resolve(root, "src/lib/email-center/service.ts"),
  "utf8",
);
const routeSource = readFileSync(
  resolve(root, "src/app/api/client-emails/route.ts"),
  "utf8",
);
const pageSource = readFileSync(
  resolve(root, "src/app/workspace/client-emails/page.tsx"),
  "utf8",
);

assert.match(
  serviceSource,
  /export async function listClientEmailArchive/,
);
assert.match(
  serviceSource,
  /in:\s*\["Sent",\s*"Simulated"\]/,
);
assert.match(
  serviceSource,
  /approvedAt:/,
);
assert.match(
  serviceSource,
  /sentAt:/,
);
assert.match(
  serviceSource,
  /htmlEncrypted/,
);
assert.match(
  routeSource,
  /view === "archive"/,
);
assert.match(
  routeSource,
  /deliveryId:\s*url\.searchParams\.get\("deliveryId"\)/,
);
assert.match(
  pageSource,
  /type Stage = "prompt" \| "drafts" \| "approval" \| "archive"/,
);
assert.match(
  pageSource,
  /Sent Archive/,
);
assert.match(
  pageSource,
  /srcDoc=\{activeArchiveItem\.html\}/,
);
assert.match(
  serviceSource,
  /function encodeArchiveCursor/,
);
assert.match(
  serviceSource,
  /take:\s*pageSize \+ 1/,
);
assert.match(
  pageSource,
  /Load older sent emails/,
);
const contractsSource = readFileSync(
  resolve(root, "src/lib/email-center/contracts.ts"),
  "utf8",
);
assert.match(
  contractsSource,
  /pagination:\s*\{[\s\S]*nextCursor:[\s\S]*hasMore:[\s\S]*pageSize:/,
);

const jobsSource = readFileSync(
  resolve(root, "src/lib/email-center/jobs.ts"),
  "utf8",
);

assert.match(serviceSource, /export async function getClientEmailDraftProgress/);
assert.match(routeSource, /view === "progress"/);
assert.match(serviceSource, /starterReady:\s*false/);
assert.match(serviceSource, /status:\s*"Generating"/);
assert.match(contractsSource, /portfolioValueNumber:\s*number \| null/);
assert.match(contractsSource, /portfolioBand:\s*EmailPortfolioBand/);
assert.match(pageSource, /function DraftGenerationProgress/);
assert.match(pageSource, /holdingFilter/);
assert.match(pageSource, /portfolioBandFilter/);
assert.match(pageSource, /temporarily locked/);
assert.match(jobsSource, /timeoutMs:\s*payload\.speedMode === "Quick" \? 5_500/);
assert.match(jobsSource, /reportProgress\(100, "Custom AI email complete and ready to edit"\)/);

assertions += 39;

let contextLoads = 0;
let researchCalls = 0;
const minimalContext = {
  generatedAt: new Date().toISOString(),
  user: { id: "u1", name: "Alex" },
  firm: { id: "f1", name: "Firm", role: "Advisor", membershipId: "m1" },
  permissions: {
    canManageFirm: false,
    canManageProjects: true,
    canInviteMembers: false,
    canAccessPortfolios: true,
    canManageClientRouting: false,
  },
  privacy: {
    clientNamesIncludedInAiSnapshot: false,
    privateClientDataMayBeWebSearched: false,
    note: "Private data is protected.",
  },
  capabilities: [],
  platformBrain: { routes: [], learnedPhrases: [], corrections: [] },
  metrics: {
    accessibleClients: 0,
    activeClients: 0,
    clientsNeedingReview: 0,
    clientHoldings: 0,
    openPersonalTasks: 0,
    openFirmTasks: 0,
    unreadAlerts: 0,
    highPriorityAlerts: 0,
    openOpportunities: 0,
    pendingApprovals: 0,
    activeWatchlistItems: 0,
    activePriceAlerts: 0,
    reportsReady: 0,
    activeProjects: 0,
    unreadAssignedClientMessages: 0,
  },
  recent: {
    alerts: [],
    opportunities: [],
    watchlistItems: [],
    researchNotes: [],
    tasks: [],
    projects: [],
    reports: [],
    approvals: [],
    clients: [],
    assignedClientMessages: [],
  },
  memory: [],
};

const command = (intent, route = null) => ({
  intent,
  confidence: 0.96,
  riskLevel: "Low",
  requiresApproval: false,
  route,
  answer: route ? `Open ${route}` : "Answer",
  userFacingSummary: "Ready",
  parameters: {
    route,
    ticker: null,
    query: null,
    title: null,
    detail: null,
    dueDate: null,
    priority: null,
    clientName: null,
    email: null,
    projectTitle: null,
    watchlistName: null,
    symbol: null,
    upperTargetPrice: null,
    lowerTargetPrice: null,
    color: null,
    reportTitle: null,
    subject: null,
    body: null,
    recipient: null,
    deliveryChannel: null,
    phone: null,
    jobKey: null,
    memory: null,
    approvalDecision: null,
    researchDepth: "standard",
  },
});

const orchestrator = loadTsModule(
  resolve(root, "src/lib/ai-studio/orchestrator.ts"),
  {
    "@/lib/bot/fast-command-router": {
      matchFastCommand({ prompt }) {
        if (/open clients/i.test(prompt)) {
          return { matched: true, confidence: 0.97, reason: "route_alias", command: command("navigate", "/workspace/clients") };
        }
        return { matched: true, confidence: 0.86, reason: "chat_first_universal_answer", command: command("answer") };
      },
    },
    "@/lib/integrations/ai": {
      async parseSliceCommandWithAi() {
        return { ok: true, provider: "parser", command: command("answer") };
      },
      async generateUniversalAssistantReply(input) {
        researchCalls += input.enableWebSearch ? 1 : 0;
        return {
          ok: true,
          provider: "OpenAI",
          status: "completed",
          text: input.enableWebSearch ? "Researched answer" : "Fast answer",
          sources: input.enableWebSearch
            ? [{ type: "web", title: "Primary Source", url: "https://www.sec.gov/example" }]
            : [],
          researchUsed: input.enableWebSearch,
          model: "fast-model",
          latencyMs: 120,
        };
      },
    },
    "@/lib/ai-studio/platform-context": {
      SLICE_PLATFORM_CAPABILITIES: [],
      compactSlicePlatformContext(context) {
        return context;
      },
    },
    "@/lib/ai-studio/context-cache": {
      async loadCachedSlicePlatformContext() {
        contextLoads += 1;
        return { context: minimalContext, cacheState: "fresh", ageMs: 10 };
      },
    },
  },
);

const baseInput = {
  user: { id: "u1", name: "Alex", email: "alex@example.com" },
  profile: {
    id: "p1",
    userId: "u1",
    firmId: "f1",
    botName: "Slice AI",
    preferredTone: "Professional",
    commandStyle: "Concise",
    autonomyLevel: "Approval required",
    personalityJson: "{}",
    riskJson: "{}",
    customInstructions: null,
  },
};

const direct = await orchestrator.orchestrateAiStudioRequest({
  ...baseInput,
  prompt: "Open clients",
  answerMode: "quick",
});
assert.equal(direct.routing.lane, "direct");
assert.equal(contextLoads, 0);
assert.equal(direct.aiResponse, null);
assertions += 3;

const current = await orchestrator.orchestrateAiStudioRequest({
  ...baseInput,
  prompt: "What is the latest regulatory outlook for public company disclosures? Include primary sources.",
  answerMode: "balanced",
});
assert.equal(current.routing.researchRequired, true);
assert.equal(current.routing.effectiveSpeedMode, "balanced");
assert.equal(researchCalls, 1);
assertions += 3;

let rawContextLoads = 0;
const contextCacheModule = loadTsModule(
  resolve(root, "src/lib/ai-studio/context-cache.ts"),
  {
    "server-only": {},
    "@/lib/ai-studio/platform-context": {
      async loadSlicePlatformContext() {
        rawContextLoads += 1;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
        return minimalContext;
      },
    },
  },
);

const cacheProfile = baseInput.profile;
const [coalescedLeft, coalescedRight] = await Promise.all([
  contextCacheModule.loadCachedSlicePlatformContext({
    user: baseInput.user,
    profile: cacheProfile,
  }),
  contextCacheModule.loadCachedSlicePlatformContext({
    user: baseInput.user,
    profile: cacheProfile,
  }),
]);
const freshCache = await contextCacheModule.loadCachedSlicePlatformContext({
  user: baseInput.user,
  profile: cacheProfile,
});
assert.equal(rawContextLoads, 1);
assert.equal(coalescedLeft.context, minimalContext);
assert.equal(coalescedRight.context, minimalContext);
assert.equal(freshCache.cacheState, "fresh");
assertions += 4;

console.log(
  JSON.stringify(
    {
      ok: true,
      test: "ai-email-generation-cockpit-v4",
      assertions,
      directLane: direct.routing.lane,
      researchLane: current.routing.lane,
    },
    null,
    2,
  ),
);