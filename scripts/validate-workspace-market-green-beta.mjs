import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import {
  extname,
  join,
  relative,
  resolve,
} from "node:path";

const root = process.cwd();

const required = new Map([
  [
    "src/app/workspace/page.tsx",
    [
      "KineticOperatingCore",
      "kinetic-quote-orbit",
      "kinetic-core-shell",
      "WorkspaceRightRail",
      "useRealtimeMarket",
      "Authenticated beta",
      "Brief",
    ],
  ],
  [
    "src/lib/workspace-green-core.ts",
    [
      'id: "brief"',
      'href: "/workspace/brief"',
      "WORKSPACE_TOOLS",
      "TEAM_ROLE_OPTIONS",
    ],
  ],
  [
    "src/components/workspace/core/workspace-sidebar.tsx",
    [
      "WORKSPACE_TOOLS.map",
      "Sign out",
      "Search advisor tools",
    ],
  ],
  [
    "src/components/workspace/core/workspace-operating-core.tsx",
    [
      "Slice Operating Core",
      "Alpha Vantage strict",
      "core-flow-line",
    ],
  ],
  [
    "src/app/api/team-invites/send/route.ts",
    [
      "getCurrentUser",
      "prisma.firmInvite.create",
      "sendEmail",
      "inviteLink",
      "expiresAt",
    ],
  ],
  [
    "src/app/workspace/team-invite/page.tsx",
    [
      "/api/auth/invite-register",
      "Create account and join firm",
      "existingAccount",
    ],
  ],
  [
    "src/app/api/auth/login/route.ts",
    [
      "temporaryLogin: false",
      "Successful beta login",
      "createSession",
    ],
  ],
  [
    "src/app/api/auth/temporary-logins/route.ts",
    [
      "permanently disabled",
      "status: 410",
      "temporaryLoginsEnabled: false",
    ],
  ],
  [
    "src/app/founder-login/page.tsx",
    [
      "Real accounts",
      "No demo access",
      "/api/auth/login",
    ],
  ],
  [
    "src/app/advisor-signup/page.tsx",
    [
      "/api/auth/register",
      "Create Beta Workspace",
      "firmName",
    ],
  ],
  [
    "src/app/market-green.css",
    [
      "--color-red-500: var(--color-emerald-500)",
      "--slice-market-green",
      "--slice-accent: #10b981",
    ],
  ],
]);

const failures = [];
const warnings = [];

