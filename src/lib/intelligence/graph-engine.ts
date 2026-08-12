import type {
  ResearchCohort,
  ResearchGraphAnalytics,
  ResearchGraphCommunity,
  ResearchGraphEdge,
  ResearchGraphNode,
  ResearchGraphNodeDetail,
  ResearchGraphNodeKind,
  ResearchGraphProjectionMode,
  ResearchGraphRankedNode,
  ResearchKnowledgeGraph,
  SliceAgenticScore,
} from "@/lib/intelligence/research-swarm-types";

const STRUCTURAL_KINDS = new Set<ResearchGraphNodeKind>([
  "run",
  "asset",
  "score",
  "cohort",
  "sector",
  "industry",
]);

const PROJECTION_LIMITS: Record<
  ResearchGraphProjectionMode,
  { nodes: number; edges: number; agentCapPerCohort: number }
> = {
  overview: {
    nodes: 420,
    edges: 1_300,
    agentCapPerCohort: 90,
  },
  balanced: {
    nodes: 1_000,
    edges: 3_600,
    agentCapPerCohort: 260,
  },
  full: {
    nodes: 4_000,
    edges: 14_000,
    agentCapPerCohort: 2_000,
  },
};

type AdjacencyEntry = {
  nodeId: string;
  edge: ResearchGraphEdge;
  direction: "incoming" | "outgoing";
};

type GraphIndex = {
  nodeById: Map<string, ResearchGraphNode>;
  adjacency: Map<string, AdjacencyEntry[]>;
  undirected: Map<string, string[]>;
  incomingCount: Map<string, number>;
  outgoingCount: Map<string, number>;
  contradictionCount: Map<string, number>;
};

export type ProjectResearchGraphOptions = {
  mode?: ResearchGraphProjectionMode;
  selectedNodeId?: string | null;
  search?: string;
  cohorts?: Array<ResearchCohort | "shared">;
  kinds?: ResearchGraphNodeKind[];
  minEdgeWeight?: number;
  analytics?: ResearchGraphAnalytics | null;
};

function clamp(value: number, minimum = 0, maximum = 100) {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, Math.min(maximum, value));
}

function average(values: number[], fallback = 0) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : fallback;
}

function safeScore(value: number | null | undefined, fallback = 50) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function rounded(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function normalizeSearch(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function buildGraphIndex(graph: ResearchKnowledgeGraph): GraphIndex {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, AdjacencyEntry[]>();
  const undirected = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();
  const outgoingCount = new Map<string, number>();
  const contradictionCount = new Map<string, number>();

  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
    undirected.set(node.id, []);
    incomingCount.set(node.id, 0);
    outgoingCount.set(node.id, 0);
    contradictionCount.set(node.id, 0);
  }

  for (const edge of graph.edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;

    adjacency.get(edge.source)?.push({
      nodeId: edge.target,
      edge,
      direction: "outgoing",
    });
    adjacency.get(edge.target)?.push({
      nodeId: edge.source,
      edge,
      direction: "incoming",
    });
    undirected.get(edge.source)?.push(edge.target);
    undirected.get(edge.target)?.push(edge.source);
    outgoingCount.set(edge.source, (outgoingCount.get(edge.source) ?? 0) + 1);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);

    if (edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES") {
      contradictionCount.set(
        edge.source,
        (contradictionCount.get(edge.source) ?? 0) + 1,
      );
      contradictionCount.set(
        edge.target,
        (contradictionCount.get(edge.target) ?? 0) + 1,
      );
    }
  }

  for (const [nodeId, neighbors] of undirected) {
    undirected.set(nodeId, Array.from(new Set(neighbors)));
  }

  return {
    nodeById,
    adjacency,
    undirected,
    incomingCount,
    outgoingCount,
    contradictionCount,
  };
}

