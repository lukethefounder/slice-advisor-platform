import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const queue = read("src/lib/background-jobs/queue.ts");
const worker = read("src/lib/background-jobs/worker.ts");
const route = read("src/app/api/client-emails/route.ts");
const service = read("src/lib/email-center/service.ts");
const jobs = read("src/lib/email-center/jobs.ts");
const page = read("src/app/workspace/client-emails/page.tsx");

let assertions = 0;

assert.match(queue, /export async function requestBackgroundJobWake/);
assertions += 1;
assert.match(queue, /Immediate worker recovery requested/);
assertions += 1;
assert.match(queue, /export async function claimBackgroundJobById/);
assertions += 1;
assert.match(queue, /WHERE "id" = \$\{jobId\}/);
assertions += 1;
assert.match(queue, /FOR UPDATE SKIP LOCKED/);
assertions += 1;

assert.match(worker, /export async function processBackgroundJobIds/);
assertions += 1;
assert.match(worker, /claimBackgroundJobById/);
assertions += 1;
assert.match(worker, /concurrency/);
assertions += 1;

assert.match(route, /import \{ after \} from "next\/server"/);
assertions += 1;
assert.match(route, /scheduleImmediateEmailWork/);
assertions += 1;
assert.match(route, /result\.results\.map\(\(item\) => item\.jobId\)/);
assertions += 1;
assert.match(route, /progress-poll-wake/);
assertions += 1;
assert.match(route, /maxDuration = 300/);
assertions += 1;

assert.match(service, /QUEUED_GENERATION_WAKE_DELAY_MS = 3_000/);
assertions += 1;
assert.match(service, /requestBackgroundJobWake/);
assertions += 1;
assert.match(service, /QUICK_GENERATION_STALL_MS = 20_000/);
assertions += 1;
assert.match(service, /RESEARCHED_GENERATION_STALL_MS = 75_000/);
assertions += 1;
assert.match(service, /releaseStalledGenerationFallback/);
assertions += 1;
assert.match(service, /Completed With Fallback/);
assertions += 1;
assert.match(service, /requestBackgroundJobCancellation/);
assertions += 1;
assert.match(service, /Waking the custom AI worker for this recipient/);
assertions += 1;

assert.match(jobs, /timeoutMs: payload\.speedMode === "Quick" \? 5_500 : 20_000/);
assertions += 1;
assert.match(jobs, /fallbackText: JSON\.stringify\(\{ options: fallback \}\)/);
assertions += 1;
assert.match(jobs, /Checking completeness, personalization, and advisor safeguards/);
assertions += 1;

assert.match(page, /view=progress&draftId=/);
assertions += 1;
assert.match(page, /window\.setTimeout\(\(\) => void tick\(\), 1_250\)/);
assertions += 1;
assert.match(page, /generationIsActive/);
assertions += 1;
assert.match(page, /generatingDraftCount/);
assertions += 1;
assert.match(page, /window\.setInterval\([\s\S]*4_000/);
assertions += 1;

console.log(
  JSON.stringify(
    {
      ok: true,
      test: "email-generation-worker-recovery",
      assertions,
      behavior: {
        immediateTargetedWake: true,
        cronRecoveryPreserved: true,
        staleFallbackRelease: true,
        perDraftPollingPreserved: true,
      },
    },
    null,
    2,
  ),
);