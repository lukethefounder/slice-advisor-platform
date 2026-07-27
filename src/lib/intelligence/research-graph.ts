import "server-only";

import { createHash } from "node:crypto";

import {
  executeNeo4j,
  isNeo4jConfigured,
  recordToNative,
} from "@/lib/neo4j";
import type {
  ResearchGraphPersistence,
  ResearchKnowledgeGraph,
} from "@/lib/intelligence/research-swarm-types";

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

function primitiveProperties(
  properties: Record<string, string | number | boolean | null>,
) {
  return JSON.stringify(properties);
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
}

export async function persistResearchKnowledgeGraph(input: {
  userId: string;
  graph: ResearchKnowledgeGraph;
}): Promise<ResearchGraphPersistence> {
  if (!isNeo4jConfigured()) {
    return {
      status: "skipped",
      detail: "Neo4j is not configured.",
    };
  }

  const tenant = tenantKey(input.userId);

  try {
    await ensureSchema();

    const nodes = input.graph.nodes.map((node) => ({
      key: node.id,
      tenantKey: tenant,
      runId: input.graph.runId,
      kind: node.kind,
      label: node.label,
      cohort: node.cohort,
      score: node.score,
      confidence: node.confidence,
      size: node.size,
      group: node.group,
      generatedAt: input.graph.generatedAt,
      propertiesJson: primitiveProperties(node.properties),
    }));

    for (const batch of chunks(nodes, 400)) {
      await executeNeo4j(
        `
          UNWIND $nodes AS input
          MERGE (node:SliceResearchNode {
            tenantKey: input.tenantKey,
            key: input.key
          })
          SET node.runId = input.runId,
              node.kind = input.kind,
              node.label = input.label,
              node.cohort = input.cohort,
              node.score = input.score,
              node.confidence = input.confidence,
              node.size = input.size,
              node.group = input.group,
              node.generatedAt = input.generatedAt,
              node.propertiesJson = input.propertiesJson
        `,
        {
          nodes: batch,
        },
      );
    }

    const edges = input.graph.edges.map((edge) => ({
      id: edge.id,
      tenantKey: tenant,
      runId: input.graph.runId,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
      weight: edge.weight,
      cohort: edge.cohort,
      generatedAt: input.graph.generatedAt,
      propertiesJson: primitiveProperties(edge.properties),
    }));

    for (const batch of chunks(edges, 500)) {
      await executeNeo4j(
        `
          UNWIND $edges AS input
          MATCH (source:SliceResearchNode {
            tenantKey: input.tenantKey,
            key: input.source
          })
          MATCH (target:SliceResearchNode {
            tenantKey: input.tenantKey,
            key: input.target
          })
          MERGE (source)-[relationship:SLICE_RESEARCH_LINK {
            tenantKey: input.tenantKey,
            id: input.id
          }]->(target)
          SET relationship.runId = input.runId,
              relationship.kind = input.kind,
              relationship.weight = input.weight,
              relationship.cohort = input.cohort,
              relationship.generatedAt = input.generatedAt,
              relationship.propertiesJson = input.propertiesJson
        `,
        {
          edges: batch,
        },
      );
    }

    return {
      status: "persisted",
      nodeCount: input.graph.nodeCount,
      edgeCount: input.graph.edgeCount,
      persistedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: "failed",
      detail:
        error instanceof Error
          ? error.message
          : "Unknown Neo4j research-graph persistence error.",
    };
  }
}

export async function loadLatestResearchKnowledgeGraph(input: {
  userId: string;
  symbol?: string;
}): Promise<ResearchKnowledgeGraph | null> {
  if (!isNeo4jConfigured()) {
    return null;
  }

  const tenant = tenantKey(input.userId);
  const symbol = String(input.symbol ?? "").trim().toUpperCase();

  try {
    const latest = await executeNeo4j(
      `
        MATCH (run:SliceResearchNode {
          tenantKey: $tenantKey,
          kind: "run"
        })
        WHERE $symbol = "" OR EXISTS {
          MATCH (run)-[:SLICE_RESEARCH_LINK]->(asset:SliceResearchNode {
            kind: "asset"
          })
          WHERE asset.label STARTS WITH $symbol
        }
        RETURN run.runId AS runId,
               run.generatedAt AS generatedAt
        ORDER BY run.generatedAt DESC
        LIMIT 1
      `,
      {
        tenantKey: tenant,
        symbol,
      },
    );

    if (!latest.records.length) {
      return null;
    }

    const latestRecord = recordToNative(latest.records[0]) as Record<
      string,
      unknown
    >;
    const runId = String(latestRecord.runId ?? "");
    const generatedAt = String(latestRecord.generatedAt ?? "");

    if (!runId) {
      return null;
    }

    const nodeResult = await executeNeo4j(
      `
        MATCH (node:SliceResearchNode {
          tenantKey: $tenantKey,
          runId: $runId
        })
        RETURN node
      `,
      {
        tenantKey: tenant,
        runId,
      },
    );
    const edgeResult = await executeNeo4j(
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
        RETURN source.key AS source,
               target.key AS target,
               relationship
      `,
      {
        tenantKey: tenant,
        runId,
      },
    );

    const nodes = nodeResult.records.map((record) => {
      const native = recordToNative(record) as Record<string, unknown>;
      const node = (native.node ?? {}) as Record<string, unknown>;
      let properties: Record<string, string | number | boolean | null> = {};

      try {
        properties = JSON.parse(String(node.propertiesJson ?? "{}")) as Record<
          string,
          string | number | boolean | null
        >;
      } catch {
        properties = {};
      }

      return {
        id: String(node.key ?? ""),
        kind: String(node.kind ?? "evidence") as ResearchKnowledgeGraph["nodes"][number]["kind"],
        label: String(node.label ?? ""),
        cohort: String(node.cohort ?? "shared") as ResearchKnowledgeGraph["nodes"][number]["cohort"],
        score:
          node.score === null || node.score === undefined
            ? null
            : Number(node.score),
        confidence:
          node.confidence === null || node.confidence === undefined
            ? null
            : Number(node.confidence),
        size: Number(node.size ?? 8),
        group: String(node.group ?? ""),
        properties,
      };
    });
    const edges = edgeResult.records.map((record) => {
      const native = recordToNative(record) as Record<string, unknown>;
      const relationship = (native.relationship ?? {}) as Record<
        string,
        unknown
      >;
      let properties: Record<string, string | number | boolean | null> = {};

      try {
        properties = JSON.parse(
          String(relationship.propertiesJson ?? "{}"),
        ) as Record<string, string | number | boolean | null>;
      } catch {
        properties = {};
      }

      return {
        id: String(relationship.id ?? ""),
        source: String(native.source ?? ""),
        target: String(native.target ?? ""),
        kind: String(
          relationship.kind ?? "CONTAINS",
        ) as ResearchKnowledgeGraph["edges"][number]["kind"],
        weight: Number(relationship.weight ?? 1),
        cohort: String(
          relationship.cohort ?? "shared",
        ) as ResearchKnowledgeGraph["edges"][number]["cohort"],
        properties,
      };
    });
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
      schemaVersion: "slice-research-graph-1.0.0",
      runId,
      generatedAt,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
      clusters,
    };
  } catch {
    return null;
  }
}