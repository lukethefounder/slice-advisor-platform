"use client";

import {
  Activity,
  Eye,
  EyeOff,
  Focus,
  Maximize2,
  Minus,
  Network,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent,
  type WheelEvent,
} from "react";

import {
  IntelligencePill,
  formatIntelligenceNumber,
} from "@/components/intelligence/intelligence-ui";
import type {
  ResearchCohort,
  ResearchGraphAnalytics,
  ResearchGraphEdge,
  ResearchGraphNode,
  ResearchGraphNodeDetail,
  ResearchGraphNodeKind,
  ResearchKnowledgeGraph,
} from "@/lib/intelligence/research-swarm-types";

type PositionedNode = ResearchGraphNode & {
  x: number;
  y: number;
};

type PositionedEdge = {
  edge: ResearchGraphEdge;
  source: PositionedNode;
  target: PositionedNode;
  controlX: number;
  controlY: number;
  priority: number;
};

type ViewState = {
  x: number;
  y: number;
  zoom: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  viewX: number;
  viewY: number;
};

type Dimensions = {
  width: number;
  height: number;
  pixelRatio: number;
};

type HardwareProfile = {
  lowPower: boolean;
  edgeMultiplier: number;
  frameInterval: number;
  animatedEdgeLimit: number;
};

type Palette = {
  surface: string;
  surfaceMuted: string;
  heading: string;
  muted: string;
  border: string;
  accent: string;
};

type NeighborEntry = {
  nodeId: string;
  edge: ResearchGraphEdge;
  direction: "incoming" | "outgoing";
};

const COHORT_COLORS: Record<ResearchCohort | "shared", string> = {
  media: "#d97706",
  technical: "#0891b2",
  economy: "#7c3aed",
  shared: "#059669",
};

const COHORT_CENTERS: Record<ResearchCohort | "shared", [number, number]> = {
  media: [-0.6, -0.16],
  technical: [0.6, -0.17],
  economy: [0, 0.59],
  shared: [0, -0.04],
};

const NODE_KINDS: Array<ResearchGraphNodeKind | "all"> = [
  "all",
  "score",
  "asset",
  "cohort",
  "agent",
  "evidence",
  "economic-series",
  "source",
  "topic",
  "sector",
  "industry",
];

const DEFAULT_PALETTE: Palette = {
  surface: "#ffffff",
  surfaceMuted: "#eef8f2",
  heading: "#031f17",
  muted: "#587166",
  border: "rgba(7, 83, 60, 0.18)",
  accent: "#16a36f",
};

const SPATIAL_CELL_SIZE = 0.065;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function hashNumber(value: string) {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return Math.abs(hash);
}

function ringPosition(input: {
  index: number;
  count: number;
  center: [number, number];
  ringBase: number;
  id: string;
}) {
  const safeCount = Math.max(input.count, 1);
  const ring = Math.floor(Math.sqrt(input.index / 10));
  const radius = input.ringBase + ring * 0.048;
  const phase = ((hashNumber(input.id) % 360) / 360) * 0.65;
  const angle =
    (input.index / safeCount) *
      Math.PI *
      2 *
      (1 + ring * 0.09) +
    phase;
  const jitter =
    ((hashNumber(`${input.id}:jitter`) % 100) / 100 - 0.5) *
    0.014;

  return {
    x:
      input.center[0] +
      Math.cos(angle) * (radius + jitter),
    y:
      input.center[1] +
      Math.sin(angle) * (radius + jitter),
  };
}

