import type { Metadata } from "next";
import { notFound } from "next/navigation";

import AgentDesk from "@/components/intelligence/agent-desk";
import { requireCurrentAgentDeskAccess } from "@/lib/agent-desk/access";

export const metadata: Metadata = {
  title: "Six-Agent Trading Desk",
  description: "Inspect six AI research roles, their source trails, and paper decisions under your saved safeguards.",
};

export default async function AgentDeskPage() {
  try {
    await requireCurrentAgentDeskAccess();
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && [401, 403].includes(Number(error.status))) notFound();
    throw error;
  }
  return <AgentDesk />;
}
