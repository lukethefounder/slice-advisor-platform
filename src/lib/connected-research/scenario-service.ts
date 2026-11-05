import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hydrate } from "@/lib/strategy-lab/provider";
import { PROVIDER, StrategyError, type BacktestResult, type StrategySpec } from "@/lib/strategy-lab/contracts";
import { validateSpec } from "@/lib/strategy-lab/validation";
import { digest, freezeJournal, appendObservations, replayForward, validateAssumptions, staticShockImpact, verifyObservationChain, type ScenarioJournal, type SourceBatch, type ForwardResult } from "./scenario-core";
import type { Scope, ScenarioAssumptions } from "./contracts";
const idOf = (v: unknown) => { if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(v)) throw new StrategyError("INVALID_ID", "Select a valid saved record.", 400); return v; };
const versionOf = (v: unknown) => { if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new StrategyError("VERSION_REQUIRED", "Reload the scenario before editing.", 409); return v; };
function nameOf(v: unknown) { if (typeof v !== "string" || !v.trim() || v.trim().length > 100) throw new StrategyError("NAME_REQUIRED", "Use a scenario name of 1–100 characters.", 400); return v.trim(); }
function unpack<T>(text: string, expectedHash?: string | null): T {
  if (expectedHash && digest(text) !== expectedHash) throw new StrategyError("RECORD_INTEGRITY", "A saved record failed its integrity check.", 409);
  try { return JSON.parse(text) as T; } catch { throw new StrategyError("RECORD_FORMAT", "The saved record is not readable.", 409); }
}
function definitionHash(specJson: string, assumptionsJson: string, weightsJson: string) { return digest(specJson + "\n" + assumptionsJson + "\n" + weightsJson); }
const summarySelect = { id: true, name: true, sourceRunId: true, status: true, acceptedSessions: true, lastSession: true, version: true, frozenAt: true, earliestStart: true, lastCheckedAt: true, nextCheckAt: true, lastError: true, createdAt: true, updatedAt: true } as const;
export async function listScenarios(scope: Scope) {
  return prisma.sliceForwardScenario.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 60, select: summarySelect });
}
async function originalRun(scope: Scope, id: string) {
  const run = await prisma.sliceStrategyRun.findFirst({ where: { userId: scope.userId, id } });
  if (!run) throw new StrategyError("SOURCE_NOT_FOUND", "The source strategy run is unavailable to this user.", 404);
  return { row: run, result: unpack<BacktestResult>(run.resultJson, run.outputSha256) };
}
async function owned(scope: Scope, id: string) {
  const row = await prisma.sliceForwardScenario.findFirst({ where: { id, ...scope } });
  if (!row) throw new StrategyError("SCENARIO_NOT_FOUND", "Scenario not found.", 404);
  if (definitionHash(row.specJson, row.assumptionsJson, row.baselineWeightsJson) !== row.definitionHash) throw new StrategyError("DEFINITION_CHANGED", "The frozen definition failed validation.", 409);
  return row;
}
export async function latestScenarioDatasets(scope: Scope, symbols: string[]) {
  // Narrow the result in SQL. Raw datasets are loaded only for calculations, never into the overview payload.
  const rows = await prisma.sliceResearchDataset.findMany({ where: { userId: scope.userId, provider: PROVIDER, symbol: { in: symbols }, endpoint: "TIME_SERIES_DAILY_ADJUSTED" }, orderBy: { retrievedAt: "desc" }, distinct: ["symbol"] });
  if (rows.length !== symbols.length) throw new StrategyError("IMPORT_REQUIRED", "Import a complete history for each selected symbol and benchmark first.", 409);
  return rows.map(hydrate);
}
export async function scenarioDetail(scope: Scope, rawId: unknown, audit = false, after?: string | null) {
  const id = idOf(rawId);
  if (!audit && after) { const marker = await prisma.sliceForwardScenario.findFirst({ where: { ...scope, id }, select: { updatedAt: true, version: true } }); if (!marker) throw new StrategyError("SCENARIO_NOT_FOUND", "Scenario not found.", 404); if (`${marker.version}:${marker.updatedAt.toISOString()}` === after) return { notModified: true as const }; }
  // Overview reads never fetch the large frozen observation journal.
  const row = await prisma.sliceForwardScenario.findFirst({ where: { ...scope, id }, select: { ...summarySelect, specJson: true, assumptionsJson: true, baselineWeightsJson: true, sourcesJson: true, sourcesHash: true, ignoredAdjustedRevisions: true, definitionHash: true, resultJson: true, resultHash: true, journalHash: true } });
  if (!row) throw new StrategyError("SCENARIO_NOT_FOUND", "Scenario not found.", 404);
  if (definitionHash(row.specJson, row.assumptionsJson, row.baselineWeightsJson) !== row.definitionHash) throw new StrategyError("DEFINITION_CHANGED", "The scenario definition failed validation.", 409);
  const spec = unpack<StrategySpec>(row.specJson), assumptions = unpack<ScenarioAssumptions>(row.assumptionsJson);
  const weights = unpack<Record<string, number>>(row.baselineWeightsJson);
  if (row.resultJson && !row.resultHash) throw new StrategyError("RESULT_INTEGRITY", "The saved result is missing its checksum.", 409);
  const result = row.resultJson ? unpack<ForwardResult>(row.resultJson, row.resultHash) : null;
  const dates = await prisma.sliceResearchDataset.findMany({ where: { userId: scope.userId, provider: PROVIDER, symbol: { in: [...new Set([...spec.symbols, spec.benchmark])] } }, distinct: ["symbol"], orderBy: { retrievedAt: "desc" }, select: { id: true, symbol: true, retrievedAt: true, lastDate: true, sourceSha256: true } });
  const sourceReferences = unpack<SourceBatch[]>(row.sourcesJson, row.sourcesHash);
  const observations = audit ? await prisma.sliceScenarioObservation.findMany({ where: { ...scope, scenarioId: row.id }, orderBy: { sessionDate: "asc" }, take: 756 }) : undefined;
  const auditIntegrity = observations && row.frozenAt ? verifyObservationChain(observations, row.definitionHash, row.frozenAt.toISOString(), row.acceptedSessions) : null;
  return { scenario: { id: row.id, name: row.name, status: row.status, version: row.version, sourceRunId: row.sourceRunId, acceptedSessions: row.acceptedSessions, lastSession: row.lastSession, earliestStart: row.earliestStart, frozenAt: row.frozenAt, lastCheckedAt: row.lastCheckedAt, lastError: row.lastError, nextCheckAt: row.nextCheckAt, definitionHash: row.definitionHash, resultHash: row.resultHash, createdAt: row.createdAt, updatedAt: row.updatedAt }, spec, assumptions,
    shock: staticShockImpact(weights, assumptions.shocksPct, spec.initialCapital), result, datasets: dates,
    reviewRequired: Boolean(result && result.calculation.strategy.maxDrawdownPct <= -assumptions.reviewDrawdownPct),
    sources: sourceReferences, ignoredAdjustedRevisions: row.ignoredAdjustedRevisions,
    ...(audit ? { observations, auditIntegrity, journalHash: row.journalHash } : {}) };
}
export async function createScenario(scope: Scope, body: Record<string, unknown>) {
  const source = await originalRun(scope, idOf(body.sourceRunId));
  const spec = validateSpec(source.result.spec), assumptions = validateAssumptions(body.assumptions, spec);
  const count = await prisma.sliceForwardScenario.count({ where: { ...scope, status: { in: ["Draft", "Watching"] } } });
  if (count >= 50) throw new StrategyError("SCENARIO_LIMIT", "Archive unused scenarios before creating more; this workspace allows 50 draft/watching scenarios.", 409);
  const specJson = JSON.stringify(spec), assumptionsJson = JSON.stringify(assumptions), baselineWeightsJson = JSON.stringify(source.result.equity.at(-1)?.weights ?? {});
  const row = await prisma.sliceForwardScenario.create({ data: { ...scope, name: nameOf(body.name), sourceRunId: source.row.id, specJson, assumptionsJson, baselineWeightsJson, definitionHash: definitionHash(specJson, assumptionsJson, baselineWeightsJson) } });
  return row.id;
}
export async function editScenario(scope: Scope, body: Record<string, unknown>) {
  const row = await owned(scope, idOf(body.id));
  if (row.status !== "Draft") throw new StrategyError("FROZEN_SCENARIO", "Launched scenarios cannot be edited. Create a new draft for different assumptions.", 409);
  const assumptionsJson = JSON.stringify(validateAssumptions(body.assumptions, unpack<StrategySpec>(row.specJson)));
  const updated = await prisma.sliceForwardScenario.updateMany({ where: { ...scope, id: row.id, status: "Draft", version: versionOf(body.version) }, data: { name: nameOf(body.name), assumptionsJson, definitionHash: definitionHash(row.specJson, assumptionsJson, row.baselineWeightsJson), version: { increment: 1 } } });
  if (updated.count !== 1) throw new StrategyError("EDIT_CONFLICT", "The draft changed in another tab. Reload it before saving.", 409);
  return row.id;
}
export async function armScenario(scope: Scope, body: Record<string, unknown>) {
  if (body.acknowledgePaperOnly !== true) throw new StrategyError("ACK_REQUIRED", "Acknowledge hypothetical paper tracking before launching.", 400);
  const row = await owned(scope, idOf(body.id));
  if (row.status !== "Draft") throw new StrategyError("ALREADY_REGISTERED", "Only a draft can be launched.", 409);
  const spec = unpack<StrategySpec>(row.specJson);
  const datasets = await latestScenarioDatasets(scope, [...new Set([...spec.symbols, spec.benchmark])]);
  const journal = freezeJournal(spec, datasets), journalJson = JSON.stringify(journal);
  if (Buffer.byteLength(journalJson) > 24000000) throw new StrategyError("JOURNAL_TOO_LARGE", "Reduce the fixed universe; the frozen observation journal exceeds 24 MB.", 422);
  const updated = await prisma.sliceForwardScenario.updateMany({ where: { ...scope, id: row.id, status: "Draft", version: versionOf(body.version) }, data: { status: "Watching", frozenAt: new Date(journal.frozenAt), earliestStart: journal.earliestStart, journalJson, journalHash: digest(journalJson), sourcesJson: JSON.stringify(journal.sources), sourcesHash: digest(JSON.stringify(journal.sources)), nextCheckAt: new Date(), version: { increment: 1 }, lastError: null } });
  if (updated.count !== 1) throw new StrategyError("LAUNCH_CONFLICT", "The scenario was changed or launched in another tab.", 409);
  return row.id;
}
export async function archiveScenario(scope: Scope, body: Record<string, unknown>) {
  const id = idOf(body.id); await owned(scope, id);
  const r = await prisma.sliceForwardScenario.updateMany({ where: { ...scope, id, version: versionOf(body.version) }, data: { status: "Archived", version: { increment: 1 } } });
  if (r.count !== 1) throw new StrategyError("EDIT_CONFLICT", "Reload the scenario before archiving.", 409);
  return id;
}
/** No provider I/O inside the transaction; version CAS and journal insert are committed together. */
export async function advanceScenario(scope: Scope, rawId: unknown) {
  const row = await owned(scope, idOf(rawId));
  if (row.status !== "Watching") throw new StrategyError("NOT_WATCHING", "Only an active forward scenario accepts new observations.", 409);
  const spec = unpack<StrategySpec>(row.specJson), assumptions = unpack<ScenarioAssumptions>(row.assumptionsJson);
  if (!row.journalJson || !row.journalHash) throw new StrategyError("JOURNAL_MISSING", "The frozen observation journal is missing.", 409);
  const journal = unpack<ScenarioJournal>(row.journalJson, row.journalHash);
  if (row.resultJson && !row.resultHash) throw new StrategyError("RESULT_INTEGRITY", "The saved result is missing its checksum.", 409);
  const prior = row.resultJson ? unpack<ForwardResult>(row.resultJson, row.resultHash) : null;
  try {
    const priorObservations = await prisma.sliceScenarioObservation.findMany({ where: { ...scope, scenarioId: row.id }, orderBy: { sessionDate: "asc" }, take: 756, select: { sessionDate: true, payloadJson: true, previousHash: true, recordHash: true } });
    verifyObservationChain(priorObservations, row.definitionHash, journal.frozenAt, row.acceptedSessions);
    const datasets = await latestScenarioDatasets(scope, [...new Set([...spec.symbols, spec.benchmark])]);
    const appended = appendObservations(spec, journal, datasets);
    const result = replayForward(spec, appended, assumptions.targetSessions, prior);
    if (!result || result.acceptedSessions === row.acceptedSessions) {
      await prisma.sliceForwardScenario.updateMany({ where: { ...scope, id: row.id, version: row.version, status: "Watching" }, data: { lastCheckedAt: new Date(), refreshStartedAt: null, lastError: null, nextCheckAt: new Date(Date.now() + 6 * 3600000) } });
      return { id: row.id, appendedSessions: 0, message: "No additional complete eligible session is available. Prior results were preserved." };
    }
    const resultJson = JSON.stringify(result), journalJson = JSON.stringify(appended), sourcesJson = JSON.stringify(appended.sources);
    if (Buffer.byteLength(resultJson) > 4000000 || Buffer.byteLength(journalJson) > 24000000) throw new StrategyError("RESULT_LIMIT", "This scenario exceeds the interactive audit limit. Prior checkpoints are preserved; reduce the universe or target duration in a new scenario.", 422);
    const batchSources = appended.sources.slice(journal.sources.length), acceptedJournalHash = digest(journalJson);
    const last = await prisma.sliceScenarioObservation.findFirst({ where: { ...scope, scenarioId: row.id }, orderBy: { sessionDate: "desc" }, select: { recordHash: true } });
    let previousHash = last?.recordHash ?? digest(row.definitionHash + "\n" + journal.frozenAt);
    const points = result.calculation.equity.filter(p => !row.lastSession || p.date > row.lastSession);
    const observations = points.map(point => {
      const payloadJson = JSON.stringify({ scenarioId: row.id, definitionHash: row.definitionHash, classification: result.classification, equity: point, benchmark: result.calculation.benchmarkEquity.find(p => p.date === point.date), trades: result.calculation.trades.filter(t => t.date === point.date), corporateActions: result.calculation.corporateActions.filter(a => a.date === point.date), sourceBatch: batchSources, acceptedJournalHash, recordedAt: new Date().toISOString() });
      const recordHash = digest(previousHash + "\n" + payloadJson);
      const item = { id: randomUUID(), ...scope, scenarioId: row.id, sessionDate: point.date, payloadJson, previousHash, recordHash }; previousHash = recordHash; return item;
    });
    await prisma.$transaction(async tx => {
      const changed = await tx.sliceForwardScenario.updateMany({ where: { ...scope, id: row.id, version: row.version, status: "Watching" }, data: { resultJson, resultHash: digest(resultJson), journalJson, journalHash: digest(journalJson), sourcesJson, sourcesHash: digest(sourcesJson), ignoredAdjustedRevisions: appended.ignoredAdjustedRevisions, acceptedSessions: result.acceptedSessions, lastSession: result.throughDate, status: result.complete ? "Complete" : "Watching", version: { increment: 1 }, lastCheckedAt: new Date(), refreshStartedAt: null, nextCheckAt: new Date(Date.now() + 6 * 3600000), lastError: null } });
      if (changed.count !== 1) throw new StrategyError("UPDATE_CONFLICT", "Another worker updated this scenario. Reload; no duplicate observation was committed.", 409);
      await tx.sliceScenarioObservation.createMany({ data: observations });
    }, { timeout: 15000 });
    return { id: row.id, appendedSessions: points.length, message: `${points.length} completed session(s) appended. Earlier checkpoints were not changed.` };
  } catch (error) {
    const detail = error instanceof StrategyError ? `${error.code}: ${error.message}` : "The update failed; prior observations remain intact.";
    await prisma.sliceForwardScenario.updateMany({ where: { ...scope, id: row.id, version: row.version }, data: { lastCheckedAt: new Date(), nextCheckAt: new Date(Date.now() + 3600000), lastError: detail.slice(0, 1000) } }).catch(() => undefined);
    throw error;
  }
}
