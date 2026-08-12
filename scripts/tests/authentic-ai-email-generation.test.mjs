import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";

const requireHere = createRequire(import.meta.url);
const ts = requireHere("typescript");
const root = process.cwd();

function source(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function loadTsModule(relativePath, imports, globals = {}) {
  const file = resolve(root, relativePath);
  const compiled = ts.transpileModule(source(relativePath), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    console,
    AbortController,
    setTimeout,
    clearTimeout,
    URL,
    require(id) {
      if (id in imports) return imports[id];
      if (id === "node:crypto") return requireHere("node:crypto");
      throw new Error(`Unexpected test import: ${id}`);
    },
    ...globals,
  };

  vm.runInNewContext(compiled, sandbox, { filename: file });
  return module.exports;
}

let assertions = 0;
const capturedBodies = [];

const aiGenerator = loadTsModule(
  "src/lib/email-center/ai-generator.ts",
  {
    "server-only": {},
    "@/lib/env": {
      getOptionalEnv(name) {
        if (name === "OPENAI_API_KEY") return "sk-test-authentic-ai-email-key-1234567890";
        if (name === "OPENAI_EMAIL_FAST_MODEL") return "gpt-5-mini";
        return "";
      },
    },
    "@/lib/integrations/ai": {
      getOpenAiRuntimeStatus() {
        return {
          fastModel: "gpt-5-mini",
          model: "gpt-5-mini",
          qualityModel: "gpt-5",
        };
      },
    },
  },
  {
    async fetch(_url, init) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      capturedBodies.push(body);

      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            return name.toLowerCase() === "x-request-id"
              ? "req_authentic_email_1"
              : null;
          },
        },
        async json() {
          return {
            id: "resp_authentic_email_1",
            output_text: JSON.stringify({
              options: [
                {
                  subject: "NVDA Concentration: Review and Next Steps",
                  body:
                    "Hello Jordan,\n\nWe are reviewing the role of NVDA within your portfolio because your request specifically called for a concentration-focused update. The purpose is not to recommend an automatic sale, but to evaluate how the position fits with diversification, liquidity, risk tolerance, and your broader plan.\n\nWe will review the verified position data, the assumptions supporting the allocation, and any tax or timing considerations before recommending a course of action. Please reply with a convenient time for a portfolio review.\n\nBest,\nAlex Advisor",
                  strategy:
                    "Translate the exact concentration prompt into a calm portfolio-review email.",
                  complianceNotes: [
                    "Verify the actual NVDA allocation before approval.",
                  ],
                  promptCoverage: [
                    "NVDA concentration",
                    "No automatic sale recommendation",
                    "Invite a portfolio review",
                  ],
                  factsUsed: [
                    "The advisor requested an NVDA concentration review.",
                  ],
                },
              ],
            }),
          };
        },
      };
    },
  },
);

const result = await aiGenerator.generateCustomAiEmailOptions({
  prompt: JSON.stringify({
    originalAdvisorPrompt:
      "Draft a measured email about NVDA concentration. Do not recommend an automatic sale. Invite the client to a review.",
    client: {
      name: "Jordan Client",
      holdings: [{ symbol: "NVDA" }],
    },
  }),
  instructions:
    "Write the finished client email from this exact prompt.",
  optionCount: 1,
  speedMode: "Quick",
  safetyIdentifier: "advisor@example.com",
});

assert.equal(result.ok, true);
assert.equal(result.options.length, 1);
assert.match(result.options[0].subject, /NVDA Concentration/i);
assert.match(result.options[0].body, /automatic sale/i);
assert.match(result.options[0].body, /portfolio review/i);
assert.doesNotMatch(result.options[0].body, /draft a measured email/i);
assert.equal(
  JSON.stringify(result.options[0].promptCoverage),
  JSON.stringify([
    "NVDA concentration",
    "No automatic sale recommendation",
    "Invite a portfolio review",
  ]),
);
assert.equal(result.requestId, "req_authentic_email_1");
assertions += 8;

assert.equal(capturedBodies.length, 1);
assert.equal(capturedBodies[0].text.format.type, "json_schema");
assert.equal(capturedBodies[0].text.format.strict, true);
assert.equal(capturedBodies[0].text.format.name, "slice_custom_client_email");
assert.equal(capturedBodies[0].store, false);
assert.equal(capturedBodies[0].tools, undefined);
assertions += 6;

const generatorSource = source("src/lib/email-center/ai-generator.ts");
const jobsSource = source("src/lib/email-center/jobs.ts");
const serviceSource = source("src/lib/email-center/service.ts");
const routeSource = source("src/app/api/client-emails/route.ts");
const pageSource = source("src/app/workspace/client-emails/page.tsx");
const facadeSource = source("src/lib/client-email-center.ts");
const backendJobsSource = source("src/lib/backend/jobs.ts");

assert.match(generatorSource, /type:\s*"json_schema"/);
assert.match(generatorSource, /strict:\s*true/);
assert.match(generatorSource, /store:\s*false/);
assert.doesNotMatch(generatorSource, /fallbackText/);
assertions += 4;

assert.match(jobsSource, /generateCustomAiEmailOptions/);
assert.match(jobsSource, /EMAIL_AI_CUSTOM_GENERATION_FAILED/);
assert.match(jobsSource, /EMAIL_AI_CUSTOM_OUTPUT_REJECTED/);
assert.match(jobsSource, /promptCoverage/);
assert.match(jobsSource, /factsUsed/);
assert.match(jobsSource, /const fallbackUsed = false/);
assert.doesNotMatch(jobsSource, /fallbackText:\s*JSON\.stringify/);
assert.doesNotMatch(jobsSource, /fallbackEvaluated/);
assert.doesNotMatch(jobsSource, /fallbackOptions\(/);
assertions += 9;

assert.match(serviceSource, /EMAIL_AI_VERIFIED_OUTPUT_REQUIRED/);
assert.match(serviceSource, /retryAiClientEmailGeneration/);
assert.match(serviceSource, /EMAIL_AI_RETRY_CONTEXT_MISSING/);
assert.match(serviceSource, /metadata\.generation\.status !== "Completed"/);
assert.match(serviceSource, /Slice never converts a deterministic starter into a successful AI result/);
assert.doesNotMatch(serviceSource, /releaseStalledGenerationFallback/);
assert.doesNotMatch(serviceSource, /released because the custom AI worker/);
assertions += 7;

assert.match(routeSource, /action === "retryAiGeneration"/);
assert.match(routeSource, /scheduleImmediateEmailWork\(\[result\.jobId\], "retry-custom-ai"\)/);
assert.match(facadeSource, /retryAiClientEmailGeneration/);
assertions += 3;

assert.match(pageSource, /Retry Custom AI/);
assert.match(pageSource, /generationNeedsRetry/);
assert.match(pageSource, /This email was not completed by Custom AI/);
assert.match(pageSource, /will not present the private preflight template as an AI-generated email/);
assertions += 4;

assert.match(backendJobsSource, /email_ai_generate:[\s\S]*timeoutMs:\s*210_000/);
assert.match(backendJobsSource, /email_ai_generate:[\s\S]*maxAttempts:\s*3/);
assertions += 2;

console.log(
  JSON.stringify(
    {
      ok: true,
      test: "authentic-custom-ai-email-generation",
      assertions,
      structuredOutput: true,
      genericFallbackPromotion: false,
      retryAction: true,
    },
    null,
    2,
  ),
);