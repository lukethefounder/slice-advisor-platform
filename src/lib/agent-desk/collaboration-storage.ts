import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AgentDeskError, type DeskScope } from "./contracts";

export const DESK_ARTIFACT_TYPES = {
  board: "SLICE_AGENT_DESK_BOARD_V1",
  entry: "SLICE_AGENT_DESK_ENTRY_V1",
  outcome: "SLICE_AGENT_DESK_OUTCOME_V1",
  brief: "SLICE_AGENT_DESK_BRIEF_V1",
  read: "SLICE_AGENT_DESK_BRIEF_READ_V1",
} as const;
export type DeskArtifactKind = keyof typeof DESK_ARTIFACT_TYPES;
export type DeskArtifactDatabase = Pick<typeof prisma, "backendPlatformEvent">;
export const deskArtifactDatabase: DeskArtifactDatabase = prisma;
export const artifactHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const artifactObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export function validArtifactId(value: unknown): value is string { return typeof value === "string" && /^[A-Za-z0-9:_.-]{1,200}$/.test(value); }
function requireArtifactScope(scope: DeskScope) {
  if (!scope || !validArtifactId(scope.userId) || !validArtifactId(scope.firmId)) throw new AgentDeskError("AGENT_ARTIFACT_SCOPE", "A private agent record requires its exact account and workspace.", 403);
}
export function artifactKey(scope: DeskScope, kind: DeskArtifactKind, id: string) { requireArtifactScope(scope); return `agent-desk-${kind}:${scope.firmId}:${id}`; }
export function artifactScope(scope: DeskScope, kind: DeskArtifactKind) { requireArtifactScope(scope); return { userId: scope.userId, firmId: scope.firmId, eventType: DESK_ARTIFACT_TYPES[kind] }; }
export function boundedArtifactLimit(value: number | undefined, fallback: number, maximum: number) {
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value))) throw new AgentDeskError("INVALID_AGENT_LIMIT", "Choose a finite record limit.", 400);
  return Math.max(1, Math.min(maximum, Math.floor(value ?? fallback)));
}

export function encodePrivateArtifact(scope: DeskScope, kind: DeskArtifactKind, value: unknown) {
  requireArtifactScope(scope);
  const payload = JSON.stringify({ owner: { userId: scope.userId, firmId: scope.firmId }, kind, value });
  return JSON.stringify({ version: 1, checksum: artifactHash(payload), payload });
}
export function decodePrivateArtifact<T>(raw: string, scope: DeskScope, kind: DeskArtifactKind): T {
  requireArtifactScope(scope);
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!artifactObject(envelope) || envelope.version !== 1 || typeof envelope.payload !== "string" || envelope.checksum !== artifactHash(envelope.payload)) throw new Error("checksum");
    const payload: unknown = JSON.parse(envelope.payload);
    if (!artifactObject(payload) || !artifactObject(payload.owner) || payload.owner.userId !== scope.userId || payload.owner.firmId !== scope.firmId || payload.kind !== kind) throw new Error("scope");
    return payload.value as T;
  } catch {
    throw new AgentDeskError("AGENT_ARTIFACT_INVALID", "A private agent record failed its ownership or integrity check. It cannot be used as learning evidence.", 503);
  }
}
export async function readPrivateArtifact<T>(scope: DeskScope, kind: DeskArtifactKind, id: string, db: DeskArtifactDatabase = deskArtifactDatabase): Promise<T | null> {
  if (!validArtifactId(id)) throw new AgentDeskError("INVALID_AGENT_RECORD_ID", "Choose a valid agent record.", 400);
  const row = await db.backendPlatformEvent.findFirst({ where: { ...artifactScope(scope, kind), eventKey: artifactKey(scope, kind, id) }, select: { metadataJson: true } });
  return row ? decodePrivateArtifact<T>(row.metadataJson, scope, kind) : null;
}
/** Upsert is insert-only. A replay returns the original record and cannot replace
 * a discussion, executed trade, or outcome with a newer model's account of it. */
export async function writePrivateArtifact<T>(scope: DeskScope, kind: DeskArtifactKind, id: string, value: T,
  presentation: { title: string; detail: string; status: string; sourceId: string },
  db: DeskArtifactDatabase = deskArtifactDatabase, allowFirstWriteWins = false): Promise<T> {
  if (!validArtifactId(id) || !validArtifactId(presentation.sourceId)) throw new AgentDeskError("INVALID_AGENT_RECORD_ID", "A server-issued agent record identity is required.", 400);
  const metadataJson = encodePrivateArtifact(scope, kind, value);
  const row = await db.backendPlatformEvent.upsert({
    where: { userId_eventKey: { userId: scope.userId, eventKey: artifactKey(scope, kind, id) } }, update: {},
    create: { ...artifactScope(scope, kind), eventKey: artifactKey(scope, kind, id), area: "AgentDeskPrivate",
      title: presentation.title.slice(0, 300), detail: presentation.detail.slice(0, 1200), status: presentation.status,
      sourceType: "PrivatePaperAgentRecord", sourceId: presentation.sourceId, metadataJson },
    select: { metadataJson: true, userId: true, firmId: true, eventType: true },
  });
  if (row.userId !== scope.userId || row.firmId !== scope.firmId || row.eventType !== DESK_ARTIFACT_TYPES[kind]) throw new AgentDeskError("AGENT_ARTIFACT_SCOPE", "The private agent record belongs to a different scope.", 403);
  const saved = decodePrivateArtifact<T>(row.metadataJson, scope, kind);
  if (!allowFirstWriteWins && row.metadataJson !== metadataJson) throw new AgentDeskError("AGENT_ARTIFACT_REPLAY_CONFLICT", "This immutable agent record already exists with different content.");
  return saved;
}
