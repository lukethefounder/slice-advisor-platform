import "server-only";
import { prisma } from "@/lib/prisma";
import { AgentDeskError, type DeskScope } from "./contracts";
import { requireAgentDeskAccess } from "./access";
import { projectPublicDiscoverySources, requireResearchSymbol, researchHash, researchJson, researchDate, uniqueResearchSources } from "./research-access-core";
import type { AgentSharedResearch, ResearchSharingPreference } from "./research-access-types";

export const RESEARCH_SHARING_EVENT = "SLICE_AGENT_DESK_PUBLIC_SOURCE_CONSENT_V1";
type SharingDatabase = Pick<typeof prisma, "backendPlatformEvent" | "firmMembership" | "sliceForecastBundle">;
const detail = "When enabled, founder-only agents may reuse public news source titles, URLs, publishers and publication/retrieval dates from this account's saved market research. This permission applies across workspaces to the founder research pool. Private analyses, messages, documents, portfolios, credentials and licensed market data are excluded.";
const revocation = "Turning sharing off excludes this account from subsequent shared-source reads. Public links already cited in completed research and its historical audit records remain in those records.";
// Account-wide consent has one key per user. A user cannot accidentally leave
// sharing enabled in a second firm after revoking it from the current settings.
const PREFERENCE_KEY = "agent-desk-public-source-consent:v1";
function validateScope(scope: DeskScope) {
  if (!scope || !/^[A-Za-z0-9:_.-]{1,200}$/.test(scope.userId) || !/^[A-Za-z0-9:_.-]{1,200}$/.test(scope.firmId)) throw new AgentDeskError("RESEARCH_SHARING_SCOPE", "An exact signed-in account and workspace are required.", 403);
}
function preference(enabled = false, updatedAt: string | null = null): ResearchSharingPreference {
  return { version: 1, enabled, updatedAt, scope: "opt-in-public-market-sources", detail, revocation };
}
function decodePreference(raw: unknown, scope: DeskScope): ResearchSharingPreference | null {
  const value = researchJson(raw);
  if (value.version !== 1 || value.userId !== scope.userId || value.firmId !== scope.firmId || typeof value.enabled !== "boolean" || !researchDate(value.updatedAt)) return null;
  return preference(value.enabled, String(value.updatedAt));
}
export async function getResearchSharingPreference(scope: DeskScope, db: SharingDatabase = prisma): Promise<ResearchSharingPreference> {
  validateScope(scope);
  const row = await db.backendPlatformEvent.findFirst({ where: { userId: scope.userId, eventType: RESEARCH_SHARING_EVENT, eventKey: PREFERENCE_KEY }, select: { firmId: true, metadataJson: true } });
  return row?.firmId ? decodePreference(row.metadataJson, { userId: scope.userId, firmId: row.firmId }) ?? preference() : preference();
}
export async function setResearchSharingPreference(scope: DeskScope, enabled: boolean, db: SharingDatabase = prisma): Promise<ResearchSharingPreference> {
  validateScope(scope);
  if (typeof enabled !== "boolean") throw new AgentDeskError("RESEARCH_SHARING_INPUT", "Choose whether to share public market source metadata.", 400);
  const updatedAt = new Date().toISOString();
  const data = { firmId: scope.firmId, status: enabled ? "Enabled" : "Disabled", metadataJson: JSON.stringify({ version: 1, ...scope, enabled, updatedAt }), detail: enabled ? "Owner opted in to public market source metadata sharing." : "Owner revoked future public market source sharing." };
  const row = await db.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey: PREFERENCE_KEY } },
    create: { userId: scope.userId, eventKey: PREFERENCE_KEY, eventType: RESEARCH_SHARING_EVENT, area: "AgentDeskPrivate", title: "Public market source sharing preference", sourceType: "OwnerConsent", ...data },
    update: data, select: { userId: true, firmId: true, eventType: true, metadataJson: true } });
  if (row.userId !== scope.userId || row.firmId !== scope.firmId || row.eventType !== RESEARCH_SHARING_EVENT) throw new AgentDeskError("RESEARCH_SHARING_SCOPE", "The preference belongs to a different account or workspace.", 403);
  const saved = decodePreference(row.metadataJson, scope);
  if (!saved) throw new AgentDeskError("RESEARCH_SHARING_INVALID", "The sharing preference could not be validated.", 503);
  return saved;
}
export function emptySharedResearch(status: AgentSharedResearch["status"] = "empty"): AgentSharedResearch {
  return { status, publisherCount: 0, sourceCount: 0, scope: "opt-in-public-market-sources", sources: [], truncated: false,
    detail: status === "disabled" ? "Founder shared-source reading is disabled." : "Only explicitly opted-in accounts contribute public discovery metadata. No private customer research or licensed feed data is shared." };
}

