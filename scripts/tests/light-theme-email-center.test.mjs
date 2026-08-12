import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const layout = read("src/app/layout.tsx");
const globals = read("src/app/globals.css");
const marketGreen = read("src/app/market-green.css");
const appearance = read("src/lib/workspace/appearance.ts");
const shell = read("src/components/workspace/core/workspace-shell.tsx");
const workspaceUi = read("src/components/workspace/core/workspace-ui.tsx");
const sliceUi = read("src/components/slice-ui.tsx");
const emailPage = read("src/app/workspace/client-emails/page.tsx");

let assertions = 0;

assert.match(layout, /data-slice-theme="light"/);
assert.match(layout, /slice-light-default-v1/);
assert.match(layout, /mode:\s*"light"/);
assert.match(layout, /WebVitalsReporter/);
assert.match(layout, /ChunkRecovery/);
assertions += 5;

assert.match(appearance, /mode:\s*"light"/);
assert.match(appearance, /resolvedTheme:\s*"light"/);
assert.match(appearance, /"dark",\s*"light",\s*"system"/);
assert.match(appearance, /dataset\.sliceAppearance/);
assert.match(appearance, /LIGHT_DEFAULT_MIGRATION_KEY/);
assertions += 5;

assert.match(globals, /--slice-page-bg:\s*#f7fcf9/);
assert.match(globals, /html\[data-slice-theme="dark"\]/);
assert.match(globals, /\.slice-panel/);
assert.match(globals, /Legacy light-mode normalization/);
assert.match(globals, /data-slice-color-lock/);
assert.match(marketGreen, /html\[data-slice-theme="light"\] body/);
assertions += 6;

assert.match(shell, /DEFAULT_APPEARANCE[\s\S]*mode:\s*"light"/);
assert.match(shell, /bg-\[var\(--slice-surface-strong\)\]/);
assert.match(workspaceUi, /text-\[var\(--slice-heading\)\]/);
assert.match(workspaceUi, /bg-\[var\(--slice-surface\)\]/);
assert.match(sliceUi, /bg-\[var\(--slice-bg\)\]/);
assert.match(sliceUi, /border-\[var\(--slice-border\)\]/);
assertions += 6;

assert.match(emailPage, /slice-email-center-light/);
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
      test: "light-theme-email-center",
      assertions,
      defaultTheme: "light",
      optionalDarkMode: true,
      emailCenterViewportCockpit: true,
    },
    null,
    2,
  ),
);