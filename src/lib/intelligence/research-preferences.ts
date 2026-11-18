import "server-only";

import { prisma } from "@/lib/prisma";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { MAX_RESEARCH_AGENTS, normalizeResearchWeights } from "./research-config";
import type { ResearchWeights } from "./research-swarm-types";

const PREFERENCE_KEY = "knowledge-graph:research-preferences:v1";

export type ResearchPreferences = {
  weights: ResearchWeights;
  agentCount: number;
  updatedAt: string | null;
};

function agentCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(30, Math.min(MAX_RESEARCH_AGENTS, Math.round(parsed)))
    : 600;
}

/** Private by authenticated user; uses the platform's existing preference store. */
export async function readResearchPreferences(userId: string): Promise<ResearchPreferences> {
  await requireResearchStorage(["BackendPlatformEvent"]);
  const row = await prisma.backendPlatformEvent.findUnique({
    where: { userId_eventKey: { userId, eventKey: PREFERENCE_KEY } },
    select: { metadataJson: true, updatedAt: true },
  });
  let saved: Record<string, unknown> = {};
  if (row) {
    try {
      const parsed: unknown = JSON.parse(row.metadataJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) saved = parsed as Record<string, unknown>;
    } catch { /* An obsolete preference record falls back to the documented defaults. */ }
  }
  return {
    weights: normalizeResearchWeights(saved.weights),
    agentCount: saved.agentCount === undefined ? 600 : agentCount(saved.agentCount),
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

export async function saveResearchPreferences(userId: string, input: { weights: ResearchWeights; agentCount: number }): Promise<ResearchPreferences> {
  await requireResearchStorage(["BackendPlatformEvent"]);
  const preferences = { weights: normalizeResearchWeights(input.weights), agentCount: agentCount(input.agentCount) };
  const data = {
    eventType: "SLICE_RESEARCH_PREFERENCES_V1",
    area: "Intelligence",
    title: "Personal knowledge graph research allocation",
    sourceType: "ResearchPreferences",
    status: "Active",
    metadataJson: JSON.stringify(preferences),
  };
  const row = await prisma.backendPlatformEvent.upsert({
    where: { userId_eventKey: { userId, eventKey: PREFERENCE_KEY } },
    create: { userId, eventKey: PREFERENCE_KEY, ...data },
    update: data,
    select: { updatedAt: true },
  });
  return { ...preferences, updatedAt: row.updatedAt.toISOString() };
}
