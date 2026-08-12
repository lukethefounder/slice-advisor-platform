import "server-only";

import { createHash } from "node:crypto";

import type {
  ResearchGraphAnalytics,
  ResearchGraphPersistence,
  ResearchKnowledgeGraph,
} from "@/lib/intelligence/research-swarm-types";
import { createLogger } from "@/lib/logger";
import {
  executeNeo4j,
  getNeo4jConfiguration,
  isNeo4jConfigured,
  recordToNative,
} from "@/lib/neo4j";

export type PersistedResearchGraphMetadata = {
  symbol: string;
  companyName?: string;
  sector?: string;
  industry?: string;
  requestedAgents?: number;
  activeAgents?: number;
  score?: number;
  confidence?: number;
  providerAsOf?: string | null;
  durationMs?: number;
  analytics?: Partial<ResearchGraphAnalytics>;
};

export type ResearchGraphRecord = {
  graph: ResearchKnowledgeGraph;
  metadata: PersistedResearchGraphMetadata;
};

const log = createLogger("intelligence:research-graph");

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function tenantKey(userId: string) {
  return `tenant:${hash(userId).slice(0, 32)}`;
}

function chunks<T>(values: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value ?? "")) as T;
  } catch {
    return fallback;
  }
}

function safeError(value: unknown, fallback: string) {
  const raw = value instanceof Error ? value.message : String(value ?? fallback);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/(password|secret|token|api[_-]?key)=([^\s&]+)/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800) || fallback;
}

function cleanSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
}