function inspectBoundary(
  relativePath,
  content,
) {
  const lines = content
    .replace(
      /\r\n/g,
      "\n",
    )
    .split("\n");

  lines.forEach(
    (
      lineValue,
      index,
    ) => {
      const line =
        lineValue.trim();

      if (
        /^```/.test(line) ||
        /^=====/.test(line) ||
        /^PHASE\s+\d+/i.test(line) ||
        /^FILE\s+\d+/i.test(line) ||
        /^FULLY\s+(?:CREATE|REPLACE)/i.test(
          line,
        ) ||
        /^APPEND TO:/i.test(line)
      ) {
        failures.push(
          `${relativePath}:${index + 1}: embedded chat instruction or Markdown fence`,
        );
      }
    },
  );
}

for (const [
  relativePath,
  signatures,
] of required) {
  const absolutePath = resolve(
    root,
    relativePath,
  );

  if (!existsSync(absolutePath)) {
    failures.push(
      `${relativePath}: missing`,
    );
    continue;
  }

  const content = readFileSync(
    absolutePath,
    "utf8",
  );

  if (!content.trim()) {
    failures.push(
      `${relativePath}: empty`,
    );
    continue;
  }

  inspectBoundary(
    relativePath,
    content,
  );

  for (const signature of signatures) {
    if (
      !content.includes(signature)
    ) {
      failures.push(
        `${relativePath}: missing signature "${signature}"`,
      );
    }
  }
}

const forbiddenTemporaryCredentials = [
  "founder@slice.local",
  "advisor@slice.local",
  "SliceFounder!2026",
  "SliceAdvisor!2026",
  "Slice Demo Advisory",
];

for (const relativePath of [
  "src/app/founder-login/page.tsx",
  "src/app/api/auth/login/route.ts",
  "src/lib/founder-access.ts",
  "src/lib/temporary-logins.ts",
]) {
  const absolutePath = resolve(
    root,
    relativePath,
  );

  if (!existsSync(absolutePath)) {
    continue;
  }

  const content = readFileSync(
    absolutePath,
    "utf8",
  );

  for (
    const forbidden of
    forbiddenTemporaryCredentials
  ) {
    if (content.includes(forbidden)) {
      failures.push(
        `${relativePath}: temporary credential or demo firm remains: "${forbidden}"`,
      );
    }
  }
}

const utilityPattern =
  /\b(bg|text|border|ring|shadow|from|via|to|outline|divide|accent|caret|decoration|placeholder|stroke|fill)-(red|rose)-(50|100|200|300|400|500|600|700|800|900|950)/;

const hardcodedRedPattern =
  /#(?:ef4444|dc2626|b91c1c|991b1b|7f1d1d|450a0a|f87171|fca5a5|e11d48|881337)\b|rgba\(\s*(?:239\s*,\s*68\s*,\s*68|220\s*,\s*38\s*,\s*38|185\s*,\s*28\s*,\s*28|153\s*,\s*27\s*,\s*27|127\s*,\s*29\s*,\s*29|69\s*,\s*10\s*,\s*10)/i;

function walk(directory) {
  const files = [];

  if (!existsSync(directory)) {
    return files;
  }

  for (const entry of readdirSync(directory)) {
    if (
      entry === "node_modules" ||
      entry === ".next" ||
      entry === ".git" ||
      entry === "generated"
    ) {
      continue;
    }

    const absolute = join(
      directory,
      entry,
    );

    const stats = statSync(absolute);

    if (stats.isDirectory()) {
      files.push(...walk(absolute));
      continue;
    }

    if (
      [
        ".ts",
        ".tsx",
        ".css",
        ".js",
        ".jsx",
        ".mjs",
      ].includes(extname(entry))
    ) {
      files.push(absolute);
    }
  }

  return files;
}

for (
  const absolutePath of
  walk(resolve(root, "src"))
) {
  const relativePath = relative(
    root,
    absolutePath,
  ).replaceAll("\\", "/");

  if (
    relativePath ===
    "src/app/market-green.css"
  ) {
    continue;
  }

  const content = readFileSync(
    absolutePath,
    "utf8",
  );

  if (utilityPattern.test(content)) {
    failures.push(
      `${relativePath}: a legacy red or rose Tailwind utility remains; run scripts/apply-market-green-brand.mjs`,
    );
  }

  if (
    hardcodedRedPattern.test(content)
  ) {
    failures.push(
      `${relativePath}: a hard-coded Slice red palette value remains; run scripts/apply-market-green-brand.mjs`,
    );
  }
}

const inviteRoute = resolve(
  root,
  "src/app/api/team-invites/send/route.ts",
);

if (existsSync(inviteRoute)) {
  const content = readFileSync(
    inviteRoute,
    "utf8",
  );

  if (
    content.includes(
      "Math.random().toString(36)",
    ) ||
    !content.includes(
      "randomBytes(18)",
    )
  ) {
    failures.push(
      "Advisor invite codes must use cryptographic random bytes.",
    );
  }
}

if (warnings.length) {
  console.warn(
    "\nWorkspace green beta warnings:\n",
  );

  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

if (failures.length) {
  console.error(
    "\nSLICE market-green beta validation failed:\n",
  );

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  console.error(
    `\n${failures.length} validation failure(s) detected.`,
  );

  process.exit(1);
}

console.log(
  `SLICE market-green beta validation passed for ${required.size} critical files.`,
);

console.log(
  "Brief navigation, live operating core, database-backed advisor email invitations, real beta accounts, temporary-login removal, and repository-wide green branding are present.",
);