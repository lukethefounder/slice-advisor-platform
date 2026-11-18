import type { Metadata } from "next";
import WorkspaceHome from "@/components/workspace/premium/workspace-home";
import { workspaceBootstrap } from "@/lib/instant-workspace/bootstrap";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const metadata: Metadata = { title: "Your Research Workspace", description: "Your knowledge graph, saved research, source evidence, and market context in one connected workspace." };
export default async function WorkspacePage() { const initial = await workspaceBootstrap(); return <WorkspaceHome initial={initial} />; }
