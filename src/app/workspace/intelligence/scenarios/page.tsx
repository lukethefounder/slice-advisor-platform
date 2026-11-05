import type { Metadata } from "next";
import ScenarioWorkspace from "@/components/connected-workspace/scenario-workspace";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Scenario Studio", description: "Explore explicit assumptions and track frozen strategy rules against later Alpha Vantage daily observations." };
export default function Page() { return <ScenarioWorkspace/>; }
