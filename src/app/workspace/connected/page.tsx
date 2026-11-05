import type { Metadata } from "next";
import ConnectedWorkspace from "@/components/connected-workspace/connected-workspace";
export const metadata: Metadata = { robots: { index: false, follow: false }, title: "Connected Workspace", description: "Explore source-aware research, strategy, and scenario relationships." };
export default function Page() { return <ConnectedWorkspace/>; }
