"use client";
import { useMemo } from "react";
import type { ResearchNetwork, NetworkNode } from "@/lib/connected-research/contracts";
import css from "./experience.module.css";
const kinds = ["dataset", "symbol", "forecast", "backtest", "scenario"] as const;
const titles = ["Observed history", "Instrument", "Published research", "Historical tests", "Forward scenarios"];
export default function ResearchNetworkView({ network, selected, onSelect }: { network: ResearchNetwork; selected: string | null; onSelect: (node: NetworkNode) => void }) {
 const layout = useMemo(() => { const positions = new Map<string, { x: number; y: number }>(); const nodes: NetworkNode[] = [];
  kinds.forEach((kind, col) => { network.nodes.filter(n => n.kind === kind).slice(0, 5).forEach((node, i) => { positions.set(node.id, { x: 18 + col * 198, y: 50 + i * 92 }); nodes.push(node); }); }); return { nodes, positions };
 }, [network]);
 return <div className={css.networkScroll}><svg viewBox="0 0 1010 530" className={css.networkSvg} role="img" aria-label="Linked records from saved research, simulations, datasets, and scenarios">
  <defs><pattern id="slice-graph-grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="var(--slice-border,#dce6e1)"/></pattern></defs><rect width="1010" height="530" fill="url(#slice-graph-grid)"/>
  {titles.map((title, i) => <text x={20 + i * 198} y="26" fill="var(--slice-muted,#546c65)" fontSize="10" fontWeight="700" key={title}>{title.toUpperCase()}</text>)}
  {network.edges.map(e => { const a = layout.positions.get(e.source), b = layout.positions.get(e.target); if (!a || !b) return null; const fromX = a.x + (a.x < b.x ? 174 : 0), toX = b.x + (a.x < b.x ? 0 : 174); return <path key={`${e.source}-${e.target}-${e.relation}`} d={`M${fromX},${a.y + 32} C${(fromX + toX) / 2},${a.y + 32} ${(fromX + toX) / 2},${b.y + 32} ${toX},${b.y + 32}`} fill="none" stroke={e.source === selected || e.target === selected ? "#16886a" : "var(--slice-border-strong,#c8dad1)"} strokeWidth={e.source === selected || e.target === selected ? 2 : 1} strokeDasharray={e.relation === "related-by-user" ? "4 4" : undefined}><title>{e.relation}</title></path>; })}
  {layout.nodes.map(n => { const pos = layout.positions.get(n.id)!; return <g transform={`translate(${pos.x},${pos.y})`} key={n.id} role="button" tabIndex={0} aria-label={`${n.label}. ${n.classification}. ${n.state}.`} className={css.graphNode} onClick={() => onSelect(n)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(n); } }}><rect width="174" height="64" rx="11" fill="var(--slice-surface-strong,#fff)" stroke={selected === n.id ? "#16886a" : "var(--slice-border,#dce6e1)"} strokeWidth={selected === n.id ? 2 : 1}/><rect x="12" y="13" width="4" height="15" rx="2" fill={n.classification === "observation" ? "#16886a" : n.classification === "estimate" ? "#8864b6" : "#39889a"}/><text x="23" y="25" fill="var(--slice-heading,#102f2b)" fontSize="11" fontWeight="700">{n.label.length > 21 ? n.label.slice(0, 20) + "…" : n.label}</text><text x="13" y="47" fill="var(--slice-muted,#546c65)" fontSize="9">{n.state} · {n.asOf?.slice(0, 10) ?? "Shared symbol"}</text><title>{n.label}: {n.subtitle}</title></g>; })}
 </svg></div>;
}
