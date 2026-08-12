"use client";

import {
  Activity,
  Eye,
  EyeOff,
  Focus,
  Layers3,
  Maximize2,
  Minus,
  Network,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Route,
  Search,
  Sparkles,
  Zap,
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
  getResearchGraphNodeDetail,
  shortestPath,
} from "@/lib/intelligence/graph-engine";
import type {
  ResearchCohort,
  ResearchGraphAnalytics,
  ResearchGraphEdge,
  ResearchGraphNode,
  ResearchGraphNodeKind,
  ResearchKnowledgeGraph,
} from "@/lib/intelligence/research-swarm-types";

type PositionedNode = ResearchGraphNode & {
  x: number;
  y: number;
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

const COHORT_COLORS: Record<ResearchCohort | "shared", string> = {
  media: "#fb923c",
  technical: "#22d3ee",
  economy: "#a78bfa",
  shared: "#10b981",
};

const COHORT_GLOW: Record<ResearchCohort | "shared", string> = {
  media: "rgba(251,146,60,0.34)",
  technical: "rgba(34,211,238,0.32)",
  economy: "rgba(167,139,250,0.34)",
  shared: "rgba(16,185,129,0.40)",
};

const COHORT_CENTERS: Record<ResearchCohort | "shared", [number, number]> = {
  media: [-0.62, -0.17],
  technical: [0.62, -0.18],
  economy: [0, 0.61],
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

const SPATIAL_CELL_SIZE = 0.06;

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
  const ring = Math.floor(Math.sqrt(input.index / 9));
  const radius = input.ringBase + ring * 0.049;
  const phase = ((hashNumber(input.id) % 360) / 360) * 0.6;
  const angle =
    (input.index / safeCount) * Math.PI * 2 * (1 + ring * 0.095) + phase;
  const jitter = ((hashNumber(`${input.id}:jitter`) % 100) / 100 - 0.5) * 0.014;

  return {
    x: input.center[0] + Math.cos(angle) * (radius + jitter),
    y: input.center[1] + Math.sin(angle) * (radius + jitter),
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

    if (node.kind === "score") return { ...node, x: 0, y: -0.02 };
    if (node.kind === "asset") return { ...node, x: 0, y: -0.34 };
    if (node.kind === "run") return { ...node, x: -0.18, y: -0.2 };
    if (node.kind === "cohort") return { ...node, x: center[0], y: center[1] };
    if (node.kind === "sector") return { ...node, x: 0.17, y: 0.42 };
    if (node.kind === "industry") return { ...node, x: -0.17, y: 0.43 };

    const ringBase =
      node.kind === "agent"
        ? 0.11
        : node.kind === "evidence" || node.kind === "economic-series"
          ? 0.29
          : node.kind === "source"
            ? 0.42
            : node.kind === "topic" || node.kind === "factor"
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
      ? 11
      : node.kind === "asset"
        ? 8.5
        : node.kind === "cohort"
          ? 7.5
          : node.kind === "agent"
            ? 1.45
            : Math.max(2.2, node.size / 3);
  return clamp(base * Math.sqrt(zoom), 1.1, 19);
}

function nodeColor(node: ResearchGraphNode) {
  if (node.kind === "score") return "#ffffff";
  if (node.kind === "asset") return "#a7f3d0";
  if (node.kind === "source") return "#64748b";
  if (node.kind === "topic") return "#94a3b8";
  return COHORT_COLORS[node.cohort];
}

function edgeControl(
  source: PositionedNode,
  target: PositionedNode,
  edgeId: string,
) {
  const midpointX = (source.x + target.x) / 2;
  const midpointY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), 0.0001);
  const direction = hashNumber(edgeId) % 2 === 0 ? 1 : -1;
  const strength = 0.016 + ((hashNumber(edgeId) % 100) / 100) * 0.032;

  return {
    x: midpointX + (-dy / distance) * strength * direction,
    y: midpointY + (dx / distance) * strength * direction,
  };
}

function formatNumber(value: number | null | undefined, decimals = 1) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : value.toFixed(decimals);
}

