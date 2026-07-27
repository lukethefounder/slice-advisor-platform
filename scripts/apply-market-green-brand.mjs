import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  extname,
  join,
  relative,
  resolve,
} from "node:path";

const root = process.cwd();
const sourceRoot = resolve(root, "src");
const reportPath = resolve(
  root,
  "artifacts",
  "market-green-brand-report.json",
);

const extensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
]);

const skippedDirectories = new Set([
  "node_modules",
  ".next",
  ".git",
  "generated",
  "artifacts",
]);

const replacements = [
  [/#ef4444/gi, "#10b981"],
  [/#dc2626/gi, "#059669"],
  [/#b91c1c/gi, "#047857"],
  [/#991b1b/gi, "#065f46"],
  [/#7f1d1d/gi, "#064e3b"],
  [/#450a0a/gi, "#022c22"],
  [/#fecaca/gi, "#a7f3d0"],
  [/#fee2e2/gi, "#d1fae5"],
  [/#fca5a5/gi, "#6ee7b7"],
  [/#f87171/gi, "#6ee7b7"],
  [/#e11d48/gi, "#0d9488"],
  [/#881337/gi, "#134e4a"],
  [/#050202/gi, "#020604"],
  [/#260606/gi, "#022c22"],
  [
    /rgba\(\s*239\s*,\s*68\s*,\s*68\s*,/gi,
    "rgba(16,185,129,",
  ],
  [
    /rgba\(\s*220\s*,\s*38\s*,\s*38\s*,/gi,
    "rgba(5,150,105,",
  ],
  [
    /rgba\(\s*185\s*,\s*28\s*,\s*28\s*,/gi,
    "rgba(4,120,87,",
  ],
  [
    /rgba\(\s*153\s*,\s*27\s*,\s*27\s*,/gi,
    "rgba(6,95,70,",
  ],
  [
    /rgba\(\s*127\s*,\s*29\s*,\s*29\s*,/gi,
    "rgba(6,78,59,",
  ],
  [
    /rgba\(\s*69\s*,\s*10\s*,\s*10\s*,/gi,
    "rgba(2,44,34,",
  ],
  [
    /rgba\(\s*248\s*,\s*113\s*,\s*113\s*,/gi,
    "rgba(110,231,183,",
  ],
  [
    /rgba\(\s*252\s*,\s*165\s*,\s*165\s*,/gi,
    "rgba(110,231,183,",
  ],
  [
    /rgba\(\s*225\s*,\s*29\s*,\s*72\s*,/gi,
    "rgba(13,148,136,",
  ],
  [/\bPremium Red\b/g, "Market Green"],
  [/\bSlice Red\b/g, "Market Green"],
  [/\bslice-red\b/g, "market-green"],
];

const utilityPattern =
  /\b(bg|text|border|ring|shadow|from|via|to|outline|divide|accent|caret|decoration|placeholder|stroke|fill)-(?:red|rose)-(50|100|200|300|400|500|600|700|800|900|950)(\/[^\s"'`)}\]]+)?/g;

function walk(directory) {
  const files = [];

  if (!existsSync(directory)) {
    return files;
  }

  for (const entry of readdirSync(directory)) {
    if (skippedDirectories.has(entry)) {
      continue;
    }

    const absolute = join(directory, entry);
    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      files.push(...walk(absolute));
      continue;
    }

    if (extensions.has(extname(entry))) {
      files.push(absolute);
    }
  }

  return files;
}

function migrateSettingsPage(content) {
  return content
    .replace(
      'type Accent = "market-green" | "crimson" | "ruby" | "graphite" | "blue";',
      'type Accent = "market-green" | "emerald" | "teal" | "graphite" | "blue";',
    )
    .replaceAll(
      'value === "crimson"',
      'value === "emerald"',
    )
    .replaceAll(
      'value === "ruby"',
      'value === "teal"',
    )
    .replaceAll(
      'accent === "crimson"',
      'accent === "emerald"',
    )
    .replaceAll(
      'accent === "ruby"',
      'accent === "teal"',
    )
    .replaceAll('"Crimson"', '"Emerald"')
    .replaceAll('"Ruby"', '"Teal"')
    .replaceAll("#fff7f7", "#ecfdf5");
}

const files = walk(sourceRoot);
const schemaPath = resolve(
  root,
  "prisma",
  "schema.prisma",
);

if (existsSync(schemaPath)) {
  files.push(schemaPath);
}

const changes = [];
let totalReplacements = 0;

for (const absolutePath of files) {
  const before = readFileSync(
    absolutePath,
    "utf8",
  );

  let after = before.replace(
    utilityPattern,
    (
      _,
      utility,
      shade,
      opacity = "",
    ) =>
      `${utility}-emerald-${shade}${opacity}`,
  );

  for (const [
    pattern,
    replacement,
  ] of replacements) {
    after = after.replace(
      pattern,
      replacement,
    );
  }

  if (
    relative(root, absolutePath)
      .replaceAll("\\", "/")
      .endsWith(
        "src/app/workspace/settings/page.tsx",
      )
  ) {
    after = migrateSettingsPage(after);
  }

  if (before === after) {
    continue;
  }

  writeFileSync(
    absolutePath,
    after,
    "utf8",
  );

  const replacementCount = Math.max(
    1,
    Math.abs(
      before.length - after.length,
    ) +
      (
        before.match(
          /(?:red|rose)-/g,
        )?.length ?? 0
      ),
  );

  totalReplacements += replacementCount;

  changes.push({
    file: relative(
      root,
      absolutePath,
    ).replaceAll("\\", "/"),
    replacementScore:
      replacementCount,
  });
}

const report = {
  schemaVersion:
    "slice-market-green-brand-migration-1.0.0",
  generatedAt:
    new Date().toISOString(),
  scannedFiles:
    files.length,
  changedFiles:
    changes.length,
  replacementScore:
    totalReplacements,
  changes,
};

const reportDirectory = resolve(
  root,
  "artifacts",
);

if (!existsSync(reportDirectory)) {
  const { mkdirSync } = await import(
    "node:fs"
  );

  mkdirSync(reportDirectory, {
    recursive: true,
  });
}

writeFileSync(
  reportPath,
  `${JSON.stringify(
    report,
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  `Market-green brand migration completed: ${changes.length} file(s) updated.`,
);

console.log(
  `Report: ${relative(
    root,
    reportPath,
  ).replaceAll("\\", "/")}`,
);