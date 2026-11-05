import type { WorkspaceSession } from "@/components/workspace/premium/session";
import type { HomeSummary } from "@/lib/workspace/home-contract";
import type { PreferenceResponse, Entitlement } from "@/lib/market-evidence/contracts";
import type { SectionResponse } from "@/lib/market-visuals/contracts";
export type WorkspaceSeed = { session: WorkspaceSession; scope: string | null; settings: PreferenceResponse | null; summary: HomeSummary | null; sections: SectionResponse[]; preparedAt: string; notes: string[] };
export type TerminalSeed = { defaultSymbol?: string; defaultRange?: import("@/lib/market-evidence/contracts").MarketRange; session: { ok: true; scope: string; configured: boolean; entitlement: Entitlement } | null; sections: SectionResponse[]; preparedAt: string; notes: string[] };