function graphKeyFromStored(value: unknown, runId: string) {
  const raw = String(value ?? "");
  const prefix = `${runId}:`;
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

function retentionCount() {
  const parsed = Number(process.env.NEO4J_RESEARCH_RUN_RETENTION);
  return Number.isInteger(parsed) ? Math.max(2, Math.min(50, parsed)) : 12;
}

async function ensureSchema() {
  await executeNeo4j(`
    CREATE CONSTRAINT slice_research_node_key IF NOT EXISTS
    FOR (node:SliceResearchNode)
    REQUIRE (node.tenantKey, node.key) IS UNIQUE
  `);

  await executeNeo4j(`
    CREATE INDEX slice_research_run_id IF NOT EXISTS
    FOR (node:SliceResearchNode)
    ON (node.tenantKey, node.runId)
  `);

  await executeNeo4j(`
    CREATE INDEX slice_research_symbol_time IF NOT EXISTS
    FOR (node:SliceResearchNode)
    ON (node.tenantKey, node.symbol, node.generatedAt)
  `);

  await executeNeo4j(`
    CREATE INDEX slice_research_graph_key IF NOT EXISTS
    FOR (node:SliceResearchNode)
    ON (node.tenantKey, node.graphKey)
  `);
}

async function pruneOldRuns(input: {
  tenant: string;
  symbol: string;
  retain: number;
}) {
  const retain = Math.max(2, Math.min(50, Math.round(input.retain)));

  await executeNeo4j(
    `
      MATCH (run:SliceResearchNode {
        tenantKey: $tenantKey,
        kind: "run",
        symbol: $symbol
      })
      WITH run
      ORDER BY run.generatedAt DESC
      WITH collect(run.runId)[${retain}..] AS obsoleteRunIds
      UNWIND obsoleteRunIds AS obsoleteRunId
      MATCH (node:SliceResearchNode {
        tenantKey: $tenantKey,
        runId: obsoleteRunId
      })
      DETACH DELETE node
    `,
    {
      tenantKey: input.tenant,
      symbol: input.symbol,
    },
  );
}

export async function persistResearchKnowledgeGraph(input: {
  userId: string;
  graph: ResearchKnowledgeGraph;
  metadata?: PersistedResearchGraphMetadata;
}): Promise<ResearchGraphPersistence> {
  if (!isNeo4jConfigured()) {
    return {
      status: "skipped",
      detail: "Neo4j is not configured.",
    };
  }

  const tenant = tenantKey(input.userId);
  const metadata = input.metadata ?? { symbol: "" };
  const symbol = cleanSymbol(
    metadata.symbol ||
      input.graph.nodes.find((node) => node.kind === "asset")?.properties.symbol ||
      input.graph.nodes.find((node) => node.kind === "asset")?.label.split(" ")[0],
  );

  try {
    await ensureSchema();

    const nodes = input.graph.nodes.map((node) => {
      const storageKey = `${input.graph.runId}:${node.id}`;
      const isRun = node.kind === "run";

      return {
        key: storageKey,
        graphKey: node.id,
        tenantKey: tenant,
        runId: input.graph.runId,
        symbol,
        kind: node.kind,
        label: node.label,
        cohort: node.cohort,
        score: node.score,
        confidence: node.confidence,
        size: node.size,
        group: node.group,
        generatedAt: input.graph.generatedAt,
        propertiesJson: safeJson(node.properties),
        metadataJson: isRun ? safeJson({ ...metadata, symbol }) : "{}",
      };
    });

    for (const batch of chunks(nodes, 300)) {
      await executeNeo4j(
        `
          UNWIND $nodes AS input
          MERGE (node:SliceResearchNode {
            tenantKey: input.tenantKey,
            key: input.key
          })
          SET node.graphKey = input.graphKey,
              node.runId = input.runId,
              node.symbol = input.symbol,
              node.kind = input.kind,
              node.label = input.label,
              node.cohort = input.cohort,
              node.score = input.score,
              node.confidence = input.confidence,
              node.size = input.size,
              node.group = input.group,
              node.generatedAt = input.generatedAt,
              node.propertiesJson = input.propertiesJson,
              node.metadataJson = input.metadataJson
        `,
        { nodes: batch },
      );
    }

    const edges = input.graph.edges.map((edge) => ({
      id: `${input.graph.runId}:${edge.id}`,
      graphId: edge.id,
      tenantKey: tenant,
      runId: input.graph.runId,
      sourceKey: `${input.graph.runId}:${edge.source}`,
      targetKey: `${input.graph.runId}:${edge.target}`,
      kind: edge.kind,
      weight: edge.weight,
      cohort: edge.cohort,
      generatedAt: input.graph.generatedAt,
      propertiesJson: safeJson(edge.properties),
    }));

    for (const batch of chunks(edges, 400)) {
      await executeNeo4j(
        `
          UNWIND $edges AS input
          MATCH (source:SliceResearchNode {
            tenantKey: input.tenantKey,
            key: input.sourceKey
          })
          MATCH (target:SliceResearchNode {
            tenantKey: input.tenantKey,
            key: input.targetKey
          })
          MERGE (source)-[relationship:SLICE_RESEARCH_LINK {
            tenantKey: input.tenantKey,
            id: input.id
          }]->(target)
          SET relationship.graphId = input.graphId,
              relationship.runId = input.runId,
              relationship.kind = input.kind,
              relationship.weight = input.weight,
              relationship.cohort = input.cohort,
              relationship.generatedAt = input.generatedAt,
              relationship.propertiesJson = input.propertiesJson
        `,
        { edges: batch },
      );
    }

    if (symbol) {
      await pruneOldRuns({
        tenant,
        symbol,
        retain: retentionCount(),
      }).catch((error) => {
        log.warn("retention.prune_failed", {
          symbol,
          runId: input.graph.runId,
          detail: safeError(error, "Neo4j retention cleanup failed."),
        });
      });
    }

    return {
      status: "persisted",
      nodeCount: input.graph.nodeCount,
      edgeCount: input.graph.edgeCount,
      persistedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error("persistence.failed", error, {
      symbol,
      runId: input.graph.runId,
      nodeCount: input.graph.nodeCount,
      edgeCount: input.graph.edgeCount,
    });
    return {
      status: "failed",
      detail: safeError(error, "Neo4j research-graph persistence failed."),
    };
  }
}

async function resolveRun(input: {
  tenant: string;
  symbol: string;
  runId?: string;
}) {
  if (input.runId) {
    const exact = await executeNeo4j(
      `
        MATCH (run:SliceResearchNode {
          tenantKey: $tenantKey,
          runId: $runId,
          kind: "run"
        })
        RETURN run.runId AS runId,
               run.generatedAt AS generatedAt,
               run.metadataJson AS metadataJson
        LIMIT 1
      `,
      {
        tenantKey: input.tenant,
        runId: input.runId,
      },
    );

    if (!exact.records.length) return null;
    const native = recordToNative(exact.records[0]) as Record<string, unknown>;
    return {
      runId: String(native.runId ?? input.runId),
      generatedAt: String(native.generatedAt ?? ""),
      metadata: parseJson<PersistedResearchGraphMetadata>(native.metadataJson, {
        symbol: input.symbol,
      }),
    };
  }

  const latest = await executeNeo4j(
    `
      MATCH (run:SliceResearchNode {
        tenantKey: $tenantKey,
        kind: "run"
      })
      WHERE $symbol = "" OR run.symbol = $symbol OR EXISTS {
        MATCH (run)-[:SLICE_RESEARCH_LINK]->(asset:SliceResearchNode {
          kind: "asset"
        })
        WHERE asset.label STARTS WITH $symbol
      }
      RETURN run.runId AS runId,
             run.generatedAt AS generatedAt,
             run.metadataJson AS metadataJson
      ORDER BY run.generatedAt DESC
      LIMIT 1
    `,
    {
      tenantKey: input.tenant,
      symbol: input.symbol,
    },
  );

  if (!latest.records.length) return null;
  const native = recordToNative(latest.records[0]) as Record<string, unknown>;
  const runId = String(native.runId ?? "");
  if (!runId) return null;

  return {
    runId,
    generatedAt: String(native.generatedAt ?? ""),
    metadata: parseJson<PersistedResearchGraphMetadata>(native.metadataJson, {
      symbol: input.symbol,
    }),
  };
}

export async function loadResearchKnowledgeGraphRecord(input: {
  userId: string;
  symbol?: string;
  runId?: string;
}): Promise<ResearchGraphRecord | null> {
  if (!isNeo4jConfigured()) return null;

  const tenant = tenantKey(input.userId);
  const symbol = cleanSymbol(input.symbol);

  try {
    const resolved = await resolveRun({
      tenant,
      symbol,
      runId: String(input.runId ?? "").trim() || undefined,
    });
    if (!resolved) return null;

    const [nodeResult, edgeResult] = await Promise.all([
      executeNeo4j(
        `
          MATCH (node:SliceResearchNode {
            tenantKey: $tenantKey,
            runId: $runId
          })
          RETURN node
          LIMIT 5000
        `,
        {
          tenantKey: tenant,
          runId: resolved.runId,
        },
      ),
      executeNeo4j(
        `
          MATCH (source:SliceResearchNode {
            tenantKey: $tenantKey,
            runId: $runId
          })-[relationship:SLICE_RESEARCH_LINK {
            tenantKey: $tenantKey,
            runId: $runId
          }]->(target:SliceResearchNode {
            tenantKey: $tenantKey,
            runId: $runId
          })
          RETURN coalesce(source.graphKey, source.key) AS source,
                 coalesce(target.graphKey, target.key) AS target,
                 relationship
          LIMIT 20000
        `,
        {
          tenantKey: tenant,
          runId: resolved.runId,
        },
      ),
    ]);

    const nodes = nodeResult.records.map((record) => {
      const native = recordToNative(record) as Record<string, unknown>;
      const node = (native.node ?? {}) as Record<string, unknown>;
      const id = String(
        node.graphKey ?? graphKeyFromStored(node.key, resolved.runId),
      );

      return {
        id,
        kind: String(node.kind ?? "evidence") as ResearchKnowledgeGraph["nodes"][number]["kind"],
        label: String(node.label ?? ""),
        cohort: String(node.cohort ?? "shared") as ResearchKnowledgeGraph["nodes"][number]["cohort"],
        score:
          node.score === null || node.score === undefined ? null : Number(node.score),
        confidence:
          node.confidence === null || node.confidence === undefined
            ? null
            : Number(node.confidence),
        size: Number(node.size ?? 8),
        group: String(node.group ?? ""),
        properties: parseJson<ResearchKnowledgeGraph["nodes"][number]["properties"]>(
          node.propertiesJson,
          {},
        ),
      };
    });

    const edges = edgeResult.records.map((record) => {
      const native = recordToNative(record) as Record<string, unknown>;
      const relationship = (native.relationship ?? {}) as Record<string, unknown>;
      const graphId = String(
        relationship.graphId ?? graphKeyFromStored(relationship.id, resolved.runId),
      );

      return {
        id: graphId,
        source: graphKeyFromStored(native.source, resolved.runId),
        target: graphKeyFromStored(native.target, resolved.runId),
        kind: String(
          relationship.kind ?? "CONTAINS",
        ) as ResearchKnowledgeGraph["edges"][number]["kind"],
        weight: Number(relationship.weight ?? 1),
        cohort: String(
          relationship.cohort ?? "shared",
        ) as ResearchKnowledgeGraph["edges"][number]["cohort"],
        properties: parseJson<ResearchKnowledgeGraph["edges"][number]["properties"]>(
          relationship.propertiesJson,
          {},
        ),
      };
    });

    const nodeIds = new Set(nodes.map((node) => node.id));
    const validEdges = edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    );
    const cohortIds = ["media", "technical", "economy", "shared"] as const;
    const clusters = cohortIds.map((cohort) => {
      const cohortNodes = nodes.filter((node) => node.cohort === cohort);
      const scored = cohortNodes
        .map((node) => node.score)
        .filter((value): value is number => value !== null);

      return {
        id: cohort,
        label:
          cohort === "media"
            ? "Media & Narrative Research"
            : cohort === "technical"
              ? "Technical & Company Data"
              : cohort === "economy"
                ? "Industry & Economy Research"
                : "Shared score and asset context",
        cohort,
        nodeCount: cohortNodes.length,
        averageScore: scored.length
          ? scored.reduce((sum, value) => sum + value, 0) / scored.length
          : 50,
      };
    });

    return {
      graph: {
        schemaVersion: "slice-research-graph-1.0.0",
        runId: resolved.runId,
        generatedAt: resolved.generatedAt,
        nodeCount: nodes.length,
        edgeCount: validEdges.length,
        nodes,
        edges: validEdges,
        clusters,
      },
      metadata: {
        ...resolved.metadata,
        symbol: cleanSymbol(resolved.metadata.symbol || symbol),
      },
    };
  } catch (error) {
    log.error("load.failed", error, {
      symbol,
      runId: input.runId ?? null,
    });
    return null;
  }
}

export async function loadLatestResearchKnowledgeGraph(input: {
  userId: string;
  symbol?: string;
}): Promise<ResearchKnowledgeGraph | null> {
  const record = await loadResearchKnowledgeGraphRecord(input);
  return record?.graph ?? null;
}

export function getResearchGraphPersistenceConfiguration() {
  const configuration = getNeo4jConfiguration();
  return {
    configured: configuration.configured,
    enabled: configuration.enabled,
    database: configuration.database,
    missing: configuration.missing,
  };
}