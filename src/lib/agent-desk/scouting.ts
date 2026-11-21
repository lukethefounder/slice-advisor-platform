import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { configured } from "@/lib/data-readiness/core";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { enqueueBackgroundJob, requestBackgroundJobCancellation } from "@/lib/background-jobs/queue";
import { requireAgentDeskAccess } from "./access";
import { agentProviderConfiguration, runResearchAgent, type AgentContext } from "./agents";
import { appendAgentBoardMessage, readAgentBoard } from "./collaboration";
import { readAgentLearning } from "./learning";
import { AgentDeskError, DEFAULT_DESK_SCOUTING, type AgentFinding, type DeskScope } from "./contracts";
import { discoverScoutCandidates, scoutDiscoveryEvidence } from "./research-tools";
import type { ScoutDiscovery } from "./research-tool-types";
import { DESK_STATE_EVENT, decodeDeskEnvelope, encodeDeskEnvelope, readDeskRecord, replaceDeskRecord, type DeskRecord } from "./store";

export const DESK_SCOUT_EVENT = "SLICE_AGENT_DESK_SCOUT_V1";
const LEASE_MS = 30 * 60_000;
const now = () => new Date().toISOString();
const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const safeError = (error: unknown) => error instanceof AgentDeskError ? error.message : "Scout could not finish this scan. Review provider access and the saved job status; no research candidate or trade was invented.";
type ScoutPayload = { scanId: string; token: string; revision: number; scheduled: boolean };
export type DeskScoutRuntime = {
  jobId: string; scope: DeskScope; payload: Record<string, unknown>; signal: AbortSignal;
  progress: (progress: number, message?: string) => Promise<void>;
};

function payloadOf(value: Record<string, unknown>): ScoutPayload {
  if (typeof value.scanId !== "string" || !/^[a-f0-9-]{36}$/.test(value.scanId) || typeof value.token !== "string" || !/^[a-f0-9-]{36}$/.test(value.token) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || typeof value.scheduled !== "boolean")
    throw new AgentDeskError("INVALID_SCOUT_JOB", "Scout requires its exact server-issued lease and settings revision.", 400);
  return { scanId: value.scanId, token: value.token, revision: Number(value.revision), scheduled: value.scheduled };
}

function isLease(record: DeskRecord, payload: ScoutPayload, jobId?: string) {
  const busy = record.state.scouting.busy;
  return Boolean(busy && busy.id === payload.scanId && busy.token === payload.token && busy.revision === payload.revision && record.state.revision === payload.revision && (!jobId || !busy.jobId || busy.jobId === jobId) && Date.parse(busy.expiresAt) > Date.now() && !record.state.controls.killSwitch && (!payload.scheduled || record.state.settings.scouting?.enabled));
}
async function authorizedLease(scope: DeskScope, payload: ScoutPayload, jobId: string, signal: AbortSignal): Promise<DeskRecord> {
  signal.throwIfAborted();
  await requireAgentDeskAccess(scope);
  let record = await readDeskRecord(scope);
  signal.throwIfAborted();
  if (!isLease(record, payload, jobId)) throw new AgentDeskError("SCOUT_SUPERSEDED", "Scout lost its lease or its founder settings changed. The late result cannot enter the research queue.");
  if (Date.parse(record.state.scouting.busy!.expiresAt) - Date.now() < LEASE_MS / 3) {
    record = await replaceDeskRecord(scope, record, { ...record.state, scouting: { ...record.state.scouting, busy: { ...record.state.scouting.busy!, expiresAt: new Date(Date.now() + LEASE_MS).toISOString() } } });
  }
  return record;
}
function nextScanAt(record: DeskRecord, checkedAt: string) {
  const settings = record.state.settings.scouting ?? DEFAULT_DESK_SCOUTING;
  return settings.enabled && !record.state.controls.killSwitch ? new Date(Date.parse(checkedAt) + settings.intervalMinutes * 60_000).toISOString() : null;
}

