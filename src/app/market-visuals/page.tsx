import type { Metadata } from "next";
import { Suspense } from "react";
import MarketTerminal from "@/components/market-terminal/market-terminal";
import { terminalBootstrap } from "@/lib/instant-workspace/bootstrap";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = { title: "Market Visuals", description: "Source-consistent market observations, detailed charts, and saved forecast context." };
export default async function MarketVisualsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const initial = await terminalBootstrap(await searchParams);
  return <Suspense fallback={<div role="status" style={{ padding: 32 }}>Opening market context…</div>}><MarketTerminal initialData={initial} /></Suspense>;
}
