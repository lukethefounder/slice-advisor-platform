import type { Metadata } from "next";
import WorkspaceHome from "@/components/workspace/premium/workspace-home";
import { workspaceBootstrap } from "@/lib/instant-workspace/bootstrap";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = { title: "Your Workspace", description: "Your saved market context, ready to inspect, with transparent source times and independent refresh." };
export default async function WorkspacePage() { const initial = await workspaceBootstrap(); return <WorkspaceHome initial={initial} />; }