function buildPositions(graph: ResearchKnowledgeGraph) {
  const counts = new Map<string, number>();

  for (const node of graph.nodes) {
    const key = `${node.cohort}:${node.kind}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const indexes = new Map<string, number>();

  return graph.nodes.map<PositionedNode>((node) => {
    const center = COHORT_CENTERS[node.cohort];
    const key = `${node.cohort}:${node.kind}`;
    const index = indexes.get(key) ?? 0;
    indexes.set(key, index + 1);
    const count = counts.get(key) ?? 1;

    if (node.kind === "score") {
      return { ...node, x: 0, y: -0.02 };
    }
    if (node.kind === "asset") {
      return { ...node, x: 0, y: -0.34 };
    }
    if (node.kind === "run") {
      return { ...node, x: -0.18, y: -0.2 };
    }
    if (node.kind === "cohort") {
      return { ...node, x: center[0], y: center[1] };
    }
    if (node.kind === "sector") {
      return { ...node, x: 0.18, y: 0.42 };
    }
    if (node.kind === "industry") {
      return { ...node, x: -0.18, y: 0.43 };
    }

    const ringBase =
      node.kind === "agent"
        ? 0.11
        : node.kind === "evidence" ||
            node.kind === "economic-series"
          ? 0.29
          : node.kind === "source"
            ? 0.42
            : node.kind === "topic" ||
                node.kind === "factor"
              ? 0.51
              : 0.36;

    return {
      ...node,
      ...ringPosition({
        index,
        count,
        center,
        ringBase,
        id: node.id,
      }),
    };
  });
}

function nodeRadius(node: ResearchGraphNode, zoom: number) {
  const base =
    node.kind === "score"
      ? 10.5
      : node.kind === "asset"
        ? 8
        : node.kind === "cohort"
          ? 7.2
          : node.kind === "agent"
            ? 1.35
            : Math.max(2.1, node.size / 3);

  return clamp(base * Math.sqrt(zoom), 1.05, 18);
}

function nodeColor(node: ResearchGraphNode) {
  if (node.kind === "score") return "#052e22";
  if (node.kind === "asset") return "#10b981";
  if (node.kind === "source") return "#64748b";
  if (node.kind === "topic") return "#94a3b8";
  return COHORT_COLORS[node.cohort];
}

function staticEdgePriority(edge: ResearchGraphEdge) {
  const structural =
    edge.kind === "DERIVES" ||
    edge.kind === "CONTRIBUTES_TO" ||
    edge.kind === "RESEARCHES" ||
    edge.kind === "OPERATES_IN";

  return (
    (structural ? 400 : 0) +
    (edge.kind === "CONTRADICTS" ||
    edge.kind === "OPPOSES"
      ? 260
      : 0) +
    (edge.kind === "SUPPORTS" ? 120 : 0) +
    edge.weight * 100
  );
}

function buildEdges(
  graph: ResearchKnowledgeGraph,
  positionMap: Map<string, PositionedNode>,
) {
  return graph.edges
    .flatMap<PositionedEdge>((edge) => {
      const source = positionMap.get(edge.source);
      const target = positionMap.get(edge.target);

      if (!source || !target) return [];

      const midpointX = (source.x + target.x) / 2;
      const midpointY = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(Math.hypot(dx, dy), 0.0001);
      const direction =
        hashNumber(edge.id) % 2 === 0 ? 1 : -1;
      const strength =
        0.016 +
        ((hashNumber(edge.id) % 100) / 100) * 0.03;

      return [
        {
          edge,
          source,
          target,
          controlX:
            midpointX +
            (-dy / distance) * strength * direction,
          controlY:
            midpointY +
            (dx / distance) * strength * direction,
          priority: staticEdgePriority(edge),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        left.edge.id.localeCompare(right.edge.id),
    );
}

function buildAdjacency(graph: ResearchKnowledgeGraph) {
  const adjacency = new Map<string, NeighborEntry[]>();

  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
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
  }

  return adjacency;
}

function shortestPath(
  adjacency: Map<string, NeighborEntry[]>,
  start: string | null,
  target: string | null,
) {
  if (!start || !target) return [];
  if (start === target) return [start];

  const queue = [start];
  const visited = new Set([start]);
  const previous = new Map<string, string>();

  while (queue.length) {
    const current = queue.shift();
    if (!current) break;

    for (const neighbor of adjacency.get(current) ?? []) {
      if (visited.has(neighbor.nodeId)) continue;
      visited.add(neighbor.nodeId);
      previous.set(neighbor.nodeId, current);

      if (neighbor.nodeId === target) {
        const path = [target];
        let cursor = target;

        while (previous.has(cursor)) {
          cursor = previous.get(cursor) ?? start;
          path.push(cursor);
          if (cursor === start) break;
        }

        return path.reverse();
      }

      queue.push(neighbor.nodeId);
    }
  }

  return [];
}

function nodeDetail(
  graph: ResearchKnowledgeGraph,
  adjacency: Map<string, NeighborEntry[]>,
  selectedNodeId: string | null,
  pathToScore: string[],
): ResearchGraphNodeDetail | null {
  if (!selectedNodeId) return null;
  const nodeById = new Map(
    graph.nodes.map((node) => [node.id, node]),
  );
  const node = nodeById.get(selectedNodeId);
  if (!node) return null;

  const neighbors = (adjacency.get(selectedNodeId) ?? [])
    .flatMap((entry) => {
      const neighbor = nodeById.get(entry.nodeId);
      return neighbor
        ? [
            {
              node: neighbor,
              edge: entry.edge,
              direction: entry.direction,
            },
          ]
        : [];
    })
    .sort(
      (left, right) =>
        right.edge.weight - left.edge.weight,
    );

  return {
    node,
    neighbors,
    pathToScore,
    incomingCount: neighbors.filter(
      (entry) => entry.direction === "incoming",
    ).length,
    outgoingCount: neighbors.filter(
      (entry) => entry.direction === "outgoing",
    ).length,
    contradictionCount: neighbors.filter(
      (entry) =>
        entry.edge.kind === "CONTRADICTS" ||
        entry.edge.kind === "OPPOSES",
    ).length,
  };
}

function pathEdgeIds(
  graph: ResearchKnowledgeGraph,
  path: string[],
) {
  const pairs = new Set<string>();

  for (let index = 0; index < path.length - 1; index += 1) {
    pairs.add(`${path[index]}\u0000${path[index + 1]}`);
    pairs.add(`${path[index + 1]}\u0000${path[index]}`);
  }

  return new Set(
    graph.edges
      .filter((edge) =>
        pairs.has(`${edge.source}\u0000${edge.target}`),
      )
      .map((edge) => edge.id),
  );
}

function spatialKey(x: number, y: number) {
  return `${Math.floor(x / SPATIAL_CELL_SIZE)}:${Math.floor(
    y / SPATIAL_CELL_SIZE,
  )}`;
}

function createSpatialIndex(
  nodes: PositionedNode[],
  visible: Set<string>,
) {
  const buckets = new Map<string, PositionedNode[]>();

  for (const node of nodes) {
    if (!visible.has(node.id)) continue;
    const key = spatialKey(node.x, node.y);
    const bucket = buckets.get(key) ?? [];
    bucket.push(node);
    buckets.set(key, bucket);
  }

  return buckets;
}

function hardwareProfile(): HardwareProfile {
  if (typeof navigator === "undefined") {
    return {
      lowPower: false,
      edgeMultiplier: 1,
      frameInterval: 55,
      animatedEdgeLimit: 40,
    };
  }

  const memory = (
    navigator as Navigator & { deviceMemory?: number }
  ).deviceMemory;
  const cores = navigator.hardwareConcurrency || 4;
  const lowPower =
    cores <= 4 ||
    (typeof memory === "number" && memory <= 4);

  return lowPower
    ? {
        lowPower: true,
        edgeMultiplier: 0.55,
        frameInterval: 85,
        animatedEdgeLimit: 18,
      }
    : {
        lowPower: false,
        edgeMultiplier: 1,
        frameInterval: 55,
        animatedEdgeLimit: 40,
      };
}

function edgeBudget(
  graph: ResearchKnowledgeGraph,
  profile: HardwareProfile,
  zoom: number,
) {
  const mode = graph.projection?.mode ?? "full";
  const base =
    mode === "overview"
      ? 900
      : mode === "balanced"
        ? 2_200
        : 4_200;
  const zoomLift =
    zoom >= 2 ? 1.5 : zoom >= 1.35 ? 1.22 : 1;

  return Math.max(
    250,
    Math.round(base * profile.edgeMultiplier * zoomLift),
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);

    return () =>
      media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

function usePalette() {
  const [palette, setPalette] =
    useState<Palette>(DEFAULT_PALETTE);

  useEffect(() => {
    const update = () => {
      const style = getComputedStyle(
        document.documentElement,
      );
      const read = (name: string, fallback: string) =>
        style.getPropertyValue(name).trim() || fallback;

      setPalette({
        surface: read(
          "--slice-surface-strong",
          DEFAULT_PALETTE.surface,
        ),
        surfaceMuted: read(
          "--slice-surface-muted",
          DEFAULT_PALETTE.surfaceMuted,
        ),
        heading: read(
          "--slice-heading",
          DEFAULT_PALETTE.heading,
        ),
        muted: read("--slice-muted", DEFAULT_PALETTE.muted),
        border: read(
          "--slice-border",
          DEFAULT_PALETTE.border,
        ),
        accent: read(
          "--slice-accent",
          DEFAULT_PALETTE.accent,
        ),
      });
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        "data-slice-theme",
        "data-slice-appearance",
        "class",
        "style",
      ],
    });

    return () => observer.disconnect();
  }, []);

  return palette;
}

export default function ResearchKnowledgeGraphCanvas({
  graph,
  analytics = null,
  height = 680,
  live = false,
}: {
  graph: ResearchKnowledgeGraph;
  analytics?: ResearchGraphAnalytics | null;
  height?: number;
  live?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const interactionFrameRef = useRef<number | null>(null);
  const hoverFrameRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{
    clientX: number;
    clientY: number;
  } | null>(null);
  const lastFrameRef = useRef(0);
  const viewRef = useRef<ViewState>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const reducedMotion = useReducedMotion();
  const palette = usePalette();
  const [profile, setProfile] =
    useState<HardwareProfile>({
      lowPower: false,
      edgeMultiplier: 1,
      frameInterval: 55,
      animatedEdgeLimit: 40,
    });
  const [dimensions, setDimensions] =
    useState<Dimensions>({
      width: 1,
      height,
      pixelRatio: 1,
    });
  const [isIntersecting, setIsIntersecting] =
    useState(true);
  const [documentVisible, setDocumentVisible] =
    useState(true);
  const [view, setView] = useState<ViewState>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] =
    useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState<
    ResearchCohort | "shared" | "all"
  >("all");
  const [kindFilter, setKindFilter] = useState<
    ResearchGraphNodeKind | "all"
  >("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(
    search.trim().toLowerCase(),
  );
  const [minEdgeWeight, setMinEdgeWeight] = useState(0);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [isolateSelection, setIsolateSelection] =
    useState(false);

  useEffect(() => {
    setProfile(hardwareProfile());
  }, []);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const positions = useMemo(
    () => buildPositions(graph),
    [graph],
  );
  const positionMap = useMemo(
    () =>
      new Map(
        positions.map((node) => [node.id, node]),
      ),
    [positions],
  );
  const adjacency = useMemo(
    () => buildAdjacency(graph),
    [graph],
  );
  const allEdges = useMemo(
    () => buildEdges(graph, positionMap),
    [graph, positionMap],
  );
  const scoreNodeId = useMemo(
    () =>
      graph.nodes.find((node) => node.kind === "score")
        ?.id ?? null,
    [graph.nodes],
  );
  const selectedPath = useMemo(
    () =>
      shortestPath(
        adjacency,
        selectedNodeId,
        scoreNodeId,
      ),
    [adjacency, scoreNodeId, selectedNodeId],
  );
  const selectedPathNodeIds = useMemo(
    () => new Set(selectedPath),
    [selectedPath],
  );
  const selectedPathEdges = useMemo(
    () => pathEdgeIds(graph, selectedPath),
    [graph, selectedPath],
  );
  const centralNodeIds = useMemo(
    () =>
      new Set([
        ...(analytics?.centralityTop
          .slice(0, 10)
          .map((node) => node.id) ?? []),
        ...(analytics?.pagerankTop
          ?.slice(0, 8)
          .map((node) => node.id) ?? []),
        ...(analytics?.betweennessTop
          ?.slice(0, 8)
          .map((node) => node.id) ?? []),
      ]),
    [analytics],
  );

  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    const isolated = new Set<string>();

    if (isolateSelection && selectedNodeId) {
      isolated.add(selectedNodeId);
      for (const neighbor of adjacency.get(
        selectedNodeId,
      ) ?? []) {
        isolated.add(neighbor.nodeId);
      }
      for (const pathNode of selectedPath) {
        isolated.add(pathNode);
      }
    }

    for (const node of positions) {
      const cohortMatch =
        cohortFilter === "all" ||
        node.cohort === cohortFilter ||
        selectedPathNodeIds.has(node.id);
      const kindMatch =
        kindFilter === "all" ||
        node.kind === kindFilter;
      const searchMatch =
        !deferredSearch ||
        `${node.label} ${node.kind} ${node.group} ${Object.values(
          node.properties,
        ).join(" ")}`
          .toLowerCase()
          .includes(deferredSearch);
      const isolationMatch =
        !isolateSelection ||
        !selectedNodeId ||
        isolated.has(node.id);

      if (
        cohortMatch &&
        kindMatch &&
        searchMatch &&
        isolationMatch
      ) {
        ids.add(node.id);
      }
    }

    if (deferredSearch) {
      for (const nodeId of [...ids]) {
        for (const neighbor of adjacency.get(nodeId) ?? []) {
          ids.add(neighbor.nodeId);
        }
      }
    }

    for (const nodeId of selectedPathNodeIds) {
      ids.add(nodeId);
    }

    return ids;
  }, [
    adjacency,
    cohortFilter,
    deferredSearch,
    isolateSelection,
    kindFilter,
    positions,
    selectedNodeId,
    selectedPath,
    selectedPathNodeIds,
  ]);

  const budget = edgeBudget(graph, profile, view.zoom);
  const visibleEdges = useMemo(
    () =>
      allEdges
        .filter(
          (record) =>
            visibleNodeIds.has(record.edge.source) &&
            visibleNodeIds.has(record.edge.target) &&
            (record.edge.weight >= minEdgeWeight ||
              selectedPathEdges.has(record.edge.id) ||
              record.edge.kind === "DERIVES" ||
              record.edge.kind === "CONTRIBUTES_TO" ||
              record.edge.kind === "RESEARCHES"),
        )
        .slice(0, budget),
    [
      allEdges,
      budget,
      minEdgeWeight,
      selectedPathEdges,
      visibleNodeIds,
    ],
  );
  const animatedEdges = useMemo(
    () =>
      visibleEdges
        .filter(
          (record) =>
            selectedPathEdges.has(record.edge.id) ||
            record.edge.source === selectedNodeId ||
            record.edge.target === selectedNodeId ||
            record.edge.weight >= 0.72,
        )
        .slice(0, profile.animatedEdgeLimit),
    [
      profile.animatedEdgeLimit,
      selectedNodeId,
      selectedPathEdges,
      visibleEdges,
    ],
  );
  const spatialIndex = useMemo(
    () => createSpatialIndex(positions, visibleNodeIds),
    [positions, visibleNodeIds],
  );
  const selectedDetail = useMemo(
    () =>
      nodeDetail(
        graph,
        adjacency,
        selectedNodeId,
        selectedPath,
      ),
    [adjacency, graph, selectedNodeId, selectedPath],
  );
  const animationActive =
    live &&
    motionEnabled &&
    !reducedMotion &&
    isIntersecting &&
    documentVisible;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const rectangle =
        container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const dprCap = profile.lowPower ? 1 : 1.5;

      setDimensions({
        width: Math.max(1, rectangle.width),
        height: Math.max(1, height),
        pixelRatio: Math.min(
          dprCap,
          Math.max(1, dpr),
        ),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);

    return () => observer.disconnect();
  }, [height, profile.lowPower]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) =>
        setIsIntersecting(entry?.isIntersecting ?? true),
      { rootMargin: "120px" },
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () =>
      setDocumentVisible(
        document.visibilityState === "visible",
      );
    update();
    document.addEventListener(
      "visibilitychange",
      update,
    );

    return () =>
      document.removeEventListener(
        "visibilitychange",
        update,
      );
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = Math.round(
      dimensions.width * dimensions.pixelRatio,
    );
    canvas.height = Math.round(
      dimensions.height * dimensions.pixelRatio,
    );
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
  }, [dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    const draw = (time = performance.now()) => {
      if (disposed) return;

      if (
        animationActive &&
        time - lastFrameRef.current <
          profile.frameInterval
      ) {
        animationFrameRef.current =
          window.requestAnimationFrame(draw);
        return;
      }

      lastFrameRef.current = time;
      const context = canvas.getContext("2d", {
        alpha: false,
        desynchronized: true,
      });

      if (!context) return;

      const {
        width,
        height: canvasHeight,
        pixelRatio,
      } = dimensions;
      context.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0,
      );
      context.fillStyle = palette.surface;
      context.fillRect(0, 0, width, canvasHeight);

      const baseScale =
        Math.min(width, canvasHeight) * 0.77;
      const scale = baseScale * view.zoom;
      const centerX = width / 2 + view.x;
      const centerY = canvasHeight / 2 + view.y;
      const pulse = animationActive
        ? (Math.sin(time / 850) + 1) / 2
        : 0.28;

      const screen = (node: PositionedNode) => ({
        x: centerX + node.x * scale,
        y: centerY + node.y * scale,
      });

      context.strokeStyle = palette.border;
      context.globalAlpha = 0.32;
      context.lineWidth = 1;
      const grid = 48;
      const offsetX =
        ((view.x % grid) + grid) % grid;
      const offsetY =
        ((view.y % grid) + grid) % grid;
      context.beginPath();

      for (let x = offsetX; x < width; x += grid) {
        context.moveTo(x, 0);
        context.lineTo(x, canvasHeight);
      }
      for (
        let y = offsetY;
        y < canvasHeight;
        y += grid
      ) {
        context.moveTo(0, y);
        context.lineTo(width, y);
      }

      context.stroke();
      context.globalAlpha = 1;

      for (const [
        cohort,
        [x, y],
      ] of Object.entries(COHORT_CENTERS) as Array<
        [ResearchCohort | "shared", [number, number]]
      >) {
        const cohortCenter = {
          x: centerX + x * scale,
          y: centerY + y * scale,
        };
        const radius =
          cohort === "shared"
            ? scale * 0.18
            : scale * (0.27 + pulse * 0.014);
        const glow = context.createRadialGradient(
          cohortCenter.x,
          cohortCenter.y,
          0,
          cohortCenter.x,
          cohortCenter.y,
          radius,
        );
        glow.addColorStop(
          0,
          `${COHORT_COLORS[cohort]}20`,
        );
        glow.addColorStop(
          1,
          `${COHORT_COLORS[cohort]}00`,
        );
        context.fillStyle = glow;
        context.fillRect(
          cohortCenter.x - radius,
          cohortCenter.y - radius,
          radius * 2,
          radius * 2,
        );
      }

      context.lineCap = "round";

      for (const record of visibleEdges) {
        const sourceScreen = screen(record.source);
        const targetScreen = screen(record.target);
        const controlScreen = {
          x: centerX + record.controlX * scale,
          y: centerY + record.controlY * scale,
        };
        const edge = record.edge;
        const path = selectedPathEdges.has(edge.id);
        const active =
          path ||
          edge.source === selectedNodeId ||
          edge.target === selectedNodeId ||
          edge.source === hoveredNodeId ||
          edge.target === hoveredNodeId;
        const contradiction =
          edge.kind === "CONTRADICTS" ||
          edge.kind === "OPPOSES";
        const support = edge.kind === "SUPPORTS";

        context.beginPath();
        context.moveTo(
          sourceScreen.x,
          sourceScreen.y,
        );
        context.quadraticCurveTo(
          controlScreen.x,
          controlScreen.y,
          targetScreen.x,
          targetScreen.y,
        );
        context.strokeStyle = contradiction
          ? "#e11d48"
          : support
            ? "#059669"
            : COHORT_COLORS[edge.cohort];
        context.globalAlpha = active
          ? 0.9
          : contradiction
            ? 0.3
            : 0.18;
        context.lineWidth = path
          ? 2.2
          : active
            ? 1.5
            : clamp(edge.weight * 0.72, 0.18, 0.9);
        context.stroke();
      }

      context.globalAlpha = 1;

      if (animationActive) {
        for (const record of animatedEdges) {
          const sourceScreen = screen(record.source);
          const targetScreen = screen(record.target);
          const controlScreen = {
            x: centerX + record.controlX * scale,
            y: centerY + record.controlY * scale,
          };
          const t =
            (time / 1_900 +
              (hashNumber(record.edge.id) % 100) /
                100) %
            1;
          const inverse = 1 - t;
          const x =
            inverse * inverse * sourceScreen.x +
            2 *
              inverse *
              t *
              controlScreen.x +
            t * t * targetScreen.x;
          const y =
            inverse * inverse * sourceScreen.y +
            2 *
              inverse *
              t *
              controlScreen.y +
            t * t * targetScreen.y;

          context.beginPath();
          context.arc(
            x,
            y,
            selectedPathEdges.has(record.edge.id)
              ? 2.5
              : 1.35,
            0,
            Math.PI * 2,
          );
          context.fillStyle =
            record.edge.kind === "CONTRADICTS" ||
            record.edge.kind === "OPPOSES"
              ? "#e11d48"
              : palette.heading;
          context.globalAlpha = 0.75;
          context.fill();
        }

        context.globalAlpha = 1;
      }

      for (const node of positions) {
        if (!visibleNodeIds.has(node.id)) continue;
        const point = screen(node);

        if (
          point.x < -45 ||
          point.x > width + 45 ||
          point.y < -45 ||
          point.y > canvasHeight + 45
        ) {
          continue;
        }

        const radius = nodeRadius(node, view.zoom);
        const selected = node.id === selectedNodeId;
        const hovered = node.id === hoveredNodeId;
        const path = selectedPathNodeIds.has(node.id);
        const central = centralNodeIds.has(node.id);
        const halo =
          selected || hovered || path || central;

        if (halo) {
          context.beginPath();
          context.arc(
            point.x,
            point.y,
            radius +
              (selected ? 9 : 5) +
              pulse,
            0,
            Math.PI * 2,
          );
          context.fillStyle =
            path || selected
              ? palette.accent
              : COHORT_COLORS[node.cohort];
          context.globalAlpha =
            selected || hovered
              ? 0.22
              : path
                ? 0.15
                : 0.09;
          context.fill();
          context.globalAlpha = 1;
        }

        context.beginPath();
        context.arc(
          point.x,
          point.y,
          radius,
          0,
          Math.PI * 2,
        );
        context.fillStyle = nodeColor(node);
        context.globalAlpha =
          selected || hovered || path
            ? 1
            : node.kind === "agent"
              ? 0.62
              : 0.9;
        context.fill();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(
          point.x,
          point.y,
          radius + 1.3,
          0,
          Math.PI * 2,
        );
        context.strokeStyle = selected
          ? palette.heading
          : palette.surface;
        context.globalAlpha = selected
          ? 0.9
          : 0.7;
        context.lineWidth = selected ? 1.5 : 0.65;
        context.stroke();
        context.globalAlpha = 1;

        const showLabel =
          node.kind === "score" ||
          node.kind === "cohort" ||
          node.kind === "asset" ||
          selected ||
          hovered ||
          path ||
          (central && view.zoom >= 0.9) ||
          view.zoom >= 2.25;

        if (showLabel) {
          context.font = `${
            selected || hovered ? 750 : 650
          } ${node.kind === "score" ? 13 : 10}px system-ui, sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "top";
          context.fillStyle = palette.heading;
          const label =
            node.label.length > 36
              ? `${node.label.slice(0, 33)}…`
              : node.label;
          context.fillText(
            label,
            point.x,
            point.y + radius + 5,
          );
        }
      }

      if (width >= 720) {
        const minimapWidth = 126;
        const minimapHeight = 88;
        const minimapX =
          width - minimapWidth - 15;
        const minimapY =
          canvasHeight - minimapHeight - 15;
        context.fillStyle = palette.surfaceMuted;
        context.strokeStyle = palette.border;
        context.globalAlpha = 0.92;
        context.lineWidth = 1;
        context.beginPath();
        context.roundRect(
          minimapX,
          minimapY,
          minimapWidth,
          minimapHeight,
          12,
        );
        context.fill();
        context.stroke();

        for (const node of positions) {
          if (!visibleNodeIds.has(node.id)) continue;
          context.beginPath();
          context.arc(
            minimapX +
              minimapWidth / 2 +
              node.x * minimapWidth * 0.5,
            minimapY +
              minimapHeight / 2 +
              node.y * minimapHeight * 0.5,
            node.kind === "score"
              ? 2.3
              : node.kind === "cohort"
                ? 1.7
                : 0.65,
            0,
            Math.PI * 2,
          );
          context.fillStyle = nodeColor(node);
          context.globalAlpha =
            node.kind === "agent" ? 0.5 : 0.85;
          context.fill();
        }

        context.globalAlpha = 1;
      }

      if (animationActive) {
        animationFrameRef.current =
          window.requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      disposed = true;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(
          animationFrameRef.current,
        );
      }
    };
  }, [
    animatedEdges,
    animationActive,
    centralNodeIds,
    dimensions,
    hoveredNodeId,
    palette,
    positions,
    profile.frameInterval,
    selectedNodeId,
    selectedPathEdges,
    selectedPathNodeIds,
    view,
    visibleEdges,
    visibleNodeIds,
  ]);

  function screenToGraph(
    clientX: number,
    clientY: number,
  ) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rectangle =
      canvas.getBoundingClientRect();
    const currentView = viewRef.current;
    const scale =
      Math.min(rectangle.width, rectangle.height) *
      0.77 *
      currentView.zoom;
    const centerX =
      rectangle.width / 2 + currentView.x;
    const centerY =
      rectangle.height / 2 + currentView.y;

    return {
      x:
        (clientX - rectangle.left - centerX) /
        scale,
      y:
        (clientY - rectangle.top - centerY) /
        scale,
      scale,
      rectangle,
      view: currentView,
    };
  }

  function findNode(
    clientX: number,
    clientY: number,
  ) {
    const point = screenToGraph(clientX, clientY);
    if (!point) return null;
    const baseCellX = Math.floor(
      point.x / SPATIAL_CELL_SIZE,
    );
    const baseCellY = Math.floor(
      point.y / SPATIAL_CELL_SIZE,
    );
    const candidates: PositionedNode[] = [];

    for (
      let x = baseCellX - 1;
      x <= baseCellX + 1;
      x += 1
    ) {
      for (
        let y = baseCellY - 1;
        y <= baseCellY + 1;
        y += 1
      ) {
        candidates.push(
          ...(spatialIndex.get(`${x}:${y}`) ?? []),
        );
      }
    }

    let closest: PositionedNode | null = null;
    let closestDistance =
      Number.POSITIVE_INFINITY;

    for (const node of candidates) {
      const distance = Math.hypot(
        node.x - point.x,
        node.y - point.y,
      );
      const threshold =
        nodeRadius(node, point.view.zoom) /
          point.scale +
        0.014;

      if (
        distance <= threshold &&
        distance < closestDistance
      ) {
        closest = node;
        closestDistance = distance;
      }
    }

    return closest;
  }

  function fitView() {
    setView({ x: 0, y: 0, zoom: 1 });
  }

  function focusNode(nodeId: string) {
    const node = positionMap.get(nodeId);
    if (!node) return;
    const scale =
      Math.min(dimensions.width, dimensions.height) *
      0.77 *
      view.zoom;

    setSelectedNodeId(nodeId);
    setView((current) => ({
      ...current,
      x: -node.x * scale,
      y: -node.y * scale,
    }));
  }

  function scheduleView(next: ViewState) {
    viewRef.current = next;

    if (interactionFrameRef.current !== null) {
      return;
    }

    interactionFrameRef.current =
      window.requestAnimationFrame(() => {
        interactionFrameRef.current = null;
        setView(viewRef.current);
      });
  }

  function scheduleHover(
    clientX: number,
    clientY: number,
  ) {
    pendingPointerRef.current = {
      clientX,
      clientY,
    };

    if (hoverFrameRef.current !== null) return;

    hoverFrameRef.current =
      window.requestAnimationFrame(() => {
        hoverFrameRef.current = null;
        const point = pendingPointerRef.current;
        if (!point) return;
        setHoveredNodeId(
          findNode(point.clientX, point.clientY)?.id ??
            null,
        );
      });
  }

  function handleWheel(
    event: WheelEvent<HTMLCanvasElement>,
  ) {
    event.preventDefault();
    const point = screenToGraph(
      event.clientX,
      event.clientY,
    );
    if (!point) return;

    const factor =
      event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clamp(
      point.view.zoom * factor,
      0.35,
      6,
    );
    const nextScale =
      Math.min(
        point.rectangle.width,
        point.rectangle.height,
      ) *
      0.77 *
      nextZoom;
    const localX =
      event.clientX - point.rectangle.left;
    const localY =
      event.clientY - point.rectangle.top;

    scheduleView({
      zoom: nextZoom,
      x:
        localX -
        point.rectangle.width / 2 -
        point.x * nextScale,
      y:
        localY -
        point.rectangle.height / 2 -
        point.y * nextScale,
    });
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLCanvasElement>,
  ) {
    const current = viewRef.current;

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      scheduleView({
        ...current,
        zoom: clamp(current.zoom * 1.2, 0.35, 6),
      });
    } else if (event.key === "-") {
      event.preventDefault();
      scheduleView({
        ...current,
        zoom: clamp(current.zoom / 1.2, 0.35, 6),
      });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scheduleView({
        ...current,
        x: current.x + 36,
      });
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scheduleView({
        ...current,
        x: current.x - 36,
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      scheduleView({
        ...current,
        y: current.y + 36,
      });
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      scheduleView({
        ...current,
        y: current.y - 36,
      });
    } else if (event.key === "0") {
      event.preventDefault();
      fitView();
    } else if (event.key === "Escape") {
      setSelectedNodeId(null);
      setHoveredNodeId(null);
      setIsolateSelection(false);
    }
  }

  useEffect(
    () => () => {
      if (interactionFrameRef.current !== null) {
        window.cancelAnimationFrame(
          interactionFrameRef.current,
        );
      }
      if (hoverFrameRef.current !== null) {
        window.cancelAnimationFrame(
          hoverFrameRef.current,
        );
      }
    },
    [],
  );

  return (
    <div className="overflow-hidden rounded-[1.55rem] border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] shadow-[0_18px_55px_var(--slice-shadow)]">
      <div className="border-b border-[var(--slice-border)] bg-[var(--slice-surface)] p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)]">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-[var(--slice-heading)]">
                Research Knowledge Graph
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                {visibleNodeIds.size.toLocaleString()} visible nodes ·{" "}
                {visibleEdges.length.toLocaleString()} rendered edges ·{" "}
                {formatIntelligenceNumber(
                  analytics?.connectednessScore,
                  0,
                )}
                % connected
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <IntelligencePill tone="emerald">
              <Activity className="h-3.5 w-3.5" />
              {graph.projection?.mode ?? "full"} view
            </IntelligencePill>
            <IntelligencePill
              tone={profile.lowPower ? "amber" : "cyan"}
            >
              {profile.lowPower
                ? "Adaptive performance"
                : "Enhanced renderer"}
            </IntelligencePill>
            <button
              type="button"
              onClick={() =>
                setMotionEnabled((current) => !current)
              }
              disabled={!live || reducedMotion}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-muted)] transition hover:border-[var(--slice-accent-border)] hover:text-[var(--slice-heading)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-pressed={motionEnabled}
            >
              {motionEnabled && !reducedMotion ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Signal flow
            </button>
            <button
              type="button"
              onClick={() =>
                setIsolateSelection(
                  (current) => !current,
                )
              }
              disabled={!selectedNodeId}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-muted)] transition hover:border-[var(--slice-accent-border)] hover:text-[var(--slice-heading)] disabled:opacity-40"
              aria-pressed={isolateSelection}
            >
              {isolateSelection ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              Isolate
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_155px_170px_230px_auto]">
          <label className="flex min-h-10 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3">
            <Search className="h-4 w-4 text-[var(--slice-subtle)]" />
            <input
              value={search}
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[var(--slice-heading)] outline-none placeholder:text-[var(--slice-subtle)]"
              placeholder="Search nodes or properties"
              aria-label="Search graph"
            />
          </label>

          <select
            value={cohortFilter}
            onChange={(
              event: ChangeEvent<HTMLSelectElement>,
            ) =>
              setCohortFilter(
                event.target.value as
                  | ResearchCohort
                  | "shared"
                  | "all",
              )
            }
            className="min-h-10 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-xs font-black text-[var(--slice-heading)] outline-none"
            aria-label="Filter by cohort"
          >
            <option value="all">All cohorts</option>
            <option value="media">Media</option>
            <option value="technical">Technical</option>
            <option value="economy">Economy</option>
            <option value="shared">Shared</option>
          </select>

          <select
            value={kindFilter}
            onChange={(
              event: ChangeEvent<HTMLSelectElement>,
            ) =>
              setKindFilter(
                event.target.value as
                  | ResearchGraphNodeKind
                  | "all",
              )
            }
            className="min-h-10 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-xs font-black text-[var(--slice-heading)] outline-none"
            aria-label="Filter by node type"
          >
            {NODE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === "all"
                  ? "All node types"
                  : kind}
              </option>
            ))}
          </select>

          <label className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2">
            <span className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
              Edge strength
              <span className="text-[var(--slice-accent-strong)]">
                {minEdgeWeight.toFixed(2)}
              </span>
            </span>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={minEdgeWeight}
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) =>
                setMinEdgeWeight(
                  Number(event.target.value),
                )
              }
              className="mt-1 w-full accent-emerald-600"
              aria-label="Minimum edge strength"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                const current = viewRef.current;
                scheduleView({
                  ...current,
                  zoom: clamp(
                    current.zoom * 1.2,
                    0.35,
                    6,
                  ),
                });
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] hover:text-[var(--slice-heading)]"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const current = viewRef.current;
                scheduleView({
                  ...current,
                  zoom: clamp(
                    current.zoom / 1.2,
                    0.35,
                    6,
                  ),
                });
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] hover:text-[var(--slice-heading)]"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fitView}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] hover:text-[var(--slice-heading)]"
              aria-label="Fit graph"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                fitView();
                setSelectedNodeId(null);
                setHoveredNodeId(null);
                setSearch("");
                setCohortFilter("all");
                setKindFilter("all");
                setMinEdgeWeight(0);
                setIsolateSelection(false);
                setMotionEnabled(false);
              }}
              className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] hover:text-[var(--slice-heading)]"
              aria-label="Reset graph"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_350px]">
        <div
          ref={containerRef}
          className="relative cursor-grab overflow-hidden active:cursor-grabbing"
          style={{ height, touchAction: "none" }}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--slice-accent-border)]"
            tabIndex={0}
            aria-label="Interactive Slice research knowledge graph. Use arrow keys to pan, plus and minus to zoom, zero to reset, and Escape to clear selection."
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            onPointerDown={(
              event: PointerEvent<HTMLCanvasElement>,
            ) => {
              const node = findNode(
                event.clientX,
                event.clientY,
              );

              if (node) {
                setSelectedNodeId(node.id);
                return;
              }

              event.currentTarget.setPointerCapture(
                event.pointerId,
              );
              const current = viewRef.current;
              dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                viewX: current.x,
                viewY: current.y,
              };
            }}
            onPointerMove={(
              event: PointerEvent<HTMLCanvasElement>,
            ) => {
              const drag = dragRef.current;

              if (
                drag &&
                drag.pointerId === event.pointerId
              ) {
                scheduleView({
                  ...viewRef.current,
                  x:
                    drag.viewX +
                    event.clientX -
                    drag.startX,
                  y:
                    drag.viewY +
                    event.clientY -
                    drag.startY,
                });
                return;
              }

              scheduleHover(
                event.clientX,
                event.clientY,
              );
            }}
            onPointerUp={(
              event: PointerEvent<HTMLCanvasElement>,
            ) => {
              if (
                dragRef.current?.pointerId ===
                event.pointerId
              ) {
                dragRef.current = null;
                event.currentTarget.releasePointerCapture?.(
                  event.pointerId,
                );
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
            }}
            onPointerLeave={() => {
              if (!dragRef.current) {
                setHoveredNodeId(null);
              }
            }}
          />

          <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--slice-border)] bg-[var(--slice-surface)] px-2.5 py-1 text-[9px] font-black text-[var(--slice-muted)] shadow-sm">
              Edge budget {budget.toLocaleString()}
            </span>
            <span className="rounded-full border border-[var(--slice-border)] bg-[var(--slice-surface)] px-2.5 py-1 text-[9px] font-black text-[var(--slice-muted)] shadow-sm">
              {motionEnabled && animationActive
                ? "Flow active"
                : "Static render"}
            </span>
          </div>
        </div>

        <aside className="border-t border-[var(--slice-border)] bg-[var(--slice-surface)] p-5 xl:border-l xl:border-t-0">
          {selectedDetail ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <span
                  className="grid h-11 w-11 place-items-center rounded-xl border"
                  style={{
                    borderColor: `${COHORT_COLORS[selectedDetail.node.cohort]}55`,
                    backgroundColor: `${COHORT_COLORS[selectedDetail.node.cohort]}12`,
                    color:
                      COHORT_COLORS[selectedDetail.node.cohort],
                  }}
                >
                  <Focus className="h-5 w-5" />
                </span>
                <IntelligencePill tone="slate">
                  {selectedDetail.node.kind}
                </IntelligencePill>
              </div>

              <p className="mt-5 text-[9px] font-black uppercase tracking-[0.13em] text-[var(--slice-accent-strong)]">
                {selectedDetail.node.cohort} cohort
              </p>
              <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[var(--slice-heading)]">
                {selectedDetail.node.label}
              </h3>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  [
                    "Score",
                    formatIntelligenceNumber(
                      selectedDetail.node.score,
                      1,
                    ),
                  ],
                  [
                    "Confidence",
                    selectedDetail.node.confidence === null
                      ? "—"
                      : `${formatIntelligenceNumber(
                          selectedDetail.node.confidence,
                          0,
                        )}%`,
                  ],
                  [
                    "Incoming",
                    selectedDetail.incomingCount,
                  ],
                  [
                    "Outgoing",
                    selectedDetail.outgoingCount,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3"
                  >
                    <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-black text-[var(--slice-heading)]">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {selectedDetail.pathToScore.length > 1 ? (
                <div className="mt-4 rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-accent-strong)]">
                    Path to score
                  </p>
                  <p className="mt-2 text-[11px] font-bold leading-5 text-[var(--slice-text)]">
                    {selectedDetail.pathToScore.length - 1} relationship
                    {selectedDetail.pathToScore.length - 1 === 1
                      ? ""
                      : "s"}
                  </p>
                </div>
              ) : null}

              <div className="mt-5">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                  Strongest relationships
                </p>
                <div className="mt-3 space-y-2">
                  {selectedDetail.neighbors
                    .slice(0, 10)
                    .map((neighbor) => (
                      <button
                        key={`${neighbor.edge.id}:${neighbor.node.id}`}
                        type="button"
                        onClick={() =>
                          focusNode(neighbor.node.id)
                        }
                        className="flex w-full items-start justify-between gap-3 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-3 text-left transition hover:border-[var(--slice-accent-border)]"
                      >
                        <span className="min-w-0">
                          <span className="line-clamp-1 text-[11px] font-black text-[var(--slice-heading)]">
                            {neighbor.node.label}
                          </span>
                          <span className="mt-1 block text-[8px] font-black uppercase tracking-[0.08em] text-[var(--slice-subtle)]">
                            {neighbor.edge.kind} ·{" "}
                            {neighbor.direction}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] font-black text-[var(--slice-accent-strong)]">
                          {formatIntelligenceNumber(
                            neighbor.edge.weight * 100,
                            0,
                          )}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                  Properties
                </p>
                <dl className="mt-2 space-y-2">
                  {Object.entries(
                    selectedDetail.node.properties,
                  )
                    .slice(0, 8)
                    .map(([key, value]) => (
                      <div
                        key={key}
                        className="grid grid-cols-[105px_minmax(0,1fr)] gap-2 text-[10px]"
                      >
                        <dt className="truncate font-black text-[var(--slice-subtle)]">
                          {key}
                        </dt>
                        <dd className="break-words font-semibold text-[var(--slice-text)]">
                          {String(value ?? "—")}
                        </dd>
                      </div>
                    ))}
                </dl>
              </div>
            </>
          ) : (
            <div className="grid min-h-[360px] place-items-center text-center">
              <div>
                <Network className="mx-auto h-8 w-8 text-[var(--slice-accent-strong)]" />
                <h3 className="mt-4 text-base font-black text-[var(--slice-heading)]">
                  Select a graph node
                </h3>
                <p className="mt-2 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                  Inspect its evidence, relationships, path to the
                  Slice score, and underlying properties.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}