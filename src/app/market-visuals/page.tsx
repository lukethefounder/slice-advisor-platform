import type { Metadata } from "next";
import { Suspense } from "react";
import MarketTerminal from "@/components/market-terminal/market-terminal";
import { terminalBootstrap } from "@/lib/instant-workspace/bootstrap";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = { title: "Market Visuals", description: "Source-consistent market observations, detailed charts, and saved forecast context." };
async function PreparedMarketVisuals({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initial = await terminalBootstrap(await searchParams);
  return <MarketTerminal initialData={initial} />;
}
export default function MarketVisualsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<div role="status" style={{ padding: 32, minHeight: "70vh", color: "var(--slice-muted)" }}>Opening your saved market context. Quotes and history will load independently…</div>}><PreparedMarketVisuals searchParams={searchParams} /></Suspense>;
}
