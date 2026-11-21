"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import type { ResearchGraphNode, ResearchKnowledgeGraph } from "@/lib/intelligence/research-swarm-types";
import { buildNeuralGeometry, cortexPoint, neuralDrift, projectNeuralPoint } from "./neural-geometry";
import styles from "./neural-brain-scene.module.css";

export type NeuralBrainSceneProps = {
  variant?: "public" | "workspace";
  graph?: ResearchKnowledgeGraph | null;
  symbol?: string;
  animated?: boolean;
  className?: string;
  height?: number;
  controls?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (node: ResearchGraphNode) => void;
};

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
const reducedSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const reducedServerSnapshot = () => true;
type HitPoint = { x: number; y: number; radius: number; node: ResearchGraphNode };

/** Canvas geometry conveys relationships; animation never implies new market observations. */
export default function NeuralBrainScene({
  variant = "workspace", graph = null, symbol = "SLICE", animated = true,
  className = "", height = 620, controls = true, selectedNodeId, onSelectNode,
}: NeuralBrainSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null), container = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 }), hitPoints = useRef<HitPoint[]>([]);
  const [paused, setPaused] = useState(false), [localSelection, setLocalSelection] = useState<string | null>(null);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedSnapshot, reducedServerSnapshot);
  const geometry = useMemo(() => buildNeuralGeometry(graph), [graph]);
  const selected = selectedNodeId === undefined ? localSelection : selectedNodeId;
  const moving = animated && !paused && !reducedMotion;

  useEffect(() => {
    const element = canvas.current, parent = container.current;
    if (!element || !parent) return;
    const context = element.getContext("2d", { alpha: true, desynchronized: true });
    if (!context) return;
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lowPower = (navigator.hardwareConcurrency || 4) <= 4 || (typeof memory === "number" && memory <= 4);
    let width = 1, canvasHeight = 1, dpr = 1, frame = 0, last = 0, disposed = false, inView = true;
    let renderedYaw = 0, renderedPitch = 0;
    const activation = new Float32Array(geometry.vertices.length);
    const points = geometry.vertices.map(() => ({ x: 0, y: 0, z: 0 }));
    const links = geometry.links.slice(0, lowPower ? 850 : 1900);
    const fibers = Array.from({ length: lowPower ? 16 : 26 }, (_, index) => {
      const side = index % 2 ? 1 : -1, band = Math.floor(index / 2), bands = lowPower ? 8 : 13;
      return Array.from({ length: 72 }, (_, step) => cortexPoint(side, -0.92 + band / (bands - 1) * 1.84 + Math.sin(step / 8 + band) * 0.035, step / 71 * Math.PI * 2, 1));
    });
    const drawable = (index: number) => !geometry.illustrative || !lowPower || index % 4 < 2;
    const draw = (timestamp: number) => {
      frame = 0;
      if (disposed) return;
      const active = moving && inView && document.visibilityState === "visible";
      if (active && timestamp - last < (lowPower ? 64 : 32)) { frame = requestAnimationFrame(draw); return; }
      last = timestamp;
      const seconds = active ? timestamp / 1000 : 0;
      const targetYaw = active ? Math.sin(seconds * 0.095) * 0.14 + pointer.current.x * 0.075 : 0.045;
      const targetPitch = active ? Math.cos(seconds * 0.11) * 0.055 + pointer.current.y * 0.025 : -0.025;
      renderedYaw += (targetYaw - renderedYaw) * 0.055;
      renderedPitch += (targetPitch - renderedPitch) * 0.055;
      const scale = Math.min(width * 0.72, canvasHeight * 0.79), cx = width / 2, cy = canvasHeight * 0.52;
      const project = (point: { x: number; y: number; z: number }) => {
        const p = projectNeuralPoint(point, renderedYaw, renderedPitch);
        return { x: cx + p.x * scale, y: cy + p.y * scale, z: p.z };
      };
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, canvasHeight);
      const halo = context.createRadialGradient(cx, cy, 10, cx, cy, scale * 0.85);
      halo.addColorStop(0, "rgba(22,117,116,0.09)"); halo.addColorStop(0.55, "rgba(24,63,109,0.04)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = halo; context.fillRect(0, 0, width, canvasHeight);
      context.lineCap = "round";
      // Fine cortical folds create the anatomy, independently of the evidence graph.
      for (let index = 0; index < fibers.length; index += 1) {
        context.beginPath();
        fibers[index].forEach((point, pointIndex) => {
          const p = project(point);
          if (!pointIndex) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y);
        });
        context.strokeStyle = index % 2 ? "#5ce9c7" : "#82bbf8";
        context.globalAlpha = geometry.illustrative ? 0.11 : 0.045;
        context.lineWidth = index % 5 === 0 ? 0.85 : 0.45; context.stroke();
      }
      activation.fill(0);
      for (let index = 0; index < geometry.vertices.length; index += 1) {
        const vertex = geometry.vertices[index];
        points[index] = project(neuralDrift(vertex, vertex.phase, seconds, active));
      }
      context.globalCompositeOperation = "lighter";
      for (let index = 0; index < links.length; index += 1) {
        const link = links[index];
        if (!drawable(link.source) || !drawable(link.target)) continue;
        const a = points[link.source], b = points[link.target];
        const relevant = geometry.vertices[link.source].id === selected || geometry.vertices[link.target].id === selected;
        const curvature = Math.sin(link.phase * 6.28) * Math.min(30, Math.hypot(b.x - a.x, b.y - a.y) * 0.12);
        const controlX = (a.x + b.x) / 2 + curvature, controlY = (a.y + b.y) / 2 - Math.abs(curvature);
        context.beginPath(); context.moveTo(a.x, a.y); context.quadraticCurveTo(controlX, controlY, b.x, b.y);
        context.strokeStyle = link.contradiction ? "#fb839c" : geometry.vertices[link.source].color;
        context.globalAlpha = relevant ? 0.65 : 0.065 + Math.max(0, (a.z + b.z) * 0.11) + link.strength * 0.045;
        context.lineWidth = relevant ? 1.3 : 0.45; context.stroke();
        const flowStride = Math.max(1, Math.floor(links.length / (lowPower ? 34 : 82)));
        if (active && (relevant || index % flowStride === 0)) {
          const t = (seconds * (0.17 + link.phase * 0.09) + link.phase) % 1;
          activation[link.target] = Math.max(activation[link.target], Math.exp(-Math.pow((t - 0.96) / 0.065, 2)));
          for (let tail = 3; tail >= 0; tail -= 1) {
            const progress = Math.max(0, t - tail * 0.015), inverse = 1 - progress;
            const x = inverse * inverse * a.x + 2 * inverse * progress * controlX + progress * progress * b.x;
            const y = inverse * inverse * a.y + 2 * inverse * progress * controlY + progress * progress * b.y;
            context.beginPath(); context.arc(x, y, tail === 0 ? 1.65 : 1.1, 0, Math.PI * 2);
            context.fillStyle = tail === 0 ? "#effffb" : link.contradiction ? "#fb839c" : geometry.vertices[link.source].color;
            context.globalAlpha = tail === 0 ? 0.84 : 0.24 - tail * 0.04; context.fill();
          }
        }
      }
      const hits: HitPoint[] = [];
      for (let index = 0; index < geometry.vertices.length; index += 1) {
        if (!drawable(index)) continue;
        const vertex = geometry.vertices[index], point = points[index];
        const focus = vertex.id === selected, firing = activation[index];
        const shimmer = active ? 0.5 + 0.5 * Math.sin(seconds * 0.8 + vertex.phase) : 0.4;
        const radius = vertex.radius * Math.max(0.75, 1 + point.z * 0.5);
        if (firing > 0.1 || focus || vertex.radius >= 6) {
          const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 4 + firing * 13);
          glow.addColorStop(0, vertex.color + (focus ? "77" : "40")); glow.addColorStop(1, vertex.color + "00");
          context.globalAlpha = focus ? 0.9 : 0.38 + firing * 0.4; context.fillStyle = glow;
          const extent = radius * 4 + firing * 13;
          context.fillRect(point.x - extent, point.y - extent, extent * 2, extent * 2);
        }
        context.beginPath(); context.arc(point.x, point.y, radius + firing * 0.7, 0, Math.PI * 2);
        context.globalAlpha = Math.min(1, 0.55 + point.z * 0.5 + shimmer * 0.17 + firing * 0.4);
        context.fillStyle = focus || firing > 0.55 ? "#e9fff8" : vertex.color; context.fill();
        if (vertex.node) hits.push({ x: point.x, y: point.y, radius: Math.max(radius, 7), node: vertex.node });
        if (focus) {
          context.beginPath(); context.arc(point.x, point.y, radius + 7, 0, Math.PI * 2);
          context.globalAlpha = 0.8; context.strokeStyle = "#b9ffe9"; context.lineWidth = 1; context.stroke();
        }
      }
      hitPoints.current = hits;
      context.globalAlpha = 1; context.globalCompositeOperation = "source-over";
      const center = geometry.vertices.findIndex(vertex => vertex.node?.kind === "asset");
      if (center >= 0) {
        const point = points[center];
        context.font = "700 11px system-ui, sans-serif"; context.textAlign = "center";
        const text = symbol.slice(0, 16), textWidth = Math.max(62, context.measureText(text).width + 24);
        context.fillStyle = "rgba(4,19,27,0.94)"; context.strokeStyle = "rgba(109,250,209,0.7)"; context.lineWidth = 1;
        context.beginPath(); context.roundRect(point.x - textWidth / 2, point.y - 14, textWidth, 28, 14); context.fill(); context.stroke();
        context.fillStyle = "#d2fff2"; context.fillText(text, point.x, point.y + 4);
      }
      if (active) frame = requestAnimationFrame(draw);
    };
    const redraw = () => { if (frame) cancelAnimationFrame(frame); frame = requestAnimationFrame(draw); };
    const resize = () => {
      const rect = parent.getBoundingClientRect(); width = Math.max(1, rect.width); canvasHeight = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75);
      element.width = Math.round(width * dpr); element.height = Math.round(canvasHeight * dpr); redraw();
    };
    const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(parent);
    const observer = new IntersectionObserver(([entry]) => { inView = entry?.isIntersecting ?? true; redraw(); }, { rootMargin: "60px" }); observer.observe(parent);
    document.addEventListener("visibilitychange", redraw); resize();
    return () => { disposed = true; cancelAnimationFrame(frame); resizeObserver.disconnect(); observer.disconnect(); document.removeEventListener("visibilitychange", redraw); hitPoints.current = []; };
  }, [geometry, moving, selected, symbol]);

  function choose(node: ResearchGraphNode) { setLocalSelection(node.id); onSelectNode?.(node); }
  return <div ref={container} className={`${styles.scene} ${className}`} data-variant={variant} style={{ "--neural-height": `${height}px` } as CSSProperties}>
    <canvas ref={canvas} className={styles.canvas} role="img" aria-label={geometry.illustrative ? "Illustrative neural brain architecture with moving synaptic signals. This visualization contains no live market observations." : `${symbol} saved research graph arranged as a neural network. Animated connections represent existing evidence relationships.`}
      onPointerMove={event => { const rect = event.currentTarget.getBoundingClientRect(); pointer.current = { x: (event.clientX - rect.left) / rect.width * 2 - 1, y: (event.clientY - rect.top) / rect.height * 2 - 1 }; }}
      onPointerLeave={() => { pointer.current = { x: 0, y: 0 }; }}
      onClick={event => { const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top; const nearest = hitPoints.current.filter(point => Math.hypot(point.x - x, point.y - y) < point.radius + 4).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0]; if (nearest) choose(nearest.node); }}/>
    {!controls && graph && <label className={styles.accessiblePicker}>Inspect a neural graph node<select className={styles.picker} value={selected ?? ""} onChange={event => { const node = graph.nodes.find(item => item.id === event.target.value); if (node) choose(node); }}><option value="">Choose a node</option>{geometry.vertices.filter(vertex => vertex.node).slice(0, 200).map(vertex => <option key={vertex.id} value={vertex.id}>{vertex.node!.kind} · {vertex.node!.label}</option>)}</select></label>}
    {controls && <div className={styles.controls}>
      <div className={styles.caption}><span className={moving ? styles.pulse : ""}/>{geometry.illustrative ? "Illustrative neural architecture" : "Saved evidence · animated connections"}</div>
      {graph && <select className={styles.picker} value={selected ?? ""} aria-label="Inspect a neural graph node" onChange={event => { const node = graph.nodes.find(item => item.id === event.target.value); if (node) choose(node); }}><option value="">Inspect a node</option>{geometry.vertices.filter(vertex => vertex.node).slice(0, 200).map(vertex => <option key={vertex.id} value={vertex.id}>{vertex.node!.kind} · {vertex.node!.label}</option>)}</select>}
      <button className={styles.motion} type="button" onClick={() => setPaused(value => !value)} disabled={reducedMotion || !animated} aria-pressed={paused || !animated || reducedMotion} aria-label={moving ? "Pause neural animation" : "Resume neural animation"}>{moving ? <Pause size={12}/> : <Play size={12}/>}<span>{reducedMotion ? "Reduced motion" : moving ? "Pause motion" : "Motion paused"}</span></button>
    </div>}
  </div>;
}
