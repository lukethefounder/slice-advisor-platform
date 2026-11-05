/** Beta removes Slice usage allowances, never authorization, provider entitlements, or calculation limits. */
export function researchBetaEnabled(env: Record<string, string | undefined>): boolean {
  const value = (env.SLICE_PULSE_BETA_UNCAPPED ?? "false").trim().toLowerCase();
  if (value !== "true" && value !== "false") throw new Error("SLICE_PULSE_BETA_UNCAPPED must be true or false.");
  return value === "true";
}
export function researchBetaSummary(env: Record<string, string | undefined>) {
  const enabled = researchBetaEnabled(env);
  return { enabled, mode: enabled ? "beta-uncapped" as const : "standard" as const,
    label: enabled ? "Beta research · Slice usage allowances disabled" : "Research · configured Slice allowances",
    coverage: ["Market data gateway", "Historical imports", "Intelligence operation usage and estimated-cost budgets"],
    preserved: ["Authentication and firm permissions", "Provider limits and endpoint entitlements", "Security request protection", "Circuit breakers and concurrency", "Data validation and calculation work limits", "Audit records and frozen scenarios"],
    providerAccess: "not-verified-by-configuration" as const };
}
