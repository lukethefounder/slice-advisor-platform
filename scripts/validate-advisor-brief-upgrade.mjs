import {
  existsSync,
  readFileSync,
} from "node:fs";
import {
  resolve,
} from "node:path";

const root =
  process.cwd();

const expectedFiles = [
  "src/lib/advisor-briefing/types.ts",
  "src/lib/advisor-briefing/universe.ts",
  "src/lib/advisor-briefing/shared.ts",
  "src/lib/advisor-briefing/alpha-market.ts",
  "src/lib/advisor-briefing/technical-research.ts",
  "src/lib/advisor-briefing/news-research.ts",
  "src/lib/advisor-briefing/economic-research.ts",
  "src/lib/advisor-briefing/ranking-helpers.ts",
  "src/lib/advisor-briefing/industry-ranking.ts",
  "src/lib/advisor-briefing/security-ranking.ts",
  "src/lib/advisor-briefing/ranking.ts",
  "src/lib/advisor-briefing/persistence.ts",
  "src/lib/advisor-briefing/email.ts",
  "src/lib/advisor-briefing/schedule.ts",
  "src/lib/advisor-briefing/engine.ts",
  "src/app/api/advisor-brief/route.ts",
  "src/app/api/cron/intelligence-advisor-brief/route.ts",
  "src/components/advisor-brief/ui.tsx",
  "src/components/advisor-brief/brief-hero.tsx",
  "src/components/advisor-brief/schedule-panel.tsx",
  "src/components/advisor-brief/security-results.tsx",
  "src/components/advisor-brief/research-details.tsx",
  "src/components/advisor-brief/results-panel.tsx",
  "src/app/workspace/brief/page.tsx",
  "scripts/install-workspace-brief-tab.mjs",
  "vercel.json",
];

const signatures =
  new Map([
    [
      "src/lib/advisor-briefing/types.ts",
      [
        "AdvisorBriefPreference",
        "AdvisorMarketBrief",
        "topIndustries",
        "overallRankedSecurities",
      ],
    ],
    [
      "src/lib/advisor-briefing/universe.ts",
      [
        "ADVISOR_BRIEF_INDUSTRIES",
        "Semiconductors",
        "Healthcare Leaders & Devices",
        "ADVISOR_BRIEF_ALL_SYMBOLS",
      ],
    ],
    [
      "src/lib/advisor-briefing/alpha-market.ts",
      [
        "REALTIME_BULK_QUOTES",
        "GLOBAL_QUOTE",
        "MARKET_STATUS",
        "loadQuotes",
      ],
    ],
    [
      "src/lib/advisor-briefing/technical-research.ts",
      [
        "TIME_SERIES_DAILY",
        "OVERVIEW",
        "loadTechnical",
        "loadFundamentals",
      ],
    ],
    [
      "src/lib/advisor-briefing/news-research.ts",
      [
        "NEWS_SENTIMENT",
        "loadNews",
        "summarizeNews",
      ],
    ],
    [
      "src/lib/advisor-briefing/economic-research.ts",
      [
        "REAL_GDP",
        "FEDERAL_FUNDS_RATE",
        "TREASURY_YIELD",
        "loadEconomy",
      ],
    ],
    [
      "src/lib/advisor-briefing/ranking-helpers.ts",
      [
        "createSourceRegistry",
        "providerMode",
        "securityDrivers",
        "industryThesis",
      ],
    ],
    [
      "src/lib/advisor-briefing/industry-ranking.ts",
      [
        "rankIndustries",
        "INDUSTRY_WEIGHTS",
        ".slice(0, 3)",
      ],
    ],
    [
      "src/lib/advisor-briefing/security-ranking.ts",
      [
        "rankSecurities",
        "SECURITY_WEIGHTS",
        ".slice(0, 5)",
      ],
    ],
    [
      "src/lib/advisor-briefing/ranking.ts",
      [
        "buildAdvisorMarketBriefCore",
        "rankIndustries",
        "rankSecurities",
        "dataQuality",
      ],
    ],
    [
      "src/lib/advisor-briefing/persistence.ts",
      [
        "generateAdvisorMarketBrief",
        "advisorAdaptiveMemory",
        "advisorDayBrief",
        "ADVISOR_BRIEF_PREFERENCE_IDENTITY",
      ],
    ],
    [
      "src/lib/advisor-briefing/email.ts",
      [
        "sendAdvisorMarketBrief",
        "idempotencyKey",
        "notificationDelivery",
      ],
    ],
    [
      "src/lib/advisor-briefing/schedule.ts",
      [
        "isAdvisorBriefDue",
        "Interval",
        "Weekly",
      ],
    ],
    [
      "src/app/api/advisor-brief/route.ts",
      [
        "save-preference",
        "generate-and-send",
        "send-latest",
      ],
    ],
    [
      "src/app/api/cron/intelligence-advisor-brief/route.ts",
      [
        "advisor-market-brief-v1",
        "idempotentScheduleLocks",
        "minimumDataQualityEnforced",
      ],
    ],
    [
      "src/components/advisor-brief/brief-hero.tsx",
      [
        "Autonomous Advisor Brief",
        "Generate current brief",
        "Generate and email",
      ],
    ],
    [
      "src/components/advisor-brief/security-results.tsx",
      [
        "Security monitor list",
        "Overall ranking",
      ],
    ],
    [
      "src/components/advisor-brief/research-details.tsx",
      [
        "Economic context",
        "Source ledger",
        "Recent stored briefings",
      ],
    ],
    [
      "src/app/workspace/brief/page.tsx",
      [
        "BriefHero",
        "BriefSchedulePanel",
        "BriefResultsPanel",
      ],
    ],
    [
      "src/components/advisor-brief/schedule-panel.tsx",
      [
        "Advisor email schedule",
        "Minimum data quality",
        "Save autonomous schedule",
      ],
    ],
    [
      "src/components/advisor-brief/results-panel.tsx",
      [
        "BriefSecurityResults",
        "BriefResearchDetails",
      ],
    ],
    [
      "scripts/install-workspace-brief-tab.mjs",
      [
        'id: "advisor-brief"',
        'href: "/workspace/brief"',
        'brief: "▤"',
      ],
    ],
    [
      "vercel.json",
      [
        "/api/cron/intelligence-advisor-brief?users=100",
        '"schedule": "*/5 * * * *"',
      ],
    ],
  ]);

