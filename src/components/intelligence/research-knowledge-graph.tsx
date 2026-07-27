"use client";

import {
  Activity,
  Maximize2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";

import type {
  ResearchCohort,
  ResearchGraphNode,
  ResearchKnowledgeGraph,
  ResearchGraphAnalytics,
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

const COHORT_COLORS: Record<ResearchCohort | "shared", string> = {
  media: "#fb923c",
  technical: "#22d3ee",
  economy: "#a78bfa",
  shared: "#10b981",
};

const COHORT_GLOW: Record<ResearchCohort | "shared", string> = {
  media: "rgba(251,146,60,0.44)",
  technical: "rgba(34,211,238,0.38)",
  economy: "rgba(167,139,250,0.42)",
  shared: "rgba(16,185,129,0.45)",
};

const COHORT_CENTERS: Record<ResearchCohort | "shared", [number, number]> = {
  media: [-0.62, -0.18],
  technical: [0.62, -0.2],
  economy: [0, 0.62],
  shared: [0, -0.04],
};

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

function ringPosition(
  index: number,
  count: number,
  center: [number, number],
  ringBase: number,
  id: string,
) {
  const safeCount = Math.max(count, 1);
  const ring = Math.floor(Math.sqrt(index / 9));
  const radius = ringBase + ring * 0.052;
  const angle =
    (index / safeCount) * Math.PI * 2 * (1 + ring * 0.1) +
    ((hashNumber(id) % 360) / 360) * 0.5;

  return {
    x: center[0] + Math.cos(angle) * radius,
    y: center[1] + Math.sin(angle) * radius,
  };
}

function buildPositions(graph: ResearchKnowledgeGraph) {
  const cohortNodes = new Map<ResearchCohort | "shared", ResearchGraphNode[]>();

  for (const cohort of ["media", "technical", "economy", "shared"] as const) {
    cohortNodes.set(
      cohort,
      graph.nodes.filter((node) => node.cohort === cohort),
    );
  }

  const kindIndexes = new Map<string, number>();

  return graph.nodes.map<PositionedNode>((node) => {
    const cohort = node.cohort;
    const center = COHORT_CENTERS[cohort];
    const key = `${cohort}:${node.kind}`;
    const index = kindIndexes.get(key) ?? 0;
    kindIndexes.set(key, index + 1);
    const kindCount =
      cohortNodes.get(cohort)?.filter((item) => item.kind === node.kind)
        .length ?? 1;

    if (node.kind === "score") {
      return { ...node, x: 0, y: -0.03 };
    }

    if (node.kind === "asset") {
      return { ...node, x: 0, y: -0.34 };
    }

    if (node.kind === "run") {
      return { ...node, x: -0.17, y: -0.2 };
    }

    if (node.kind === "cohort") {
      return { ...node, x: center[0], y: center[1] };
    }

    if (node.kind === "sector") {
      return { ...node, x: 0.16, y: 0.42 };
    }

    if (node.kind === "industry") {
      return { ...node, x: -0.16, y: 0.43 };
    }

    if (node.kind === "agent") {
      const position = ringPosition(index, kindCount, center, 0.11, node.id);
      return { ...node, ...position };
    }

    if (node.kind === "evidence" || node.kind === "economic-series") {
      const position = ringPosition(index, kindCount, center, 0.3, node.id);
      return { ...node, ...position };
    }

    if (node.kind === "source") {
      const position = ringPosition(index, kindCount, center, 0.43, node.id);
      return { ...node, ...position };
    }

    if (node.kind === "topic" || node.kind === "factor") {
      const position = ringPosition(index, kindCount, center, 0.52, node.id);
      return { ...node, ...position };
    }

    const position = ringPosition(index, kindCount, center, 0.36, node.id);
    return { ...node, ...position };
  });
}

function nodeRadius(node: ResearchGraphNode, zoom: number) {
  const base =
    node.kind === "score"
      ? 10
      : node.kind === "asset"
        ? 8
        : node.kind === "cohort"
          ? 7
          : node.kind === "agent"
            ? 1.55
            : Math.max(2.4, node.size / 2.9);

  return clamp(base * Math.sqrt(zoom), 1.15, 18);
}

function nodeColor(node: ResearchGraphNode) {
  if (node.kind === "score") {
    return "#ffffff";
  }

  if (node.kind === "asset") {
    return "#a7f3d0";
  }

  if (node.kind === "source") {
    return "#64748b";
  }

  if (node.kind === "topic") {
    return "#94a3b8";
  }

  return COHORT_COLORS[node.cohort];
}

function edgeCurveOffset(source: PositionedNode, target: PositionedNode, edgeId: string) {
  const midpointX = (source.x + target.x) / 2;
  const midpointY = (source.y + target.y) / 2;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(Math.hypot(dx, dy), 0.0001);
  const direction = hashNumber(edgeId) % 2 === 0 ? 1 : -1;
  const strength = 0.018 + ((hashNumber(edgeId) % 100) / 100) * 0.035;

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
  const [view, setView] = useState<ViewState>({
    x: 0,
    y: 0,
    zoom: 1,
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [cohortFilter, setCohortFilter] = useState<
    ResearchCohort | "shared" | "all"
  >("all");
  const [search, setSearch] = useState("");
  const positions = useMemo(() => buildPositions(graph), [graph]);
  const positionMap = useMemo(
    () => new Map(positions.map((node) => [node.id, node])),
    [positions],
  );
  const centralNodeIds = useMemo(
    () =>
      new Set(
        analytics?.centralityTop.slice(0, 8).map((node) => node.id) ?? [],
      ),
    [analytics],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const visibleNodeIds = useMemo(() => {
    const ids = new Set<string>();

    for (const node of positions) {
      const cohortMatch =
        cohortFilter === "all" || node.cohort === cohortFilter;
      const searchMatch =
        !normalizedSearch ||
        node.label.toLowerCase().includes(normalizedSearch) ||
        node.kind.toLowerCase().includes(normalizedSearch) ||
        node.group.toLowerCase().includes(normalizedSearch);

      if (cohortMatch && searchMatch) {
        ids.add(node.id);
      }
    }

    if (normalizedSearch) {
      for (const edge of graph.edges) {
        if (ids.has(edge.source) || ids.has(edge.target)) {
          ids.add(edge.source);
          ids.add(edge.target);
        }
      }
    }

    return ids;
  }, [cohortFilter, graph.edges, normalizedSearch, positions]);
  const selectedNode = selectedNodeId
    ? positionMap.get(selectedNodeId) ?? null
    : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) {
      return;
    }

    let disposed = false;

    const draw = (time = 0) => {
      if (disposed) {
        return;
      }

      const rectangle = container.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.max(1, rectangle.width);
      const canvasHeight = Math.max(1, height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(canvasHeight * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${canvasHeight}px`;
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, width, canvasHeight);
      const scale = Math.min(width, canvasHeight) * 0.8 * view.zoom;
      const centerX = width / 2 + view.x;
      const centerY = canvasHeight / 2 + view.y;
      const pulse = live ? (Math.sin(time / 640) + 1) / 2 : 0.4;

      const toScreen = (node: PositionedNode) => ({
        x: centerX + node.x * scale,
        y: centerY + node.y * scale,
      });

      const background = context.createRadialGradient(
        width * 0.5,
        canvasHeight * 0.5,
        0,
        width * 0.5,
        canvasHeight * 0.5,
        Math.max(width, canvasHeight) * 0.7,
      );
      background.addColorStop(0, "rgba(6,78,59,0.18)");
      background.addColorStop(0.45, "rgba(2,6,23,0.32)");
      background.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = background;
      context.fillRect(0, 0, width, canvasHeight);

      for (const [cohort, [x, y]] of Object.entries(COHORT_CENTERS) as Array<[
        ResearchCohort | "shared",
        [number, number],
      ]>) {
        const screen = {
          x: centerX + x * scale,
          y: centerY + y * scale,
        };
        const radius =
          cohort === "shared" ? scale * 0.22 : scale * (0.31 + pulse * 0.035);
        const glow = context.createRadialGradient(
          screen.x,
          screen.y,
          0,
          screen.x,
          screen.y,
          radius,
        );
        glow.addColorStop(0, COHORT_GLOW[cohort]);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = glow;
        context.fillRect(screen.x - radius, screen.y - radius, radius * 2, radius * 2);
      }

      context.lineCap = "round";

      for (const edge of graph.edges) {
        if (
          !visibleNodeIds.has(edge.source) ||
          !visibleNodeIds.has(edge.target)
        ) {
          continue;
        }

        const source = positionMap.get(edge.source);
        const target = positionMap.get(edge.target);

        if (!source || !target) {
          continue;
        }

        const sourceScreen = toScreen(source);
        const targetScreen = toScreen(target);
        const control = edgeCurveOffset(source, target, edge.id);
        const controlScreen = {
          x: centerX + control.x * scale,
          y: centerY + control.y * scale,
        };
        const highlighted =
          selectedNodeId === edge.source ||
          selectedNodeId === edge.target ||
          hoveredNodeId === edge.source ||
          hoveredNodeId === edge.target ||
          centralNodeIds.has(edge.source) ||
          centralNodeIds.has(edge.target);
        const strokeColor =
          edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES"
            ? "rgba(110,231,183,0.72)"
            : edge.kind === "SUPPORTS"
              ? "rgba(52,211,153,0.55)"
              : `${COHORT_COLORS[edge.cohort]}${highlighted ? "aa" : "2d"}`;

        context.beginPath();
        context.moveTo(sourceScreen.x, sourceScreen.y);
        context.quadraticCurveTo(
          controlScreen.x,
          controlScreen.y,
          targetScreen.x,
          targetScreen.y,
        );
        context.strokeStyle = strokeColor;
        context.lineWidth = highlighted
          ? 1.6
          : clamp(edge.weight * 0.85, 0.16, 1.1);
        context.shadowBlur = highlighted ? 12 : 0;
        context.shadowColor = COHORT_COLORS[edge.cohort];
        context.stroke();
        context.shadowBlur = 0;

        if (live && (highlighted || edge.weight >= 0.55)) {
          const t = ((time / 1_500 + (hashNumber(edge.id) % 100) / 100) % 1);
          const inv = 1 - t;
          const particleX =
            inv * inv * sourceScreen.x +
            2 * inv * t * controlScreen.x +
            t * t * targetScreen.x;
          const particleY =
            inv * inv * sourceScreen.y +
            2 * inv * t * controlScreen.y +
            t * t * targetScreen.y;
          context.beginPath();
          context.arc(particleX, particleY, highlighted ? 2.6 : 1.6, 0, Math.PI * 2);
          context.fillStyle = edge.kind === "CONTRADICTS" ? "#6ee7b7" : "#ffffff";
          context.globalAlpha = highlighted ? 0.95 : 0.55;
          context.fill();
          context.globalAlpha = 1;
        }
      }

      for (const node of positions) {
        if (!visibleNodeIds.has(node.id)) {
          continue;
        }

        const screen = toScreen(node);
        const radius = nodeRadius(node, view.zoom);
        const selected = node.id === selectedNodeId;
        const hovered = node.id === hoveredNodeId;
        const central = centralNodeIds.has(node.id);
        const halo = selected || hovered || central;

        if (halo) {
          context.beginPath();
          context.arc(screen.x, screen.y, radius + 7 + pulse * 2, 0, Math.PI * 2);
          context.fillStyle = COHORT_GLOW[node.cohort];
          context.globalAlpha = selected || hovered ? 0.65 : 0.28;
          context.fill();
          context.globalAlpha = 1;
        }

        context.beginPath();
        context.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
        context.fillStyle = nodeColor(node);
        context.globalAlpha =
          selected || hovered
            ? 1
            : node.kind === "agent"
              ? 0.62
              : 0.86;
        context.fill();
        context.globalAlpha = 1;

        context.beginPath();
        context.arc(screen.x, screen.y, radius + 1.5, 0, Math.PI * 2);
        context.strokeStyle = halo ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.12)";
        context.lineWidth = halo ? 1.6 : 0.5;
        context.stroke();

        const showLabel =
          node.kind === "score" ||
          node.kind === "cohort" ||
          node.kind === "asset" ||
          selected ||
          hovered ||
          central ||
          view.zoom >= 2.25;

        if (showLabel) {
          context.font = `${selected || hovered ? 700 : 600} ${
            node.kind === "score" ? 13 : 10
          }px system-ui, sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "top";
          context.fillStyle = "rgba(255,255,255,0.93)";
          const label =
            node.label.length > 34
              ? `${node.label.slice(0, 31)}…`
              : node.label;
          context.fillText(label, screen.x, screen.y + radius + 5);
        }
      }

      if (live) {
        animationFrameRef.current = window.requestAnimationFrame(draw);
      }
    };

    draw();
    const observer = new ResizeObserver(() => draw());
    observer.observe(container);

    return () => {
      disposed = true;
      observer.disconnect();

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    analytics,
    centralNodeIds,
    graph.edges,
    height,
    hoveredNodeId,
    live,
    positionMap,
    positions,
    selectedNodeId,
    view,
    visibleNodeIds,
  ]);

  function screenToGraph(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rectangle = canvas.getBoundingClientRect();
    const width = rectangle.width;
    const canvasHeight = rectangle.height;
    const scale = Math.min(width, canvasHeight) * 0.8 * view.zoom;
    const centerX = width / 2 + view.x;
    const centerY = canvasHeight / 2 + view.y;

    return {
      x: (event.clientX - rectangle.left - centerX) / scale,
      y: (event.clientY - rectangle.top - centerY) / scale,
      scale,
    };
  }

  function findNode(event: PointerEvent<HTMLCanvasElement>) {
    const point = screenToGraph(event);

    if (!point) {
      return null;
    }

    let closest: PositionedNode | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const node of positions) {
      if (!visibleNodeIds.has(node.id)) {
        continue;
      }

      const distance = Math.hypot(node.x - point.x, node.y - point.y);
      const threshold = nodeRadius(node, view.zoom) / point.scale + 0.013;

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

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#020202] shadow-2xl shadow-black/50">
      <div className="flex flex-col gap-3 border-b border-white/8 bg-black/80 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-white">
              Real-time Research Knowledge Graph
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
              {graph.nodeCount.toLocaleString()} nodes · {graph.edgeCount.toLocaleString()} edges · {analytics?.connectednessScore.toFixed(0) ?? "—"}% connected
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100">
            <Activity className="h-3.5 w-3.5" />
            {live ? "Live signal flow" : "Static graph"}
          </span>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={search}
              onChange={(event: any) => setSearch(event.target.value)}
              className="w-40 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-700"
              placeholder="Search graph"
            />
          </label>
          <select
            value={cohortFilter}
            onChange={(event: any) =>
              setCohortFilter(
                event.target.value as
                  | ResearchCohort
                  | "shared"
                  | "all",
              )
            }
            className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-black text-white outline-none"
          >
            <option value="all">All cohorts</option>
            <option value="media">Media</option>
            <option value="technical">Technical</option>
            <option value="economy">Economy</option>
            <option value="shared">Shared</option>
          </select>
          <button
            type="button"
            onClick={() =>
              setView((current) => ({
                ...current,
                zoom: clamp(current.zoom * 1.2, 0.35, 6),
              }))
            }
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:text-white"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setView((current) => ({
                ...current,
                zoom: clamp(current.zoom / 1.2, 0.35, 6),
              }))
            }
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
            }}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 hover:text-white"
            aria-label="Reset graph"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_350px]">
        <div
          ref={containerRef}
          className="relative cursor-grab overflow-hidden active:cursor-grabbing"
          style={{ height }}
        >
          <canvas
            ref={canvasRef}
            onWheel={(event: any) => {
              event.preventDefault();
              const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
              setView((current) => ({
                ...current,
                zoom: clamp(current.zoom * factor, 0.35, 6),
              }));
            }}
            onPointerDown={(event: any) => {
              const node = findNode(event);

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
            onPointerMove={(event: any) => {
              const drag = dragRef.current;

              if (drag && drag.pointerId === event.pointerId) {
                setView((current) => ({
                  ...current,
                  x: drag.viewX + event.clientX - drag.startX,
                  y: drag.viewY + event.clientY - drag.startY,
                }));
                return;
              }

              setHoveredNodeId(findNode(event)?.id ?? null);
            }}
            onPointerUp={(event: any) => {
              if (dragRef.current?.pointerId === event.pointerId) {
                dragRef.current = null;
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerLeave={() => setHoveredNodeId(null)}
            className="block h-full w-full"
          />

          <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/75 p-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 backdrop-blur-xl">
            {(["media", "technical", "economy", "shared"] as const).map(
              (cohort) => (
                <span key={cohort} className="inline-flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COHORT_COLORS[cohort] }}
                  />
                  {cohort}
                </span>
              ),
            )}
          </div>
        </div>

        <aside className="border-t border-white/8 bg-black/65 p-5 xl:border-l xl:border-t-0">
          {selectedNode ? (
            <div>
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: nodeColor(selectedNode) }}
                />
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {selectedNode.kind} · {selectedNode.cohort}
                </span>
              </div>
              <h3 className="mt-4 text-xl font-black leading-tight text-white">
                {selectedNode.label}
              </h3>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                    Score
                  </p>
                  <p className="mt-1 text-xl font-black text-white">
                    {formatNumber(selectedNode.score)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                    Confidence
                  </p>
                  <p className="mt-1 text-xl font-black text-white">
                    {formatNumber(selectedNode.confidence)}
                  </p>
                </div>
              </div>
              <div className="mt-5 max-h-[23rem] space-y-3 overflow-y-auto pr-1">
                {Object.entries(selectedNode.properties).map(([key, value]) => (
                  <div
                    key={key}
                    className="rounded-xl border border-white/8 bg-white/[0.025] p-3"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
                      {key}
                    </p>
                    <p className="mt-1 break-words text-xs font-semibold leading-5 text-slate-300">
                      {String(value ?? "—")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="grid min-h-56 place-items-center text-center">
                <div>
                  <Sparkles className="mx-auto h-8 w-8 text-emerald-300" />
                  <h3 className="mt-4 text-lg font-black text-white">
                    Select a graph node
                  </h3>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    Drag to pan, wheel to zoom, and select agents, sources,
                    topics, evidence, cohorts, or the Slice score.
                  </p>
                </div>
              </div>

              {analytics ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      Connectedness
                    </p>
                    <p className="mt-2 text-3xl font-black text-white">
                      {analytics.connectednessScore.toFixed(0)}%
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      Top connectors
                    </p>
                    <div className="mt-3 space-y-2">
                      {analytics.centralityTop.slice(0, 5).map((node) => (
                        <div key={node.id} className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate font-bold text-slate-300">
                            {node.label}
                          </span>
                          <span className="font-black text-white">
                            {node.centralityScore}%
                          </span>
                        </div>
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