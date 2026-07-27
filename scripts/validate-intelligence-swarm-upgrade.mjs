import {
  existsSync,
  readFileSync,
} from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const expected = [
  "src/lib/intelligence/alpha-vantage-types.ts",
  "src/lib/intelligence/alpha-vantage-live.ts",
  "src/app/api/intelligence/alpha-vantage/route.ts",
  "src/lib/intelligence-forecast/live-snapshot.ts",
  "src/lib/intelligence/research-swarm-types.ts",
  "src/lib/intelligence/economic-live.ts",
  "src/lib/intelligence/research-swarm.ts",
  "src/lib/intelligence/research-graph.ts",
  "src/app/api/intelligence/research-swarm/route.ts",
  "src/components/intelligence/research-knowledge-graph.tsx",
  "src/app/intelligence/page.tsx",
  "src/app/workspace/intelligence/layout.tsx",
  "src/app/workspace/intelligence/page.tsx",
  "src/app/workspace/intelligence/forecast-lab/page.tsx",
  "src/app/workspace/intelligence/agent-simulation/page.tsx",
  "src/app/workspace/intelligence/knowledge-graph/page.tsx",
];

const signatures = new Map([
  [
    "src/lib/intelligence/research-swarm-types.ts",
    ["slice-agentic-score-1.0.0", "slice-research-swarm-1.0.0"],
  ],
  [
    "src/lib/intelligence/economic-live.ts",
    ["getEconomicResearch", "FEDERAL_FUNDS_RATE", "UNEMPLOYMENT"],
  ],
  [
    "src/lib/intelligence/research-swarm.ts",
    ["runResearchSwarm", "equalThirdWeighting", "buildForecastVector", "buildGraphAnalytics"],
  ],
  [
    "src/lib/intelligence/research-graph.ts",
    ["persistResearchKnowledgeGraph", "SliceResearchNode"],
  ],
  [
    "src/app/api/intelligence/research-swarm/route.ts",
    ["maximumAgents", "graphMode", "persistResearchKnowledgeGraph"],
  ],
  [
    "src/components/intelligence/research-knowledge-graph.tsx",
    ["ResearchKnowledgeGraphCanvas", "requestAnimationFrame", "centralityTop"],
  ],
  [
    "src/app/workspace/intelligence/page.tsx",
    ["Real-time research, live knowledge graph", "Full research cycle"],
  ],
  [
    "src/app/workspace/intelligence/agent-simulation/page.tsx",
    ["Real-Time Research Swarm", "Agent inspector"],
  ],
  [
    "src/app/workspace/intelligence/knowledge-graph/page.tsx",
    ["Live Research Knowledge Graph", "Build full graph"],
  ],
  [
    "src/app/workspace/intelligence/forecast-lab/page.tsx",
    ["Agentic Forecast Lab", "research-swarm"],
  ],
]);

const failures = [];

for (const relativePath of expected) {
  const absolutePath = resolve(root, relativePath);

  if (!existsSync(absolutePath)) {
    failures.push(`${relativePath}: missing`);
    continue;
  }

  const content = readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (
      /^```/.test(line) ||
      /^=====/.test(line) ||
      /^PHASE\s+\d+/i.test(line) ||
      /^REPLACE(?: OR CREATE)?:\s+src\//i.test(line) ||
      /^APPEND TO:\s+src\//i.test(line) ||
      /^##\s+`?src\//i.test(line)
    ) {
      failures.push(
        `${relativePath}:${index + 1}: embedded chat heading or Markdown fence: ${line}`,
      );
    }
  }

  for (const signature of signatures.get(relativePath) ?? []) {
    if (!content.includes(signature)) {
      failures.push(`${relativePath}: missing signature ${signature}`);
    }
  }
}

const snapshotPath = resolve(
  root,
  "src/lib/intelligence-forecast/live-snapshot.ts",
);

if (existsSync(snapshotPath)) {
  const content = readFileSync(snapshotPath, "utf8");

  if (
    content.includes("src/app/intelligence/page.tsx") ||
    content.includes('redirect("/workspace/intelligence")')
  ) {
    failures.push(
      "src/lib/intelligence-forecast/live-snapshot.ts: another source file appears appended to the module",
    );
  }
}

if (failures.length) {
  console.error("\nSLICE Intelligence Swarm validation failed:\n");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

console.log(
  `SLICE Intelligence Swarm boundary validation passed for ${expected.length} files.`,
);