const failures = [];
const warnings = [];

function inspectBoundaries(
  relativePath,
  content,
) {
  const lines =
    content
      .replace(
        /\r\n/g,
        "\n",
      )
      .split(
        "\n",
      );

  lines.forEach(
    (
      rawLine,
      index,
    ) => {
      const line =
        rawLine.trim();

      if (
        /^```/.test(line) ||
        /^=====/.test(line) ||
        /^PHASE\s+\d+/i.test(line) ||
        /^PART\s+\d+/i.test(line) ||
        /^FULLY\s+(?:CREATE|REPLACE)/i.test(line) ||
        /^REPLACE(?: OR CREATE)?:/i.test(line) ||
        /^APPEND TO:/i.test(line) ||
        /^##\s+`?(?:src|scripts)\//i.test(line)
      ) {
        failures.push(
          `${relativePath}:${index + 1}: embedded chat instruction or Markdown fence: ${line}`,
        );
      }
    },
  );
}

function inspectSecrets(
  relativePath,
  content,
) {
  const patterns = [
    /ALPHA_VANTAGE_API_KEY\s*=\s*["'][^"']+["']/i,
    /RESEND_API_KEY\s*=\s*["'][^"']+["']/i,
    /CRON_SECRET\s*=\s*["'][^"']+["']/i,
    /Authorization:\s*["']Bearer\s+[A-Za-z0-9_-]{10,}/i,
  ];

  if (
    patterns.some(
      (pattern) =>
        pattern.test(
          content,
        ),
    )
  ) {
    failures.push(
      `${relativePath}: possible hard-coded credential detected`,
    );
  }
}

for (
  const relativePath of
  expectedFiles
) {
  const absolutePath =
    resolve(
      root,
      relativePath,
    );

  if (
    !existsSync(
      absolutePath,
    )
  ) {
    failures.push(
      `${relativePath}: missing`,
    );
    continue;
  }

  const content =
    readFileSync(
      absolutePath,
      "utf8",
    );

  if (!content.trim()) {
    failures.push(
      `${relativePath}: empty file`,
    );
    continue;
  }

  inspectBoundaries(
    relativePath,
    content,
  );
  inspectSecrets(
    relativePath,
    content,
  );

  for (
    const signature of
    signatures.get(
      relativePath,
    ) ??
    []
  ) {
    if (
      !content.includes(
        signature,
      )
    ) {
      failures.push(
        `${relativePath}: missing required signature "${signature}"`,
      );
    }
  }
}

const universePath =
  resolve(
    root,
    "src/lib/advisor-briefing/universe.ts",
  );

if (
  existsSync(
    universePath,
  )
) {
  const content =
    readFileSync(
      universePath,
      "utf8",
    );
  const industryCount =
    (
      content.match(
        /\n\s*id:\s*"[^"]+",\n\s*name:/g,
      ) ??
      []
    ).length;

  if (
    industryCount <
    10
  ) {
    failures.push(
      `Expected at least 10 industry definitions; found ${industryCount}.`,
    );
  }
}

const workspacePath =
  resolve(
    root,
    "src/app/workspace/page.tsx",
  );

if (
  existsSync(
    workspacePath,
  )
) {
  const content =
    readFileSync(
      workspacePath,
      "utf8",
    );

  if (
    !content.includes(
      'id: "advisor-brief"',
    )
  ) {
    warnings.push(
      "The Brief tab is not installed yet. Run node scripts/install-workspace-brief-tab.mjs.",
    );
  }
} else {
  failures.push(
    "src/app/workspace/page.tsx: existing workspace page is missing",
  );
}

if (
  warnings.length
) {
  console.warn(
    "\nSLICE Advisor Brief validation warnings:\n",
  );

  for (
    const warning of
    warnings
  ) {
    console.warn(
      `- ${warning}`,
    );
  }
}

if (
  failures.length
) {
  console.error(
    "\nSLICE Advisor Brief validation failed:\n",
  );

  for (
    const failure of
    failures
  ) {
    console.error(
      `- ${failure}`,
    );
  }

  console.error(
    `\n${failures.length} validation failure(s) detected.`,
  );
  process.exit(1);
}

console.log(
  `SLICE Advisor Brief boundary validation passed for ${expectedFiles.length} replacement files.`,
);
console.log(
  "Top-three industries, five securities per industry, overall ranking, source evidence, autonomous scheduling, and advisor email signatures are present.",
);