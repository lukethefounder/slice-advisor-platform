"use client";
import { LineChart, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import type { ForwardResult } from "@/lib/connected-research/scenario-core";
import css from "./experience.module.css";
export default function ScenarioChart({ result }: { result: ForwardResult }) {
 const benchmark = new Map(result.calculation.benchmarkEquity.map(p => [p.date, p.equity]));
 const data = result.calculation.equity.map(p => ({ date: p.date, paper: p.equity, benchmark: benchmark.get(p.date) ?? null }));
 return <div className={css.chart} role="img" aria-label="Frozen-rule paper equity and benchmark, only through accepted completed sessions"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 15, right: 15, bottom: 5, left: 0 }}><CartesianGrid stroke="var(--slice-border,#dce6e1)" vertical={false}/><XAxis dataKey="date" minTickGap={55} tick={{ fontSize: 10, fill: "var(--slice-muted,#546c65)" }}/><YAxis width={66} domain={["auto", "auto"]} tickFormatter={v => `$${(Number(v) / 1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: "var(--slice-muted,#546c65)" }}/><Tooltip formatter={v => `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}/><Line name="Paper strategy" dataKey="paper" type="linear" stroke="#0b8c67" strokeWidth={2.5} dot={data.length === 1} isAnimationActive={false}/><Line name="Benchmark simulation" dataKey="benchmark" type="linear" stroke="#3996af" strokeWidth={1.8} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div>;
}
