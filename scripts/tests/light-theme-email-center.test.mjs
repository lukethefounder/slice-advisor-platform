import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const layout = read("src/app/layout.tsx");
const bootstrap = read("src/lib/workspace/theme-bootstrap.ts");
const appearance = read("src/lib/workspace/appearance.ts");
const emailPage = read("src/app/workspace/client-emails/page.tsx");

let assertions = 0;

// Behavioral prepaint, migration, storage and hydration coverage lives in
// neural-theme-runtime.test.mjs. Keep this older entry point as a focused
// theme/Email Center integration smoke test for existing validation callers.
assert.match(layout, /data-slice-theme="dark"/);
assert.match(layout, /data-slice-brand="neural"/);
assert.match(layout, /NEURAL_THEME_BOOTSTRAP/);
assert.match(layout, /PlatformAppearance/);
assert.match(layout, /WebVitalsReporter/);
assert.match(layout, /ChunkRecovery/);
assert.doesNotMatch(layout, /slice-light-default-v1/);
assertions += 7;

assert.match(bootstrap, /slice-neural-default-v1/);
assert.match(bootstrap, /candidate === "light"/);
assert.match(bootstrap, /candidate === "system"/);
assert.match(appearance, /mode:\s*"dark"/);
assert.match(appearance, /resolvedTheme:\s*"dark"/);
assert.match(appearance, /dataset\.sliceAppearance/);
assert.match(appearance, /resolveNeuralTheme/);
assertions += 7;

assert.match(emailPage, /slice-email-center/);
assert.doesNotMatch(emailPage, /slice-email-center-light/);
assertions += 1;
assert.match(emailPage, /data-slice-color-lock="true"/);
assert.match(emailPage, /email-scroll-region/);
assert.match(emailPage, /AI Prompt/);
assert.match(emailPage, /Draft Studio/);
assert.match(emailPage, /Approval & Send/);
assert.match(emailPage, /Sent Archive/);
assert.match(emailPage, /createAiDrafts/);
assert.match(emailPage, /retryAiGeneration/);
assert.match(emailPage, /view:\s*"archive"/);
assert.match(emailPage, /lg:h-\[calc\(100dvh-6\.25rem\)\]/);
assert.match(emailPage, /--email-preview/);
assertions += 12;

assert.doesNotMatch(
  emailPage,
  /<main className="[^"]*text-white/,
  "The Email Center root must use theme tokens rather than force dark text.",
);
assertions += 1;

console.log(
  JSON.stringify(
    {
      ok: true,
      test: "neural-theme-email-center",
      assertions,
      defaultTheme: "dark",
      optionalLightMode: true,
      emailCenterViewportCockpit: true,
    },
    null,
    2,
  ),
);