export async function recoverScoutLease(scope: DeskScope, previous?: DeskRecord): Promise<DeskRecord> {
  await requireAgentDeskAccess(scope);
  const record = previous ?? await readDeskRecord(scope);
  const busy = record.state.scouting.busy;
  if (!busy) return record;
  const revoked = busy.revision !== record.state.revision || record.state.controls.killSwitch || (busy.scheduled === true && !record.state.settings.scouting?.enabled);
  const job = !revoked && busy.jobId ? await prisma.backendJobRun.findFirst({ where: { id: busy.jobId, ...scope }, select: { status: true } }) : null;
  const terminal = job && ["Failed", "DeadLetter", "Cancelled", "Complete"].includes(job.status);
  if (!revoked && !terminal && Date.parse(busy.expiresAt) > Date.now()) return record;
  await requireAgentDeskAccess(scope);
  const recovered = await replaceDeskRecord(scope, record, { ...record.state, scouting: { ...record.state.scouting, busy: null,
    nextScanAt: record.state.settings.scouting?.enabled && !record.state.controls.killSwitch ? record.state.scouting.nextScanAt : null,
    lastError: "The previous scout job ended or lost its lease. Its late result cannot alter the research queue." }, updatedAt: now() });
  if (busy.jobId) await requestBackgroundJobCancellation({ ...scope, jobId: busy.jobId }).catch(() => undefined);
  return recovered;
}

