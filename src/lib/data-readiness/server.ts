import { gatewayPolicy } from "@/lib/market-evidence/gateway-budget";
import "server-only";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-route";
import { RESEARCH_TABLES, configured, storageReport, type Readiness, type StorageRow } from "./core";
let cached: { at: number; rows: StorageRow[] } | null = null;
let pending: Promise<StorageRow[]> | null = null;
/** Only schema metadata is cached. No user data, credentials, or provider results. */
export async function researchStorageRows(): Promise<StorageRow[]> {
 if (cached && Date.now() - cached.at < 5000) return cached.rows;
 if (pending) return pending;
 pending = prisma.$queryRaw<StorageRow[]>`SELECT c.relname AS name,
 has_table_privilege(c.oid, 'SELECT') AS "canRead",
 (has_table_privilege(c.oid, 'INSERT') AND has_table_privilege(c.oid, 'UPDATE')) AS "canWrite",
 c.relrowsecurity AS rls,
 (r.rolsuper OR r.rolbypassrls OR (c.relowner = r.oid AND NOT c.relforcerowsecurity)) AS bypass
 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
 JOIN pg_catalog.pg_roles r ON r.rolname = current_user
 WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND c.relname IN (
 'SliceResearchDataset','SliceStrategyDefinition','SliceStrategyRun','SliceProviderQuota','SliceForecastBundle',
 'SliceForwardScenario','SliceScenarioObservation','SliceResearchRelationship',
 'BackendPlatformEvent','IntelligenceForecastRun','IntelligenceForecastHorizon')`
 .then(rows => { cached = { at: Date.now(), rows }; return rows; }).finally(() => { pending = null; });
 return pending;
}
export async function requireResearchStorage(required: readonly string[] = RESEARCH_TABLES): Promise<void> {
 let rows: StorageRow[];
 try { rows = await researchStorageRows(); }
 catch { throw new ApiError({ status: 503, code: "RESEARCH_DATABASE_UNAVAILABLE", message: "Research storage could not be checked. Verify the runtime database connection. No provider calls were started by this operation.", expose: true }); }
 const report = storageReport(rows, required);
 if (report.missing.length) throw new ApiError({ status: 409, code: "RESEARCH_SCHEMA_REQUIRED", message: `Research storage is not installed in the connected database: ${report.missing.join(", ")}. Apply the reviewed migrations before collecting new research.`, expose: true });
 if (report.restricted.length) throw new ApiError({ status: 409, code: "RESEARCH_DATABASE_ACCESS", message: `The server role lacks the expected access for: ${report.restricted.join(", ")}. Review the server connection role. Keep row-level security enabled.`, expose: true });
}
function displayedGatewayPolicy(): Readiness["providers"]["gatewayBudget"] {
 try { const policy = gatewayPolicy(process.env); return { perMinute: policy.perMinute, perDay: policy.perDay, betaEnabled: policy.enforcement === "beta-uncapped" }; }
 catch { return { perMinute: null, perDay: null, configurationError: "The server market-gateway configuration is invalid. Review its allowance and beta settings; no provider access was verified." }; }
}
export async function readDataReadiness(): Promise<Readiness> {
 const groups = [
  { name: "Forecast & knowledge graph", needs: ["SliceForecastBundle"] },
  { name: "Strategy Lab", needs: ["SliceResearchDataset", "SliceStrategyDefinition", "SliceStrategyRun", "SliceProviderQuota"] },
  { name: "Scenario Studio", needs: ["SliceForwardScenario", "SliceScenarioObservation", "SliceResearchRelationship"] },
  { name: "Market cache & AI conversations", needs: ["BackendPlatformEvent"] },
 ];
 let rows: StorageRow[] = [], unavailable = false;
 try { rows = await researchStorageRows(); } catch { unavailable = true; }
 const all = [...new Set(groups.flatMap(g => g.needs))], report = storageReport(rows, all);
 return { checkedAt: new Date().toISOString(), database: {
  state: unavailable ? "unavailable" : report.ready ? "ready" : "incomplete",
  missing: unavailable ? [] : report.missing, restricted: unavailable ? [] : report.restricted,
  message: unavailable ? "Database connection could not be verified." : report.ready ? "Required table names and server-role access are present. This is not an end-to-end data or column-integrity test." : "Storage setup is blocking one or more modules. An administrator must review the database repair report.",
 }, providers: { alpha: configured(process.env.ALPHA_VANTAGE_API_KEY) ? "configured-unverified" : "missing", openai: configured(process.env.OPENAI_API_KEY) ? "configured-unverified" : "missing", entitlement: ["realtime", "delayed"].includes(process.env.ALPHA_VANTAGE_ENTITLEMENT || "") ? process.env.ALPHA_VANTAGE_ENTITLEMENT! : "historical", gatewayBudget: displayedGatewayPolicy() },
 modules: groups.map(g => ({ ...g, ready: !unavailable && storageReport(rows, g.needs).ready })) };
}
