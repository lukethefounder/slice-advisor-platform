import { researchBetaEnabled } from "@/lib/research/beta-policy";
import { assertProviderSuccess } from "./import-errors";
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { PROVIDER, StrategyError, manifestOf, type Dataset } from "./contracts";
import { symbolOf } from "./validation";
import { parseDailyPayload, verifyUsdIdentity } from "./provider-parser";
import { Series } from "./indicators";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
function envInt(key: string, fallback: number, min: number, max: number) { const n = Number(process.env[key]); return Number.isInteger(n) && n >= min && n <= max ? n : fallback; }
export function newYorkToday() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function keyValue() {
  const value = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!value || /^(demo|your[_ -]|changeme|replace)/i.test(value)) throw new StrategyError("PROVIDER_NOT_CONFIGURED", "A private Alpha Vantage API key is required; demo keys and generated substitutes are not allowed.", 503);
  return value;
}
/** Shared, database-backed budget for all imports made by this module. Existing external collectors retain their own guards. */
async function reserveProviderSlot(apiKey: string) {
  const id = sha(`slice-strategy:${apiKey}`), now = new Date(), day = now.toISOString().slice(0, 10);
  const rpm = envInt("SLICE_STRATEGY_AV_REQUESTS_PER_MINUTE", 5, 1, 1200);
  const daily = envInt("SLICE_STRATEGY_AV_REQUESTS_PER_DAY", 25, 1, 1000000);
  const beta = researchBetaEnabled(process.env);
  const spacing = beta ? 0 : Math.ceil(60000 / rpm);
  const delay = await prisma.$transaction(async tx => {
    // Integer advisory lock derived from the key hash; no credential reaches SQL or logs.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${Number.parseInt(id.slice(0, 7), 16)})::text`;
    const row = await tx.sliceProviderQuota.findUnique({ where: { id } });
    const count = row?.day === day ? row.requests : 0;
    if (!beta && count >= daily) throw new StrategyError("DAILY_QUOTA", "Slice's historical-import daily allowance is exhausted. Enable the reviewed beta flag to remove this local allowance; provider limits remain separate.", 429, Math.ceil((Date.parse(`${day}T00:00:00Z`) + 86400000 - now.getTime()) / 1000));
    const wait = beta ? 0 : Math.max(0, (row?.nextAllowedAt.getTime() ?? 0) - now.getTime());
    if (wait > 15000) throw new StrategyError("RATE_LIMITED", "The historical import queue is busy. Retry after other imports finish.", 429, Math.ceil(wait / 1000));
    const state = { day, requests: count + 1, nextAllowedAt: new Date(now.getTime() + wait + spacing) };
    await tx.sliceProviderQuota.upsert({ where: { id }, create: { id, ...state }, update: state });
    return wait;
  }, { timeout: 10000 });
  if (delay) await new Promise(resolve => setTimeout(resolve, delay));
}
async function providerJson(apiKey: string, params: Record<string, string>): Promise<string> {
  await reserveProviderSlot(apiKey);
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("apikey", apiKey);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { Accept: "application/json" } });
    const retry = Number(response.headers.get("retry-after"));
    if (response.status === 429) throw new StrategyError("PROVIDER_RATE_LIMIT", "Alpha Vantage is limiting requests. Saved imports were retained; resume after its allowance reopens.", 429, Number.isFinite(retry) && retry > 0 ? Math.min(86400, Math.ceil(retry)) : 60);
    if (response.status === 401 || response.status === 403) throw new StrategyError("PROVIDER_CREDENTIAL", "Alpha Vantage rejected the server credential or endpoint permission.", response.status);
    if (!response.ok) throw new StrategyError("PROVIDER_HTTP", `Alpha Vantage returned HTTP ${response.status}.`, 502);
    const reader = response.body?.getReader(); if (!reader) throw new StrategyError("PROVIDER_BODY", "Provider returned an empty response.", 502);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const item = await reader.read(); if (item.done) break; size += item.value.length;
      if (size > 6000000) { await reader.cancel(); throw new StrategyError("PROVIDER_RESPONSE_TOO_LARGE", "History response exceeds the import limit.", 502); }
      chunks.push(item.value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    let payload: unknown;
    try { payload = JSON.parse(text); } catch { throw new StrategyError("PROVIDER_JSON", "Alpha Vantage returned unreadable JSON.", 502); }
    assertProviderSuccess(payload, Number.isFinite(retry) && retry > 0 ? retry : 60);
    return text;
  } catch (error) {
    if (error instanceof StrategyError) throw error;
    throw new StrategyError("PROVIDER_TIMEOUT", "Alpha Vantage could not complete the request. Retry; no substitute data was used.", 504);
  } finally { clearTimeout(timeout); }
}
async function performImport(userId: string, rawSymbol: unknown, force = false) {
  const symbol = symbolOf(rawSymbol), apiKey = keyValue();
  const hours = envInt("SLICE_STRATEGY_HISTORY_CACHE_HOURS", 6, 1, 24);
  if (!force) {
    const stored = await prisma.sliceResearchDataset.findFirst({ where: { userId, provider: PROVIDER, symbol, retrievedAt: { gte: new Date(Date.now() - hours * 3600000) } }, orderBy: { retrievedAt: "desc" } });
    if (stored) return { ...manifestOf(hydrate(stored)), cached: true };
  }
  const identityText = await providerJson(apiKey, { function: "SYMBOL_SEARCH", keywords: symbol });
  verifyUsdIdentity(JSON.parse(identityText) as unknown, symbol);
  const text = await providerJson(apiKey, { function: "TIME_SERIES_DAILY_ADJUSTED", symbol, outputsize: "full" });
  const payload = JSON.parse(text) as unknown;
  const bars = parseDailyPayload(payload, symbol, newYorkToday());
  new Series({ id: "pending", symbol, provider: PROVIDER, currency: "USD", bars, retrievedAt: new Date().toISOString(), sourceSha256: sha(text) });
  const duplicate = await prisma.sliceResearchDataset.findFirst({ where: { userId, provider: PROVIDER, symbol, sourceSha256: sha(text), endpoint: "TIME_SERIES_DAILY_ADJUSTED" }, orderBy: { retrievedAt: "desc" } });
  if (duplicate && hydrate(duplicate).bars.at(-1)?.date === bars.at(-1)?.date) return { ...manifestOf(hydrate(duplicate)), cached: true };
  const stored = await prisma.sliceResearchDataset.create({ data: {
    userId, provider: PROVIDER, symbol, currency: "USD", endpoint: "TIME_SERIES_DAILY_ADJUSTED",
    rawJson: text, identityJson: identityText, sourceSha256: sha(text), firstDate: bars[0].date, lastDate: bars.at(-1)!.date, barCount: bars.length,
  } });
  return { ...manifestOf(hydrate(stored)), cached: false };
}
type StoredDataset = { id: string; symbol: string; provider: string; currency: string; rawJson: string; identityJson: string; sourceSha256: string; retrievedAt: Date };
export function hydrate(row: StoredDataset): Dataset {
  if (row.provider !== PROVIDER || row.currency !== "USD" || sha(row.rawJson) !== row.sourceSha256) throw new StrategyError("DATASET_INTEGRITY", "Stored data failed provider/currency/checksum validation.");
  verifyUsdIdentity(JSON.parse(row.identityJson) as unknown, row.symbol);
  // Freeze availability to the import's date; replay never picks up a formerly incomplete bar.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(row.retrievedAt);
  return { id: row.id, symbol: row.symbol, provider: PROVIDER, currency: "USD", retrievedAt: row.retrievedAt.toISOString(), sourceSha256: row.sourceSha256, bars: parseDailyPayload(JSON.parse(row.rawJson) as unknown, row.symbol, today) };
}
export async function loadDatasets(userId: string, ids: string[]) {
  if (!ids.length || ids.length > 13 || new Set(ids).size !== ids.length) throw new StrategyError("DATASET_IDS", "Provide 1–13 unique dataset IDs.");
  const rows = await prisma.sliceResearchDataset.findMany({ where: { userId, id: { in: ids }, provider: PROVIDER } });
  if (rows.length !== ids.length) throw new StrategyError("DATASET_ACCESS", "One or more datasets are missing or not available to this user.", 404);
  return rows.map(hydrate);
}