/** Discovery has a separate opt-in schedule; it never arms trading or changes an execution allowlist. */
export async function queueDeskScout(scope: DeskScope, revision: number, scheduled = false): Promise<string | null> {
  await requireAgentDeskAccess(scope);
  await requireResearchStorage(["BackendPlatformEvent"]);
  const provider = agentProviderConfiguration();
  if (!provider.key || !configured(process.env.ALPHA_VANTAGE_API_KEY)) throw new AgentDeskError("SCOUT_PROVIDERS_REQUIRED", "Configure the private AI and market providers before starting Scout. Data subscriptions and live market entitlements remain separate.", 503);
  let record = await recoverScoutLease(scope, await readDeskRecord(scope));
  if (!Number.isSafeInteger(revision) || revision !== record.state.revision) throw new AgentDeskError("DESK_REVISION_CHANGED", "The founder's saved settings changed. Reload before starting a scout scan.");
  if (record.state.controls.killSwitch) throw new AgentDeskError("DESK_KILLED", "Clear the kill switch before starting Scout.");
  if (record.state.scouting.busy) {
    if (scheduled) return null;
    throw new AgentDeskError("SCOUT_BUSY", "A scout scan is already queued or running.");
  }
  if (record.state.scouting.pendingResearch) {
    if (scheduled) return null;
    throw new AgentDeskError("SCOUT_RESEARCH_PENDING", "A selected candidate is waiting for Intelligence Studio. Let the worker hand it off before starting another discovery scan.");
  }
  const settings = record.state.settings.scouting ?? DEFAULT_DESK_SCOUTING;
  if (scheduled && (!settings.enabled || record.state.scouting.nextScanAt && Date.parse(record.state.scouting.nextScanAt) > Date.now())) return null;
  const payload: ScoutPayload = { scanId: randomUUID(), token: randomUUID(), revision, scheduled }, startedAt = now();
  record = await replaceDeskRecord(scope, record, { ...record.state,
    scouting: { ...record.state.scouting, busy: { id: payload.scanId, token: payload.token, jobId: null, startedAt, expiresAt: new Date(Date.now() + LEASE_MS).toISOString(), revision, scheduled }, lastError: null }, updatedAt: startedAt });
  try {
    await requireAgentDeskAccess(scope);
    const current = await readDeskRecord(scope);
    if (!isLease(current, payload)) throw new AgentDeskError("SCOUT_SUPERSEDED", "Scout was cancelled before its job could be queued.");
    const queued = await enqueueBackgroundJob({ context: scope, jobKey: "agent_desk_scout", jobName: "Founder scout discovery",
      payload, idempotencyKey: `agent-desk-scout:${scope.firmId}:${payload.scanId}`, maxAttempts: 1, timeoutMs: 1_200_000, backoffMs: 30_000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      await requireAgentDeskAccess(scope);
      const latest = await readDeskRecord(scope);
      if (!isLease(latest, payload)) { await requestBackgroundJobCancellation({ ...scope, jobId: queued.job.id }).catch(() => undefined); return queued.job.id; }
      if (latest.state.scouting.busy!.jobId === queued.job.id) break;
      try {
        await replaceDeskRecord(scope, latest, { ...latest.state, scouting: { ...latest.state.scouting, busy: { ...latest.state.scouting.busy!, jobId: queued.job.id } } });
        break;
      } catch (error) { if (!(error instanceof AgentDeskError) || error.code !== "DESK_CONFLICT" || attempt === 2) throw error; }
    }
    return queued.job.id;
  } catch (error) {
    // A revoked founder, changed revision or replaced lease is never rewritten by this old request.
    try {
      await requireAgentDeskAccess(scope);
      const latest = await readDeskRecord(scope);
      if (isLease(latest, payload)) await replaceDeskRecord(scope, latest, { ...latest.state, scouting: { ...latest.state.scouting, busy: null, lastError: safeError(error) }, updatedAt: now() });
    } catch { /* The current owner/scheduler can recover a stale lease. */ }
    throw error;
  }
}

function validateSelection(selection: AgentFinding | null, discovery: ScoutDiscovery) {
  if (!selection) return null;
  if (selection.role !== "scout" || selection.action !== "hold" || selection.allocationPct !== null)
    throw new AgentDeskError("SCOUT_RESEARCH_ONLY", "Scout may recommend only a research candidate; it cannot propose an order or allocation.");
  const symbol = selection.candidateSymbol ?? null;
  const allowedIds = new Set(scoutDiscoveryEvidence(discovery).map(row => row.id));
  if ([...selection.findings, ...(selection.messages ?? [])].some(row => row.evidenceIds.some(id => !allowedIds.has(id))))
    throw new AgentDeskError("SCOUT_SELECTION_INVALID", "Scout cited evidence outside the observed candidate inventory.");
  if (!symbol) return null;
  const candidate = discovery.candidates.find(row => row.symbol === symbol);
  const source = scoutDiscoveryEvidence(discovery).find(row => row.metrics.symbol === symbol);
  if (selection.status !== "complete" || !candidate || !source || !selection.findings.some(finding => finding.evidenceIds.includes(source.id)))
    throw new AgentDeskError("SCOUT_SELECTION_INVALID", "Scout selected a symbol without citing its observed inventory record. No replacement candidate was guessed.");
  return symbol;
}

async function commitScout(runtime: DeskScoutRuntime, payload: ScoutPayload, discovery: ScoutDiscovery, selection: AgentFinding | null) {
  const selectedSymbol = validateSelection(selection, discovery), completedAt = now();
  const sourceHash = sha({ discovery, selection });
  for (let attempt = 0; attempt < 3; attempt++) {
    const record = await authorizedLease(runtime.scope, payload, runtime.jobId, runtime.signal);
    const settings = record.state.settings.scouting ?? DEFAULT_DESK_SCOUTING;
    const pendingResearch = selectedSymbol && settings.enabled && settings.autoResearch
      ? { scanId: payload.scanId, symbol: selectedSymbol, selectedAt: completedAt } : null;
    const next = { ...record.state, scouting: { ...record.state.scouting, busy: null, discovery, selection, lastScanAt: completedAt,
      nextScanAt: nextScanAt(record, completedAt), lastError: selection?.status === "failed" ? selection.error ?? "The AI scout did not finish reviewing the candidate inventory." : discovery.candidates.length ? null : "No current verified candidates were available in this scan.",
      pendingResearch }, updatedAt: completedAt };
    try {
      await prisma.$transaction(async transaction => {
        runtime.signal.throwIfAborted();
        await requireAgentDeskAccess(runtime.scope);
        const changed = await transaction.backendPlatformEvent.updateMany({
          where: { id: record.id, ...runtime.scope, eventType: DESK_STATE_EVENT, metadataJson: record.raw },
          data: { metadataJson: encodeDeskEnvelope(next) },
        });
        if (changed.count !== 1) throw new AgentDeskError("DESK_CONFLICT", "The desk changed before Scout could commit its research inventory.");
        await transaction.backendPlatformEvent.create({ data: { ...runtime.scope, eventKey: `agent-desk-scout:${runtime.scope.firmId}:${payload.scanId}`, eventType: DESK_SCOUT_EVENT,
          area: "AgentDeskPrivate", title: "Scout discovery receipt", detail: selectedSymbol ? `${selectedSymbol} selected for research; no trading authorization granted.` : "No candidate selected for further research.",
          status: selection?.status ?? "NoCandidates", sourceType: "PrivateAgentDiscovery", sourceId: payload.scanId,
          metadataJson: encodeDeskEnvelope({ version: 1, owner: runtime.scope, id: payload.scanId, jobId: runtime.jobId, leaseTokenHash: sha(payload.token), settingsRevision: payload.revision, startedAt: record.state.scouting.busy!.startedAt, completedAt,
            discovery, selection, selectedSymbol, sourceHash, queuedForResearch: Boolean(pendingResearch), classification: "research-only", tradingAllowlistChanged: false }) } });
        const evidenceIds = selection ? [...new Set(selection.findings.flatMap(finding => finding.evidenceIds))] : [];
        await appendAgentBoardMessage(runtime.scope, { id: `discovery:${payload.scanId}`, cycleId: payload.scanId, symbol: selectedSymbol ?? record.state.settings.symbol,
          round: 0, phase: "discovery", from: selection ? "scout" : "system", to: "team", replyToIds: [],
          body: selection ? `${selection.summary}\n\n${selectedSymbol ? `${selectedSymbol} is selected for further research.` : "No candidate was selected."} ${pendingResearch ? "The candidate is queued for an Intelligence Studio handoff." : "No automatic research handoff was queued."} Trading permission is unchanged.`
            : "The provider and configured research universe returned no current verified candidates. No AI selection was claimed and no research handoff or order was created.",
          evidenceIds, createdAt: completedAt, researchRunId: null, sourceHash, ...(selection ? { report: selection } : {}) }, transaction);
        for (const [index, message] of (selection?.messages ?? []).entries()) await appendAgentBoardMessage(runtime.scope, {
          id: `discovery:${payload.scanId}:message:${index}`, cycleId: payload.scanId, symbol: selectedSymbol ?? record.state.settings.symbol,
          round: 0, phase: "discovery", from: "scout", to: message.to, replyToIds: message.replyToIds, body: message.body,
          evidenceIds: message.evidenceIds, createdAt: completedAt, researchRunId: null, sourceHash,
        }, transaction);
        runtime.signal.throwIfAborted();
        await requireAgentDeskAccess(runtime.scope);
      });
      return { scanId: payload.scanId, selectedSymbol, queuedForResearch: Boolean(pendingResearch), candidates: discovery.candidates.length, classification: "research-only" as const };
    } catch (error) { if (!(error instanceof AgentDeskError) || error.code !== "DESK_CONFLICT" || attempt === 2) throw error; }
  }
  throw new AgentDeskError("DESK_CONFLICT", "Scout could not commit against the current founder settings.");
}

async function completedScout(runtime: DeskScoutRuntime, payload: ScoutPayload) {
  await requireAgentDeskAccess(runtime.scope);
  runtime.signal.throwIfAborted();
  const row = await prisma.backendPlatformEvent.findFirst({ where: { ...runtime.scope, eventType: DESK_SCOUT_EVENT, eventKey: `agent-desk-scout:${runtime.scope.firmId}:${payload.scanId}` }, select: { metadataJson: true } });
  if (!row) return null;
  const value = decodeDeskEnvelope(row.metadataJson) as { version?: unknown; owner?: DeskScope; id?: unknown; jobId?: unknown; leaseTokenHash?: unknown; settingsRevision?: unknown;
    discovery?: ScoutDiscovery; selection?: AgentFinding | null; sourceHash?: unknown; selectedSymbol?: string | null; queuedForResearch?: boolean; classification?: unknown };
  if (!value || typeof value !== "object" || value.version !== 1 || value.owner?.userId !== runtime.scope.userId || value.owner?.firmId !== runtime.scope.firmId || value.id !== payload.scanId || value.jobId !== runtime.jobId || value.leaseTokenHash !== sha(payload.token) || value.settingsRevision !== payload.revision || value.classification !== "research-only" || !Array.isArray(value.discovery?.candidates) || value.sourceHash !== sha({ discovery: value.discovery, selection: value.selection }))
    throw new AgentDeskError("SCOUT_RECEIPT_INVALID", "The completed scout receipt failed ownership, lease or source verification.", 409);
  return { scanId: payload.scanId, selectedSymbol: value.selectedSymbol ?? null, queuedForResearch: value.queuedForResearch === true, candidates: value.discovery.candidates.length, classification: "research-only" as const, reused: true };
}

/** The durable worker produces research and a private Team Board message only.
 * The main scheduler drains pendingResearch; this module cannot create orders. */
export async function runDeskScoutJob(runtime: DeskScoutRuntime) {
  const payload = payloadOf(runtime.payload);
  const completed = await completedScout(runtime, payload);
  if (completed) return completed;
  const authorize = async () => { await authorizedLease(runtime.scope, payload, runtime.jobId, runtime.signal); };
  try {
    const initial = await authorizedLease(runtime.scope, payload, runtime.jobId, runtime.signal);
    await runtime.progress(5, "Scanning observed market activity and the founder's research universe");
    await authorize();
    const settings = initial.state.settings.scouting ?? DEFAULT_DESK_SCOUTING;
    const discovery = await discoverScoutCandidates(runtime.scope, { signal: runtime.signal, universe: settings.universe, limit: settings.maxCandidates,
      exclude: [initial.state.settings.symbol, initial.state.account.position?.symbol, initial.state.scouting.selection?.candidateSymbol].filter((value): value is string => Boolean(value)) });
    await authorize();
    await runtime.progress(45, "Reviewing candidate provenance and lessons from prior paper outcomes");
    await authorize();
    const [learning, board] = await Promise.all([readAgentLearning(runtime.scope, { limit: 200, now: discovery.checkedAt }), readAgentBoard(runtime.scope, { limit: 24, before: discovery.checkedAt })]);
    await authorize();
    let selection: AgentFinding | null = null;
    if (discovery.candidates.length) {
      const context: AgentContext = { symbol: initial.state.settings.symbol, researchRunId: payload.scanId, collectedAt: discovery.checkedAt, market: null,
        purpose: "discovery", score: null, discovery, learning, board, evidence: scoutDiscoveryEvidence(discovery), gaps: discovery.issues.map(row => row.message),
        policy: initial.state.settings.policy, account: initial.state.account, operationsMode: initial.state.settings.operations?.mode ?? "economy", executionTarget: "local-simulation" };
      selection = await runResearchAgent("scout", context, [], { ownerId: runtime.scope.userId, signal: runtime.signal, authorize, phase: "discovery", round: 0 });
    }
    await authorize();
    await runtime.progress(90, "Saving Scout's cited research selection and Team Board report");
    return await commitScout(runtime, payload, discovery, selection);
  } catch (error) {
    // Cleanup cannot revive an expired/replaced lease or publish late research after revocation.
    try {
      await requireAgentDeskAccess(runtime.scope);
      const record = await readDeskRecord(runtime.scope);
      if (isLease(record, payload, runtime.jobId)) await replaceDeskRecord(runtime.scope, record, { ...record.state, scouting: { ...record.state.scouting, busy: null,
        nextScanAt: nextScanAt(record, now()), lastError: safeError(error) }, updatedAt: now() });
    } catch { /* A later authorized scheduler handles stale lease recovery. */ }
    throw error;
  }
}