function pageRank(
  graph: ResearchKnowledgeGraph,
  index: GraphIndex,
  iterations = 18,
  damping = 0.85,
) {
  const nodeCount = Math.max(1, graph.nodes.length);
  let current = new Map<string, number>(
    graph.nodes.map((node) => [node.id, 1 / nodeCount]),
  );

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Map<string, number>(
      graph.nodes.map((node) => [node.id, (1 - damping) / nodeCount]),
    );
    let dangling = 0;

    for (const node of graph.nodes) {
      const outgoing = (index.adjacency.get(node.id) ?? []).filter(
        (entry) => entry.direction === "outgoing",
      );
      const rank = current.get(node.id) ?? 0;

      if (!outgoing.length) {
        dangling += rank;
        continue;
      }

      const totalWeight = outgoing.reduce(
        (sum, entry) => sum + Math.max(entry.edge.weight, 0.05),
        0,
      );

      for (const entry of outgoing) {
        const share = Math.max(entry.edge.weight, 0.05) / totalWeight;
        next.set(
          entry.nodeId,
          (next.get(entry.nodeId) ?? 0) + damping * rank * share,
        );
      }
    }

    const danglingShare = (damping * dangling) / nodeCount;
    for (const node of graph.nodes) {
      next.set(node.id, (next.get(node.id) ?? 0) + danglingShare);
    }

    current = next;
  }

  const maximum = Math.max(1e-12, ...current.values());
  return new Map(
    [...current.entries()].map(([id, value]) => [id, (value / maximum) * 100]),
  );
}

function connectedComponents(index: GraphIndex) {
  const visited = new Set<string>();
  const components: string[][] = [];

  for (const nodeId of index.nodeById.keys()) {
    if (visited.has(nodeId)) continue;

    const queue = [nodeId];
    const component: string[] = [];
    visited.add(nodeId);

    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      component.push(current);

      for (const neighbor of index.undirected.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    components.push(component);
  }

  return components.sort((left, right) => right.length - left.length);
}

function deterministicSamples(nodeIds: string[], maximum = 24) {
  if (nodeIds.length <= maximum) return nodeIds;
  const output: string[] = [];
  const stride = nodeIds.length / maximum;

  for (let index = 0; index < maximum; index += 1) {
    output.push(nodeIds[Math.min(nodeIds.length - 1, Math.floor(index * stride))]);
  }

  return Array.from(new Set(output));
}

/**
 * Bounded Brandes-style approximation. Sampling keeps the calculation linear
 * enough for interactive graph builds while retaining useful bridge rankings.
 */
function approximateBetweenness(index: GraphIndex) {
  const nodeIds = [...index.nodeById.keys()].sort();
  const sources = deterministicSamples(nodeIds, 24);
  const score = new Map<string, number>(nodeIds.map((id) => [id, 0]));
  let pathLengthSum = 0;
  let reachedPairs = 0;

  for (const source of sources) {
    const stack: string[] = [];
    const predecessors = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
    const pathCount = new Map<string, number>(nodeIds.map((id) => [id, 0]));
    const distance = new Map<string, number>(nodeIds.map((id) => [id, -1]));
    pathCount.set(source, 1);
    distance.set(source, 0);
    const queue = [source];

    while (queue.length) {
      const vertex = queue.shift();
      if (!vertex) continue;
      stack.push(vertex);

      for (const neighbor of index.undirected.get(vertex) ?? []) {
        if ((distance.get(neighbor) ?? -1) < 0) {
          queue.push(neighbor);
          distance.set(neighbor, (distance.get(vertex) ?? 0) + 1);
        }

        if (distance.get(neighbor) === (distance.get(vertex) ?? 0) + 1) {
          pathCount.set(
            neighbor,
            (pathCount.get(neighbor) ?? 0) + (pathCount.get(vertex) ?? 0),
          );
          predecessors.get(neighbor)?.push(vertex);
        }
      }
    }

    for (const value of distance.values()) {
      if (value > 0) {
        pathLengthSum += value;
        reachedPairs += 1;
      }
    }

    const dependency = new Map<string, number>(nodeIds.map((id) => [id, 0]));

    while (stack.length) {
      const child = stack.pop();
      if (!child) continue;

      for (const parent of predecessors.get(child) ?? []) {
        const childPaths = Math.max(pathCount.get(child) ?? 0, 1e-12);
        const contribution =
          ((pathCount.get(parent) ?? 0) / childPaths) *
          (1 + (dependency.get(child) ?? 0));
        dependency.set(parent, (dependency.get(parent) ?? 0) + contribution);
      }

      if (child !== source) {
        score.set(child, (score.get(child) ?? 0) + (dependency.get(child) ?? 0));
      }
    }
  }

  const maximum = Math.max(1e-12, ...score.values());
  return {
    scores: new Map(
      [...score.entries()].map(([id, value]) => [id, (value / maximum) * 100]),
    ),
    averagePathLength: reachedPairs ? pathLengthSum / reachedPairs : 0,
  };
}

function labelPropagation(index: GraphIndex) {
  const labels = new Map<string, string>(
    [...index.nodeById.keys()].map((id) => [id, id]),
  );
  const nodeIds = [...index.nodeById.keys()].sort();

  for (let iteration = 0; iteration < 8; iteration += 1) {
    let changed = 0;

    for (const nodeId of nodeIds) {
      const weights = new Map<string, number>();

      for (const entry of index.adjacency.get(nodeId) ?? []) {
        const label = labels.get(entry.nodeId) ?? entry.nodeId;
        weights.set(label, (weights.get(label) ?? 0) + Math.max(entry.edge.weight, 0.1));
      }

      const best = [...weights.entries()].sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
      )[0]?.[0];

      if (best && labels.get(nodeId) !== best) {
        labels.set(nodeId, best);
        changed += 1;
      }
    }

    if (!changed) break;
  }

  return labels;
}

