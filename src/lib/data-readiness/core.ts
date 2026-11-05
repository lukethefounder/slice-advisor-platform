export type StorageRow = { name: string; canRead: boolean; canWrite: boolean; rls: boolean; bypass: boolean };
export const RESEARCH_TABLES = ["SliceResearchDataset", "SliceStrategyDefinition", "SliceStrategyRun", "SliceProviderQuota", "SliceForecastBundle", "SliceForwardScenario", "SliceScenarioObservation", "SliceResearchRelationship"] as const;
export type Readiness = { checkedAt: string; database: { state: "ready" | "incomplete" | "unavailable"; missing: string[]; restricted: string[]; message: string }; providers: { alpha: "configured-unverified" | "missing"; openai: "configured-unverified" | "missing"; entitlement: string; gatewayBudget: { perMinute: number | null; perDay: number | null; betaEnabled?: boolean; configurationError?: string } }; modules: Array<{ name: string; ready: boolean; needs: string[] }> };
export function configured(value: string | undefined): boolean { return Boolean(value?.trim()) && !/^(demo$|your[_ -]|replace|changeme|<)/i.test(value!.trim()); }
export function storageReport(rows: StorageRow[], required: readonly string[] = RESEARCH_TABLES) {
 const byName = new Map(rows.map(row => [row.name, row]));
 const missing = required.filter(name => !byName.has(name));
 const restricted = required.filter(name => { const r = byName.get(name); return r && (!r.canRead || !r.canWrite || (r.rls && !r.bypass)); });
 return { missing: [...missing], restricted: [...restricted], ready: !missing.length && !restricted.length };
}
export function databaseFailure(error: unknown): { code: string; message: string; status: number } | null {
 const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
 if (["P2021", "42P01"].includes(code)) return { code: "RESEARCH_SCHEMA_REQUIRED", status: 409, message: "Required research tables are missing from this database. Apply the reviewed research migrations to the database used by the app; changing an API key will not create these tables." };
 if (["P2022", "42703"].includes(code)) return { code: "RESEARCH_SCHEMA_MISMATCH", status: 409, message: "The database columns do not match the installed code. Review migration history before generating new research." };
 if (["P1010", "42501"].includes(code)) return { code: "RESEARCH_DATABASE_ACCESS", status: 503, message: "The server database role cannot access the required research tables. Review server role permissions; do not disable row-level security or use browser credentials." };
 if (["P1001", "P1002", "P1017", "P2024"].includes(code)) return { code: "RESEARCH_DATABASE_UNAVAILABLE", status: 503, message: "The server could not complete its database connection. Verify the runtime database connection and pool before retrying." };
 return null;
}
export function routeStorageRequirements(pathname: string, write: boolean): string[] {
 if (pathname.startsWith("/api/strategy-lab/datasets")) return write ? ["SliceResearchDataset", "SliceProviderQuota"] : ["SliceResearchDataset"];
 if (pathname.startsWith("/api/strategy-lab/runs")) return write ? ["SliceResearchDataset", "SliceStrategyRun"] : ["SliceStrategyRun"];
 if (pathname.startsWith("/api/strategy-lab/templates")) return ["SliceStrategyDefinition"];
 if (pathname.startsWith("/api/strategy-lab/scenarios")) return ["SliceForwardScenario", "SliceScenarioObservation", "SliceStrategyRun"];
 return [];
}
