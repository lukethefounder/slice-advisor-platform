import type { Metadata } from "next";
import StrategyLabWorkspace from "@/components/strategy-lab/strategy-lab-workspace";
export const metadata: Metadata = { title: "Strategy Lab | Slice", description: "Build and replay transparent historical strategies using verified Alpha Vantage daily data." };
export default function StrategyLabPage() { return <StrategyLabWorkspace />; }