/** The only cross-account projection. Consent is explicit, active membership is
 * verified, only allowlisted public feed metadata is returned, and consent is
 * checked again after database reads so revocation is honored in flight. */
export async function loadSharedPublicResearch(scope: DeskScope, symbol: string, signal?: AbortSignal,
  dependencies: { db?: SharingDatabase; authorize?: typeof requireAgentDeskAccess; now?: () => number } = {}): Promise<AgentSharedResearch> {
  const db = dependencies.db ?? prisma, authorize = dependencies.authorize ?? requireAgentDeskAccess, now = dependencies.now?.() ?? Date.now();
  validateScope(scope); signal?.throwIfAborted(); await authorize(scope);
  const researchSymbol = requireResearchSymbol(symbol);
  const rows = await db.backendPlatformEvent.findMany({ where: { eventType: RESEARCH_SHARING_EVENT, status: "Enabled", userId: { not: scope.userId } },
    orderBy: { updatedAt: "desc" }, take: 100, select: { userId: true, firmId: true, eventKey: true, metadataJson: true } });
  const consented = rows.flatMap(row => {
    if (!row.firmId) return [];
    const owner = { userId: row.userId, firmId: row.firmId };
    return row.eventKey === PREFERENCE_KEY && decodePreference(row.metadataJson, owner)?.enabled ? [owner] : [];
  });
  if (!consented.length) return emptySharedResearch();
  const memberships = await db.firmMembership.findMany({ where: { OR: consented, status: "Active", user: { platformStatus: "Active" }, firm: { platformStatus: "Active" } }, select: { userId: true, firmId: true }, take: 100 });
  const active = new Set(memberships.map(row => `${row.userId}:${row.firmId}`));
  const publishers = consented.filter(row => active.has(`${row.userId}:${row.firmId}`));
  if (!publishers.length) return emptySharedResearch();
  const archives = await db.sliceForecastBundle.findMany({ where: { userId: { in: [...new Set(publishers.map(row => row.userId))] }, symbol: researchSymbol, status: { in: ["Ready", "ResearchOnly"] }, createdAt: { gte: new Date(now - 7 * 86_400_000) } },
    orderBy: { createdAt: "desc" }, take: 60, select: { userId: true, researchJson: true, operationsJson: true } });
  signal?.throwIfAborted(); await authorize(scope);
  const stillEnabled = await db.backendPlatformEvent.findMany({ where: { eventType: RESEARCH_SHARING_EVENT, status: "Enabled", OR: publishers },
    take: 100, select: { userId: true, firmId: true, eventKey: true, metadataJson: true } });
  const allowed = new Set(stillEnabled.filter(row => row.firmId && row.eventKey === PREFERENCE_KEY && decodePreference(row.metadataJson, { userId: row.userId, firmId: row.firmId })?.enabled).map(row => row.userId));
  const contributors = new Set<string>();
  const sources = uniqueResearchSources(archives.flatMap(row => {
    if (!allowed.has(row.userId) || researchJson(row.operationsJson).researchSha256 !== researchHash(row.researchJson)) return [];
    const projected = projectPublicDiscoverySources(row.researchJson, now, "opt-in-public-market-sources");
    if (projected.length) contributors.add(row.userId);
    return projected;
  }), 40);
  signal?.throwIfAborted();
  return { ...emptySharedResearch(), status: sources.length ? "ready" : "empty", sources, sourceCount: sources.length, publisherCount: contributors.size,
    truncated: rows.length === 100 || archives.length === 60 || sources.length === 40 };
}