function communitiesFromLabels(
  graph: ResearchKnowledgeGraph,
  labels: Map<string, string>,
  pagerank: Map<string, number>,
): ResearchGraphCommunity[] {
  const buckets = new Map<string, ResearchGraphNode[]>();

  for (const node of graph.nodes) {
    const label = labels.get(node.id) ?? node.id;
    const bucket = buckets.get(label) ?? [];
    bucket.push(node);
    buckets.set(label, bucket);
  }

  return [...buckets.entries()]
    .map(([labelId, nodes], indexNumber) => {
      const nodeIds = new Set(nodes.map((node) => node.id));
      const internalEdges = graph.edges.filter(
        (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
      ).length;
      const ranked = [...nodes].sort(
        (left, right) =>
          (pagerank.get(right.id) ?? 0) - (pagerank.get(left.id) ?? 0),
      );
      const dominantCohort = (["media", "technical", "economy", "shared"] as const)
        .map((cohort) => ({
          cohort,
          count: nodes.filter((node) => node.cohort === cohort).length,
        }))
        .sort((left, right) => right.count - left.count)[0]?.cohort ?? "shared";
      const scored = nodes
        .map((node) => node.score)
        .filter((value): value is number => typeof value === "number");

      return {
        id: `community:${indexNumber + 1}:${labelId.slice(0, 18)}`,
        label: ranked[0]?.label || `Community ${indexNumber + 1}`,
        cohort: dominantCohort,
        nodeCount: nodes.length,
        edgeCount: internalEdges,
        averageScore: rounded(average(scored, 50), 2),
        topNodeIds: ranked.slice(0, 6).map((node) => node.id),
      } satisfies ResearchGraphCommunity;
    })
    .sort((left, right) => right.nodeCount - left.nodeCount)
    .slice(0, 18);
}

function sourceConcentration(graph: ResearchKnowledgeGraph) {
  const counts = new Map<string, number>();
  let total = 0;

  for (const edge of graph.edges) {
    if (edge.kind !== "PUBLISHED_BY") continue;
    counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    total += 1;
  }

  if (!total || counts.size <= 1) return total ? 100 : 0;

  const hhi = [...counts.values()].reduce((sum, count) => {
    const share = count / total;
    return sum + share * share;
  }, 0);
  const minimum = 1 / counts.size;
  return clamp(((hhi - minimum) / Math.max(1 - minimum, 1e-9)) * 100);
}

function networkResilience(
  graph: ResearchKnowledgeGraph,
  index: GraphIndex,
  centrality: Array<{ id: string; centralityScore: number }>,
) {
  if (graph.nodeCount <= 2) return 100;

  const removeCount = Math.max(1, Math.min(12, Math.ceil(graph.nodeCount * 0.005)));
  const removed = new Set(centrality.slice(0, removeCount).map((item) => item.id));
  const remaining = [...index.nodeById.keys()].filter((id) => !removed.has(id));

  if (!remaining.length) return 0;

  const visited = new Set<string>();
  let largest = 0;

  for (const start of remaining) {
    if (visited.has(start)) continue;
    const queue = [start];
    let count = 0;
    visited.add(start);

    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;
      count += 1;

      for (const neighbor of index.undirected.get(current) ?? []) {
        if (!removed.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    largest = Math.max(largest, count);
  }

  return clamp((largest / remaining.length) * 100);
}

function clusterPressureFromGraph(
  graph: ResearchKnowledgeGraph,
  score?: SliceAgenticScore | null,
): ResearchGraphAnalytics["clusterPressure"] {
  const cohortScores = new Map<ResearchCohort | "shared", number>();
  const cohortConfidence = new Map<ResearchCohort | "shared", number>();

  for (const cohort of ["media", "technical", "economy"] as const) {
    cohortScores.set(
      cohort,
      score?.cohorts[cohort].score ??
        safeScore(graph.nodes.find((node) => node.kind === "cohort" && node.cohort === cohort)?.score),
    );
    cohortConfidence.set(
      cohort,
      score?.cohorts[cohort].confidence ??
        safeScore(
          graph.nodes.find((node) => node.kind === "cohort" && node.cohort === cohort)
            ?.confidence,
          0,
        ),
    );
  }

  const overall =
    score?.overall ??
    safeScore(graph.nodes.find((node) => node.kind === "score")?.score);
  const overallConfidence =
    score?.confidence ??
    safeScore(graph.nodes.find((node) => node.kind === "score")?.confidence, 0);

  return {
    media: {
      score: cohortScores.get("media") ?? 50,
      confidence: cohortConfidence.get("media") ?? 0,
      pressure: rounded(Math.abs((cohortScores.get("media") ?? 50) - overall)),
      nodeCount: graph.nodes.filter((node) => node.cohort === "media").length,
    },
    technical: {
      score: cohortScores.get("technical") ?? 50,
      confidence: cohortConfidence.get("technical") ?? 0,
      pressure: rounded(Math.abs((cohortScores.get("technical") ?? 50) - overall)),
      nodeCount: graph.nodes.filter((node) => node.cohort === "technical").length,
    },
    economy: {
      score: cohortScores.get("economy") ?? 50,
      confidence: cohortConfidence.get("economy") ?? 0,
      pressure: rounded(Math.abs((cohortScores.get("economy") ?? 50) - overall)),
      nodeCount: graph.nodes.filter((node) => node.cohort === "economy").length,
    },
    shared: {
      score: overall,
      confidence: overallConfidence,
      pressure: 0,
      nodeCount: graph.nodes.filter((node) => node.cohort === "shared").length,
    },
  };
}

function rankedNodes(
  graph: ResearchKnowledgeGraph,
  scores: Map<string, number>,
  limit: number,
): ResearchGraphRankedNode[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  return [...scores.entries()]
    .map(([id, score]) => {
      const node = nodeById.get(id);
      return node
        ? {
            id,
            label: node.label,
            kind: node.kind,
            cohort: node.cohort,
            score: rounded(score, 2),
          }
        : null;
    })
    .filter((item): item is ResearchGraphRankedNode => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function analyzeResearchGraph(
  graph: ResearchKnowledgeGraph,
  score?: SliceAgenticScore | null,
): ResearchGraphAnalytics {
  const startedAt = Date.now();
  const index = buildGraphIndex(graph);
  const pagerank = pageRank(graph, index);
  const betweenness = approximateBetweenness(index);
  const components = connectedComponents(index);
  const labels = labelPropagation(index);
  const communities = communitiesFromLabels(graph, labels, pagerank);
  const maximumDegree = Math.max(
    1,
    ...graph.nodes.map(
      (node) =>
        (index.incomingCount.get(node.id) ?? 0) +
        (index.outgoingCount.get(node.id) ?? 0),
    ),
  );

  const centralityTop = graph.nodes
    .map((node) => {
      const degree =
        (index.incomingCount.get(node.id) ?? 0) +
        (index.outgoingCount.get(node.id) ?? 0);
      const weightedDegree = (index.adjacency.get(node.id) ?? []).reduce(
        (sum, entry) => sum + Math.max(entry.edge.weight, 0),
        0,
      );
      const centralityScore = clamp(
        (degree / maximumDegree) * 55 +
          (pagerank.get(node.id) ?? 0) * 0.3 +
          (betweenness.scores.get(node.id) ?? 0) * 0.15,
      );

      return {
        id: node.id,
        label: node.label,
        kind: node.kind,
        cohort: node.cohort,
        degree,
        weightedDegree: rounded(weightedDegree, 2),
        centralityScore: rounded(centralityScore, 2),
      };
    })
    .sort((left, right) => right.centralityScore - left.centralityScore)
    .slice(0, 16);

  const bridgeNodes = graph.nodes
    .map((node) => {
      const neighborCohorts = new Set(
        (index.adjacency.get(node.id) ?? [])
          .map((entry) => index.nodeById.get(entry.nodeId)?.cohort)
          .filter(Boolean),
      );
      const scoreValue =
        (betweenness.scores.get(node.id) ?? 0) * 0.65 +
        Math.max(0, neighborCohorts.size - 1) * 18 +
        (pagerank.get(node.id) ?? 0) * 0.15;

      return neighborCohorts.size >= 2
        ? {
            id: node.id,
            label: node.label,
            cohort: node.cohort,
            bridgeScore: rounded(clamp(scoreValue), 2),
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.bridgeScore - left.bridgeScore)
    .slice(0, 12);

  const contradictionHotspots = graph.nodes
    .map((node) => {
      const contradictionCount = index.contradictionCount.get(node.id) ?? 0;
      if (!contradictionCount) return null;
      const severity = clamp(
        contradictionCount * 16 +
          Math.abs(safeScore(node.score) - 50) * 0.7 +
          (pagerank.get(node.id) ?? 0) * 0.15,
      );
      return {
        id: node.id,
        label: node.label,
        cohort: node.cohort,
        contradictionCount,
        severity: rounded(severity, 2),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.severity - left.severity)
    .slice(0, 12);

  const possibleEdges = Math.max(
    1,
    (graph.nodeCount * Math.max(graph.nodeCount - 1, 1)) / 2,
  );
  const density = clamp((graph.edgeCount / possibleEdges) * 8_000);
  const edgeIntensity = clamp(
    average(graph.edges.map((edge) => edge.weight * 100), 50),
  );
  const largestComponentPercent = graph.nodeCount
    ? ((components[0]?.length ?? 0) / graph.nodeCount) * 100
    : 0;
  const contradictionEdges = graph.edges.filter(
    (edge) => edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES",
  ).length;
  const connectednessScore = clamp(
    largestComponentPercent * 0.42 +
      edgeIntensity * 0.24 +
      density * 0.14 +
      Math.min(bridgeNodes.length * 2.5, 20),
  );
  const visualComplexity = clamp(
    Math.log2(Math.max(graph.nodeCount, 1)) * 8.2 +
      Math.log2(Math.max(graph.edgeCount, 1)) * 6.3 +
      communities.length * 1.4,
  );

  return {
    density: rounded(density),
    visualComplexity: rounded(visualComplexity),
    edgeIntensity: rounded(edgeIntensity),
    connectednessScore: rounded(connectednessScore),
    centralityTop,
    bridgeNodes,
    contradictionHotspots,
    clusterPressure: clusterPressureFromGraph(graph, score),
    algorithmVersion: "slice-graph-analytics-3.0.0",
    pagerankTop: rankedNodes(graph, pagerank, 12),
    betweennessTop: rankedNodes(graph, betweenness.scores, 12),
    communities,
    componentCount: components.length,
    largestComponentPercent: rounded(largestComponentPercent),
    networkResilience: rounded(networkResilience(graph, index, centralityTop)),
    sourceConcentration: rounded(sourceConcentration(graph)),
    contradictionRatio: rounded(
      graph.edgeCount ? (contradictionEdges / graph.edgeCount) * 100 : 0,
    ),
    averagePathLength: rounded(betweenness.averagePathLength),
    analyzedNodeCount: graph.nodeCount,
    analyzedEdgeCount: graph.edgeCount,
    analysisDurationMs: Date.now() - startedAt,
  };
}

export function shortestPath(
  graph: ResearchKnowledgeGraph,
  sourceId: string,
  targetId: string,
) {
  if (sourceId === targetId) return [sourceId];
  const index = buildGraphIndex(graph);
  if (!index.nodeById.has(sourceId) || !index.nodeById.has(targetId)) return [];
  const queue = [sourceId];
  const visited = new Set([sourceId]);
  const previous = new Map<string, string>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;

    for (const neighbor of index.undirected.get(current) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      previous.set(neighbor, current);

      if (neighbor === targetId) {
        const path = [targetId];
        let cursor = targetId;
        while (previous.has(cursor)) {
          cursor = previous.get(cursor) ?? sourceId;
          path.push(cursor);
          if (cursor === sourceId) break;
        }
        return path.reverse();
      }

      queue.push(neighbor);
    }
  }

  return [];
}

export function getResearchGraphNodeDetail(
  graph: ResearchKnowledgeGraph,
  nodeId: string | null | undefined,
): ResearchGraphNodeDetail | null {
  if (!nodeId) return null;
  const index = buildGraphIndex(graph);
  const node = index.nodeById.get(nodeId);
  if (!node) return null;
  const scoreNode = graph.nodes.find((candidate) => candidate.kind === "score");
  const neighbors = (index.adjacency.get(nodeId) ?? [])
    .map((entry) => {
      const neighbor = index.nodeById.get(entry.nodeId);
      return neighbor
        ? {
            node: neighbor,
            edge: entry.edge,
            direction: entry.direction,
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort(
      (left, right) =>
        right.edge.weight - left.edge.weight ||
        left.node.label.localeCompare(right.node.label),
    )
    .slice(0, 80);

  return {
    node,
    neighbors,
    pathToScore: scoreNode ? shortestPath(graph, nodeId, scoreNode.id) : [],
    incomingCount: index.incomingCount.get(nodeId) ?? 0,
    outgoingCount: index.outgoingCount.get(nodeId) ?? 0,
    contradictionCount: index.contradictionCount.get(nodeId) ?? 0,
  };
}

function nodeImportance(
  node: ResearchGraphNode,
  index: GraphIndex,
  analytics: ResearchGraphAnalytics | null | undefined,
) {
  const kindWeight: Record<ResearchGraphNodeKind, number> = {
    score: 180,
    asset: 170,
    run: 155,
    cohort: 145,
    sector: 125,
    industry: 120,
    forecast: 112,
    evidence: 100,
    "economic-series": 100,
    source: 84,
    factor: 82,
    topic: 74,
    agent: 42,
  };
  const centrality = analytics?.centralityTop.find((item) => item.id === node.id)
    ?.centralityScore ?? 0;
  const pagerank = analytics?.pagerankTop?.find((item) => item.id === node.id)?.score ?? 0;
  const betweenness = analytics?.betweennessTop?.find((item) => item.id === node.id)?.score ?? 0;
  const degree = (index.adjacency.get(node.id) ?? []).length;
  const contradiction = index.contradictionCount.get(node.id) ?? 0;

  return (
    kindWeight[node.kind] +
    centrality * 1.15 +
    pagerank * 0.8 +
    betweenness * 0.7 +
    degree * 2.4 +
    contradiction * 9 +
    safeScore(node.confidence, 0) * 0.18 +
    Math.abs(safeScore(node.score) - 50) * 0.25 +
    node.size * 0.4
  );
}

function edgeImportance(
  edge: ResearchGraphEdge,
  selectedNodeId: string | null,
  pathEdgeIds: Set<string>,
) {
  const kindWeight: Record<ResearchGraphEdge["kind"], number> = {
    DERIVES: 130,
    CONTRIBUTES_TO: 125,
    RESEARCHES: 118,
    OPERATES_IN: 112,
    BELONGS_TO: 105,
    CONTRADICTS: 104,
    OPPOSES: 104,
    SUPPORTS: 94,
    PUBLISHED_BY: 82,
    USES_EVIDENCE: 80,
    ABOUT_TOPIC: 68,
    CONTAINS: 62,
  };

  return (
    kindWeight[edge.kind] +
    edge.weight * 100 +
    (pathEdgeIds.has(edge.id) ? 500 : 0) +
    (selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
      ? 320
      : 0)
  );
}

function edgeIdsForPath(graph: ResearchKnowledgeGraph, path: string[]) {
  const pairs = new Set<string>();
  for (let index = 0; index < path.length - 1; index += 1) {
    pairs.add(`${path[index]}\u0000${path[index + 1]}`);
    pairs.add(`${path[index + 1]}\u0000${path[index]}`);
  }

  return new Set(
    graph.edges
      .filter((edge) => pairs.has(`${edge.source}\u0000${edge.target}`))
      .map((edge) => edge.id),
  );
}

export function projectResearchGraph(
  graph: ResearchKnowledgeGraph,
  options: ProjectResearchGraphOptions = {},
): ResearchKnowledgeGraph {
  const mode = options.mode ?? "balanced";
  const limits = PROJECTION_LIMITS[mode];
  const index = buildGraphIndex(graph);
  const analytics = options.analytics ?? analyzeResearchGraph(graph);
  const normalizedSearch = normalizeSearch(options.search);
  const cohortSet = options.cohorts?.length ? new Set(options.cohorts) : null;
  const kindSet = options.kinds?.length ? new Set(options.kinds) : null;
  const selectedNodeId = options.selectedNodeId ?? null;
  const scoreNode = graph.nodes.find((node) => node.kind === "score");
  const selectedPath =
    selectedNodeId && scoreNode ? shortestPath(graph, selectedNodeId, scoreNode.id) : [];
  const selectedPathIds = new Set(selectedPath);
  const pathEdgeIds = edgeIdsForPath(graph, selectedPath);
  const required = new Set<string>();

  for (const node of graph.nodes) {
    if (STRUCTURAL_KINDS.has(node.kind)) required.add(node.id);
  }

  for (const nodeId of selectedPathIds) required.add(nodeId);

  if (selectedNodeId) {
    required.add(selectedNodeId);
    for (const entry of index.adjacency.get(selectedNodeId) ?? []) {
      required.add(entry.nodeId);
    }
  }

  const candidates = graph.nodes.filter((node) => {
    if (required.has(node.id)) return true;
    if (cohortSet && !cohortSet.has(node.cohort)) return false;
    if (kindSet && !kindSet.has(node.kind)) return false;
    if (!normalizedSearch) return true;
    const haystack = `${node.label} ${node.kind} ${node.group} ${Object.values(
      node.properties,
    ).join(" ")}`.toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  if (normalizedSearch) {
    for (const node of candidates) {
      for (const entry of index.adjacency.get(node.id) ?? []) required.add(entry.nodeId);
    }
  }

  const agentCountByCohort = new Map<ResearchCohort | "shared", number>();
  const selectedNodes: ResearchGraphNode[] = [];

  for (const node of [...candidates].sort((left, right) => {
    const requiredDelta = Number(required.has(right.id)) - Number(required.has(left.id));
    if (requiredDelta) return requiredDelta;
    return (
      nodeImportance(right, index, analytics) -
        nodeImportance(left, index, analytics) ||
      left.id.localeCompare(right.id)
    );
  })) {
    if (selectedNodes.length >= limits.nodes && !required.has(node.id)) continue;

    if (node.kind === "agent" && !required.has(node.id)) {
      const current = agentCountByCohort.get(node.cohort) ?? 0;
      if (current >= limits.agentCapPerCohort) continue;
      agentCountByCohort.set(node.cohort, current + 1);
    }

    selectedNodes.push(node);
  }

  const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
  const minEdgeWeight = clamp(options.minEdgeWeight ?? 0, 0, 1);
  const selectedEdges = graph.edges
    .filter(
      (edge) =>
        selectedNodeIds.has(edge.source) &&
        selectedNodeIds.has(edge.target) &&
        (edge.weight >= minEdgeWeight ||
          pathEdgeIds.has(edge.id) ||
          edge.kind === "DERIVES" ||
          edge.kind === "CONTRIBUTES_TO" ||
          edge.kind === "RESEARCHES"),
    )
    .sort(
      (left, right) =>
        edgeImportance(right, selectedNodeId, pathEdgeIds) -
          edgeImportance(left, selectedNodeId, pathEdgeIds) ||
        left.id.localeCompare(right.id),
    )
    .slice(0, limits.edges);

  const edgeNodeIds = new Set(
    selectedEdges.flatMap((edge) => [edge.source, edge.target]),
  );
  const finalNodes = selectedNodes.filter(
    (node) => required.has(node.id) || edgeNodeIds.has(node.id) || STRUCTURAL_KINDS.has(node.kind),
  );
  const finalNodeIds = new Set(finalNodes.map((node) => node.id));
  const finalEdges = selectedEdges.filter(
    (edge) => finalNodeIds.has(edge.source) && finalNodeIds.has(edge.target),
  );
  const cohortIds = ["media", "technical", "economy", "shared"] as const;
  const clusters = cohortIds.map((cohort) => {
    const cohortNodes = finalNodes.filter((node) => node.cohort === cohort);
    const scores = cohortNodes
      .map((node) => node.score)
      .filter((value): value is number => typeof value === "number");
    const existing = graph.clusters.find((cluster) => cluster.cohort === cohort);

    return {
      id: cohort,
      label: existing?.label ?? `${cohort} research`,
      cohort,
      nodeCount: cohortNodes.length,
      averageScore: rounded(average(scores, existing?.averageScore ?? 50)),
    };
  });

  return {
    ...graph,
    nodeCount: finalNodes.length,
    edgeCount: finalEdges.length,
    nodes: finalNodes,
    edges: finalEdges,
    clusters,
    projection: {
      mode,
      originalNodeCount: graph.nodes.length,
      originalEdgeCount: graph.edges.length,
      renderedNodeCount: finalNodes.length,
      renderedEdgeCount: finalEdges.length,
      omittedNodeCount: Math.max(0, graph.nodes.length - finalNodes.length),
      omittedEdgeCount: Math.max(0, graph.edges.length - finalEdges.length),
      clipped:
        finalNodes.length < graph.nodes.length || finalEdges.length < graph.edges.length,
      selectedNodeId,
      generatedAt: new Date().toISOString(),
    },
  };
}

export function graphProjectionLimits(mode: ResearchGraphProjectionMode) {
  return { ...PROJECTION_LIMITS[mode] };
}