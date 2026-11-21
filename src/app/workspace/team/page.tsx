import type { Metadata } from "next";
import { Suspense } from "react";
import TeamManager from "@/components/team/team-manager";
export const metadata: Metadata = { title: "Team & access | Slice", description: "Invite colleagues and manage your firm's membership invitations." };
export default function TeamPage() { return <Suspense fallback={<div role="status" className="p-8">Loading your team…</div>}><TeamManager /></Suspense>; }