function spatialKey(x: number, y: number) {
  return `${Math.floor(x / SPATIAL_CELL_SIZE)}:${Math.floor(y / SPATIAL_CELL_SIZE)}`;
}

function createSpatialIndex(nodes: PositionedNode[], visible: Set<string>) {
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

function pathEdgeIds(graph: ResearchKnowledgeGraph, path: string[]) {
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

function edgeVisualPriority(
  edge: ResearchGraphEdge,
  input: {
    selectedNodeId: string | null;
    hoveredNodeId: string | null;
    centralNodeIds: Set<string>;
    selectedPathEdges: Set<string>;
  },
) {
  const structural =
    edge.kind === "DERIVES" ||
    edge.kind === "CONTRIBUTES_TO" ||
    edge.kind === "RESEARCHES" ||
    edge.kind === "OPERATES_IN";
  const active =
    edge.source === input.selectedNodeId ||
    edge.target === input.selectedNodeId ||
    edge.source === input.hoveredNodeId ||
    edge.target === input.hoveredNodeId;

  return (
    (input.selectedPathEdges.has(edge.id) ? 1_000 : 0) +
    (active ? 500 : 0) +
    (structural ? 240 : 0) +
    (edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES" ? 180 : 0) +
    (input.centralNodeIds.has(edge.source) || input.centralNodeIds.has(edge.target)
      ? 120
      : 0) +
    edge.weight * 100
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

export default function ResearchKnowledgeGraphCanvas({
  graph,
  analytics = null,
  height = 760,
  live = true,
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
  const lastFrameRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 1,
    height,
    pixelRatio: 1,
  });
  const [isIntersecting, setIsIntersecting] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState<
    ResearchCohort | "shared" | "all"
  >("all");
  const [kindFilter, setKindFilter] = useState<ResearchGraphNodeKind | "all">(
    "all",
  );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [minEdgeWeight, setMinEdgeWeight] = useState(0);
  const [motionEnabled, setMotionEnabled] = useState(live);
  const [isolateSelection, setIsolateSelection] = useState(false);
  const positions = useMemo(() => buildPositions(graph), [graph]);
  const positionMap = useMemo(
    () => new Map(positions.map((node) => [node.id, node])),
    [positions],
  );
  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const node of graph.nodes) map.set(node.id, new Set());
    for (const edge of graph.edges) {
      map.get(edge.source)?.add(edge.target);
      map.get(edge.target)?.add(edge.source);
    }
    return map;
  }, [graph.edges, graph.nodes]);
  const scoreNodeId = useMemo(
    () => graph.nodes.find((node) => node.kind === "score")?.id ?? null,
    [graph.nodes],
  );
  const selectedPath = useMemo(
    () =>
      selectedNodeId && scoreNodeId
        ? shortestPath(graph, selectedNodeId, scoreNodeId)
        : [],
    [graph, scoreNodeId, selectedNodeId],
  );
  const selectedPathNodeIds = useMemo(() => new Set(selectedPath), [selectedPath]);
  const selectedPathEdges = useMemo(
    () => pathEdgeIds(graph, selectedPath),
    [graph, selectedPath],
  );
  const centralNodeIds = useMemo(
    () =>
      new Set(
        [
          ...(analytics?.centralityTop.slice(0, 10).map((node) => node.id) ?? []),
          ...(analytics?.pagerankTop?.slice(0, 8).map((node) => node.id) ?? []),
          ...(analytics?.betweennessTop?.slice(0, 8).map((node) => node.id) ?? []),
        ],
      ),
    [analytics],
  );
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();
    const isolated = new Set<string>();

    if (isolateSelection && selectedNodeId) {
      isolated.add(selectedNodeId);
      for (const neighbor of adjacency.get(selectedNodeId) ?? []) isolated.add(neighbor);
      for (const pathNode of selectedPath) isolated.add(pathNode);
    }

    for (const node of positions) {
      const cohortMatch =
        cohortFilter === "all" || node.cohort === cohortFilter || selectedPathNodeIds.has(node.id);
      const kindMatch = kindFilter === "all" || node.kind === kindFilter;
      const searchMatch =
        !deferredSearch ||
        `${node.label} ${node.kind} ${node.group} ${Object.values(node.properties).join(" ")}`
          .toLowerCase()
          .includes(deferredSearch);
      const isolationMatch = !isolateSelection || !selectedNodeId || isolated.has(node.id);

      if (cohortMatch && kindMatch && searchMatch && isolationMatch) ids.add(node.id);
    }

    if (deferredSearch) {
      for (const nodeId of [...ids]) {
        for (const neighbor of adjacency.get(nodeId) ?? []) ids.add(neighbor);
      }
    }

    for (const nodeId of selectedPathNodeIds) ids.add(nodeId);
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
  const visibleEdges = useMemo(() => {
    const edges = graph.edges.filter(
      (edge) =>
        visibleNodeIds.has(edge.source) &&
        visibleNodeIds.has(edge.target) &&
        (edge.weight >= minEdgeWeight ||
          selectedPathEdges.has(edge.id) ||
          edge.kind === "DERIVES" ||
          edge.kind === "CONTRIBUTES_TO" ||
          edge.kind === "RESEARCHES"),
    );
    const renderLimit = view.zoom < 1.35 ? 4_800 : view.zoom < 2 ? 8_000 : 14_000;

    return edges
      .sort(
        (left, right) =>
          edgeVisualPriority(right, {
            selectedNodeId,
            hoveredNodeId,
            centralNodeIds,
            selectedPathEdges,
          }) -
          edgeVisualPriority(left, {
            selectedNodeId,
            hoveredNodeId,
            centralNodeIds,
            selectedPathEdges,
          }),
      )
      .slice(0, renderLimit);
  }, [
    centralNodeIds,
    graph.edges,
    hoveredNodeId,
    minEdgeWeight,
    selectedNodeId,
    selectedPathEdges,
    view.zoom,
    visibleNodeIds,
  ]);
  const animatedEdges = useMemo(
    () =>
      visibleEdges
        .filter(
          (edge) =>
            selectedPathEdges.has(edge.id) ||
            edge.source === selectedNodeId ||
            edge.target === selectedNodeId ||
            edge.source === hoveredNodeId ||
            edge.target === hoveredNodeId ||
            edge.weight >= 0.62,
        )
        .slice(0, 180),
    [hoveredNodeId, selectedNodeId, selectedPathEdges, visibleEdges],
  );
  const spatialIndex = useMemo(
    () => createSpatialIndex(positions, visibleNodeIds),
    [positions, visibleNodeIds],
  );
  const selectedDetail = useMemo(
    () => getResearchGraphNodeDetail(graph, selectedNodeId),
    [graph, selectedNodeId],
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
      const rectangle = container.getBoundingClientRect();
      setDimensions({
        width: Math.max(1, rectangle.width),
        height: Math.max(1, height),
        pixelRatio: Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
      });
    };
    update();
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [height]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry?.isIntersecting ?? true),
      { rootMargin: "200px" },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setDocumentVisible(document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.round(dimensions.width * dimensions.pixelRatio);
    canvas.height = Math.round(dimensions.height * dimensions.pixelRatio);
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;
  }, [dimensions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    const draw = (time = performance.now()) => {
      if (disposed) return;
      if (animationActive && time - lastFrameRef.current < 33) {
        animationFrameRef.current = window.requestAnimationFrame(draw);
        return;
      }
      lastFrameRef.current = time;

      const context = canvas.getContext("2d", { alpha: true });
      if (!context) return;
      const { width, height: canvasHeight, pixelRatio } = dimensions;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, canvasHeight);
      const baseScale = Math.min(width, canvasHeight) * 0.79;
      const scale = baseScale * view.zoom;
      const centerX = width / 2 + view.x;
      const centerY = canvasHeight / 2 + view.y;
      const pulse = animationActive ? (Math.sin(time / 760) + 1) / 2 : 0.38;
      const screen = (node: PositionedNode) => ({
        x: centerX + node.x * scale,
        y: centerY + node.y * scale,
      });

      const background = context.createRadialGradient(
        width * 0.5,
        canvasHeight * 0.48,
        0,
        width * 0.5,
        canvasHeight * 0.48,
        Math.max(width, canvasHeight) * 0.72,
      );
      background.addColorStop(0, "rgba(6,78,59,0.20)");
      background.addColorStop(0.42, "rgba(2,16,12,0.26)");
      background.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = background;
      context.fillRect(0, 0, width, canvasHeight);

      context.strokeStyle = "rgba(52,211,153,0.035)";
      context.lineWidth = 1;
      const grid = 44;
      const offsetX = ((view.x % grid) + grid) % grid;
      const offsetY = ((view.y % grid) + grid) % grid;
      context.beginPath();
      for (let x = offsetX; x < width; x += grid) {
        context.moveTo(x, 0);
        context.lineTo(x, canvasHeight);
      }
      for (let y = offsetY; y < canvasHeight; y += grid) {
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
      context.stroke();

      for (const [cohort, [x, y]] of Object.entries(COHORT_CENTERS) as Array<[
        ResearchCohort | "shared",
        [number, number],
      ]>) {
        const center = { x: centerX + x * scale, y: centerY + y * scale };
        const radius =
          cohort === "shared" ? scale * 0.2 : scale * (0.29 + pulse * 0.025);
        const glow = context.createRadialGradient(
          center.x,
          center.y,
          0,
          center.x,
          center.y,
          radius,
        );
        glow.addColorStop(0, COHORT_GLOW[cohort]);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = glow;
        context.fillRect(center.x - radius, center.y - radius, radius * 2, radius * 2);
      }

      context.lineCap = "round";
      for (const edge of visibleEdges) {
        const source = positionMap.get(edge.source);
        const target = positionMap.get(edge.target);
        if (!source || !target) continue;
        const sourceScreen = screen(source);
        const targetScreen = screen(target);
        const control = edgeControl(source, target, edge.id);
        const controlScreen = {
          x: centerX + control.x * scale,
          y: centerY + control.y * scale,
        };
        const path = selectedPathEdges.has(edge.id);
        const active =
          path ||
          edge.source === selectedNodeId ||
          edge.target === selectedNodeId ||
          edge.source === hoveredNodeId ||
          edge.target === hoveredNodeId;
        const central =
          centralNodeIds.has(edge.source) || centralNodeIds.has(edge.target);
        const contradiction = edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES";
        const support = edge.kind === "SUPPORTS";

        context.beginPath();
        context.moveTo(sourceScreen.x, sourceScreen.y);
        context.quadraticCurveTo(
          controlScreen.x,
          controlScreen.y,
          targetScreen.x,
          targetScreen.y,
        );
        context.strokeStyle = contradiction
          ? active
            ? "rgba(251,113,133,0.95)"
            : "rgba(244,63,94,0.38)"
          : support
            ? active
              ? "rgba(52,211,153,0.92)"
              : "rgba(52,211,153,0.34)"
            : active
              ? `${COHORT_COLORS[edge.cohort]}dd`
              : `${COHORT_COLORS[edge.cohort]}${central ? "66" : "27"}`;
        context.lineWidth = path
          ? 2.4
          : active
            ? 1.7
            : clamp(edge.weight * 0.8, 0.16, 1.05);
        context.shadowBlur = active ? 12 : 0;
        context.shadowColor = contradiction
          ? "rgba(244,63,94,0.7)"
          : COHORT_COLORS[edge.cohort];
        context.stroke();
        context.shadowBlur = 0;
      }

      if (animationActive) {
        for (const edge of animatedEdges) {
          const source = positionMap.get(edge.source);
          const target = positionMap.get(edge.target);
          if (!source || !target) continue;
          const sourceScreen = screen(source);
          const targetScreen = screen(target);
          const control = edgeControl(source, target, edge.id);
          const controlScreen = {
            x: centerX + control.x * scale,
            y: centerY + control.y * scale,
          };
          const t = (time / 1_650 + (hashNumber(edge.id) % 100) / 100) % 1;
          const inverse = 1 - t;
          const x =
            inverse * inverse * sourceScreen.x +
            2 * inverse * t * controlScreen.x +
            t * t * targetScreen.x;
          const y =
            inverse * inverse * sourceScreen.y +
            2 * inverse * t * controlScreen.y +
            t * t * targetScreen.y;
          const active =
            selectedPathEdges.has(edge.id) ||
            edge.source === selectedNodeId ||
            edge.target === selectedNodeId;
          context.beginPath();
          context.arc(x, y, active ? 2.7 : 1.45, 0, Math.PI * 2);
          context.fillStyle =
            edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES"
              ? "#fb7185"
              : "#f8fafc";
          context.globalAlpha = active ? 0.95 : 0.54;
          context.fill();
          context.globalAlpha = 1;
        }
      }

      for (const node of positions) {
        if (!visibleNodeIds.has(node.id)) continue;
        const nodeScreen = screen(node);
        if (
          nodeScreen.x < -40 ||
          nodeScreen.x > width + 40 ||
          nodeScreen.y < -40 ||
          nodeScreen.y > canvasHeight + 40
        ) {
          continue;
        }
        const radius = nodeRadius(node, view.zoom);
        const selected = node.id === selectedNodeId;
        const hovered = node.id === hoveredNodeId;
        const path = selectedPathNodeIds.has(node.id);
        const central = centralNodeIds.has(node.id);
        const halo = selected || hovered || path || central;

        if (halo) {
          context.beginPath();
          context.arc(
            nodeScreen.x,
            nodeScreen.y,
            radius + (selected ? 10 : 6) + pulse * 2,
            0,
            Math.PI * 2,
          );
          context.fillStyle = path ? "rgba(255,255,255,0.28)" : COHORT_GLOW[node.cohort];
          context.globalAlpha = selected || hovered ? 0.68 : path ? 0.42 : 0.23;
          context.fill();
          context.globalAlpha = 1;
        }

        context.beginPath();
        context.arc(nodeScreen.x, nodeScreen.y, radius, 0, Math.PI * 2);
        context.fillStyle = nodeColor(node);
        context.globalAlpha =
          selected || hovered || path ? 1 : node.kind === "agent" ? 0.56 : 0.86;
        context.fill();
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(nodeScreen.x, nodeScreen.y, radius + 1.5, 0, Math.PI * 2);
        context.strokeStyle = halo
          ? "rgba(255,255,255,0.88)"
          : "rgba(255,255,255,0.12)";
        context.lineWidth = halo ? 1.55 : 0.45;
        context.stroke();

        const showLabel =
          node.kind === "score" ||
          node.kind === "cohort" ||
          node.kind === "asset" ||
          selected ||
          hovered ||
          path ||
          (central && view.zoom >= 0.85) ||
          view.zoom >= 2.2;

        if (showLabel) {
          context.font = `${selected || hovered ? 750 : 650} ${
            node.kind === "score" ? 13 : 10
          }px system-ui, sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "top";
          context.fillStyle = "rgba(255,255,255,0.94)";
          const label = node.label.length > 38 ? `${node.label.slice(0, 35)}…` : node.label;
          context.fillText(label, nodeScreen.x, nodeScreen.y + radius + 5);
        }
      }

      const minimapWidth = 130;
      const minimapHeight = 92;
      const minimapX = width - minimapWidth - 16;
      const minimapY = canvasHeight - minimapHeight - 16;
      context.fillStyle = "rgba(0,0,0,0.64)";
      context.strokeStyle = "rgba(255,255,255,0.11)";
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(minimapX, minimapY, minimapWidth, minimapHeight, 12);
      context.fill();
      context.stroke();
      for (const node of positions) {
        if (!visibleNodeIds.has(node.id)) continue;
        context.beginPath();
        context.arc(
          minimapX + minimapWidth / 2 + node.x * minimapWidth * 0.52,
          minimapY + minimapHeight / 2 + node.y * minimapHeight * 0.52,
          node.kind === "score" ? 2.4 : node.kind === "cohort" ? 1.8 : 0.65,
          0,
          Math.PI * 2,
        );
        context.fillStyle = nodeColor(node);
        context.globalAlpha = node.kind === "agent" ? 0.42 : 0.78;
        context.fill();
        context.globalAlpha = 1;
      }

      if (animationActive) {
        animationFrameRef.current = window.requestAnimationFrame(draw);
      }
    };

    draw();
    return () => {
      disposed = true;
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    animatedEdges,
    animationActive,
    centralNodeIds,
    dimensions,
    hoveredNodeId,
    positionMap,
    positions,
    selectedNodeId,
    selectedPathEdges,
    selectedPathNodeIds,
    view,
    visibleEdges,
    visibleNodeIds,
  ]);

  function screenToGraph(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rectangle = canvas.getBoundingClientRect();
    const scale = Math.min(rectangle.width, rectangle.height) * 0.79 * view.zoom;
    const centerX = rectangle.width / 2 + view.x;
    const centerY = rectangle.height / 2 + view.y;

    return {
      x: (clientX - rectangle.left - centerX) / scale,
      y: (clientY - rectangle.top - centerY) / scale,
      scale,
      rectangle,
    };
  }

  function findNode(clientX: number, clientY: number) {
    const point = screenToGraph(clientX, clientY);
    if (!point) return null;
    const baseCellX = Math.floor(point.x / SPATIAL_CELL_SIZE);
    const baseCellY = Math.floor(point.y / SPATIAL_CELL_SIZE);
    const candidates: PositionedNode[] = [];

    for (let x = baseCellX - 1; x <= baseCellX + 1; x += 1) {
      for (let y = baseCellY - 1; y <= baseCellY + 1; y += 1) {
        candidates.push(...(spatialIndex.get(`${x}:${y}`) ?? []));
      }
    }

    let closest: PositionedNode | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const node of candidates) {
      const distance = Math.hypot(node.x - point.x, node.y - point.y);
      const threshold = nodeRadius(node, view.zoom) / point.scale + 0.014;
      if (distance <= threshold && distance < closestDistance) {
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
    const scale = Math.min(dimensions.width, dimensions.height) * 0.79 * view.zoom;
    setSelectedNodeId(nodeId);
    setView((current) => ({
      ...current,
      x: -node.x * scale,
      y: -node.y * scale,
    }));
  }

  function handleWheel(event: WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const point = screenToGraph(event.clientX, event.clientY);
    if (!point) return;
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = clamp(view.zoom * factor, 0.35, 6);
    const nextScale = Math.min(point.rectangle.width, point.rectangle.height) * 0.79 * nextZoom;
    const localX = event.clientX - point.rectangle.left;
    const localY = event.clientY - point.rectangle.top;

    setView({
      zoom: nextZoom,
      x: localX - point.rectangle.width / 2 - point.x * nextScale,
      y: localY - point.rectangle.height / 2 - point.y * nextScale,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      setView((current) => ({ ...current, zoom: clamp(current.zoom * 1.2, 0.35, 6) }));
    } else if (event.key === "-") {
      event.preventDefault();
      setView((current) => ({ ...current, zoom: clamp(current.zoom / 1.2, 0.35, 6) }));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setView((current) => ({ ...current, x: current.x + 36 }));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setView((current) => ({ ...current, x: current.x - 36 }));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setView((current) => ({ ...current, y: current.y + 36 }));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setView((current) => ({ ...current, y: current.y - 36 }));
    } else if (event.key === "0") {
      event.preventDefault();
      fitView();
    } else if (event.key === "Escape") {
      setSelectedNodeId(null);
      setHoveredNodeId(null);
      setIsolateSelection(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-emerald-400/10 bg-[#010604] shadow-2xl shadow-black/55">
      <div className="border-b border-white/8 bg-black/82 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
              <Network className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Research Knowledge Graph</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                {graph.nodeCount.toLocaleString()} rendered nodes · {graph.edgeCount.toLocaleString()} rendered edges · {analytics?.connectednessScore.toFixed(0) ?? "—"}% connected
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
              <Activity className="h-3.5 w-3.5" />
              {graph.projection?.mode ?? "full"} view
            </span>
            <button
              type="button"
              onClick={() => setMotionEnabled((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:text-white"
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
              onClick={() => setIsolateSelection((current) => !current)}
              disabled={!selectedNodeId}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-300 hover:text-white disabled:opacity-35"
              aria-pressed={isolateSelection}
            >
              {isolateSelection ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              Isolate
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_160px_170px_240px_auto]">
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-700"
              placeholder="Search nodes, groups, or properties"
              aria-label="Search graph"
            />
          </label>
          <select
            value={cohortFilter}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setCohortFilter(
                event.target.value as ResearchCohort | "shared" | "all",
              )
            }
            className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-black text-white outline-none"
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
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setKindFilter(event.target.value as ResearchGraphNodeKind | "all")
            }
            className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-black text-white outline-none"
            aria-label="Filter by node type"
          >
            {NODE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind === "all" ? "All node types" : kind}
              </option>
            ))}
          </select>
          <label className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
            <span className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.12em] text-slate-600">
              Edge strength
              <span className="text-emerald-300">{minEdgeWeight.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={minEdgeWeight}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setMinEdgeWeight(Number(event.target.value))}
              className="mt-1 w-full accent-emerald-500"
              aria-label="Minimum edge strength"
            />
          </label>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setView((current) => ({ ...current, zoom: clamp(current.zoom * 1.2, 0.35, 6) }))}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:text-white"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView((current) => ({ ...current, zoom: clamp(current.zoom / 1.2, 0.35, 6) }))}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:text-white"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={fitView}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:text-white"
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
              }}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:text-white"
              aria-label="Reset graph"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_370px]">
        <div
          ref={containerRef}
          className="relative cursor-grab overflow-hidden active:cursor-grabbing"
          style={{ height }}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400/70"
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            onPointerDown={(event: PointerEvent<HTMLCanvasElement>) => {
              const node = findNode(event.clientX, event.clientY);
              if (node) {
                setSelectedNodeId(node.id);
                return;
              }
              event.currentTarget.setPointerCapture(event.pointerId);
              dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                viewX: view.x,
                viewY: view.y,
              };
            }}
            onPointerMove={(event: PointerEvent<HTMLCanvasElement>) => {
              const drag = dragRef.current;
              if (drag && drag.pointerId === event.pointerId) {
                setView((current) => ({
                  ...current,
                  x: drag.viewX + event.clientX - drag.startX,
                  y: drag.viewY + event.clientY - drag.startY,
                }));
                return;
              }
              setHoveredNodeId(findNode(event.clientX, event.clientY)?.id ?? null);
            }}
            onPointerUp={(event: PointerEvent<HTMLCanvasElement>) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={() => {
              dragRef.current = null;
              setHoveredNodeId(null);
            }}
            onPointerLeave={() => setHoveredNodeId(null)}
            tabIndex={0}
            role="img"
            aria-label={`Interactive Slice research graph with ${graph.nodeCount} visible nodes and ${graph.edgeCount} visible relationships. Use arrow keys to pan, plus and minus to zoom, zero to reset, or select nodes with a pointer.`}
          />

          <div className="pointer-events-none absolute bottom-4 left-4 flex max-w-[calc(100%-180px)] flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/78 p-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 backdrop-blur-xl">
            {(["media", "technical", "economy", "shared"] as const).map((cohort) => (
              <span key={cohort} className="inline-flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: COHORT_COLORS[cohort] }}
                />
                {cohort}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 text-emerald-200">
              <Zap className="h-3 w-3" />
              {visibleNodeIds.size.toLocaleString()} visible
            </span>
          </div>
        </div>

        <aside className="border-t border-white/8 bg-black/68 p-5 xl:border-l xl:border-t-0">
          {selectedDetail ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: nodeColor(selectedDetail.node) }}
                  />
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {selectedDetail.node.kind} · {selectedDetail.node.cohort}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => focusNode(selectedDetail.node.id)}
                  className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:text-white"
                  aria-label="Center selected node"
                >
                  <Focus className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mt-4 text-xl font-black leading-tight text-white">
                {selectedDetail.node.label}
              </h3>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  ["Score", formatNumber(selectedDetail.node.score)],
                  ["Confidence", formatNumber(selectedDetail.node.confidence)],
                  ["Incoming", selectedDetail.incomingCount.toLocaleString()],
                  ["Outgoing", selectedDetail.outgoingCount.toLocaleString()],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                      {label}
                    </p>
                    <p className="mt-1 text-xl font-black text-white">{value}</p>
                  </div>
                ))}
              </div>

              {selectedDetail.pathToScore.length > 1 ? (
                <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.055] p-4">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-200">
                    <Route className="h-4 w-4" />
                    Path to Slice score
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {selectedDetail.pathToScore.map((nodeId, index) => {
                      const node = positionMap.get(nodeId);
                      return (
                        <button
                          type="button"
                          key={nodeId}
                          onClick={() => focusNode(nodeId)}
                          className="rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] font-bold text-slate-200 hover:border-emerald-400/30"
                        >
                          {index + 1}. {node?.label ?? nodeId}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    Strongest relationships
                  </p>
                  <span className="text-[10px] font-bold text-slate-500">
                    {selectedDetail.neighbors.length}
                  </span>
                </div>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {selectedDetail.neighbors.slice(0, 18).map((neighbor) => (
                    <button
                      type="button"
                      key={`${neighbor.edge.id}:${neighbor.direction}`}
                      onClick={() => focusNode(neighbor.node.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-3 text-left hover:border-emerald-400/20"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-white">
                          {neighbor.node.label}
                        </span>
                        <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.1em] text-slate-600">
                          {neighbor.edge.kind} · {neighbor.direction}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-black text-emerald-200">
                        {neighbor.edge.weight.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 max-h-72 space-y-3 overflow-y-auto pr-1">
                {Object.entries(selectedDetail.node.properties).map(([key, value]) => (
                  <div key={key} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                      {key}
                    </p>
                    {key.toLowerCase().includes("url") && typeof value === "string" && value.startsWith("http") ? (
                      <a
                        href={value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block break-all text-xs font-semibold leading-5 text-cyan-200 hover:underline"
                      >
                        {value}
                      </a>
                    ) : (
                      <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-300">
                        {String(value ?? "—")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="grid min-h-48 place-items-center text-center">
                <div>
                  <Sparkles className="mx-auto h-8 w-8 text-emerald-300" />
                  <h3 className="mt-4 text-lg font-black text-white">Select a graph node</h3>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    Drag to pan, wheel to zoom, search the graph, filter a cohort, or select a node to trace its pathway into the Slice score.
                  </p>
                </div>
              </div>

              {analytics ? (
                <div className="mt-5 grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["Connected", `${analytics.connectednessScore.toFixed(0)}%`],
                      ["Resilience", `${analytics.networkResilience?.toFixed(0) ?? "—"}%`],
                      ["Communities", String(analytics.communities?.length ?? "—")],
                      ["Avg path", analytics.averagePathLength?.toFixed(2) ?? "—"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                          {label}
                        </p>
                        <p className="mt-2 text-2xl font-black text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      <Layers3 className="h-4 w-4" />
                      Top connectors
                    </div>
                    <div className="mt-3 space-y-2">
                      {analytics.centralityTop.slice(0, 7).map((node) => (
                        <button
                          type="button"
                          key={node.id}
                          onClick={() => focusNode(node.id)}
                          className="flex w-full items-center justify-between gap-3 text-left text-xs"
                        >
                          <span className="truncate font-bold text-slate-300 hover:text-white">
                            {node.label}
                          </span>
                          <span className="font-black text-white">
                            {node.centralityScore.toFixed(0)}%
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}