/** A short database lease prevents duplicate in-flight imports across tabs and server workers. */
export async function importHistory(userId: string, rawSymbol: unknown, force = false) {
  const symbol = symbolOf(rawSymbol), eventKey = `strategy-import-lease:${symbol}`, token = randomUUID();
  const key = { userId_eventKey: { userId, eventKey } };
  const row = await prisma.backendPlatformEvent.upsert({ where: key, update: {}, create: { userId, eventKey,
    eventType: "SLICE_STRATEGY_IMPORT_LEASE_V2", area: "Strategy Lab", title: `Historical import: ${symbol}`,
    severity: "Info", status: "Idle", sourceType: "HistoricalImport", metadataJson: "{}" }, select: { id: true } });
  const claimed = await prisma.backendPlatformEvent.updateMany({ where: { id: row.id, userId, OR: [{ status: { not: "Loading" } }, { updatedAt: { lt: new Date(Date.now() - 120000) } }] }, data: { status: "Loading", detail: token } });
  if (claimed.count !== 1) throw new StrategyError("IMPORT_BUSY", `${symbol} is already being imported. Completed versions remain available; retry shortly.`, 409, 5);
  try { return await performImport(userId, symbol, force); }
  finally { await prisma.backendPlatformEvent.updateMany({ where: { id: row.id, userId, detail: token, status: "Loading" }, data: { status: "Idle", detail: null } }).catch(() => undefined); }
}
